import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import { runAgentWorkflow } from './services/workflow';
import { getMasterWallet } from './config/cronos'; // Ensure this path matches your project structure

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

// START SERVER
const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
    console.log(`🤖 Master Agent Gateway running on port ${PORT}`);
    console.log(`💳 Accepting Payments at: ${MASTER_WALLET}`);
    console.log(`--------------------------------------------------`);
});