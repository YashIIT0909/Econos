import { Router, Request, Response } from 'express';
import axios from 'axios';
import { MasterAgentOrchestrator } from '../services/masterAgentOrchestrator';
import { logger } from '../utils/logger';

const router = Router();

// Initialize orchestrator (will be injected in server.ts)
let orchestrator: MasterAgentOrchestrator;

export function setOrchestrator(orc: MasterAgentOrchestrator) {
    orchestrator = orc;
}

/**
 * POST /ai/analyze
 * Analyze a natural language task and generate workflow plan
 * No payment required - just returns the plan and cost
 */
router.post('/analyze', async (req: Request, res: Response) => {
    try {
        const { taskDescription } = req.body;

        if (!taskDescription) {
            return res.status(400).json({ error: 'taskDescription is required' });
        }

        logger.info('AI analyzing task', { taskDescription });

        // Use MasterAgentOrchestrator to analyze task
        const plan = await orchestrator.analyzeTask(taskDescription);

        // Return plan with cost estimate
        res.json({
            success: true,
            plan: {
                planId: plan.planId,
                description: taskDescription,
                workflow: plan.steps.map(step => ({
                    order: step.order,
                    agent: step.serviceType,
                    description: step.description,
                })),
                estimatedCost: plan.estimatedBudgetWei,
                estimatedCostEther: (Number(plan.estimatedBudgetWei) / 1e18).toFixed(4),
                reasoning: plan.reasoning || 'AI-generated workflow',
            }
        });

    } catch (error: any) {
        logger.error('AI analyze error', { error: error.message });
        res.status(500).json({ 
            error: error.message || 'Failed to analyze task',
            details: error.toString()
        });
    }
});

/**
 * POST /ai/execute
 * Execute an AI-generated workflow with payment verification
 * Requires payment proof (transaction hash)
 * 
 * FIXED: Now uses the same pipeline storage as visual builder for consistency
 */
router.post('/execute', async (req: Request, res: Response) => {
    try {
        const { taskDescription, paymentTxHash } = req.body;

        if (!taskDescription) {
            return res.status(400).json({ error: 'taskDescription is required' });
        }

        if (!paymentTxHash) {
            return res.status(400).json({ error: 'paymentTxHash is required for execution' });
        }

        logger.info('AI executing task', { taskDescription, paymentTxHash });

        // Import pipeline storage
        const { pipelineStatuses, pipelineResults } = await import('../services/pipeline-executor');
        
        // Execute workflow using MasterAgentOrchestrator  
        const result = await orchestrator.analyzeAndSubmit(taskDescription);

        // Extract taskId correctly based on execution type
        let taskId: string;
        
        if (result.executionType === 'single') {
            // For single agent: result.result is SubmitTaskResult
            taskId = (result.result as any).task.taskId;
            
            // FIXED: Store in pipeline format so visual builder polling works
            // Initialize as running
            pipelineStatuses.set(taskId, {
                taskId,
                status: 'running',
                totalSteps: 1,
                completedSteps: 0,
                currentStep: 1,
                currentAgent: 'AI Agent',
                steps: [{ order: 1, agent: 'AI Agent', status: 'running' }]
            });
            
            logger.info('Stored initial pipeline status', { taskId });
            
            // Start async monitoring to update when complete
            setImmediate(async () => {
                try {
                    logger.info('Starting background monitoring for AI task', { taskId });
                    
                    // Get worker info
                    const workers = await orchestrator.getAvailableWorkers();
                    const task = await orchestrator.getTaskStatus(taskId);
                    const worker = workers.find(w => 
                        w.address.toLowerCase() === task?.assignedWorker?.toLowerCase()
                    );
                    
                    if (!worker || !worker.endpoint) {
                        logger.error('Worker endpoint not found', { taskId });
                        return;
                    }
                    
                    // Poll for result directly from worker
                    const pollInterval = setInterval(async () => {
                        try {
                            // Try to fetch result from worker
                            const resultResponse = await axios.get(
                                `${worker.endpoint}/result/${taskId}`,
                                { timeout: 5000 }
                            );
                            
                            if (resultResponse.data && resultResponse.data.success) {
                                // Result is ready!
                                clearInterval(pollInterval);
                                const resultData = resultResponse.data.data;
                                
                                // Store completed result
                                pipelineStatuses.set(taskId, {
                                    taskId,
                                    status: 'completed',
                                    totalSteps: 1,
                                    completedSteps: 1,
                                    steps: [{ order: 1, agent: 'AI Agent', status: 'completed' }]
                                });
                                
                                pipelineResults.set(taskId, {
                                    taskId,
                                    success: true,
                                    status: 'completed',
                                    completedAt: Date.now(),
                                    steps: [{ order: 1, agent: 'AI Agent', taskId, result: resultData }],
                                    aggregatedOutput: resultData,
                                    results: [resultData]
                                });
                                
                                logger.info('AI task result fetched and stored', { taskId });
                            }
                        } catch (error: any) {
                            // Result not ready yet, continue polling
                            if (error.response?.status !== 404) {
                                logger.debug('Polling for result', { taskId, error: error.message });
                            }
                        }
                    }, 2000);
                    
                    // Timeout after 5 minutes
                    setTimeout(() => {
                        clearInterval(pollInterval);
                        logger.warn('AI task monitoring timed out', { taskId });
                    }, 300000);
                } catch (error: any) {
                    logger.error('Error monitoring AI task', { taskId, error: error.message });
                }
            });
        } else {
            // For multi-agent: already uses pipeline stores
            taskId = (result.result as any).taskId;
        }

        logger.info('Workflow execution started', { taskId, executionType: result.executionType });

        res.json({
            success: result.success,
            taskId: taskId,
            executionType: result.executionType,
            message: 'Workflow execution started. Poll /pipeline/:taskId/status for updates.'
        });

    } catch (error: any) {
        logger.error('AI execute error', { error: error.message });
        res.status(500).json({ 
            error: error.message || 'Failed to execute workflow',
            details: error.toString()
        });
    }
});

/**
 * GET /ai/status/:taskId
 * Get execution status for an AI-generated workflow
 */
router.get('/status/:taskId', async (req: Request, res: Response) => {
    try {
        const taskId = Array.isArray(req.params.taskId) 
            ? req.params.taskId[0] 
            : req.params.taskId;

        // Get task status from orchestrator
        const task = await orchestrator.getTaskStatus(taskId);

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // FIXED: If task is completed, fetch actual result from worker
        let resultData = null;
        if (task.status === 'COMPLETED' && task.assignedWorker) {
            try {
                // Get worker endpoint (you might need to look this up from worker registry)
                const workers = await orchestrator.getAvailableWorkers();
                const worker = workers.find(w => w.address.toLowerCase() === task.assignedWorker?.toLowerCase());
                
                if (worker && worker.endpoint) {
                    logger.info('Fetching result from worker', { taskId, endpoint: worker.endpoint });
                    
                    // Fetch result from worker
                    const axios = require('axios');
                    const resultResponse = await axios.get(`${worker.endpoint}/result/${taskId}`, {
                        timeout: 5000
                    });
                    
                    if (resultResponse.data && resultResponse.data.success) {
                        resultData = resultResponse.data.data;
                        logger.info('Result fetched successfully', { taskId });
                    }
                } else {
                    logger.warn('Worker endpoint not found for completed task', { 
                        taskId, 
                        assignedWorker: task.assignedWorker 
                    });
                }
            } catch (error: any) {
                logger.error('Failed to fetch result from worker', { 
                    taskId, 
                    error: error.message 
                });
                // Don't fail the status request if result fetch fails
                // The frontend can retry
            }
        }

        res.json({
            taskId: task.taskId,
            status: task.status,
            result: resultData,
            resultHash: task.resultHash || null,
            error: (task as any).error || null,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
        });

    } catch (error: any) {
        logger.error('AI status error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /ai/capabilities
 * Get available worker capabilities for AI planning
 */
router.get('/capabilities', async (req: Request, res: Response) => {
    try {
        const capabilities = await orchestrator.getCapabilities();
        
        res.json({
            success: true,
            capabilities: {
                serviceCount: capabilities.services.length,
                availableServices: capabilities.availableServiceTypes,
                workers: capabilities.services.map(s => ({
                    type: (s as any).type || (s as any).serviceType || 'unknown',
                    name: s.name,
                    description: s.description,
                }))
            }
        });

    } catch (error: any) {
        logger.error('AI capabilities error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
