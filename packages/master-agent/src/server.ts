import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import { runAgentWorkflow } from './services/workflow';
import { getMasterWallet } from './config/cronos';
import pipelineRoutes from './routes/pipeline';
import aiRoutes, { setOrchestrator } from './routes/ai';
import { MasterAgentOrchestrator } from './services/masterAgentOrchestrator';

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURATION
const WORKER_ENDPOINT = process.env.WORKER_ENDPOINT ?? "http://localhost:3001";
const WORKER_ADDRESS = process.env.WORKER_ADDRESS ?? "0xB0BeC85Fd4B334048f6B1C4733ea51BfAe6c3Dd0";
const MASTER_WALLET = getMasterWallet().address; // The wallet receiving payments
const RPC_URL = process.env.CRONOS_RPC_URL || "https://evm-t3.cronos.org/";

// DYNAMIC PRICING (TCRO)
const PRICES: Record<string, string> = {
    'summary-generation': '0.02',
    'image-generation': '0.02',
    'researcher': '0.05',
    'default': '0.01'
};

// Initialize AI Orchestrator for chat mode
const orchestrator = new MasterAgentOrchestrator({
    knownWorkers: [
        { address: WORKER_ADDRESS, endpoint: WORKER_ENDPOINT }
    ],
    autoStartMonitor: false // Don't need lifecycle monitoring for AI chat
});
setOrchestrator(orchestrator);
console.log('🤖 AI Orchestrator initialized');

/**
 * MIDDLEWARE: L402 Payment Guard
 * 1. Checks if the request has an L402 Authorization header.
 * 2. If NO: Returns 402 Payment Required with invoice details.
 * 3. If YES: Verifies the transaction on-chain.
 */
async function paymentGuard(req: Request, res: Response, next: NextFunction) {
    try {
        const { taskType } = req.body;

        // 1. Determine Price
        const price = PRICES[taskType as string] || PRICES['default'];

        // 2. Check for L402 Header (Standard: "Authorization: L402 <token>")
        const authHeader = req.headers['authorization'] || req.headers['x-payment-token'];

        if (!authHeader || !String(authHeader).startsWith('L402')) {
            console.log(`🛑 Access Denied: Payment Required for ${taskType} (${price} TCRO)`);

            // Standard L402 Response
            res.set('WWW-Authenticate', `L402 type="transaction", amount="${price}", token="TCRO", recipient="${MASTER_WALLET}"`);
            res.status(402).json({
                error: "Payment Required",
                message: "Please pay the required amount to the Master Wallet.",
                paymentDetails: {
                    amount: price,
                    currency: "TCRO",
                    recipient: MASTER_WALLET,
                    chainId: 338 // Cronos Testnet
                }
            });
            return;
        }

        // 3. Verify Payment Logic
        const txHash = String(authHeader).split(' ')[1]; // Extract Hash
        console.log(`💰 Verifying payment: ${txHash}...`);

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const tx = await provider.getTransaction(txHash);

        // Validation Checks
        if (!tx) {
            throw new Error("Transaction not found on chain");
        }
        if (tx.to?.toLowerCase() !== MASTER_WALLET.toLowerCase()) {
            throw new Error(`Invalid Recipient: Paid to ${tx.to}, expected ${MASTER_WALLET}`);
        }

        // Check Value (Allow small float discrepancies with parseEther)
        const paidValue = BigInt(tx.value);
        const requiredValue = ethers.parseEther(price);

        if (paidValue < requiredValue) {
            throw new Error(`Insufficient Payment: Paid ${ethers.formatEther(paidValue)}, needed ${price}`);
        }

        // (Optional) Replay Protection: Check if txHash was already used in your DB
        // await checkTxReplay(txHash); 

        console.log(`✅ Payment Verified! Starting job.`);
        next();

    } catch (error: any) {
        console.error("❌ Payment Verification Failed:", error.message);
        res.status(403).json({ error: "Invalid Payment", details: error.message });
        return;
    }
}

/**
 * MAIN ENDPOINT: Hire an Agent
 * Protected by L402 paymentGuard
 */
app.post('/hire', paymentGuard, async (req: Request, res: Response) => {
    try {
        const { taskType, params } = req.body;

        // Validate Inputs
        if (!taskType || !params) {
            return res.status(400).json({ error: "Missing required fields: taskType, params" });
        }

        // Get Price (Again, for the internal workflow)
        const price = PRICES[taskType as string] || PRICES['default'];

        // Execute Autonomous Workflow
        // The paymentGuard ensures we (The Master) have received funds, 
        // so now we can safely spend our own gas to hire the Worker.
        const result = await runAgentWorkflow(
            taskType,
            params,
            price,
            WORKER_ENDPOINT,
            WORKER_ADDRESS
        );

        // Return Final Result
        return res.json({
            success: true,
            taskId: result.taskId,
            status: "COMPLETED",
            depositTx: result.txHash,
            output: result.output, // The JSON result from the Worker
        });

    } catch (error: any) {
        console.error("API Execution Error:", error);
        return res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

/**
 * ==========================
 * 🔌 SUPABASE TEST ENDPOINT
 * ==========================
 */
app.get('/test-supabase', async (req: Request, res: Response) => {
    try {
        const { prompt, params } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Missing 'prompt' field" });
        }

        console.log(`🧠 Analyzing task: "${prompt.slice(0, 50)}..."`);

        // Step 1: Fetch workers from CONTRACT (same as /workers/contract)
        const registry = getWorkerRegistryContract();
        const metadataPointers = await registry.getAllWorkers() as string[];

        console.log(`📊 Found ${metadataPointers.length} workers on contract`);

        // Step 2: Fetch all addresses and worker data in parallel
        const workerPromises = [];
        for (let i = 0; i < metadataPointers.length; i++) {
            workerPromises.push(registry.workerAddresses(i));
        }
        const addresses = await Promise.all(workerPromises);
        const workerDataPromises = addresses.map(addr => registry.workers(addr));
        const workersData = await Promise.all(workerDataPromises);

        // Step 3: Extract UUIDs and fetch from Supabase
        const metadataIds = metadataPointers.map(p => bytes32ToUuid(p));
        let agentMetadata: Record<string, any> = {};

        if (SUPABASE_KEY && metadataIds.length > 0) {
            try {
                const response = await fetch(
                    `${SUPABASE_URL}/rest/v1/agent_metadata?id=in.(${metadataIds.join(',')})`,
                    {
                        headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${SUPABASE_KEY}`,
                        },
                    }
                );
                if (response.ok) {
                    const agents = await response.json() as any[];
                    for (const agent of agents) {
                        agentMetadata[agent.wallet_address?.toLowerCase()] = agent;
                    }
                }
            } catch (err) {
                console.warn('Failed to fetch Supabase metadata:', err);
            }
        }

        // Step 4: Build available services list from Supabase data
        interface AgentInfo {
            address: string;
            name: string;
            description: string | null;
            category: string | null;
            endpoint: string | null;
            price: string | null;
            reputation: number;
        }
        const availableAgents: AgentInfo[] = [];
        const serviceTypes = new Set<string>();

        for (let i = 0; i < metadataPointers.length; i++) {
            const worker = workersData[i];
            const metadata = agentMetadata[worker.walletAddress.toLowerCase()];

            if (worker.isActive && metadata) {
                // Parse capabilities to extract service types
                let capabilities: string[] = [];
                if (metadata.capabilities) {
                    try {
                        const cap = JSON.parse(metadata.capabilities);
                        capabilities = Object.keys(cap.inputSchema || {});
                    } catch { }
                }

                availableAgents.push({
                    address: worker.walletAddress,
                    name: metadata.name,
                    description: metadata.description,
                    category: metadata.category,
                    endpoint: metadata.endpoint,
                    price: metadata.price,
                    reputation: Number(worker.reputation),
                });

                // Use category as service type
                if (metadata.category) {
                    serviceTypes.add(metadata.category);
                }
                if (metadata.name) {
                    serviceTypes.add(metadata.name.toLowerCase().replace(/\s+/g, '-'));
                }
            }
        }

        console.log(`📋 Found ${availableAgents.length} active agents with metadata`);

        // Step 5: Analyze prompt for multi-agent pipeline
        const promptLower = prompt.toLowerCase();

        // Helper function to find agent by keyword
        const findAgent = (keyword: string) => {
            return availableAgents.find(agent => {
                const name = agent.name?.toLowerCase() || '';
                const desc = agent.description?.toLowerCase() || '';
                return name.includes(keyword) || desc.includes(keyword);
            });
        };

        // Detect multi-step patterns: "and", "then", multiple keywords
        const hasResearch = promptLower.includes('research');
        const hasSummary = promptLower.includes('summar');
        const hasMarket = promptLower.includes('market');
        const hasImage = promptLower.includes('image');
        const hasMultipleSteps = (promptLower.includes(' and ') || promptLower.includes(' then ') ||
            promptLower.includes('after that') || promptLower.includes('finally'));

        // Count how many tasks are mentioned
        const taskCount = [hasResearch, hasSummary, hasMarket, hasImage].filter(Boolean).length;
        const isMultiAgent = taskCount > 1 || hasMultipleSteps;

        const steps: any[] = [];
        let totalBudget = 0;

        if (isMultiAgent) {
            // Multi-agent pipeline - add steps in logical order
            let order = 1;

            if (hasResearch) {
                const agent = findAgent('research');
                if (agent) {
                    steps.push({
                        order: order++,
                        serviceType: 'researcher',
                        description: 'Research and gather information',
                        workerAddress: agent.address,
                        workerName: agent.name,
                        workerEndpoint: agent.endpoint,
                        price: agent.price,
                        inputFrom: 'user',
                    });
                    totalBudget += parseFloat(agent.price || '0');
                }
            }

            if (hasMarket) {
                const agent = findAgent('market');
                if (agent) {
                    steps.push({
                        order: order++,
                        serviceType: 'market-research',
                        description: 'Analyze market data and trends',
                        workerAddress: agent.address,
                        workerName: agent.name,
                        workerEndpoint: agent.endpoint,
                        price: agent.price,
                        inputFrom: steps.length > 0 ? 'previous' : 'user',
                    });
                    totalBudget += parseFloat(agent.price || '0');
                }
            }

            if (hasSummary) {
                const agent = findAgent('summary');
                if (agent) {
                    steps.push({
                        order: order++,
                        serviceType: 'summary-generation',
                        description: 'Summarize the results',
                        workerAddress: agent.address,
                        workerName: agent.name,
                        workerEndpoint: agent.endpoint,
                        price: agent.price,
                        inputFrom: steps.length > 0 ? 'previous' : 'user',
                    });
                    totalBudget += parseFloat(agent.price || '0');
                }
            }

            if (hasImage) {
                const agent = findAgent('image');
                if (agent) {
                    steps.push({
                        order: order++,
                        serviceType: 'image-generation',
                        description: 'Generate visual representation',
                        workerAddress: agent.address,
                        workerName: agent.name,
                        workerEndpoint: agent.endpoint,
                        price: agent.price,
                        inputFrom: steps.length > 0 ? 'previous' : 'user',
                    });
                    totalBudget += parseFloat(agent.price || '0');
                }
            }
        }

        // Fallback to single agent if no multi-agent detected
        if (steps.length === 0) {
            let selectedAgent = availableAgents[0];
            let serviceType = 'general';

            for (const agent of availableAgents) {
                const name = agent.name?.toLowerCase() || '';
                const desc = agent.description?.toLowerCase() || '';

                if (hasResearch && (name.includes('research') || desc.includes('research'))) {
                    selectedAgent = agent;
                    serviceType = 'researcher';
                    break;
                } else if (hasSummary && (name.includes('summary') || desc.includes('summary'))) {
                    selectedAgent = agent;
                    serviceType = 'summary-generation';
                    break;
                } else if (hasMarket && (name.includes('market') || desc.includes('market'))) {
                    selectedAgent = agent;
                    serviceType = 'market-research';
                    break;
                } else if (hasImage && (name.includes('image') || desc.includes('image'))) {
                    selectedAgent = agent;
                    serviceType = 'image-generation';
                    break;
                }
            }

            steps.push({
                order: 1,
                serviceType,
                description: `Execute with ${selectedAgent?.name || 'selected agent'}`,
                workerAddress: selectedAgent?.address,
                workerName: selectedAgent?.name,
                workerEndpoint: selectedAgent?.endpoint,
                price: selectedAgent?.price,
                inputFrom: 'user',
            });
            totalBudget = parseFloat(selectedAgent?.price || '0');
        }

        // Return the analysis
        return res.json({
            success: true,
            analysis: {
                isSingleAgent: steps.length === 1,
                reasoning: steps.length > 1
                    ? `Multi-agent pipeline detected: ${steps.map(s => s.workerName).join(' → ')}`
                    : `Selected "${steps[0]?.workerName}" based on prompt analysis`,
                estimatedBudget: `${totalBudget * 1e18}`,
                steps,
            },
            capabilities: {
                availableServices: Array.from(serviceTypes),
                workerCount: availableAgents.length,
                agents: availableAgents.map(a => ({
                    name: a.name,
                    category: a.category,
                    price: a.price,
                    address: a.address,
                })),
            }
        });

    } catch (error: any) {
        console.error("Analysis Error:", error);
        return res.status(500).json({ error: error.message || "Analysis failed" });
    }
});

/**
 * AI-POWERED ENDPOINT: Analyze AND Execute
 * Full pipeline: Analyze → Select Workers → Execute
 */
app.post('/orchestrate', paymentGuard, async (req: Request, res: Response) => {
    try {
        const { prompt, params } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Missing 'prompt' field" });
        }

        console.log(`🚀 Orchestrating task: "${prompt.slice(0, 50)}..."`);

        // Execute the full AI-powered flow
        const result = await orchestrator.analyzeAndSubmit(prompt, {}, params || {});

        return res.json({
            success: result.success,
            executionType: result.executionType,
            plan: {
                isSingleAgent: result.plan.isSingleAgent,
                reasoning: result.plan.reasoning,
                steps: result.plan.steps.map(s => ({
                    serviceType: s.serviceType,
                    worker: s.assignedWorker,
                }))
            },
            result: result.result,
        });

    } catch (error: any) {
        console.error("Orchestration Error:", error);
        return res.status(500).json({ error: error.message || "Orchestration failed" });
    }
});



/**
 * LIST WORKERS FROM CONTRACT: Fetch registered workers from WorkerRegistry + Supabase metadata
 */
import { getWorkerRegistryContract } from './config/contracts';

// Supabase configuration (use the same keys as frontend)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jmbqxdlzfktohtakeyxo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

/**
 * Convert bytes32 metadataPointer to UUID
 * Matches the marketplace frontend implementation
 */
function bytes32ToUuid(bytes32: string): string {
    // Remove 0x prefix and leading zeros (UUID is 32 hex chars = 16 bytes)
    const hex = bytes32.slice(2).replace(/^0+/, '');
    // Pad to 32 chars if needed
    const paddedHex = hex.padStart(32, '0');
    // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    return `${paddedHex.slice(0, 8)}-${paddedHex.slice(8, 12)}-${paddedHex.slice(12, 16)}-${paddedHex.slice(16, 20)}-${paddedHex.slice(20, 32)}`;
}

app.get('/workers/contract', async (req: Request, res: Response) => {
    try {
        const registry = getWorkerRegistryContract();

        // Step 1: Get all metadata pointers in ONE contract call (like marketplace does)
        const metadataPointers = await registry.getAllWorkers() as string[];
        const count = metadataPointers.length;

        console.log(`📊 Found ${count} workers in contract`);

        // Step 2: Fetch worker details in PARALLEL
        const workerPromises = [];
        for (let i = 0; i < count; i++) {
            workerPromises.push(registry.workerAddresses(i));
        }
        const addresses = await Promise.all(workerPromises);

        // Step 3: Fetch worker data in PARALLEL
        const workerDataPromises = addresses.map(addr => registry.workers(addr));
        const workersData = await Promise.all(workerDataPromises);

        // Step 4: Build contract workers array and extract UUIDs
        const contractWorkers = [];
        const metadataIds: string[] = [];

        for (let i = 0; i < count; i++) {
            const worker = workersData[i];
            const metadataId = bytes32ToUuid(metadataPointers[i]);
            metadataIds.push(metadataId);

            contractWorkers.push({
                address: worker.walletAddress,
                metadataPointer: metadataPointers[i],
                metadataId,
                reputation: Number(worker.reputation),
                isActive: worker.isActive,
                registrationTime: Number(worker.registrationTime),
            });
        }

        console.log('🔍 UUIDs generated:', metadataIds);
        console.log('🔑 Supabase key available:', !!SUPABASE_KEY);

        // Step 2: Fetch agent metadata from Supabase
        let agentMetadata: Record<string, any> = {};

        if (SUPABASE_KEY && metadataIds.length > 0) {
            try {
                const url = `${SUPABASE_URL}/rest/v1/agent_metadata?id=in.(${metadataIds.join(',')})`;
                console.log('📡 Supabase URL:', url);

                const response = await fetch(url, {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                    },
                });

                console.log('📨 Supabase response status:', response.status);

                if (response.ok) {
                    const agents = await response.json() as any[];
                    console.log('📦 Agents fetched:', agents.length, agents);
                    for (const agent of agents) {
                        agentMetadata[agent.wallet_address?.toLowerCase()] = agent;
                    }
                    console.log(`📦 Fetched ${agents.length} agent metadata from Supabase`);
                } else {
                    console.log('❌ Supabase error:', await response.text());
                }
            } catch (err) {
                console.warn('Failed to fetch Supabase metadata:', err);
            }
        }

        // Step 3: Merge contract data with Supabase metadata
        const workers = contractWorkers.map(w => {
            const metadata = agentMetadata[w.address.toLowerCase()];
            return {
                // On-chain data
                address: w.address,
                reputation: w.reputation,
                isActive: w.isActive,
                registrationTime: w.registrationTime,
                // Supabase metadata
                name: metadata?.name || `Worker ${w.address.slice(0, 8)}`,
                description: metadata?.description || null,
                category: metadata?.category || null,
                endpoint: metadata?.endpoint || null,
                capabilities: metadata?.capabilities || null,
                price: metadata?.price || null,
            };
        });

        return res.json({
            source: 'WorkerRegistry contract + Supabase',
            totalRegistered: Number(count),
            workers,
        });
    } catch (error: any) {
        console.error('Contract fetch error:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'master-agent', timestamp: new Date().toISOString() });
});

// SSE Events endpoint for flow visualization
import { eventStreamer } from './services/eventStreamer';

app.get('/events', (req: Request, res: Response) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection event
    res.write(`data: ${JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
        message: '✅ Connected to Master Agent event stream'
    })}\n\n`);

    // Register client with event streamer
    const removeClient = eventStreamer.addClient((event) => {
        try {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch (e) {
            console.error('SSE write error:', e);
        }
    });

    // Handle client disconnect
    req.on('close', () => {
        removeClient();
        console.log('📡 SSE client disconnected from Master Agent');
    });

    console.log('📡 SSE client connected to Master Agent');
});

// Main execute endpoint with L402 payment
app.post('/execute', paymentGuard, async (req: Request, res: Response) => {
    const { taskType, params } = req.body;
    
    try {
        const price = PRICES[taskType] || PRICES['default'];
        const result = await runAgentWorkflow(
            taskType,
            params,
            price, // budget in ETH
            WORKER_ENDPOINT,
            WORKER_ADDRESS
        );
        
        res.json({
            success: true,
            taskId: result.taskId,
            output: result.output
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Register pipeline routes
app.use('/pipeline', pipelineRoutes);

// Register AI routes for chat mode
app.use('/ai', aiRoutes);

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Master Agent running on port ${PORT}`);
    console.log(`📋 Endpoints:`);
    console.log(`   - POST /execute (with L402 payment)`);
    console.log(`   - GET  /health`);
    console.log(`   - GET  /events (SSE flow visualization)`);
    console.log(`   - POST /pipeline/execute-pipeline`);
    console.log(`   - GET  /pipeline/:id/status`);
    console.log(`   - POST /ai/analyze (AI chat mode)`);
    console.log(`   - POST /ai/execute (AI chat execution)`);
    console.log(`   - GET  /ai/capabilities`);
    console.log(`\n💡 Master Wallet: ${MASTER_WALLET}`);
});