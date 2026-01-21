'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface LogEntry {
    type: string;
    timestamp: number;
    message: string;
    taskId?: string;
}

interface TerminalLogsProps {
    title: string;
    logs: LogEntry[];
    isConnected: boolean;
    connectionStatus?: string;
    className?: string;
}

// Color mapping for different log types
const getLogColor = (type: string): string => {
    if (type.includes('error') || type.includes('invalid') || type.includes('failed')) {
        return 'text-red-400';
    }
    if (type.includes('complete') || type.includes('success') || type.includes('verified') || type.includes('valid') || type.includes('confirmed')) {
        return 'text-emerald-400';
    }
    if (type.includes('start') || type.includes('send') || type.includes('deposit') || type.includes('sign')) {
        return 'text-amber-400';
    }
    if (type.includes('received') || type.includes('poll') || type.includes('fetch')) {
        return 'text-cyan-400';
    }
    if (type === 'connected') {
        return 'text-emerald-500';
    }
    return 'text-zinc-300';
};

const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

export function TerminalLogs({
    title,
    logs,
    isConnected,
    connectionStatus,
    className,
}: TerminalLogsProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className={cn(
            'flex flex-col h-full rounded-xl overflow-hidden',
            'bg-zinc-950 border border-zinc-800/50',
            className
        )}>
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800/50">
                <div className="flex items-center gap-3">
                    {/* Traffic light dots */}
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <span className="text-sm font-medium text-zinc-300">{title}</span>
                </div>

                {/* Connection status */}
                <div className="flex items-center gap-2">
                    <div className={cn(
                        'w-2 h-2 rounded-full',
                        isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
                    )} />
                    <span className="text-xs text-zinc-500">
                        {connectionStatus || (isConnected ? 'Connected' : 'Disconnected')}
                    </span>
                </div>
            </div>

            {/* Terminal Body */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 font-mono text-sm"
            >
                {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-zinc-600 text-sm">
                            {isConnected ? 'Waiting for events...' : 'Not connected'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {logs.map((log, index) => (
                            <div key={index} className="flex gap-3">
                                <span className="text-zinc-600 shrink-0">
                                    [{formatTimestamp(log.timestamp)}]
                                </span>
                                <span className={cn('wrap-break-word', getLogColor(log.type))}>
                                    {log.message}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Blinking cursor */}
                {isConnected && (
                    <div className="mt-2 flex items-center">
                        <span className="text-zinc-500">$</span>
                        <span className="ml-2 w-2 h-4 bg-zinc-400 animate-pulse" />
                    </div>
                )}
            </div>
        </div>
    );
}
