import { downloadMediaMessage, proto, WAMessage } from '@whiskeysockets/baileys';
import * as pdfParseModule from 'pdf-parse';
const pdfParse: any = (pdfParseModule as any).default || pdfParseModule;
import { aiService } from './ai.js';
import { logger } from '../utils/logger.js';

export class DocumentService {
  /**
   * Checks if message is a document (PDF, TXT, CSV, DOCX)
   */
  public extractDocumentInfo(message?: proto.IMessage | null): {
    documentMessage: proto.Message.IDocumentMessage;
    fileName: string;
    mimetype: string;
    isQuoted: boolean;
  } | null {
    if (!message) return null;

    // Direct document
    if (message.documentMessage) {
      return {
        documentMessage: message.documentMessage,
        fileName: message.documentMessage.fileName || 'document',
        mimetype: message.documentMessage.mimetype || 'application/octet-stream',
        isQuoted: false
      };
    }

    // Quoted document
    const quoted =
      message.extendedTextMessage?.contextInfo?.quotedMessage ||
      message.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (quoted?.documentMessage) {
      return {
        documentMessage: quoted.documentMessage,
        fileName: quoted.documentMessage.fileName || 'document',
        mimetype: quoted.documentMessage.mimetype || 'application/octet-stream',
        isQuoted: true
      };
    }

    return null;
  }

  /**
   * Downloads document and analyzes its text content with AI
   */
  public async handleDocumentAnalysis(
    msg: WAMessage,
    documentInfo: { documentMessage: proto.Message.IDocumentMessage; fileName: string; mimetype: string },
    userPrompt: string,
    senderName: string,
    chatId: string
  ): Promise<string> {
    try {
      logger.info({ fileName: documentInfo.fileName, mimetype: documentInfo.mimetype }, 'Downloading document for analysis');
      const buffer = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        { logger: logger as any, reuploadRequest: () => Promise.reject(new Error('Reupload not supported')) }
      );

      let extractedText = '';

      if (documentInfo.mimetype.includes('pdf') || documentInfo.fileName.endsWith('.pdf')) {
        const pdfData = await pdfParse(buffer as Buffer);
        extractedText = pdfData.text;
      } else {
        // Plain text, CSV, markdown, JSON
        extractedText = (buffer as Buffer).toString('utf-8');
      }

      if (!extractedText.trim()) {
        return '⚠️ *Could not extract readable text from this document.* (It may be encrypted or scanned image-only PDF).';
      }

      // Truncate to reasonable token limit (~12,000 characters)
      const truncated = extractedText.length > 12000
        ? extractedText.substring(0, 12000) + '\n\n...[Document truncated for length]...'
        : extractedText;

      const instruction = userPrompt && userPrompt.length > 2
        ? userPrompt
        : 'Provide a structured summary of this document, including key takeaways, important details, and action points.';

      const prompt = `You are an AI document analysis assistant.
Document Name: "${documentInfo.fileName}"
Sender: "${senderName}"

User Request: "${instruction}"

--- DOCUMENT CONTENT ---
${truncated}
--- END DOCUMENT CONTENT ---

Please provide a clear, professional, and well-structured response based on the document content using WhatsApp formatting (*bold*, bullet points, \`code\`).`;

      return await aiService.generateReply(chatId, prompt, senderName, false);
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to process document');
      return `⚠️ *Error analyzing document:* ${err.message || 'Unknown error occurred'}`;
    }
  }
}

export const documentService = new DocumentService();
