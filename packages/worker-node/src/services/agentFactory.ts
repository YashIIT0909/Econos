import { createImageGenerationAgent } from './image-generation/agent';
import { createSummaryGenerationAgent } from './summary-generation/agent';
import { createResearcherAgent } from './researcher/agent';
import { createWriterAgent } from './writer/agent';
import { createMarketResearchAgent } from './market-research/agent';

export interface Agent {
    execute(input: unknown): Promise<unknown>;
}

export const agentFactories: Record<string, () => Agent> = {
    'image-generation': createImageGenerationAgent,
    'summary-generation': createSummaryGenerationAgent,
    'researcher': createResearcherAgent,
    'writer': createWriterAgent,
    'market-research': createMarketResearchAgent,
};

export function getAgent(serviceId: string): Agent | undefined {
    const factory = agentFactories[serviceId];
    return factory ? factory() : undefined;
}