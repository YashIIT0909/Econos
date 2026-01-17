/**
 * Task Coordinator
 * 
 * Main orchestrator for the x402 worker flow:
 * 1. Listens for TaskCreated events
 * 2. Verifies EIP-712 authorization
 * 3. Dispatches to appropriate agent for compute
 * 4. Canonicalizes results and submits on-chain
 * 5. Tracks task lifecycle
 */

import { getContractService, ContractService, TaskCreatedEvent, toBytes32 } from './contractService';
import { getAuthorizationVerifier, AuthorizationVerifier, TaskAuthorization } from './authorizationVerifier';
import { getTaskStateManager, TaskStateManager, TaskState } from './taskStateManager';
import { computeResultHash, prepareResult } from './resultCanonicalizer';
import { getWorkerAddress } from '../config/cronos';
import { logger } from '../utils/logger';

// Import agent factory functions
import { createImageGenerationAgent } from '../services/image-generation/agent';
import { createSummaryGenerationAgent } from '../services/summary-generation/agent';
import { createResearcherAgent } from '../services/researcher/agent';
import { createWriterAgent } from '../services/writer/agent';
import { createMarketResearchAgent } from '../services/market-research/agent';

/**
 * Agent interface for executing tasks
 */
interface Agent {
    execute(input: unknown): Promise<unknown>;
}

/**
 * Map service names to agent factories
 */
const agentFactories: Record<string, () => Agent> = {
    'image-generation': createImageGenerationAgent,
    'summary-generation': createSummaryGenerationAgent,
    'researcher': createResearcherAgent,
    'writer': createWriterAgent,
    'market-research': createMarketResearchAgent,
};

/**
 * Authorization data storage
 * Maps taskId -> TaskAuthorization
 * 
 * In a production system, this would be fetched from IPFS or a separate endpoint.
 * For now, master agents can POST authorization data to a dedicated endpoint.
 */
const pendingAuthorizations: Map<string, TaskAuthorization> = new Map();

/**
 * Register authorization data for a pending task
 * Called via HTTP endpoint before the on-chain deposit
 */
export function registerAuthorization(taskId: string, auth: TaskAuthorization): void {
    pendingAuthorizations.set(taskId, auth);
    logger.debug('Authorization registered', { taskId });
}

/**
 * Get and remove authorization for a task
 */
function consumeAuthorization(taskId: string): TaskAuthorization | undefined {
    const auth = pendingAuthorizations.get(taskId);
    if (auth) {
        pendingAuthorizations.delete(taskId);
    }
    return auth;
}

/**
 * Task Coordinator
 * 
 * Orchestrates the entire task lifecycle from event to settlement.
 */
export class TaskCoordinator {
    private contractService: ContractService;
    private authVerifier: AuthorizationVerifier;
    private stateManager: TaskStateManager;
    private workerAddress: string;
    private agents: Record<string, Agent> = {};
    private unsubscribeTaskCreated: (() => void) | null = null;
    private unsubscribeTaskCompleted: (() => void) | null = null;
    private isRunning: boolean = false;

    constructor() {
        this.contractService = getContractService();
        this.authVerifier = getAuthorizationVerifier();
        this.stateManager = getTaskStateManager();
        this.workerAddress = getWorkerAddress();
    }

    /**
     * Initialize agents lazily
     */
    private getAgent(serviceName: string): Agent | undefined {
        if (!this.agents[serviceName]) {
            const factory = agentFactories[serviceName];
            if (factory) {
                this.agents[serviceName] = factory();
            }
        }
        return this.agents[serviceName];
    }

    /**
     * Start listening for TaskCreated events
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('TaskCoordinator already running');
            return;
        }

        // Check if worker is active in registry
        const isActive = await this.contractService.isWorkerActive();
        if (!isActive) {
            logger.warn('Worker is not active in registry. Event listening will start but tasks may not be accepted.');
        }

        // Subscribe to TaskCreated events
        this.unsubscribeTaskCreated = this.contractService.onTaskCreated(
            this.handleTaskCreated.bind(this)
        );

        // Subscribe to TaskCompleted events (for confirmation)
        this.unsubscribeTaskCompleted = this.contractService.onTaskCompleted(
            this.handleTaskCompleted.bind(this)
        );

        this.isRunning = true;

        logger.info('TaskCoordinator started', {
            worker: this.workerAddress,
            escrow: this.contractService.getEscrowAddress(),
        });
    }

    /**
     * Stop listening and cleanup
     */
    stop(): void {
        if (this.unsubscribeTaskCreated) {
            this.unsubscribeTaskCreated();
            this.unsubscribeTaskCreated = null;
        }
        if (this.unsubscribeTaskCompleted) {
            this.unsubscribeTaskCompleted();
            this.unsubscribeTaskCompleted = null;
        }
        this.isRunning = false;
        logger.info('TaskCoordinator stopped');
    }

    /**
     * Handle TaskCreated event
     */
    private async handleTaskCreated(event: TaskCreatedEvent): Promise<void> {
        const { taskId, master, amount } = event;

        logger.info('TaskCreated event received', {
            taskId,
            master,
            amount: amount.toString(),
        });

        try {
            // Get task from chain to verify and get deadline
            const onChainTask = await this.contractService.getTask(taskId);
            if (!onChainTask) {
                logger.error('Task not found on chain', { taskId });
                return;
            }

            // Create task record
            this.stateManager.createTask(
                taskId,
                taskId,
                master,
                amount,
                onChainTask.deadline
            );

            // Get authorization (should have been registered via HTTP endpoint)
            const auth = consumeAuthorization(taskId);
            if (!auth) {
                logger.error('No authorization found for task', { taskId });
                this.stateManager.markFailed(taskId, 'No authorization data found');
                return;
            }

            // Verify authorization
            const authResult = this.authVerifier.verifyAuthorization(
                auth,
                master,
                this.workerAddress
            );

            if (!authResult.valid) {
                logger.error('Authorization verification failed', {
                    taskId,
                    error: authResult.error,
                });
                this.stateManager.markFailed(taskId, authResult.error || 'Authorization failed');
                return;
            }

            // Mark authorized
            this.stateManager.markAuthorized(
                taskId,
                auth.payload.serviceName,
                auth.payload.params
            );

            // Execute task
            await this.executeTask(taskId, auth.payload.serviceName, auth.payload.params);

        } catch (error) {
            logger.error('Error handling TaskCreated event', { taskId, error });
            this.stateManager.markFailed(taskId, String(error));
        }
    }

    /**
     * Execute the compute task
     */
    private async executeTask(
        taskId: string,
        serviceName: string,
        params: unknown
    ): Promise<void> {
        // Mark as running
        this.stateManager.markRunning(taskId);

        try {
            // Get agent
            const agent = this.getAgent(serviceName);
            if (!agent) {
                throw new Error(`Unknown service: ${serviceName}`);
            }

            logger.info('Executing task', { taskId, serviceName });

            // Execute agent
            const result = await agent.execute(params);

            logger.info('Task execution completed', { taskId });

            // Prepare and submit result
            await this.submitResult(taskId, result);

        } catch (error) {
            logger.error('Task execution failed', { taskId, error });
            this.stateManager.markFailed(taskId, String(error));
        }
    }

    /**
     * Submit result to chain
     */
    private async submitResult(taskId: string, result: unknown): Promise<void> {
        try {
            // Canonicalize and hash result
            const prepared = prepareResult(result);

            logger.info('Submitting result on-chain', {
                taskId,
                resultHash: prepared.hash,
            });

            // Submit to contract
            const txHash = await this.contractService.submitWork(taskId, prepared.hash);

            // Mark as submitted
            this.stateManager.markSubmitted(taskId, prepared.hash, txHash);

            logger.info('Result submitted', { taskId, txHash });

        } catch (error) {
            logger.error('Failed to submit result', { taskId, error });
            this.stateManager.markFailed(taskId, `Submit failed: ${error}`);
        }
    }

    /**
     * Handle TaskCompleted event (confirmation)
     */
    private handleTaskCompleted(taskId: string, resultHash: string): void {
        logger.info('TaskCompleted event received', { taskId, resultHash });

        const task = this.stateManager.getTask(taskId);
        if (task && task.state === TaskState.SUBMITTED) {
            this.stateManager.markCompleted(taskId);
            logger.info('Task fully completed, payment received', {
                taskId,
                amount: task.amount.toString(),
            });
        }
    }

    /**
     * Get coordinator status
     */
    getStatus(): {
        isRunning: boolean;
        workerAddress: string;
        stats: ReturnType<TaskStateManager['getStats']>;
    } {
        return {
            isRunning: this.isRunning,
            workerAddress: this.workerAddress,
            stats: this.stateManager.getStats(),
        };
    }

    /**
     * Get all tasks
     */
    getTasks() {
        return this.stateManager.getAllTasks();
    }
}

// Singleton instance
let coordinatorInstance: TaskCoordinator | null = null;

/**
 * Get the singleton TaskCoordinator instance
 */
export function getTaskCoordinator(): TaskCoordinator {
    if (!coordinatorInstance) {
        coordinatorInstance = new TaskCoordinator();
    }
    return coordinatorInstance;
}
