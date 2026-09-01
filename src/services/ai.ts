import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { calendarService, MeetingResult } from './calendar.js';
import { memoryService } from './memoryService.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

interface ChatMessage {
  role: 'user' | 'model' | 'assistant' | 'system';
  content: string;
  senderName?: string;
}

// In-memory conversation history buffer
const chatHistoryMap = new Map<string, ChatMessage[]>();

export class AIService {
  private openrouterClient: OpenAI | null = null;
  private geminiClient: GoogleGenerativeAI | null = null;
  private openaiClient: OpenAI | null = null;
  private groqClient: OpenAI | null = null;

  constructor() {
    if (config.openrouterApiKey) {
      this.openrouterClient = new OpenAI({
        apiKey: config.openrouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/whatsapp-assistant',
          'X-Title': 'WhatsApp AI Assistant'
        }
      });
      logger.info('OpenRouter AI Provider initialized');
    }
    if (config.geminiApiKey) {
      this.geminiClient = new GoogleGenerativeAI(config.geminiApiKey);
      logger.info('Gemini AI Provider initialized');
    }
    if (config.groqApiKey) {
      this.groqClient = new OpenAI({
        apiKey: config.groqApiKey,
        baseURL: 'https://api.groq.com/openai/v1'
      });
      logger.info('Groq AI Provider initialized');
    }
    if (config.openaiApiKey) {
      this.openaiClient = new OpenAI({
        apiKey: config.openaiApiKey
      });
      logger.info('OpenAI Provider initialized');
    }

    if (!config.openrouterApiKey && !config.geminiApiKey && !config.groqApiKey && !config.openaiApiKey) {
      logger.warn('No AI API key found! Please set OPENROUTER_API_KEY or GEMINI_API_KEY in your .env file.');
    }
  }

  public getHistory(chatId: string): ChatMessage[] {
    if (!chatHistoryMap.has(chatId)) {
      chatHistoryMap.set(chatId, []);
    }
    return chatHistoryMap.get(chatId)!;
  }

  public appendToHistory(chatId: string, message: ChatMessage) {
    const history = this.getHistory(chatId);
    history.push(message);
    if (history.length > config.maxHistoryPerChat * 2) {
      history.splice(0, history.length - config.maxHistoryPerChat * 2);
    }
  }

  /**
   * Generates an AI response given a prompt and chat context
   */
  public async generateReply(
    chatId: string,
    prompt: string,
    senderName: string = 'User',
    isGroup: boolean = false,
    groupSubject?: string
  ): Promise<string> {
    const history = this.getHistory(chatId);

    const memoryContext = memoryService.getMemoryPromptContext(chatId);

    const systemInstruction = `You are a smart, helpful, and concise AI WhatsApp Assistant.
You are running directly inside WhatsApp ${isGroup ? `in a group chat called "${groupSubject || 'Group'}"` : 'in a direct message'}.
Guidelines:
- Format your output nicely using WhatsApp markdown (*bold*, _italic_, ~strikethrough~, \`monospace\`, bullet points).
- Keep replies conversational, concise, and helpful (mobile screen friendly).
- When addressing users, be polite and natural.
- You can answer questions, summarize text, assist with brainstorming, calculate, debug code, and more.${memoryContext}`;

    // 1. Try OpenRouter (if configured)
    if (this.openrouterClient) {
      try {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: 'system', content: systemInstruction },
          ...history.slice(-8).map(m => ({
            role: (m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
            content: `${m.senderName ? `[${m.senderName}]: ` : ''}${m.content}`
          })),
          { role: 'user', content: `[${senderName}]: ${prompt}` }
        ];

        let modelName = config.aiModel || 'google/gemini-2.5-flash';
        let completion;
        try {
          completion = await this.openrouterClient.chat.completions.create({
            model: modelName,
            messages
          });
        } catch (callErr: any) {
          logger.warn({ err: callErr.message, model: modelName }, 'Primary OpenRouter model failed, trying fallback google/gemini-2.5-flash');
          completion = await this.openrouterClient.chat.completions.create({
            model: 'google/gemini-2.5-flash',
            messages
          });
        }

        const reply = completion.choices[0]?.message?.content || 'No response generated.';
        this.appendToHistory(chatId, { role: 'user', content: prompt, senderName });
        this.appendToHistory(chatId, { role: 'assistant', content: reply, senderName: 'Assistant' });
        return reply.trim();
      } catch (err: any) {
        logger.error({ err }, 'Error calling OpenRouter API for reply');
        if (!this.geminiClient && !this.groqClient && !this.openaiClient) {
          return `⚠️ Error generating AI reply via OpenRouter: ${err.message || 'Unknown error'}`;
        }
      }
    }

    // 2. Try Direct Gemini
    if (this.geminiClient) {
      try {
        const model = this.geminiClient.getGenerativeModel({
          model: config.aiModel || 'gemini-2.0-flash',
          systemInstruction
        });

        const contents = [
          ...history.slice(-8).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: `${m.senderName ? `[${m.senderName}]: ` : ''}${m.content}` }]
          })),
          {
            role: 'user',
            parts: [{ text: `[${senderName}]: ${prompt}` }]
          }
        ];

        const result = await model.generateContent({ contents });
        const responseText = result.response.text();

        this.appendToHistory(chatId, { role: 'user', content: prompt, senderName });
        this.appendToHistory(chatId, { role: 'model', content: responseText, senderName: 'Assistant' });

        return responseText.trim();
      } catch (err: any) {
        logger.error({ err }, 'Error calling Gemini API for reply');
        if (!this.groqClient && !this.openaiClient) {
          return `⚠️ Error generating AI reply: ${err.message || 'Unknown error'}`;
        }
      }
    }

    // 3. Fallback to Groq / OpenAI
    const fallbackClient = this.groqClient || this.openaiClient;
    if (fallbackClient) {
      try {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: 'system', content: systemInstruction },
          ...history.slice(-8).map(m => ({
            role: (m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
            content: `${m.senderName ? `[${m.senderName}]: ` : ''}${m.content}`
          })),
          { role: 'user', content: `[${senderName}]: ${prompt}` }
        ];

        const modelName = this.groqClient ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
        const completion = await fallbackClient.chat.completions.create({
          model: modelName,
          messages
        });

        const reply = completion.choices[0]?.message?.content || 'No response generated.';
        this.appendToHistory(chatId, { role: 'user', content: prompt, senderName });
        this.appendToHistory(chatId, { role: 'assistant', content: reply, senderName: 'Assistant' });
        return reply.trim();
      } catch (err: any) {
        logger.error({ err }, 'Error calling OpenAI/Groq API for reply');
        return `⚠️ Error generating AI reply: ${err.message || 'Unknown error'}`;
      }
    }

    return '⚠️ No AI API key is configured. Please provide OPENROUTER_API_KEY or GEMINI_API_KEY in your .env file.';
  }

  /**
   * Transcribe an audio buffer (voice note / audio file)
   */
  public async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string = 'audio/ogg; codecs=opus'
  ): Promise<{ transcript: string; summary?: string }> {
    // 1. Try Gemini directly if key provided
    if (this.geminiClient) {
      try {
        const model = this.geminiClient.getGenerativeModel({
          model: 'gemini-2.0-flash'
        });

        const cleanMime = mimeType.split(';')[0].trim() || 'audio/ogg';
        const base64Audio = audioBuffer.toString('base64');

        const prompt = `Transcribe this voice note/audio accurately. 
Format your response as follows:
*📝 Transcription:*
<exact transcribed text here in the spoken language>

*💡 Quick Summary (if longer than 1 sentence):*
<brief 1-2 sentence summary>`;

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: cleanMime,
              data: base64Audio
            }
          }
        ]);

        return { transcript: result.response.text().trim() };
      } catch (err: any) {
        logger.error({ err }, 'Error transcribing audio via Gemini');
      }
    }

    // 2. Try OpenRouter multimodal (google/gemini-2.5-flash supports audio transcription)
    if (this.openrouterClient) {
      try {
        const cleanMime = mimeType.split(';')[0].trim() || 'audio/ogg';
        const base64Audio = audioBuffer.toString('base64');
        const dataUrl = `data:${cleanMime};base64,${base64Audio}`;

        const prompt = `Transcribe this voice note/audio accurately.
Format your response as follows:
*📝 Transcription:*
<exact transcribed text here in the spoken language>

*💡 Quick Summary (if longer than 1 sentence):*
<brief 1-2 sentence summary>`;

        const completion = await this.openrouterClient.chat.completions.create({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url' as any,
                  image_url: {
                    url: dataUrl
                  }
                }
              ] as any
            }
          ]
        });

        const reply = completion.choices[0]?.message?.content;
        if (reply) {
          return { transcript: reply.trim() };
        }
      } catch (err: any) {
        logger.error({ err: err?.message || err }, 'OpenRouter audio transcription error');
      }
    }

    // 3. Try Groq Whisper or OpenAI Whisper
    const whisperClient = this.groqClient || this.openaiClient;
    if (whisperClient) {
      try {
        const file = new File([audioBuffer], 'voice_note.ogg', { type: mimeType });
        const transcription = await whisperClient.audio.transcriptions.create({
          file: file,
          model: this.groqClient ? 'whisper-large-v3' : 'whisper-1'
        });

        return {
          transcript: `*📝 Transcription:*\n${transcription.text}`
        };
      } catch (err: any) {
        logger.error({ err }, 'Error transcribing audio via Whisper');
      }
    }

    return {
      transcript: '⚠️ Voice note received. For audio transcription, please ensure OpenRouter or Gemini/Groq is enabled.'
    };
  }

  /**
   * Summarize a collection of group chat messages
   */
  public async summarizeMessages(messages: string[], groupName?: string): Promise<string> {
    if (!messages.length) {
      return 'No recent messages to summarize.';
    }

    const prompt = `Here are recent messages from the WhatsApp group "${groupName || 'Chat'}":
\n${messages.join('\n')}\n
Please provide a structured, easy-to-read summary of what was discussed, key highlights, action items, or decisions made. Use WhatsApp markdown (*bold*, bullets).`;

    if (this.openrouterClient) {
      try {
        const completion = await this.openrouterClient.chat.completions.create({
          model: config.aiModel || 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }]
        });
        const text = completion.choices[0]?.message?.content;
        if (text) return text.trim();
      } catch (err: any) {
        logger.error({ err }, 'Error summarizing messages with OpenRouter');
      }
    }

    if (this.geminiClient) {
      try {
        const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      } catch (err: any) {
        logger.error({ err }, 'Error summarizing messages with Gemini');
      }
    }

    return '⚠️ Summary unavailable. Please check your API key.';
  }

  /**
   * Intelligently parses a natural language meeting request and schedules it via Google Calendar
   */
  public async handleMeetingSchedule(prompt: string, senderName: string = 'User'): Promise<string> {
    const now = new Date();
    const currentDateStr = now.toLocaleString('en-US', {
      timeZone: config.defaultTimezone,
      dateStyle: 'full',
      timeStyle: 'long'
    });
    const isoNow = now.toISOString();

    const extractionPrompt = `You are an AI meeting scheduler assistant.
Current Reference Time: ${currentDateStr} (ISO: ${isoNow}, Timezone: ${config.defaultTimezone}).

The user message is:
"${prompt}"

Extract the meeting parameters and return ONLY a single valid JSON object (no markdown code blocks, no backticks, no explanatory text):
{
  "isMeeting": true,
  "title": "Meeting Title",
  "description": "Brief agenda or purpose",
  "startTime": "YYYY-MM-DDTHH:mm:ss",
  "endTime": "YYYY-MM-DDTHH:mm:ss",
  "attendees": ["email1@gmail.com"]
}

Rules:
1. "startTime" and "endTime" must be valid local timestamps based on the reference time and timezone (${config.defaultTimezone}).
2. If the user mentions relative times (e.g. "tomorrow at 4pm", "next Tuesday 10am", "in 1 hour"), calculate the exact date & time.
3. If no duration is given, default "endTime" to 30 minutes after "startTime".
4. Extract all valid email addresses in the text as "attendees".
5. If no specific title is mentioned, generate a concise title like "Meeting with ${senderName}" or "Discussion regarding <topic>".`;

    let rawJsonText = '';

    // 1. Try OpenRouter
    if (this.openrouterClient) {
      try {
        const completion = await this.openrouterClient.chat.completions.create({
          model: config.aiModel || 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: extractionPrompt }]
        });
        rawJsonText = completion.choices[0]?.message?.content || '';
      } catch (err: any) {
        logger.error({ err }, 'OpenRouter error during meeting intent extraction');
      }
    }

    // 2. Try Gemini
    if (!rawJsonText && this.geminiClient) {
      try {
        const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(extractionPrompt);
        rawJsonText = result.response.text();
      } catch (err: any) {
        logger.error({ err }, 'Gemini error during meeting intent extraction');
      }
    }

    // 3. Try Groq / OpenAI fallback
    const fallbackClient = this.groqClient || this.openaiClient;
    if (!rawJsonText && fallbackClient) {
      try {
        const completion = await fallbackClient.chat.completions.create({
          model: this.groqClient ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
          messages: [{ role: 'user', content: extractionPrompt }]
        });
        rawJsonText = completion.choices[0]?.message?.content || '';
      } catch (err: any) {
        logger.error({ err }, 'Fallback error during meeting intent extraction');
      }
    }

    try {
      // Clean possible backticks
      const cleanJson = rawJsonText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleanJson);
      if (!parsed.startTime) {
        throw new Error('Could not determine meeting date and time.');
      }

      const startTime = new Date(parsed.startTime);
      const endTime = parsed.endTime ? new Date(parsed.endTime) : new Date(startTime.getTime() + 30 * 60 * 1000);

      const result = await calendarService.scheduleMeeting({
        title: parsed.title || `Meeting with ${senderName}`,
        description: parsed.description || `Scheduled by ${senderName} via WhatsApp AI Assistant`,
        startTime,
        endTime,
        attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
        timeZone: config.defaultTimezone
      });

      return this.formatMeetingResponse(result);
    } catch (parseErr: any) {
      logger.error({ parseErr, rawJsonText }, 'Failed to parse meeting details');
      return `⚠️ I couldn't clearly parse the meeting time and details. Please try with more specifics (e.g. \`!meet Tomorrow at 4 PM with colleague@gmail.com for Sprint Planning\`).`;
    }
  }

  /**
   * Formats meeting result into clean WhatsApp markdown
   */
  private formatMeetingResponse(result: MeetingResult): string {
    const formatTime = (date: Date) => {
      return date.toLocaleString('en-US', {
        timeZone: result.timeZone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    };

    const formattedStart = formatTime(result.startTime);
    const formattedEnd = result.endTime.toLocaleTimeString('en-US', {
      timeZone: result.timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    let msg = `📅 *Meeting Scheduled Successfully!*\n\n`;
    msg += `📌 *Title:* ${result.title}\n`;
    msg += `⏰ *When:* ${formattedStart} – ${formattedEnd} (${result.timeZone})\n`;

    if (result.meetLink) {
      msg += `📹 *Google Meet:* ${result.meetLink}\n`;
    }

    if (result.attendees.length > 0) {
      msg += `👥 *Invited Attendees:* ${result.attendees.map(e => `\`${e}\``).join(', ')}\n`;
      msg += `📧 _Invitations & calendar updates sent to Gmail._\n`;
    }

    if (result.calendarLink) {
      msg += `\n🔗 *Calendar Event:* ${result.calendarLink}\n`;
    }

    return msg;
  }

  /**
   * Analyzes an image with AI vision models and answers user queries or gives a detailed review
   */
  public async analyzeImage(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg',
    prompt?: string,
    senderName: string = 'User',
    chatId?: string
  ): Promise<string> {
    const cleanMime = mimeType.split(';')[0].trim() || 'image/jpeg';
    const base64Image = imageBuffer.toString('base64');
    const userPrompt = prompt?.trim() || 'Please review and describe this image in detail. Highlight all important elements, text, objects, and key insights.';

    const systemInstruction = `You are a vision-capable AI WhatsApp Assistant.
Analyze the user's provided image carefully and provide a helpful, accurate, and insightful response.
Guidelines:
- If the user asks a specific question about the image, directly and thoroughly answer it.
- If no specific question is asked, provide a concise summary, key highlights, and an insightful review of what's in the image.
- If the image contains text, diagrams, code, math, or handwriting, accurately read/explain it.
- Format your response nicely using WhatsApp markdown (*bold*, _italic_, bullet points, \`code\`).`;

    // 1. Try OpenRouter (supports google/gemini-2.5-flash, openai/gpt-4o, etc.)
    if (this.openrouterClient) {
      try {
        const visionModel = config.aiModel.includes('gemini') || config.aiModel.includes('vision') || config.aiModel.includes('4o') || config.aiModel.includes('claude')
          ? config.aiModel
          : 'google/gemini-2.5-flash';

        const completion = await this.openrouterClient.chat.completions.create({
          model: visionModel,
          messages: [
            { role: 'system', content: systemInstruction },
            {
              role: 'user',
              content: [
                { type: 'text', text: `[${senderName}]: ${userPrompt}` },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${cleanMime};base64,${base64Image}`
                  }
                }
              ]
            }
          ]
        });

        const reply = completion.choices[0]?.message?.content || 'Unable to analyze image.';
        if (chatId) {
          this.appendToHistory(chatId, { role: 'user', content: `[Sent Image] ${userPrompt}`, senderName });
          this.appendToHistory(chatId, { role: 'assistant', content: reply, senderName: 'Assistant' });
        }
        return reply.trim();
      } catch (err: any) {
        logger.error({ err }, 'Error analyzing image via OpenRouter vision');
      }
    }

    // 2. Try Gemini directly
    if (this.geminiClient) {
      try {
        const model = this.geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent([
          `${systemInstruction}\n\nUser Question: ${userPrompt}`,
          {
            inlineData: {
              mimeType: cleanMime,
              data: base64Image
            }
          }
        ]);
        const reply = result.response.text();
        if (chatId) {
          this.appendToHistory(chatId, { role: 'user', content: `[Sent Image] ${userPrompt}`, senderName });
          this.appendToHistory(chatId, { role: 'assistant', content: reply, senderName: 'Assistant' });
        }
        return reply.trim();
      } catch (err: any) {
        logger.error({ err }, 'Error analyzing image via Gemini');
      }
    }

    // 3. Try OpenAI directly
    if (this.openaiClient) {
      try {
        const completion = await this.openaiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemInstruction },
            {
              role: 'user',
              content: [
                { type: 'text', text: `[${senderName}]: ${userPrompt}` },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${cleanMime};base64,${base64Image}`
                  }
                }
              ]
            }
          ]
        });
        const reply = completion.choices[0]?.message?.content || 'Unable to analyze image.';
        if (chatId) {
          this.appendToHistory(chatId, { role: 'user', content: `[Sent Image] ${userPrompt}`, senderName });
          this.appendToHistory(chatId, { role: 'assistant', content: reply, senderName: 'Assistant' });
        }
        return reply.trim();
      } catch (err: any) {
        logger.error({ err }, 'Error analyzing image via OpenAI');
      }
    }

    return '⚠️ Could not analyze image. Please ensure your AI API key is configured with vision support.';
  }
}

export const aiService = new AIService();

