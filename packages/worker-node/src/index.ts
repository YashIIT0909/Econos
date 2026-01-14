import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { x402Middleware, X402Request } from './middleware/x402';
import { verifyPaymentMiddleware } from './middleware/verifyPayment';
import { requestContextMiddleware, ContextualRequest } from './middleware/requestContext';
import { signInferenceOutput } from './signer/sign';
import { generateManifest } from './registry/manifest';
import { getWorkerAddress, cronosConfig } from './config/cronos';
import { getService, getServiceNames } from './config/services';
import { hashObject } from './utils/hash';
import { logger, logServiceRequest } from './utils/logger';

// Import all agents
import { createImageGenerationAgent } from './services/image-generation/agent';
import { createSummaryGenerationAgent } from './services/summary-generation/agent';
import { createResearcherAgent } from './services/researcher/agent';
import { createWriterAgent } from './services/writer/agent';
import { createMarketResearchAgent } from './services/market-research/agent';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Initialize agents lazily to allow env vars to load
let agents: Record<string, { execute: (input: unknown) => Promise<unknown> }> | null = null;

function getAgents() {
    if (!agents) {
        agents = {
            'image-generation': createImageGenerationAgent(),
            'summary-generation': createSummaryGenerationAgent(),
            'researcher': createResearcherAgent(),
            'writer': createWriterAgent(),
            'market-research': createMarketResearchAgent(),
        };
    }
    return agents;
}

/**
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'ok',
        worker: getWorkerAddress(),
        network: cronosConfig.networkName,
        chainId: cronosConfig.chainId,
        services: getServiceNames(),
        timestamp: Math.floor(Date.now() / 1000),
    });
});

/**
 * Manifest endpoint - service discovery for master agents
 */
app.get('/manifest', (_req: Request, res: Response) => {
    res.json(generateManifest());
});

/**
 * Unified inference endpoint
 * POST /inference/:serviceName
 * 
 * Flow:
 * 1. x402 middleware - check for payment
 * 2. verifyPayment middleware - verify on-chain payment
 * 3. requestContext middleware - generate request ID
 * 4. Agent execution
 * 5. Sign response with EIP-191
 * 6. Return signed response
 */
app.post(
    '/inference/:serviceName',
    x402Middleware as express.RequestHandler,
    verifyPaymentMiddleware as express.RequestHandler,
    requestContextMiddleware as express.RequestHandler,
    async (req: Request, res: Response) => {
        const contextReq = req as ContextualRequest;
        const serviceName = contextReq.serviceName!;
        const requestId = contextReq.requestId;
        const timestamp = contextReq.requestTimestamp;

        logServiceRequest(serviceName, requestId, 'start');

        try {
            const service = getService(serviceName);
            if (!service) {
                res.status(404).json({ error: 'not_found', message: `Service '${serviceName}' not found` });
                return;
            }

            const agentMap = getAgents();
            const agent = agentMap[serviceName];
            if (!agent) {
                res.status(500).json({ error: 'agent_not_found', message: 'Agent implementation not found' });
                return;
            }

            // Execute agent
            const outputData = await agent.execute(req.body);

            // Create response hash and sign
            const responseHash = hashObject(outputData);
            const signed = await signInferenceOutput(serviceName, requestId, outputData, timestamp);

            // Construct final response
            const response = {
                data: outputData,
                signature: signed.signature,
                requestId,
                worker: getWorkerAddress(),
                timestamp,
                serviceName,
                responseHash,
            };

            logServiceRequest(serviceName, requestId, 'complete');
            res.json(response);
        } catch (error) {
            logServiceRequest(serviceName, requestId, 'error', { error: String(error) });

            if (error instanceof Error && error.name === 'ZodError') {
                res.status(400).json({
                    error: 'validation_error',
                    message: 'Invalid input schema',
                    details: error,
                });
                return;
            }

            res.status(500).json({
                error: 'execution_error',
                message: 'Failed to execute service',
                requestId,
            });
        }
    }
);

/**
 * Error handler
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'internal_error', message: 'An unexpected error occurred' });
});

/**
 * Start server
 */
const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
    logger.info(`🚀 Worker Node started`, {
        port: PORT,
        worker: getWorkerAddress(),
        network: cronosConfig.networkName,
        services: getServiceNames(),
    });

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    ECONOS WORKER NODE                        ║
╠══════════════════════════════════════════════════════════════╣
║  Status:   🟢 Running                                        ║
║  Port:     ${String(PORT).padEnd(49)}║
║  Worker:   ${getWorkerAddress().slice(0, 42).padEnd(49)}║
║  Network:  ${cronosConfig.networkName.padEnd(49)}║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                  ║
║    GET  /health           - Health check                     ║
║    GET  /manifest         - Service discovery                ║
║    POST /inference/:name  - Paid AI inference                ║
╠══════════════════════════════════════════════════════════════╣
║  Services: ${getServiceNames().join(', ').padEnd(49)}║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
