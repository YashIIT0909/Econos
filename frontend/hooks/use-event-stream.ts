/**
 * useEventStream - React hook for SSE connection management
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface FlowEvent {
    type: string;
    timestamp: number;
    taskId?: string;
    data?: Record<string, unknown>;
    message: string;
}

interface UseEventStreamOptions {
    url: string;
    onEvent?: (event: FlowEvent) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
    autoReconnect?: boolean;
    reconnectDelay?: number;
}

interface UseEventStreamReturn {
    events: FlowEvent[];
    isConnected: boolean;
    error: string | null;
    connect: () => void;
    disconnect: () => void;
    clearEvents: () => void;
}

export function useEventStream({
    url,
    onEvent,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectDelay = 3000,
}: UseEventStreamOptions): UseEventStreamReturn {
    const [events, setEvents] = useState<FlowEvent[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
            setIsConnected(false);
            onDisconnect?.();
        }
    }, [onDisconnect]);

    const connect = useCallback(() => {
        // Clean up existing connection
        disconnect();

        try {
            const eventSource = new EventSource(url);
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                setIsConnected(true);
                setError(null);
                onConnect?.();
            };

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as FlowEvent;
                    setEvents((prev) => [...prev, data]);
                    onEvent?.(data);
                } catch (e) {
                    console.error('Failed to parse SSE event:', e);
                }
            };

            eventSource.onerror = (e) => {
                console.error('SSE error:', e);
                setError('Connection lost');
                setIsConnected(false);
                onError?.(e);

                // Auto-reconnect
                if (autoReconnect) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, reconnectDelay);
                }
            };
        } catch (e) {
            setError(`Failed to connect: ${e}`);
            setIsConnected(false);
        }
    }, [url, onEvent, onConnect, onError, autoReconnect, reconnectDelay, disconnect]);

    const clearEvents = useCallback(() => {
        setEvents([]);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        events,
        isConnected,
        error,
        connect,
        disconnect,
        clearEvents,
    };
}
