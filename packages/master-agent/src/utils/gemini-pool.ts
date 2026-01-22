/**
 * Gemini API Key Pool
 * Rotates between multiple API keys to avoid rate limits
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from './logger';

class GeminiKeyPool {
    private keys: string[] = [];
    private currentIndex = 0;
    private keyUsageCount = new Map<string, number>();
    
    constructor() {
        this.loadKeys();
    }
    
    private loadKeys() {
        // Load primary key
        const primaryKey = process.env.GEMINI_API_KEY;
        if (primaryKey) {
            this.keys.push(primaryKey);
            this.keyUsageCount.set(primaryKey, 0);
        }
        
        // Load additional keys (GEMINI_API_KEY_2, GEMINI_API_KEY_3, etc.)
        let i = 2;
        while (true) {
            const key = process.env[`GEMINI_API_KEY_${i}`];
            if (!key) break;
            this.keys.push(key);
            this.keyUsageCount.set(key, 0);
            i++;
        }
        
        logger.info('Gemini key pool initialized', { keyCount: this.keys.length });
        
        if (this.keys.length === 0) {
            logger.warn('No Gemini API keys configured! Add GEMINI_API_KEY to .env');
        }
    }
    
    /**
     * Get the next API key in rotation
     */
    getNextKey(): string | null {
        if (this.keys.length === 0) return null;
        
        const key = this.keys[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        
        // Increment usage count
        const count = this.keyUsageCount.get(key) || 0;
        this.keyUsageCount.set(key, count + 1);
        
        return key;
    }
    
    /**
     * Get a Gemini client with the next available key
     */
    getClient(): GoogleGenAI | null {
        const key = this.getNextKey();
        if (!key) return null;
        
        return new GoogleGenAI({ apiKey: key });
    }
    
    /**
     * Get usage statistics
     */
    getStats() {
        return {
            totalKeys: this.keys.length,
            currentIndex: this.currentIndex,
            usagePerKey: Array.from(this.keyUsageCount.entries()).map(([key, count]) => ({
                key: `${key.slice(0, 10)}...`,
                usageCount: count
            }))
        };
    }
}

// Singleton instance
export const geminiPool = new GeminiKeyPool();
