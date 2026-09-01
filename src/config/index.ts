import dotenv from 'dotenv';

dotenv.config();

function sanitizeModel(modelStr?: string): string {
  if (!modelStr) return 'google/gemini-2.5-flash';
  const clean = modelStr.trim().replace(/[\r\n\t]/g, '');
  if (!clean || clean.includes('gemini-2.0-flash-001') || clean === 'google/gemini-2.0-flash') {
    return 'google/gemini-2.5-flash';
  }
  return clean;
}

export const config = {
  openrouterApiKey: (process.env.OPENROUTER_API_KEY || '').trim().replace(/[\r\n\t]/g, ''),
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim().replace(/[\r\n\t]/g, ''),
  groqApiKey: (process.env.GROQ_API_KEY || '').trim().replace(/[\r\n\t]/g, ''),
  openaiApiKey: (process.env.OPENAI_API_KEY || '').trim().replace(/[\r\n\t]/g, ''),
  aiModel: sanitizeModel(process.env.AI_MODEL),
  commandPrefix: (process.env.COMMAND_PREFIX || '!ai').trim().toLowerCase(),
  wakeWords: (process.env.WAKE_WORDS || 'assistant,bot,ai')
    .split(',')
    .map(w => w.trim().toLowerCase().replace(/[\r\n\t]/g, ''))
    .filter(Boolean),
  autoTranscribeAudio: process.env.AUTO_TRANSCRIBE_AUDIO !== 'false',
  autoReplyDms: process.env.AUTO_REPLY_DMS === 'true',
  respondOnTag: process.env.RESPOND_ON_TAG !== 'false',
  pairingPhoneNumber: process.env.PAIRING_PHONE_NUMBER?.replace(/[^0-9]/g, '') || '',
  authFolder: (process.env.AUTH_FOLDER || 'auth_info_baileys').trim(),
  maxHistoryPerChat: 15,
  googleServiceAccountKeyFile: (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '').trim(),
  googleServiceAccountEmail: (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim(),
  googlePrivateKey: (process.env.GOOGLE_PRIVATE_KEY || '').trim(),
  googleCalendarId: (process.env.GOOGLE_CALENDAR_ID || 'primary').trim(),
  defaultTimezone: (process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata').trim(),
  adminNumbers: (process.env.ADMIN_NUMBERS || process.env.ADMIN_PHONE || '')
    .split(',')
    .map(n => n.replace(/[^0-9]/g, ''))
    .filter(Boolean)
};

