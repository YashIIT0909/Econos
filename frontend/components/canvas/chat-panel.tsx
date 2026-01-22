'use client'

import { useState, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    workflow?: {
        agents: string[]
        cost: string
        planId?: string
    }
    isLoading?: boolean
    isExecuting?: boolean
    result?: any
}

interface ChatPanelProps {
    onRequestPayment?: (amount: string, planId: string, taskDescription: string) => void
    executionResult?: any
    isExecuting?: boolean
}

export function ChatPanel({ onRequestPayment, executionResult, isExecuting }: ChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Describe your task and I\'ll construct an optimal workflow for you.',
            timestamp: new Date()
        }
    ])
    const [input, setInput] = useState('')
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [currentTaskDescription, setCurrentTaskDescription] = useState('')

    // Update messages when execution state changes
    useEffect(() => {
        setMessages(prev => prev.map(msg => {
            // Only update workflow messages
            if (!msg.workflow) return msg
            
            // Update executing state
            if (isExecuting && !msg.result) {
                return { ...msg, isExecuting: true }
            }
            
            // Update with result when execution completes
            if (executionResult && !msg.result) {
                return { 
                    ...msg, 
                    isExecuting: false,
                    result: executionResult
                }
            }
            
            return msg
        }))
    }, [executionResult, isExecuting])

    const examplePrompts = [
        'Research Bitcoin market trends and create a summary',
        'Generate an image of a futuristic city',
        'Analyze climate data and summarize findings',
    ]

    const handleSend = async () => {
        if (!input.trim() || isAnalyzing) return

        const taskDescription = input
        setCurrentTaskDescription(taskDescription)

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: taskDescription,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsAnalyzing(true)

        const loadingMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Analyzing your request...',
            timestamp: new Date(),
            isLoading: true
        }
        setMessages(prev => [...prev, loadingMessage])

        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_MASTER_AGENT_URL || 'http://localhost:4000'}/ai/analyze`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskDescription })
                }
            )

            if (!response.ok) {
                throw new Error('Failed to analyze task')
            }

            const data = await response.json()

            setMessages(prev => prev.filter(m => !m.isLoading))
            
            const workflowMessage: Message = {
                id: (Date.now() + 2).toString(),
                role: 'assistant',
                content: `I'll use the following workflow:\n${data.plan.workflow.map((w: any) => `${w.order}. ${w.agent}`).join('\n')}\n\nEstimated cost: ${data.plan.estimatedCostEther} TCRO`,
                timestamp: new Date(),
                workflow: {
                    agents: data.plan.workflow.map((w: any) => w.agent),
                    cost: data.plan.estimatedCostEther,
                    planId: data.plan.planId
                }
            }

            setMessages(prev => [...prev, workflowMessage])

        } catch (error) {
            setMessages(prev => prev.filter(m => !m.isLoading))
            const errorMessage: Message = {
                id: (Date.now() + 3).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsAnalyzing(false)
        }
    }

    const handlePayAndExecute = (cost: string, planId: string) => {
        if (onRequestPayment) {
            onRequestPayment(cost, planId, currentTaskDescription)
        } else {
            alert('Payment integration not available. Please use this chat from the canvas page.')
        }
    }

    return (
        <div className="flex flex-col h-full bg-zinc-950" style={{ height: '100%' }}>
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800">
                <h2 className="text-lg font-medium text-zinc-100">AI Workflow Assistant</h2>
                <p className="text-xs text-zinc-500 mt-1">Describe what you need and I'll build it</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4" style={{ minHeight: 0 }}>
                {messages.map((message) => (
                    <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-4 py-3 rounded-lg ${
                            message.role === 'user' 
                                ? 'bg-zinc-800 text-zinc-100' 
                                : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                        }`}>
                            {message.isLoading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">{message.content}</span>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    {message.workflow && (
                                        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                                            {message.workflow.agents.map((agent, idx) => (
                                                <div key={idx} className="text-xs text-zinc-500 flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center text-zinc-400">
                                                        {idx + 1}
                                                    </span>
                                                    {agent}
                                                </div>
                                            ))}
                                            <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between">
                                                <span className="text-xs text-zinc-500">Cost:</span>
                                                <span className="text-sm font-medium text-zinc-300">
                                                    {message.workflow.cost} TCRO
                                                </span>
                                            </div>
                                            {!message.isExecuting && (
                                                <button
                                                    onClick={() => handlePayAndExecute(message.workflow!.cost, message.workflow!.planId!)}
                                                    className="w-full mt-3 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium rounded-lg transition-colors"
                                                >
                                                    Pay {message.workflow.cost} TCRO & Execute
                                                </button>
                                            )}
                                            {message.isExecuting && (
                                                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Executing workflow...</span>
                                                </div>
                                            )}
                                            {message.result && (
                                                <div className="mt-3 pt-3 border-t border-zinc-800">
                                                    <div className="text-xs font-medium text-green-400 mb-2">
                                                        ✓ Execution Complete
                                                    </div>
                                                    <div className="text-sm text-zinc-300 bg-zinc-900 rounded p-3">
                                                        <pre className="whitespace-pre-wrap font-mono text-xs">
                                                            {JSON.stringify(message.result.aggregatedOutput || message.result.results, null, 2)}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="mt-1 text-xs text-zinc-600">
                                {message.timestamp.toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Example Prompts */}
            {messages.length === 1 && (
                <div className="px-6 pb-4">
                    <p className="text-xs text-zinc-600 mb-2">Try these:</p>
                    <div className="flex flex-wrap gap-2">
                        {examplePrompts.map((prompt, idx) => (
                            <button
                                key={idx}
                                onClick={() => setInput(prompt)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 border border-zinc-800 transition-colors"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-zinc-800">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Describe your task..."
                        disabled={isAnalyzing}
                        className="flex-1 px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isAnalyzing}
                        className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg transition-colors"
                    >
                        {isAnalyzing ? (
                            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                        ) : (
                            <Send className="w-5 h-5 text-zinc-400" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
