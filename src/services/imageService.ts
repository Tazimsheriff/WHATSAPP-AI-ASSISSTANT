import { downloadContentFromMessage, proto } from '@whiskeysockets/baileys';
import { aiService } from './ai.js';
import { logger } from '../utils/logger.js';

export class ImageService {
  /**
   * Extract image message from root or nested structures
   */
  public extractImageMessage(msg?: proto.IMessage | null): { image: proto.Message.IImageMessage; isQuoted: boolean } | null {
    if (!msg) return null;

    if (msg.imageMessage) return { image: msg.imageMessage, isQuoted: false };
    if (msg.ephemeralMessage?.message?.imageMessage) return { image: msg.ephemeralMessage.message.imageMessage, isQuoted: false };
    if (msg.viewOnceMessage?.message?.imageMessage) return { image: msg.viewOnceMessage.message.imageMessage, isQuoted: false };
    if (msg.viewOnceMessageV2?.message?.imageMessage) return { image: msg.viewOnceMessageV2.message.imageMessage, isQuoted: false };

    // Check quoted message
    const quoted = msg.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted) {
      if (quoted.imageMessage) return { image: quoted.imageMessage, isQuoted: true };
      if (quoted.ephemeralMessage?.message?.imageMessage) return { image: quoted.ephemeralMessage.message.imageMessage, isQuoted: true };
      if (quoted.viewOnceMessage?.message?.imageMessage) return { image: quoted.viewOnceMessage.message.imageMessage, isQuoted: true };
      if (quoted.viewOnceMessageV2?.message?.imageMessage) return { image: quoted.viewOnceMessageV2.message.imageMessage, isQuoted: true };
    }

    return null;
  }

  /**
   * Downloads image buffer and runs vision analysis with AI
   */
  public async handleImageAnalysis(
    imageMessage: proto.Message.IImageMessage,
    prompt: string = '',
    senderName: string = 'User',
    chatId: string = ''
  ): Promise<string> {
    try {
      logger.info({ mimetype: imageMessage.mimetype }, 'Downloading image for AI vision analysis...');
      const stream = await downloadContentFromMessage(imageMessage, 'image');
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      if (!buffer || buffer.length === 0) {
        return '⚠️ Could not download the image. Please try sending it again.';
      }

      logger.info({ sizeBytes: buffer.length }, 'Analyzing image with AI vision...');
      return await aiService.analyzeImage(
        buffer,
        imageMessage.mimetype || 'image/jpeg',
        prompt,
        senderName,
        chatId
      );
    } catch (err: any) {
      logger.error({ err }, 'Failed to process and analyze image');
      return `⚠️ Error analyzing image: ${err.message || 'Unknown error'}`;
    }
  }
}

export const imageService = new ImageService();
