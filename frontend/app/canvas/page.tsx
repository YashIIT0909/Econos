'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
    Background,
    Controls,
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    type Connection,
    type Edge,
    type Node,
    type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { toast } from 'sonner'

import { Navbar } from '@/components/ui/navbar'
import { AgentSidebar } from '@/components/canvas/agent-sidebar'
import { AgentNode } from '@/components/canvas/agent-node'
import { PipelineControls } from '@/components/canvas/pipeline-controls'
import { PaymentModal } from '@/components/canvas/payment-modal'
import { TaskInputDialog } from '@/components/canvas/task-input-dialog'
import { ResultsModal } from '@/components/canvas/results-modal'
import { ExecutionLog } from '@/components/canvas/execution-log'
import { ChatPanel } from '@/components/canvas/chat-panel'
import type { Agent, PipelineNodeData } from '@/types/agent'
import { requestPipelineExecution, executePipelineWithPayment, type PaymentDetails, waitForPipelineCompletion, waitForAICompletion } from '@/lib/api'

// Register custom node types
const nodeTypes = {
    agent: AgentNode,
}

// Custom edge styles
const defaultEdgeOptions = {
    type: 'smoothstep',
    animated: true,
    style: {
        stroke: '#52525b',
        strokeWidth: 2,
    },
}

function CanvasContent() {
    const reactFlowWrapper = useRef<HTMLDivElement>(null)
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
    
    // Tab state: 'canvas' or 'chat'
    const [activeTab, setActiveTab] = useState<'canvas' | 'chat'>('canvas')

    // Wallet integration
    const { address, isConnected } = useAccount()
    const { sendTransaction, data: txHash, isPending, error: txError } = useSendTransaction()
    const { isLoading: isConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash })

    // Task input dialog state
    const [taskInputOpen, setTaskInputOpen] = useState(false)
    const [taskDescription, setTaskDescription] = useState('')

    // Execution state for visual feedback
    const [executionState, setExecutionState] = useState<{
        taskId: string | null
        currentStep: number | null
        completedSteps: Set<string>
        failedSteps: Set<string>
        isPolling: boolean
        isAIChat: boolean // Track if this is AI chat execution
    }>({
        taskId: null,
        currentStep: null,
        completedSteps: new Set(),
        failedSteps: new Set(),
        isPolling: false,
        isAIChat: false
    })

    // Payment modal state
    const [paymentModal, setPaymentModal] = useState<{
        open: boolean
        paymentDetails?: PaymentDetails
    }>({ open: false })

    // Execution state
    const [isExecuting, setIsExecuting] = useState(false)
    const [executionResult, setExecutionResult] = useState<any>(null)
    const processedTxRef = useRef<string | null>(null)

    // Calculate total pipeline amount
    const pipelineStats = useMemo(() => {
        let total = 0
        nodes.forEach((node: Node<PipelineNodeData>) => {
            const price = parseFloat(node.data?.agent?.price || '0')
            total += price
        })
        return {
            agentCount: nodes.length,
            totalAmount: total.toFixed(4),
        }
    }, [nodes])

    // Handle new connections between nodes
    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    )

    // Update node visual states based on execution progress
    useEffect(() => {
        if (!executionState.taskId) return;

        setNodes((nds) => nds.map((node) => ({
            ...node,
            data: {
                ...node.data,
                executionState: 
                    executionState.completedSteps.has(node.data.agent.name) ? 'completed' :
                    executionState.failedSteps.has(node.data.agent.name) ? 'failed' :
                    'pending'
            }
        })));
    }, [executionState.completedSteps, executionState.failedSteps, setNodes]);

    // Poll pipeline status for real-time visual feedback
    useEffect(() => {
        if (!executionState.taskId || !executionState.isPolling) return;

        const pollStatus = async () => {
            try {
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_MASTER_AGENT_URL || 'http://localhost:4000'}/pipeline/${executionState.taskId}/status`
                );
                
                if (!response.ok) {
                    console.error('Status polling failed:', response.status);
                    return;
                }
                
                const data = await response.json();

                if (data.status) {
                    // Extract completed and failed steps
                    const completed = new Set<string>();
                    const failed = new Set<string>();
                    
                    if (data.steps) {
                        data.steps.forEach((step: any) => {
                            if (step.status === 'completed') {
                                completed.add(step.agent);
                            } else if (step.status === 'failed') {
                                failed.add(step.agent);
                            }
                        });
                    }

                    // Update execution state
                    setExecutionState(prev => ({
                        ...prev,
                        currentStep: data.currentStep || prev.currentStep,
                        completedSteps: completed,
                        failedSteps: failed,
                        isPolling: data.status === 'running'
                    }));

                    // Stop polling and update UI when pipeline completes or fails
                    if (data.status === 'completed' || data.status === 'failed') {
                        setExecutionState(prev => ({ ...prev, isPolling: false }));
                        setIsExecuting(false);
                    }
                }
            } catch (error) {
                console.error('Status polling error:', error);
            }
        };

        // Start polling immediately
        pollStatus();
        
        const interval = setInterval(pollStatus, 3000); // Poll every 3 seconds

        return () => clearInterval(interval);
    }, [executionState.taskId, executionState.isPolling]);

    // Handle drag start from sidebar
    const onDragStart = (event: React.DragEvent, agent: Agent) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify(agent))
        event.dataTransfer.effectAllowed = 'move'
    }

    // Handle drag over canvas
    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }, [])

    // Handle drop on canvas
    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault()

            if (!reactFlowWrapper.current || !reactFlowInstance) return

            const agentData = event.dataTransfer.getData('application/reactflow')
            if (!agentData) return

            const agent: Agent = JSON.parse(agentData)

            // Get drop position
            const bounds = reactFlowWrapper.current.getBoundingClientRect()
            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX - bounds.left,
                y: event.clientY - bounds.top,
            })

            // Create new node
            const newNode: Node<PipelineNodeData> = {
                id: `${agent.id}-${Date.now()}`,
                type: 'agent',
                position,
                data: {
                    agent,
                    label: agent.name,
                },
            }

            setNodes((nds) => nds.concat(newNode))
        },
        [reactFlowInstance, setNodes]
    )

    // Clear all nodes and edges
    const handleClear = useCallback(() => {
        setNodes([])
        setEdges([])
        setExecutionResult(null)
    }, [setNodes, setEdges])

    // L402 Protocol Flow: Execute pipeline with payment
    const handleExecute = useCallback(async () => {
        console.log('🔵 handleExecute called')
        console.log('📊 Nodes:', nodes.length)
        console.log('🔗 Edges:', edges.length)
        
        if (nodes.length === 0) {
            toast.error('Add some agents to the canvas first!')
            return
        }

        // Find root nodes (no incoming edges)
        const targetIds = new Set(edges.map((e: Edge) => e.target))
        const rootNodes = nodes.filter((n: Node) => !targetIds.has(n.id))

        if (rootNodes.length === 0 && nodes.length > 0) {
            toast.error('Pipeline has a cycle - please ensure there is a clear starting point.')
            return
        }

        // Show task input dialog
        setTaskInputOpen(true)
    }, [nodes, edges])

    // Handle task description submission from dialog
    const handleTaskSubmit = useCallback(async (description: string) => {
        setTaskDescription(description)
        setTaskInputOpen(false)

        try {
            setIsExecuting(true)
            setExecutionResult(null)

            // Step 1: Initial request (expect 402 Payment Required)
            console.log('🚀 Requesting pipeline execution...')
            console.log('📋 Task:', description)
            console.log('📡 API URL:', process.env.NEXT_PUBLIC_MASTER_AGENT_URL || 'http://localhost:4000')
            const response = await requestPipelineExecution(nodes, edges, description)
            console.log('📥 Response:', response)

            if (response.status === 402) {
                // Step 2: Show payment modal
                console.log('💰 Payment required:', response.paymentDetails)
                setPaymentModal({
                    open: true,
                    paymentDetails: response.paymentDetails,
                })
                setIsExecuting(false)
                return
            }

            // If already paid (unlikely but possible)
            toast.success('Pipeline execution started!')
            const result = await waitForPipelineCompletion(response.taskId)
            setExecutionResult(result)
            toast.success('Pipeline completed successfully!')

        } catch (error: any) {
            console.error('❌ Pipeline execution error:', error)
            toast.error(error.message || 'Failed to execute pipeline')
        } finally {
            setIsExecuting(false)
        }
    }, [nodes, edges])

    // Handle payment transaction
    const handlePayment = useCallback(async () => {
        if (!paymentModal.paymentDetails) return

        try {
            const { amount, recipient } = paymentModal.paymentDetails
            
            // Send transaction
            sendTransaction({
                to: recipient as `0x${string}`,
                value: parseEther(amount),
            })
        } catch (error: any) {
            console.error('Payment error:', error)
            toast.error(error.message || 'Payment failed')
        }
    }, [paymentModal.paymentDetails, sendTransaction])

    // After payment confirmation, retry with L402 header
    const handlePaymentSuccess = useCallback(async () => {
        if (!txHash) return

        try {
            setIsExecuting(true)
            
            // Check if this is AI chat mode (task description but no nodes)
            const isAIChatMode = taskDescription && nodes.length === 0
            
            if (isAIChatMode) {
                console.log('🤖 AI Chat Mode: Executing with payment', txHash)
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_MASTER_AGENT_URL || 'http://localhost:4000'}/ai/execute`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            taskDescription,
                            paymentTxHash: txHash
                        })
                    }
                )

                if (!response.ok) {
                    const errorText = await response.text()
                    throw new Error(`AI execution failed: ${errorText}`)
                }
                
                const data = await response.json()
                console.log('✅ AI workflow started:', data.taskId)
                
                toast.success('AI workflow started!')
                setPaymentModal({ open: false })
                setExecutionState({
                    taskId: data.taskId,
                    currentStep: null,
                    completedSteps: new Set(),
                    failedSteps: new Set(),
                    isPolling: true,
                    isAIChat: true
                })
                
                // FIXED: Use SAME polling as visual builder!
                console.log('⏳ Waiting for task completion (using pipeline polling)...')
                const finalResult = await waitForPipelineCompletion(data.taskId)
                console.log('✅ Task completed:', finalResult)
                setExecutionResult(finalResult)
                toast.success('AI workflow completed successfully!')
                
            } else {
                console.log('✅ Visual Builder: Payment confirmed, executing pipeline...')
                
                // Step 4: Retry with L402 authorization
                const result = await executePipelineWithPayment(nodes, edges, txHash, taskDescription)
                
                toast.success('Pipeline execution started!')
                setPaymentModal({ open: false })
                
                // Start status polling for visual feedback
                setExecutionState({
                    taskId: result.taskId,
                    currentStep: 1,
                    completedSteps: new Set(),
                    failedSteps: new Set(),
                    isPolling: true,
                    isAIChat: false
                })
                
                // Poll for completion
                const finalResult = await waitForPipelineCompletion(result.taskId)
                setExecutionResult(finalResult)
                toast.success('Pipeline completed successfully!')
            }

        } catch (error: any) {
            console.error('Execution after payment error:', error)
            toast.error(error.message || 'Execution failed after payment')
            // Clear polling state on error
            setExecutionState(prev => ({ ...prev, isPolling: false }))
        } finally {
            setIsExecuting(false)
        }
    }, [txHash, nodes, edges, taskDescription])

    // Trigger execution after successful payment
    useEffect(() => {
        if (isTxSuccess && txHash && processedTxRef.current !== txHash) {
            processedTxRef.current = txHash
            handlePaymentSuccess()
        }
    }, [isTxSuccess, txHash, handlePaymentSuccess])

    return (
        <div className="h-screen flex flex-col bg-zinc-950">
            <Navbar />
            
            {/* Tab Toggle - visible below navbar */}
            <div className="flex justify-center py-3 bg-zinc-950 border-b border-zinc-800/50" style={{ marginTop: '80px' }}>
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                    <button
                        onClick={() => setActiveTab('canvas')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeTab === 'canvas'
                                ? 'bg-zinc-800 text-zinc-100'
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                        }`}
                    >
                        Visual Builder
                    </button>
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeTab === 'chat'
                                ? 'bg-zinc-800 text-zinc-100'
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                        }`}
                    >
                        AI Chat
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - only in canvas mode */}
                {activeTab === 'canvas' && <AgentSidebar onDragStart={onDragStart} />}

                {/* Main Content */}
                <div className="flex-1 flex flex-col relative">
                    {/* Content Area */}
                    {activeTab === 'canvas' ? (
                <div className="flex-1 relative" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    nodeTypes={nodeTypes}
                    defaultEdgeOptions={defaultEdgeOptions}
                    fitView
                    className="bg-zinc-950"
                >
                    <Background color="#27272a" gap={16} />
                    <Controls
                        className="!bg-zinc-900 !border-zinc-800 !rounded-md [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-700 [&>button]:!w-6 [&>button]:!h-6"
                    />
                    <PipelineControls onClear={handleClear} onExecute={handleExecute} isExecuting={isExecuting} />
                </ReactFlow>

                {/* Empty state */}
                {nodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <p className="text-zinc-500 text-sm mb-1">Drag agents from the sidebar</p>
                            <p className="text-zinc-600 text-xs">Connect them to build your pipeline</p>
                        </div>
                    </div>
                )}

                {/* Pipeline Stats Bar */}
                {nodes.length > 0 && (
                    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20
                                    bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 
                                    rounded-lg px-4 py-2 flex items-center gap-4 shadow-lg pointer-events-auto">
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-400 text-xs">Agents:</span>
                            <span className="text-white font-medium text-sm">{pipelineStats.agentCount}</span>
                        </div>
                        <div className="w-px h-4 bg-zinc-700" />
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-400 text-xs">Total Cost:</span>
                            <span className="text-green-400 font-medium text-sm">{pipelineStats.totalAmount} TCRO</span>
                        </div>
                    </div>
                )}

                {/* Execution Result Display */}
                {executionResult && (
                    <div className="absolute top-4 right-4 z-20 max-w-md
                                    bg-zinc-900/95 backdrop-blur-sm border border-green-500/30
                                    rounded-lg p-4 shadow-lg">
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                <h3 className="text-green-400 font-semibold text-sm mb-2">✓ Pipeline Completed</h3>
                                <div className="text-xs text-zinc-300 space-y-1">
                                    <p>Task ID: <span className="font-mono text-zinc-400">{executionResult.taskId?.slice(0, 16)}...</span></p>
                                    {executionResult.results && (
                                        <div className="mt-2 p-2 bg-zinc-800/50 rounded text-xs max-h-32 overflow-y-auto">
                                            <pre className="whitespace-pre-wrap">{JSON.stringify(executionResult.aggregatedOutput || executionResult.results, null, 2)}</pre>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setExecutionResult(null)}
                                    className="mt-2 text-xs text-zinc-500 hover:text-zinc-400"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
                ) : (
                    /* Chat Mode */
                    <ChatPanel 
                        onRequestPayment={(cost, planId, taskDesc) => {
                            setTaskDescription(taskDesc)
                            setPaymentModal({
                                open: true,
                                paymentDetails: {
                                    amount: cost,
                                    currency: 'TCRO',
                                    recipient: '0x561009A39f2BC5a975251685Ae8C7F98Fac063C7',
                                    chainId: 338
                                }
                            })
                        }}
                        executionResult={executionState.isAIChat ? executionResult : null}
                        isExecuting={executionState.isAIChat && isExecuting}
                    />
                )}
                </div>
            </div>

            {/* Task Input Dialog */}
            <TaskInputDialog
                open={taskInputOpen}
                onOpenChange={setTaskInputOpen}
                onSubmit={handleTaskSubmit}
                agentCount={nodes.length}
            />

            {/* L402 Payment Modal */}
            {paymentModal.paymentDetails && (
                <PaymentModal
                    open={paymentModal.open}
                    onOpenChange={(open) => setPaymentModal({ ...paymentModal, open })}
                    amount={paymentModal.paymentDetails.amount}
                    currency={paymentModal.paymentDetails.currency}
                    recipient={paymentModal.paymentDetails.recipient}
                    chainId={paymentModal.paymentDetails.chainId}
                    onPayment={handlePayment}
                    isConnected={isConnected}
                    onConnect={() => {}} // Handled by navbar
                    isPending={isPending}
                    isConfirming={isConfirming}
                    isSuccess={isTxSuccess}
                    error={txError}
                    txHash={txHash}
                />
            )}

            {/* Execution Log Window */}
            <ExecutionLog 
                taskId={executionState.taskId}
                isExecuting={isExecuting}
            />

            {/* Results Modal */}
            {executionResult && (
                <ResultsModal
                    open={!!executionResult}
                    onOpenChange={(open) => !open && setExecutionResult(null)}
                    taskId={executionResult.taskId || executionState.taskId || ''}
                    steps={executionResult.steps?.map((s: any, i: number) => ({
                        order: i + 1,
                        agent: s.agent || `Step ${i + 1}`,
                        status: s.error ? 'failed' : 'completed',
                        result: s.result,
                        error: s.error
                    })) || []}
                    aggregatedOutput={executionResult.aggregatedOutput || executionResult.results}
                    status={executionResult.success ? 'completed' : 'failed'}
                />
            )}
        </div>
    )
}

export default function CanvasPage() {
    return (
        <main className="min-h-screen bg-zinc-950">
            <Navbar />
            <ReactFlowProvider>
                <CanvasContent />
            </ReactFlowProvider>
        </main>
    )
}
