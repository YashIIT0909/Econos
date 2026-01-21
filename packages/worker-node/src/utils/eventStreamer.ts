/**
 * Event Streamer for Worker Node Flow Visualization
 * Broadcasts task execution events to SSE clients
 */

import { EventEmitter } from 'events';

// Event types for worker-node flow visualization
export type WorkerEventType =
    | 'auth:received'
    | 'auth:stored'
    | 'event:taskCreated'
    | 'eip712:verify'
    | 'eip712:valid'
    | 'eip712:invalid'
    | 'task:start'
    | 'ai:start'
    | 'ai:progress'
    | 'ai:complete'
    | 'ai:error'
    | 'sign:start'
    | 'sign:complete'
    | 'proof:stored'
    | 'result:served'
    | 'log';

export interface WorkerEvent {
    type: WorkerEventType;
    timestamp: number;
    taskId?: string;
    data?: Record<string, unknown>;
    message: string;
}

class WorkerEventStreamer extends EventEmitter {
    private static instance: WorkerEventStreamer;
    private clients: Set<(event: WorkerEvent) => void> = new Set();

    private constructor() {
        super();
    }

    static getInstance(): WorkerEventStreamer {
        if (!WorkerEventStreamer.instance) {
            WorkerEventStreamer.instance = new WorkerEventStreamer();
        }
        return WorkerEventStreamer.instance;
    }

    /**
     * Add a client listener for SSE
     */
    addClient(callback: (event: WorkerEvent) => void): () => void {
        this.clients.add(callback);
        return () => this.clients.delete(callback);
    }

    /**
     * Emit a worker event to all connected clients
     */
    emitEvent(event: Omit<WorkerEvent, 'timestamp'>): void {
        const fullEvent: WorkerEvent = {
            ...event,
            timestamp: Date.now()
        };

        // Broadcast to all SSE clients
        this.clients.forEach(callback => {
            try {
                callback(fullEvent);
            } catch (e) {
                console.error('SSE client callback error:', e);
            }
        });

        // Also emit on EventEmitter for internal use
        this.emit('event', fullEvent);
    }

    /**
     * Helper methods for common worker events
     */
    authReceived(taskId: string) {
        this.emitEvent({
            type: 'auth:received',
            taskId,
            message: `📨 Authorization received for task ${taskId.slice(0, 16)}...`
        });
    }

    authStored(taskId: string) {
        this.emitEvent({
            type: 'auth:stored',
            taskId,
            message: `💾 Authorization stored, waiting for deposit...`
        });
    }

    taskCreatedEvent(taskId: string, amount: string, master: string) {
        this.emitEvent({
            type: 'event:taskCreated',
            taskId,
            data: { amount, master },
            message: `⛓️ TaskCreated event received! Amount: ${amount} from ${master.slice(0, 10)}...`
        });
    }

    eip712Verify(taskId: string) {
        this.emitEvent({
            type: 'eip712:verify',
            taskId,
            message: `🔐 Verifying EIP-712 signature...`
        });
    }

    eip712Valid(taskId: string, signer: string) {
        this.emitEvent({
            type: 'eip712:valid',
            taskId,
            data: { signer },
            message: `✅ EIP-712 signature valid! Signer: ${signer.slice(0, 10)}...`
        });
    }

    eip712Invalid(taskId: string, error: string) {
        this.emitEvent({
            type: 'eip712:invalid',
            taskId,
            data: { error },
            message: `❌ EIP-712 signature invalid: ${error}`
        });
    }

    taskStart(taskId: string, serviceName: string) {
        this.emitEvent({
            type: 'task:start',
            taskId,
            data: { serviceName },
            message: `🚀 Starting task execution: ${serviceName}`
        });
    }

    aiStart(taskId: string, service: string) {
        this.emitEvent({
            type: 'ai:start',
            taskId,
            data: { service },
            message: `🧠 AI agent executing: ${service}...`
        });
    }

    aiProgress(taskId: string, progress: string) {
        this.emitEvent({
            type: 'ai:progress',
            taskId,
            data: { progress },
            message: `⏳ ${progress}`
        });
    }

    aiComplete(taskId: string, durationMs: number) {
        this.emitEvent({
            type: 'ai:complete',
            taskId,
            data: { durationMs },
            message: `✅ AI execution complete (${(durationMs / 1000).toFixed(2)}s)`
        });
    }

    aiError(taskId: string, error: string) {
        this.emitEvent({
            type: 'ai:error',
            taskId,
            data: { error },
            message: `❌ AI execution failed: ${error}`
        });
    }

    signStart(taskId: string) {
        this.emitEvent({
            type: 'sign:start',
            taskId,
            message: `✍️ Signing result hash (gasless)...`
        });
    }

    signComplete(taskId: string, resultHash: string) {
        this.emitEvent({
            type: 'sign:complete',
            taskId,
            data: { resultHash: resultHash.slice(0, 20) + '...' },
            message: `✅ Result signed: ${resultHash.slice(0, 20)}...`
        });
    }

    proofStored(taskId: string) {
        this.emitEvent({
            type: 'proof:stored',
            taskId,
            message: `📦 Proof stored, ready for relay pickup`
        });
    }

    resultServed(taskId: string) {
        this.emitEvent({
            type: 'result:served',
            taskId,
            message: `📤 Result served to Master Agent`
        });
    }

    log(message: string, taskId?: string) {
        this.emitEvent({
            type: 'log',
            taskId,
            message
        });
    }
}

export const workerEventStreamer = WorkerEventStreamer.getInstance();
