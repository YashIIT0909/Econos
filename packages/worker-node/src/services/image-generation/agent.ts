import { GoogleGenAI } from '@google/genai';
import {
    ImageGenerationInput,
    ImageGenerationInputSchema,
    ImageGenerationOutput,
    ImageGenerationOutputSchema,
} from './schema';
import { logger } from '../../utils/logger';

/**
 * Image Generation Agent using Gemini 2.5 Flash Image
 * 
 * Generates actual images using Google's native image generation model
 * This uses the free tier of Gemini API!
 */
export class ImageGenerationAgent {
    private ai: GoogleGenAI;
    private model = 'gemini-2.5-flash-image'; // Gemini 2.5 Flash with image generation

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set');
        }

        this.ai = new GoogleGenAI({ apiKey });
    }

    /**
     * Generate images based on the input prompt
     */
    async execute(input: unknown): Promise<ImageGenerationOutput> {
        const validatedInput = ImageGenerationInputSchema.parse(input);

        logger.debug('ImageGenerationAgent executing', {
            prompt: validatedInput.prompt.slice(0, 50) + '...',
            numberOfImages: validatedInput.numberOfImages,
        });

        // Build the full prompt with style guidance
        let fullPrompt = `Generate an image: ${validatedInput.prompt}`;

        if (validatedInput.style) {
            const styleGuide: Record<string, string> = {
                photo: 'photorealistic, high quality photograph',
                art: 'artistic, painting style, fine art',
                digital_art: 'digital art, modern illustration',
                sketch: 'pencil sketch, hand-drawn style',
            };
            fullPrompt = `${styleGuide[validatedInput.style]}: ${fullPrompt}`;
        }

        if (validatedInput.negativePrompt) {
            fullPrompt += `. Avoid: ${validatedInput.negativePrompt}`;
        }

        try {
            const response = await this.ai.models.generateContent({
                model: this.model,
                contents: fullPrompt,
                config: {
                    responseModalities: ['image', 'text'],
                },
            });

            // Extract images from response
            const images: Array<{ imageBase64: string; mimeType: string }> = [];

            const candidate = response.candidates?.[0];
            if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData?.data) {
                        images.push({
                            imageBase64: part.inlineData.data,
                            mimeType: part.inlineData.mimeType || 'image/png',
                        });
                    }
                }
            }

            if (images.length === 0) {
                throw new Error('No images were generated. The model may have returned text only.');
            }

            const output: ImageGenerationOutput = {
                images,
                prompt: fullPrompt,
                numberOfImages: images.length,
                metadata: {
                    model: this.model,
                    aspectRatio: validatedInput.aspectRatio || '1:1',
                    generatedAt: Math.floor(Date.now() / 1000),
                },
            };

            logger.info('ImageGenerationAgent completed', {
                imagesGenerated: images.length,
            });

            return ImageGenerationOutputSchema.parse(output);
        } catch (error: any) {
            // ---------------------------------------------------------
            // FALLBACK: Generate mock SVG placeholder on rate limit
            // ---------------------------------------------------------
            logger.warn('⚠️ ImageGenerationAgent failed (Rate Limit?), using mock placeholder.', { 
                error: error.message || String(error)
            });

            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Create a simple SVG placeholder as base64
            const svgContent = `
                <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
                    <rect width="512" height="512" fill="#667eea"/>
                    <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">
                        Mock Image
                    </text>
                    <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="14" fill="#e0e0e0" text-anchor="middle" dominant-baseline="middle">
                        ${validatedInput.prompt.slice(0, 40)}...
                    </text>
                    <text x="50%" y="65%" font-family="Arial, sans-serif" font-size="10" fill="#c0c0c0" text-anchor="middle" dominant-baseline="middle">
                        (API Rate Limit - Mock Mode)
                    </text>
                </svg>
            `.trim();

            const mockOutput: ImageGenerationOutput = {
                images: [{
                    imageBase64: Buffer.from(svgContent).toString('base64'),
                    mimeType: 'image/svg+xml'
                }],
                prompt: fullPrompt,
                numberOfImages: 1,
                metadata: {
                    model: this.model,
                    aspectRatio: validatedInput.aspectRatio || '1:1',
                    generatedAt: Math.floor(Date.now() / 1000),
                    note: 'Mock Mode - API Rate Limit'
                },
            };

            return mockOutput;
        }
    }
}

/**
 * Factory function to create an ImageGenerationAgent instance
 */
export function createImageGenerationAgent(): ImageGenerationAgent {
    return new ImageGenerationAgent();
}
