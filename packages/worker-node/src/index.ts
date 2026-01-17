import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { generateManifest } from './registry/manifest';
import { getWorkerAddress, cronosConfig } from './config/cronos';
import { getServiceNames } from './config/services';
import { logger } from './utils/logger';

// Import coordinator module
import { getTaskCoordinator, registerAuthorization, TaskAuthorization } from './coordinator';

const app = express();
app.use(express.json({ limit: '1mb' }));

/**
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
    const coordinatorEnabled = process.env.ENABLE_COORDINATOR === 'true';
    let coordinatorStatus = null;

    if (coordinatorEnabled) {
        try {
            const coordinator = getTaskCoordinator();
            coordinatorStatus = coordinator.getStatus();
        } catch {
            coordinatorStatus = { error: 'Coordinator not initialized' };
        }
    }

    res.json({
        status: 'ok',
        worker: getWorkerAddress(),
        network: cronosConfig.networkName,
        chainId: cronosConfig.chainId,
        services: getServiceNames(),
        coordinator: coordinatorStatus,
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
 * Authorization endpoint - register task authorization before on-chain deposit
 * 
 * This is the x402 flow entry point:
 * 1. Master agent calls POST /authorize/:taskId with EIP-712 signature
 * 2. Master agent deposits to NativeEscrow contract
 * 3. Worker receives TaskCreated event and processes using the registered authorization
 * 4. Worker submits result and receives payment from escrow
 */
app.post('/authorize/:taskId', (req: Request, res: Response) => {
    const rawTaskId = req.params.taskId;
    const taskId: string = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;
    const auth = req.body as TaskAuthorization;

    if (!auth.message || !auth.signature || !auth.payload) {
        res.status(400).json({
            error: 'invalid_authorization',
            message: 'Missing message, signature, or payload',
            required: {
                message: 'EIP-712 TaskAuthorization message (taskId, worker, expiresAt, nonce)',
                signature: 'EIP-712 signature from master agent',
                payload: 'Task payload containing serviceName and params',
            },
        });
        return;
    }

    registerAuthorization(taskId, auth);

    logger.info('Authorization registered via HTTP', { taskId });

    res.json({
        success: true,
        taskId,
        message: 'Authorization registered. Proceed with on-chain deposit to NativeEscrow.',
        nextStep: 'Call NativeEscrow.depositTask(taskId, workerAddress, duration) with payment',
    });
});

/**
 * Tasks endpoint - list all tasks (for monitoring)
 */
app.get('/tasks', (_req: Request, res: Response) => {
    const coordinatorEnabled = process.env.ENABLE_COORDINATOR === 'true';

    if (!coordinatorEnabled) {
        res.status(503).json({
            error: 'coordinator_disabled',
            message: 'Task coordinator is not enabled. Set ENABLE_COORDINATOR=true in .env',
        });
        return;
    }

    try {
        const coordinator = getTaskCoordinator();
        res.json({
            tasks: coordinator.getTasks(),
            stats: coordinator.getStatus().stats,
        });
    } catch (error) {
        res.status(500).json({
            error: 'coordinator_error',
            message: String(error),
        });
    }
});

/**
 * Error handler
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'internal_error', message: 'An unexpected error occurred' });
});

/**
 * Start server and coordinator
 */
const PORT = parseInt(process.env.PORT || '3001', 10);
const ENABLE_COORDINATOR = process.env.ENABLE_COORDINATOR === 'true';

const server = app.listen(PORT, async () => {
    logger.info(`🚀 Worker Node started`, {
        port: PORT,
        worker: getWorkerAddress(),
        network: cronosConfig.networkName,
        services: getServiceNames(),
        coordinatorEnabled: ENABLE_COORDINATOR,
    });

    // Start coordinator if enabled
    if (ENABLE_COORDINATOR) {
        try {
            const coordinator = getTaskCoordinator();
            await coordinator.start();
            logger.info('✅ Task Coordinator started - listening for on-chain events');
        } catch (error) {
            logger.error('❌ Failed to start Task Coordinator', { error });
            console.error('Task Coordinator failed to start. Check contract addresses in .env');
        }
    }

    const coordStatus = ENABLE_COORDINATOR ? '🟢 Active' : '⚪ Disabled';

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    ECONOS WORKER NODE                        ║
╠══════════════════════════════════════════════════════════════╣
║  Status:   🟢 Running                                        ║
║  Port:     ${String(PORT).padEnd(49)}║
║  Worker:   ${getWorkerAddress().slice(0, 42).padEnd(49)}║
║  Network:  ${cronosConfig.networkName.padEnd(49)}║
║  Coordinator: ${coordStatus.padEnd(46)}║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                  ║
║    GET  /health           - Health check                     ║
║    GET  /manifest         - Service discovery                ║
║    GET  /tasks            - List coordinator tasks           ║
║    POST /authorize/:id    - Register task authorization      ║
╠══════════════════════════════════════════════════════════════╣
║  Services: ${getServiceNames().join(', ').padEnd(49)}║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...');
    if (ENABLE_COORDINATOR) {
        const coordinator = getTaskCoordinator();
        coordinator.stop();
    }
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down...');
    if (ENABLE_COORDINATOR) {
        const coordinator = getTaskCoordinator();
        coordinator.stop();
    }
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

export default app;
