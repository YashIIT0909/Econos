'use client';

import { cn } from '@/lib/utils';
import {
    User,
    Bot,
    Shield,
    FileKey,
    Send,
    Wallet,
    Zap,
    Brain,
    PenTool,
    Package,
    RefreshCw,
    CheckCircle2,
    ArrowRight
} from 'lucide-react';

// Define the 14 steps of the Econos x402 flow
const FLOW_STEPS = [
    // Payment Phase
    { id: 1, phase: 'payment', actor: 'user', label: 'Request Pipeline', icon: User, description: 'User sends task to Master Agent' },
    { id: 2, phase: 'payment', actor: 'user', label: 'L402 Payment', icon: Wallet, description: 'User pays TCRO to Master' },
    { id: 3, phase: 'payment', actor: 'master', label: 'Verify Payment', icon: CheckCircle2, description: 'Master verifies L402 tx on-chain' },

    // Authorization Phase
    { id: 4, phase: 'authorization', actor: 'master', label: 'Sign EIP-712', icon: FileKey, description: 'Master creates EIP-712 authorization' },
    { id: 5, phase: 'authorization', actor: 'master', label: 'Send Auth', icon: Send, description: 'POST /authorize to Worker' },

    // Escrow Phase 
    { id: 6, phase: 'escrow', actor: 'master', label: 'Deposit Escrow', icon: Shield, description: 'depositTask() to NativeEscrow' },
    { id: 7, phase: 'escrow', actor: 'worker', label: 'Event Received', icon: Zap, description: 'TaskCreated event from chain' },

    // Execution Phase
    { id: 8, phase: 'execution', actor: 'worker', label: 'Verify Signature', icon: FileKey, description: 'Worker verifies EIP-712' },
    { id: 9, phase: 'execution', actor: 'worker', label: 'AI Execution', icon: Brain, description: 'Execute AI agent task' },
    { id: 10, phase: 'execution', actor: 'worker', label: 'Sign Result', icon: PenTool, description: 'Sign result hash (gasless)' },
    { id: 11, phase: 'execution', actor: 'worker', label: 'Store Proof', icon: Package, description: 'Store for relay pickup' },

    // Settlement Phase
    { id: 12, phase: 'settlement', actor: 'master', label: 'Relay Submit', icon: RefreshCw, description: 'submitWorkRelayed() to escrow' },
    { id: 13, phase: 'settlement', actor: 'master', label: 'Fetch Result', icon: Package, description: 'GET /result from Worker' },
    { id: 14, phase: 'settlement', actor: 'user', label: 'Result Delivered', icon: CheckCircle2, description: 'Final output returned' },
];

const PHASE_COLORS = {
    payment: { bg: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30', text: 'text-blue-400', label: 'Payment' },
    authorization: { bg: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/30', text: 'text-purple-400', label: 'Authorization' },
    escrow: { bg: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/30', text: 'text-amber-400', label: 'Escrow' },
    execution: { bg: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Execution' },
    settlement: { bg: 'from-cyan-500/20 to-cyan-600/10', border: 'border-cyan-500/30', text: 'text-cyan-400', label: 'Settlement' },
};

const ACTOR_STYLES = {
    user: 'bg-zinc-700 border-zinc-600',
    master: 'bg-blue-900/50 border-blue-500/40',
    worker: 'bg-emerald-900/50 border-emerald-500/40',
};

interface FlowDiagramProps {
    activeStep: number | null;
    completedSteps: Set<number>;
    className?: string;
}

export function FlowDiagram({ activeStep, completedSteps, className }: FlowDiagramProps) {
    // Group steps by phase
    const phaseGroups = FLOW_STEPS.reduce((acc, step) => {
        if (!acc[step.phase]) acc[step.phase] = [];
        acc[step.phase].push(step);
        return acc;
    }, {} as Record<string, typeof FLOW_STEPS>);

    return (
        <div className={cn('flex flex-col h-full', className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6 px-2">
                <h2 className="text-lg font-semibold text-zinc-100">x402 Payment Flow</h2>
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500/50 border border-blue-500" />
                        <span className="text-zinc-400">Master Agent</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500/50 border border-emerald-500" />
                        <span className="text-zinc-400">Worker Node</span>
                    </div>
                </div>
            </div>

            {/* Flow Steps */}
            <div className="flex-1 overflow-y-auto space-y-4 px-2">
                {Object.entries(phaseGroups).map(([phase, steps]) => {
                    const phaseStyle = PHASE_COLORS[phase as keyof typeof PHASE_COLORS];
                    return (
                        <div key={phase} className={cn(
                            'rounded-xl p-4 border',
                            `bg-linear-to-br ${phaseStyle.bg}`,
                            phaseStyle.border
                        )}>
                            {/* Phase Label */}
                            <div className="flex items-center gap-2 mb-3">
                                <span className={cn('text-xs font-semibold uppercase tracking-wider', phaseStyle.text)}>
                                    {phaseStyle.label} Phase
                                </span>
                            </div>

                            {/* Steps */}
                            <div className="flex flex-wrap gap-2">
                                {steps.map((step, idx) => {
                                    const isActive = activeStep === step.id;
                                    const isCompleted = completedSteps.has(step.id);
                                    const Icon = step.icon;

                                    return (
                                        <div key={step.id} className="flex items-center gap-1">
                                            <div
                                                className={cn(
                                                    'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300',
                                                    ACTOR_STYLES[step.actor as keyof typeof ACTOR_STYLES],
                                                    isActive && 'ring-2 ring-white/50 scale-105',
                                                    isCompleted && 'opacity-100',
                                                    !isCompleted && !isActive && 'opacity-50',
                                                )}
                                                title={step.description}
                                            >
                                                <div className={cn(
                                                    'w-6 h-6 rounded-full flex items-center justify-center',
                                                    isCompleted ? 'bg-emerald-500' : isActive ? 'bg-white/20 animate-pulse' : 'bg-zinc-700'
                                                )}>
                                                    {isCompleted ? (
                                                        <CheckCircle2 className="w-4 h-4 text-white" />
                                                    ) : (
                                                        <Icon className="w-3.5 h-3.5 text-zinc-300" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-zinc-200">{step.label}</span>
                                                    <span className="text-[10px] text-zinc-500">{step.id}</span>
                                                </div>
                                            </div>
                                            {idx < steps.length - 1 && (
                                                <ArrowRight className={cn(
                                                    'w-4 h-4 transition-colors',
                                                    isCompleted ? 'text-emerald-500' : 'text-zinc-600'
                                                )} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-zinc-800 px-2">
                <p className="text-xs text-zinc-500 text-center">
                    Execute a workflow from the Canvas page to see the flow in action
                </p>
            </div>
        </div>
    );
}
