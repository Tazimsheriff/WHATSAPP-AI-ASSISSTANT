import OpenAI from 'openai';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class ImageGenService {
  private openaiClient: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Generates AI image from prompt and returns image buffer
   */
  public async generateImage(prompt: string): Promise<{ buffer: Buffer; prompt: string } | null> {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) return null;

    logger.info({ prompt: cleanPrompt }, 'Generating AI image');

    // 1. Try Pollinations.ai (Fast, high-res Flux/SDXL model, zero API key needed)
    try {
      const encoded = encodeURIComponent(cleanPrompt);
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&model=flux`;

      const response = await fetch(url);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuffer),
          prompt: cleanPrompt
        };
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Pollinations image generation failed, trying OpenAI fallback');
    }

    // 2. Try OpenAI DALL-E 3
    if (this.openaiClient) {
      try {
        const response = await this.openaiClient.images.generate({
          model: 'dall-e-3',
          prompt: cleanPrompt,
          n: 1,
          size: '1024x1024'
        });

        const imageUrl = response.data?.[0]?.url;
        if (imageUrl) {
          const imgRes = await fetch(imageUrl);
          const arrayBuffer = await imgRes.arrayBuffer();
          return {
            buffer: Buffer.from(arrayBuffer),
            prompt: cleanPrompt
          };
        }
      } catch (err: any) {
        logger.error({ err: err.message }, 'OpenAI DALL-E generation failed');
      }
    }

    return null;
  }
}

export const imageGenService = new ImageGenService();
