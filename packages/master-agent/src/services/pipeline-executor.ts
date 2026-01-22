/**
 * Pipeline Executor Service
 * Orchestrates multi-agent workflows from canvas pipeline structure
 */

import { ethers } from 'ethers';
import { runAgentWorkflow, type WorkflowResult } from './workflow';
import type {
    CanvasPipeline,
    PipelineExecutionPlan,
    PipelineExecutionStep,
    PipelineStatus,
    PipelineResult
} from '../types/pipeline-types';

// In-memory storage for pipeline status (could be persisted to DB)
export const pipelineStatuses = new Map<string, PipelineStatus>();
export const pipelineResults = new Map<string, PipelineResult>();

/**
 * Map generic pipeline context to service-specific parameters
 */
function mapServiceParameters(
    serviceName: string,
    context: {
        taskDescription: string;
        previousOutput: any;
        stepOrder: number;
        pipelineId: string;
    }
): any {
    const { taskDescription, previousOutput, stepOrder, pipelineId } = context;
    
    // Map to service-specific schemas
    switch (serviceName) {
        case 'researcher':
            return {
                topic: previousOutput?.topic || taskDescription,
                depth: 'deep'
            };
        
        case 'market-research':
            return {
                topic: previousOutput?.topic || taskDescription,
                marketFocus: 'trends'
            };
        
        case 'writer':
            return {
                topic: previousOutput?.topic || taskDescription,
                content: previousOutput?.data || previousOutput?.summary || '',
                style: 'professional'
            };
        
        case 'summary-generation':
            // Convert previous output to string if it's an object
            const textToSummarize = previousOutput 
                ? (typeof previousOutput === 'string' 
                    ? previousOutput 
                    : JSON.stringify(previousOutput, null, 2))
                : taskDescription;
            
            return {
                text: textToSummarize,
                maxLength: 500
            };
        
        case 'image-generation':
            return {
                prompt: previousOutput?.description || taskDescription,
                style: 'professional'
            };
        
        default:
            // Generic fallback with topic
            return {
                topic: taskDescription,
                input: previousOutput || undefined,
                contextData: {
                    stepOrder,
                    pipelineId
                }
            };
    }
}

/**
 * Parse canvas pipeline into topologically sorted execution plan
 */
export function parseCanvasPipeline(pipeline: CanvasPipeline): PipelineExecutionPlan {
    const { nodes, edges } = pipeline;
    
    // Create task ID
    const taskId = ethers.hexlify(ethers.randomBytes(32));
    
    // Build adjacency map for topological sort
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // Initialize
    for (const node of nodes) {
        adjacency.set(node.id, []);
        inDegree.set(node.id, 0);
    }
    
    // Build graph
    for (const edge of edges) {
        adjacency.get(edge.source)?.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
    
    // Topological sort (Kahn's algorithm)
    const queue: string[] = [];
    const executionOrder: string[] = [];
    
    // Find nodes with no dependencies (root nodes)
    for (const [nodeId, degree] of inDegree) {
        if (degree === 0) {
            queue.push(nodeId);
        }
    }
    
    while (queue.length > 0) {
        const current = queue.shift()!;
        executionOrder.push(current);
        
        // Process neighbors
        const neighbors = adjacency.get(current) || [];
        for (const neighbor of neighbors) {
            const newDegree = (inDegree.get(neighbor) || 0) - 1;
            inDegree.set(neighbor, newDegree);
            
            if (newDegree === 0) {
                queue.push(neighbor);
            }
        }
    }
    
    // Check for cycles
    if (executionOrder.length !== nodes.length) {
        throw new Error('Pipeline contains a cycle - cannot execute');
    }
    
    //Create execution steps
    const steps: PipelineExecutionStep[] = executionOrder.map((nodeId, index) => {
        const node = nodes.find(n => n.id === nodeId)!;
        
        // Find input nodes (predecessors)
        const inputs = edges
            .filter(e => e.target === nodeId)
            .map(e => e.source);
        
        return {
            order: index + 1,
            nodeId: node.id,
            agentName: node.agentName,
            agentAddress: node.walletAddress,
            endpoint: node.endpoint,
            price: node.price || '0.01',
            inputs,
            status: 'pending',
        };
    });
    
    // Calculate total cost
    const totalCost = steps.reduce((sum, step) => {
        return sum + parseFloat(step.price);
    }, 0);
    
    return {
        taskId,
        steps,
        totalCost: totalCost.toFixed(4),
    };
}

/**
 * Execute pipeline sequentially using existing workflow system
 */
export async function executePipeline(
    plan: PipelineExecutionPlan,
    taskDescription?: string
): Promise<PipelineResult> {
    const { taskId, steps } = plan;
    
    console.log(`🔄 Starting pipeline execution: ${taskId}`);
    console.log(`📋 ${steps.length} agents in workflow`);
    
    // Initialize status
    const status: PipelineStatus = {
        taskId,
        status: 'running',
        totalSteps: steps.length,
        completedSteps: 0,
        steps: steps.map(s => ({
            order: s.order,
            agent: s.agentName,
            status: 'pending',
        })),
    };
    pipelineStatuses.set(taskId, status);
    
    // Execute steps sequentially
    const stepResults: Array<{
        order: number
        agent: string
        taskId: string
        result: any
        error?: string
    }> = [];
    
    let previousOutput: any = null;
    
    try {
        for (const step of steps) {
            console.log(`  → Step ${step.order}: ${step.agentName}`);
            
            // Update status
            status.currentStep = step.order;
            status.currentAgent = step.agentName;
            status.steps[step.order - 1].status = 'running';
            pipelineStatuses.set(taskId, status);
            
            try {
                // Remove " Agent" suffix and convert to worker service name format
                const serviceName = step.agentName
                    .replace(/\s+Agent$/i, '') // Remove " Agent" suffix
                    .toLowerCase()
                    .replace(/\s+/g, '-');
                
                // Prepare service-specific parameters
                const serviceParams = mapServiceParameters(
                    serviceName,
                    {
                        taskDescription: taskDescription || 'Execute workflow task',
                        previousOutput: previousOutput,
                        stepOrder: step.order,
                        pipelineId: taskId,
                    }
                );
                
                if (!step.endpoint) {
                    throw new Error(`Agent ${step.agentName} has no endpoint configured`);
                }
                
                // Execute using existing workflow system
                const result: WorkflowResult = await runAgentWorkflow(
                    serviceName,
                    serviceParams,
                    step.price,
                    step.endpoint,
                    step.agentAddress
                );
                
                // Store result
                stepResults.push({
                    order: step.order,
                    agent: step.agentName,
                    taskId: result.taskId,
                    result: result.output,
                });
                
                // Use this agent's output as next agent's input
                previousOutput = result.output;
                
                // Update status
                status.completedSteps++;
                status.steps[step.order - 1].status = 'completed';
                pipelineStatuses.set(taskId, status);
                
                console.log(`  ✓ Step ${step.order} completed`);
                
            } catch (error: any) {
                console.error(`  ✗ Step ${step.order} failed:`, error.message);
                
                // Mark step as failed
                status.steps[step.order - 1].status = 'failed';
                stepResults.push({
                    order: step.order,
                    agent: step.agentName,
                    taskId: '',
                    result: null,
                    error: error.message,
                });
                
                throw error; // Stop pipeline on first failure
            }
        }
        
        // All steps completed successfully
        status.status = 'completed';
        pipelineStatuses.set(taskId, status);
        
        const finalResult: PipelineResult = {
            taskId,
            success: true,
            status: 'completed',
            completedAt: Date.now(),
            steps: stepResults,
            aggregatedOutput: previousOutput,
            results: stepResults.map(s => s.result),
        };
        
        pipelineResults.set(taskId, finalResult);
        console.log(`✅ Pipeline ${taskId} completed successfully`);
        
        return finalResult;
        
    } catch (error: any) {
        // Pipeline failed
        status.status = 'failed';
        pipelineStatuses.set(taskId, status);
        
        const failedResult: PipelineResult = {
            taskId,
            success: false,
            status: 'failed',
            completedAt: Date.now(),
            steps: stepResults,
            results: stepResults.map(s => s.result),
        };
        
        pipelineResults.set(taskId, failedResult);
        console.log(`❌ Pipeline ${taskId} failed`);
        
        throw error;
    }
}

/**
 * Get current pipeline status
 */
export function getPipelineStatus(taskId: string): PipelineStatus | null {
    return pipelineStatuses.get(taskId) || null;
}

/**
 * Get pipeline result
 */
export function getPipelineResult(taskId: string): PipelineResult | null {
    return pipelineResults.get(taskId) || null;
}
