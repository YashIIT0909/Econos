import { z } from 'zod';

/**
 * Input schema for image generation service
 */
export const ImageGenerationInputSchema = z.object({
    prompt: z.string().min(3).max(1000).describe('Description of the image to generate'),
    numberOfImages: z.number().min(1).max(4).optional().default(1),
    aspectRatio: z.enum(['1:1', '3:4', '4:3', '9:16', '16:9']).optional().default('1:1'),
    style: z.enum(['photo', 'art', 'digital_art', 'sketch']).optional(),
    negativePrompt: z.string().max(500).optional().describe('What to avoid in the image'),
});

export type ImageGenerationInput = z.infer<typeof ImageGenerationInputSchema>;

/**
 * Output schema for image generation service
 */
export const ImageGenerationOutputSchema = z.object({
    images: z.array(z.object({
        imageBase64: z.string().describe('Base64 encoded PNG image'),
        mimeType: z.string().default('image/png'),
    })),
    prompt: z.string(),
    numberOfImages: z.number(),
    metadata: z.object({
        model: z.string(),
        aspectRatio: z.string(),
        generatedAt: z.number(),
        note: z.string().optional(),
    }),
});

export type ImageGenerationOutput = z.infer<typeof ImageGenerationOutputSchema>;
