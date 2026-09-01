import { downloadContentFromMessage, WAMessage, proto } from '@whiskeysockets/baileys';
import { aiService } from './ai.js';
import { logger } from '../utils/logger.js';

export class TranscriberService {
  /**
   * Extract audio message object from possible nested message structures
   */
  public extractAudioMessage(msg?: proto.IMessage | null): proto.Message.IAudioMessage | null {
    if (!msg) return null;

    if (msg.audioMessage) return msg.audioMessage;
    if (msg.ephemeralMessage?.message?.audioMessage) return msg.ephemeralMessage.message.audioMessage;
    if (msg.viewOnceMessage?.message?.audioMessage) return msg.viewOnceMessage.message.audioMessage;
    if (msg.viewOnceMessageV2?.message?.audioMessage) return msg.viewOnceMessageV2.message.audioMessage;

    // Check quoted message
    const quoted = msg.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted) {
      if (quoted.audioMessage) return quoted.audioMessage;
      if (quoted.ephemeralMessage?.message?.audioMessage) return quoted.ephemeralMessage.message.audioMessage;
      if (quoted.viewOnceMessage?.message?.audioMessage) return quoted.viewOnceMessage.message.audioMessage;
      if (quoted.viewOnceMessageV2?.message?.audioMessage) return quoted.viewOnceMessageV2.message.audioMessage;
    }

    return null;
  }

  /**
   * Process a voice note or audio message and return transcription text
   */
  public async handleAudioMessage(
    sock: any,
    message: WAMessage
  ): Promise<string | null> {
    try {
      const audioMessage = this.extractAudioMessage(message.message);

      if (!audioMessage) {
        logger.warn('No audio message structure found in message');
        return null;
      }

      logger.info('Downloading audio stream for transcription...');

      // Download audio chunks directly using Baileys downloadContentFromMessage
      const stream = await downloadContentFromMessage(audioMessage, 'audio');
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      if (!buffer || buffer.length === 0) {
        logger.warn('Audio buffer empty after download');
        return null;
      }

      logger.info(
        { sizeBytes: buffer.length, mimetype: audioMessage.mimetype },
        'Transcribing audio buffer with AI...'
      );

      const result = await aiService.transcribeAudio(
        buffer,
        audioMessage.mimetype || 'audio/ogg; codecs=opus'
      );

      return result.transcript;
    } catch (err: any) {
      logger.error({ err: err?.message || err }, 'Failed to download or transcribe audio message');
      return `⚠️ Failed to transcribe audio: ${err.message || 'Error occurred'}`;
    }
  }
}

export const transcriberService = new TranscriberService();
