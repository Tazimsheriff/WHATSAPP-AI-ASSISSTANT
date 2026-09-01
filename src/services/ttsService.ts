import * as googleTTS from 'google-tts-api';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class TTSService {
  private openaiClient: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Converts text to speech audio buffer
   */
  public async generateSpeechBuffer(text: string): Promise<{ buffer: Buffer; mimetype: string } | null> {
    const cleanText = text
      .replace(/[*_~`]/g, '') // remove markdown
      .replace(/https?:\/\/\S+/g, '') // remove URLs
      .trim();

    if (!cleanText) return null;

    // Truncate to reasonable speech length (~400 characters)
    const speechText = cleanText.length > 400 ? cleanText.substring(0, 400) + '...' : cleanText;

    // 1. Try OpenAI TTS (if key available)
    if (this.openaiClient) {
      try {
        logger.info('Generating speech via OpenAI TTS');
        const mp3 = await this.openaiClient.audio.speech.create({
          model: 'tts-1',
          voice: 'nova',
          input: speechText
        });
        const arrayBuffer = await mp3.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuffer),
          mimetype: 'audio/mp4'
        };
      } catch (err: any) {
        logger.warn({ err: err.message }, 'OpenAI TTS failed, falling back to Google TTS');
      }
    }

    // 2. Free Google TTS Fallback
    try {
      logger.info('Generating speech via Google TTS');
      const base64 = await googleTTS.getAudioBase64(speechText, {
        lang: 'en',
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000
      });
      return {
        buffer: Buffer.from(base64, 'base64'),
        mimetype: 'audio/mp4'
      };
    } catch (err: any) {
      logger.error({ err: err.message }, 'Google TTS generation failed');
      return null;
    }
  }
}

export const ttsService = new TTSService();
