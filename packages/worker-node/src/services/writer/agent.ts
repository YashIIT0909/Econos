import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { WriterInput, WriterInputSchema, WriterOutput, WriterOutputSchema } from './schema';
import { calculateReadingTime, countWords } from './tools';
import { logger } from '../../utils/logger';

const systemPrompt = fs.readFileSync(path.join(__dirname, 'prompt.txt'), 'utf-8');

export class WriterAgent {
    private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }

    async execute(input: unknown): Promise<WriterOutput> {
        const validatedInput = WriterInputSchema.parse(input);
        logger.debug('WriterAgent executing', { topic: validatedInput.topic });

        const userPrompt = `
Write ${validatedInput.type} content about: "${validatedInput.topic}"
Tone: ${validatedInput.tone}
Target Length: ~${validatedInput.targetLength} words
${validatedInput.audience ? `Audience: ${validatedInput.audience}` : ''}
${validatedInput.keywords?.length ? `Keywords: ${validatedInput.keywords.join(', ')}` : ''}

Return JSON:
{
  "content": "the written content",
  "title": "optional title",
  "highlights": ["key point 1", "key point 2"]
}`;

        try {
            const result = await this.model.generateContent([{ text: systemPrompt }, { text: userPrompt }]);
            const responseText = result.response.text();
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('Failed to extract JSON');

            const parsed = JSON.parse(jsonMatch[0]);
            const wordCount = countWords(parsed.content);

            return WriterOutputSchema.parse({
                ...parsed,
                wordCount,
                readingTime: calculateReadingTime(wordCount),
                metadata: { type: validatedInput.type, tone: validatedInput.tone, generatedAt: Math.floor(Date.now() / 1000) },
            });
        } catch (error: any) {
            // ---------------------------------------------------------
            // FALLBACK: Mock written content
            // ---------------------------------------------------------
            logger.warn('⚠️ WriterAgent failed (Rate Limit?), using mock content.', {
                error: error.message || String(error)
            });

            await new Promise(resolve => setTimeout(resolve, 2000));

            const mockContent = `This is a ${validatedInput.type} about ${validatedInput.topic}.\n\nDue to API rate limits, this is a placeholder ${validatedInput.type}. The content would normally provide comprehensive information about ${validatedInput.topic} in a ${validatedInput.tone} tone.\n\nKey points that would be covered:\n- Understanding the core concepts\n- Practical applications\n- Current trends and developments\n- Future outlook\n\nThis mock content maintains the requested ${validatedInput.tone} tone while providing a basic framework for the topic.`;

            const wordCount = countWords(mockContent);

            const mockOutput = {
                content: mockContent,
                title: `${validatedInput.topic} - Mock ${validatedInput.type}`,
                highlights: [
                    "Mock content generated due to API limits",
                    `Topic: ${validatedInput.topic}`,
                    `Type: ${validatedInput.type}`
                ],
                wordCount,
                readingTime: calculateReadingTime(wordCount),
                metadata: {
                    type: validatedInput.type,
                    tone: validatedInput.tone,
                    generatedAt: Math.floor(Date.now() / 1000),
                    note: 'Mock Mode - API Rate Limit'
                },
            };

            return mockOutput as any;
        }
    }
}

export function createWriterAgent(): WriterAgent {
    return new WriterAgent();
}
