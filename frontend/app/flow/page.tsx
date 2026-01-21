'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Navbar } from '@/components/ui/navbar';
import { TerminalLogs, LogEntry } from '@/components/flow/terminal-logs';
import { FlowDiagram } from '@/components/flow/flow-diagram';
import { useEventStream, FlowEvent } from '@/hooks/use-event-stream';
import { RefreshCw, Plug, PlugZap } from 'lucide-react';

const MASTER_AGENT_URL = process.env.NEXT_PUBLIC_MASTER_AGENT_URL || 'http://localhost:4000';
const WORKER_NODE_URL = process.env.NEXT_PUBLIC_WORKER_NODE_URL || 'http://localhost:3001';

// Map event types to flow step IDs
const EVENT_TO_STEP: Record<string, number> = {
    // Master Agent events
    'l402:received': 1,
    'l402:verify': 2,
    'l402:verified': 3,
    'eip712:sign': 4,
    'authorize:send': 5,
    'authorize:success': 5,
    'escrow:deposit': 6,
    'escrow:confirmed': 6,
    'relay:poll': 12,
    'relay:found': 12,
    'relay:submit': 12,
    'relay:confirmed': 12,
    'result:fetch': 13,
    'result:received': 14,
    'pipeline:start': 1,
    'pipeline:step': 9,
    'pipeline:complete': 14,
    'pipeline:error': 14,

    // Worker Node events
    'auth:received': 5,
    'auth:stored': 5,
    'event:taskCreated': 7,
    'eip712:verify': 8,
    'eip712:valid': 8,
    'eip712:invalid': 8,
    'task:start': 9,
    'ai:start': 9,
    'ai:progress': 9,
    'ai:complete': 9,
    'ai:error': 9,
    'sign:start': 10,
    'sign:complete': 10,
    'proof:stored': 11,
    'result:served': 13,
};

export default function FlowPage() {
    const [autoConnect, setAutoConnect] = useState(true);
    const [activeStep, setActiveStep] = useState<number | null>(null);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

    // Master Agent SSE connection
    const masterStream = useEventStream({
        url: `${MASTER_AGENT_URL}/events`,
        autoReconnect: true,
        onEvent: (event) => {
            const step = EVENT_TO_STEP[event.type];
            if (step) {
                setActiveStep(step);
                // Mark completed after a delay
                setTimeout(() => {
                    if (event.type.includes('complete') || event.type.includes('confirmed') || event.type.includes('success') || event.type.includes('verified') || event.type.includes('valid')) {
                        setCompletedSteps(prev => new Set([...prev, step]));
                    }
                }, 500);
            }
        }
    });

    // Worker Node SSE connection
    const workerStream = useEventStream({
        url: `${WORKER_NODE_URL}/events`,
        autoReconnect: true,
        onEvent: (event) => {
            const step = EVENT_TO_STEP[event.type];
            if (step) {
                setActiveStep(step);
                setTimeout(() => {
                    if (event.type.includes('complete') || event.type.includes('valid') || event.type.includes('stored') || event.type.includes('served')) {
                        setCompletedSteps(prev => new Set([...prev, step]));
                    }
                }, 500);
            }
        }
    });

    // Convert FlowEvent to LogEntry
    const masterLogs: LogEntry[] = useMemo(() =>
        masterStream.events.map(e => ({
            type: e.type,
            timestamp: e.timestamp,
            message: e.message,
            taskId: e.taskId
        })),
        [masterStream.events]
    );

    const workerLogs: LogEntry[] = useMemo(() =>
        workerStream.events.map(e => ({
            type: e.type,
            timestamp: e.timestamp,
            message: e.message,
            taskId: e.taskId
        })),
        [workerStream.events]
    );

    // Auto-connect on mount
    useEffect(() => {
        if (autoConnect) {
            masterStream.connect();
            workerStream.connect();
        }
        return () => {
            masterStream.disconnect();
            workerStream.disconnect();
        };
    }, [autoConnect]);

    const handleRefresh = useCallback(() => {
        masterStream.clearEvents();
        workerStream.clearEvents();
        setActiveStep(null);
        setCompletedSteps(new Set());
    }, [masterStream, workerStream]);

    const handleToggleConnection = useCallback(() => {
        if (masterStream.isConnected || workerStream.isConnected) {
            masterStream.disconnect();
            workerStream.disconnect();
        } else {
            masterStream.connect();
            workerStream.connect();
        }
    }, [masterStream, workerStream]);

    const isConnected = masterStream.isConnected || workerStream.isConnected;

    return (
        <main className="min-h-screen bg-zinc-950">
            <Navbar />

            <div className="pt-20 h-screen flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-800/50">
                    <div className="max-w-[1800px] mx-auto flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-100">Flow Visualization</h1>
                            <p className="text-sm text-zinc-500 mt-1">
                                Real-time x402 payment flow from Master Agent and Worker Node
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleRefresh}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Clear Logs
                            </button>
                            <button
                                onClick={handleToggleConnection}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isConnected
                                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                    }`}
                            >
                                {isConnected ? (
                                    <><PlugZap className="w-4 h-4" /> Connected</>
                                ) : (
                                    <><Plug className="w-4 h-4" /> Connect</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content - Three Column Layout */}
                <div className="flex-1 overflow-hidden p-6">
                    <div className="max-w-[1800px] mx-auto h-full grid grid-cols-12 gap-4">
                        {/* Left Panel - Master Agent Logs */}
                        <div className="col-span-3 h-full">
                            <TerminalLogs
                                title="Master Agent"
                                logs={masterLogs}
                                isConnected={masterStream.isConnected}
                                connectionStatus={masterStream.error || undefined}
                                className="h-full"
                            />
                        </div>

                        {/* Center Panel - Flow Diagram */}
                        <div className="col-span-6 h-full bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4 overflow-hidden">
                            <FlowDiagram
                                activeStep={activeStep}
                                completedSteps={completedSteps}
                                className="h-full"
                            />
                        </div>

                        {/* Right Panel - Worker Node Logs */}
                        <div className="col-span-3 h-full">
                            <TerminalLogs
                                title="Worker Node"
                                logs={workerLogs}
                                isConnected={workerStream.isConnected}
                                connectionStatus={workerStream.error || undefined}
                                className="h-full"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
