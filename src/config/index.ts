import dotenv from 'dotenv';

dotenv.config();

export const config = {
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'google/gemini-2.5-flash',
  commandPrefix: (process.env.COMMAND_PREFIX || '!ai').toLowerCase(),
  wakeWords: (process.env.WAKE_WORDS || 'assistant,bot,ai')
    .split(',')
    .map(w => w.trim().toLowerCase())
    .filter(Boolean),
  autoTranscribeAudio: process.env.AUTO_TRANSCRIBE_AUDIO !== 'false',
  autoReplyDms: process.env.AUTO_REPLY_DMS === 'true',
  respondOnTag: process.env.RESPOND_ON_TAG !== 'false',
  pairingPhoneNumber: process.env.PAIRING_PHONE_NUMBER?.replace(/[^0-9]/g, '') || '',
  authFolder: process.env.AUTH_FOLDER || 'auth_info_baileys',
  maxHistoryPerChat: 15,
  googleServiceAccountKeyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '',
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY || '',
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata'
};

