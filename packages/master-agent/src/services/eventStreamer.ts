/**
 * Event Streamer for Flow Visualization
 * Broadcasts pipeline execution events to SSE clients
 */

import { EventEmitter } from 'events';

// Event types for flow visualization
export type FlowEventType =
    | 'l402:received'
    | 'l402:verify'
    | 'l402:verified'
    | 'eip712:sign'
    | 'authorize:send'
    | 'authorize:success'
    | 'escrow:deposit'
    | 'escrow:confirmed'
    | 'relay:poll'
    | 'relay:found'
    | 'relay:submit'
    | 'relay:confirmed'
    | 'result:fetch'
    | 'result:received'
    | 'pipeline:start'
    | 'pipeline:step'
    | 'pipeline:complete'
    | 'pipeline:error'
    | 'log';

export interface FlowEvent {
    type: FlowEventType;
    timestamp: number;
    taskId?: string;
    data?: Record<string, unknown>;
    message: string;
}

class EventStreamer extends EventEmitter {
    private static instance: EventStreamer;
    private clients: Set<(event: FlowEvent) => void> = new Set();

    private constructor() {
        super();
    }

    static getInstance(): EventStreamer {
        if (!EventStreamer.instance) {
            EventStreamer.instance = new EventStreamer();
        }
        return EventStreamer.instance;
    }

    /**
     * Add a client listener for SSE
     */
    addClient(callback: (event: FlowEvent) => void): () => void {
        this.clients.add(callback);
        return () => this.clients.delete(callback);
    }

    /**
     * Emit a flow event to all connected clients
     */
    emitEvent(event: Omit<FlowEvent, 'timestamp'>): void {
        const fullEvent: FlowEvent = {
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
     * Helper methods for common events
     */
    l402Received(amount: string) {
        this.emitEvent({
            type: 'l402:received',
            message: `💰 L402 payment request received: ${amount} TCRO`
        });
    }

    l402Verified(txHash: string) {
        this.emitEvent({
            type: 'l402:verified',
            data: { txHash },
            message: `✅ L402 payment verified: ${txHash.slice(0, 16)}...`
        });
    }

    eip712Sign(taskId: string, worker: string) {
        this.emitEvent({
            type: 'eip712:sign',
            taskId,
            data: { worker },
            message: `🔐 Signing EIP-712 authorization for worker ${worker.slice(0, 10)}...`
        });
    }

    authorizeSend(taskId: string, endpoint: string) {
        this.emitEvent({
            type: 'authorize:send',
            taskId,
            data: { endpoint },
            message: `📨 Sending authorization to worker at ${endpoint}`
        });
    }

    authorizeSuccess(taskId: string) {
        this.emitEvent({
            type: 'authorize:success',
            taskId,
            message: `✅ Worker accepted authorization`
        });
    }

    escrowDeposit(taskId: string, amount: string, worker: string) {
        this.emitEvent({
            type: 'escrow:deposit',
            taskId,
            data: { amount, worker },
            message: `💎 Depositing ${amount} TCRO to NativeEscrow for worker ${worker.slice(0, 10)}...`
        });
    }

    escrowConfirmed(taskId: string, txHash: string) {
        this.emitEvent({
            type: 'escrow:confirmed',
            taskId,
            data: { txHash },
            message: `✅ Escrow deposit confirmed: ${txHash.slice(0, 16)}...`
        });
    }

    relayPoll(taskId: string, attempt: number) {
        this.emitEvent({
            type: 'relay:poll',
            taskId,
            data: { attempt },
            message: `👂 Polling for worker proof (attempt ${attempt})...`
        });
    }

    relayFound(taskId: string) {
        this.emitEvent({
            type: 'relay:found',
            taskId,
            message: `📦 Worker proof received, preparing relay transaction`
        });
    }

    relaySubmit(taskId: string) {
        this.emitEvent({
            type: 'relay:submit',
            taskId,
            message: `🚀 Submitting relayed work to escrow contract...`
        });
    }

    relayConfirmed(taskId: string, txHash: string) {
        this.emitEvent({
            type: 'relay:confirmed',
            taskId,
            data: { txHash },
            message: `✅ Work submitted, payment released: ${txHash.slice(0, 16)}...`
        });
    }

    resultReceived(taskId: string) {
        this.emitEvent({
            type: 'result:received',
            taskId,
            message: `📥 Final result fetched from worker`
        });
    }

    pipelineStart(taskId: string, agentCount: number) {
        this.emitEvent({
            type: 'pipeline:start',
            taskId,
            data: { agentCount },
            message: `🚀 Pipeline started with ${agentCount} agents`
        });
    }

    pipelineStep(taskId: string, step: number, agent: string, status: 'start' | 'complete' | 'error') {
        const icons = { start: '⚙️', complete: '✅', error: '❌' };
        this.emitEvent({
            type: 'pipeline:step',
            taskId,
            data: { step, agent, status },
            message: `${icons[status]} Step ${step}: ${agent} - ${status}`
        });
    }

    pipelineComplete(taskId: string) {
        this.emitEvent({
            type: 'pipeline:complete',
            taskId,
            message: `🎉 Pipeline completed successfully`
        });
    }

    pipelineError(taskId: string, error: string) {
        this.emitEvent({
            type: 'pipeline:error',
            taskId,
            data: { error },
            message: `❌ Pipeline error: ${error}`
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

export const eventStreamer = EventStreamer.getInstance();
