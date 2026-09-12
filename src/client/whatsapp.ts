import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  proto,
  useMultiFileAuthState,
  WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config } from '../config/index.js';
import { messageHandler } from '../handlers/messageHandler.js';
import { reminderService } from '../services/reminderService.js';
import { logger } from '../utils/logger.js';

// In-memory store of recent message protos to satisfy retry / re-decryption requests
const messageStore = new Map<string, proto.IMessage>();

export class WhatsAppClient {
  private sock: WASocket | null = null;

  public async connect(): Promise<WASocket> {
    const { state, saveCreds } = await useMultiFileAuthState(config.authFolder);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info({ version, isLatest }, 'Using Baileys version');

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }) as any,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      retryRequestDelayMs: 350,
      maxMsgRetryCount: 5,
      shouldIgnoreJid: (jid) => jid.endsWith('@broadcast'),
      getMessage: async (key) => {
        if (key.id && messageStore.has(key.id)) {
          return messageStore.get(key.id);
        }
        return undefined;
      }
    });

    // Wrap sendMessage to intercept @lid routing, strip quotes for self chat, and track sent IDs
    const rawSendMessage = this.sock.sendMessage.bind(this.sock);
    this.sock.sendMessage = async (jid: string, content: any, options?: any) => {
      let target = jid;
      const myPhone = config.pairingPhoneNumber || (this.sock?.user?.id ? this.sock.user.id.split(':')[0].replace(/[^0-9]/g, '') : '');
      const myLid = this.sock?.user?.lid ? this.sock.user.lid.split(':')[0].replace(/[^0-9]/g, '') : '';

      // If target is LID or self, route to standard phone JID
      if (target.endsWith('@lid') && myPhone) {
        if (!myLid || target.includes(myLid) || options?.quoted?.key?.fromMe) {
          target = `${myPhone}@s.whatsapp.net`;
        }
      }

      const isSelf = !!myPhone && target.includes(myPhone);

      try {
        const opts = isSelf ? { ...options, quoted: undefined } : options;
        const res = await rawSendMessage(target, content, opts);
        if (res?.key?.id) {
          messageHandler.registerBotMessageId(res.key.id);
        }
        return res;
      } catch (err: any) {
        logger.warn({ err: err?.message || err, target }, 'Failed to send message with options, falling back without quote');
        const fallbackOpts = { ...options, quoted: undefined };
        const res = await rawSendMessage(target, content, fallbackOpts);
        if (res?.key?.id) {
          messageHandler.registerBotMessageId(res.key.id);
        }
        return res;
      }
    };

    // If pairing phone number is set and device is not registered yet, request pairing code
    if (config.pairingPhoneNumber && !state.creds.registered) {
      setTimeout(async () => {
        try {
          logger.info(`Requesting pairing code for phone number: ${config.pairingPhoneNumber}`);
          const code = await this.sock?.requestPairingCode(config.pairingPhoneNumber);
          console.log('\n╔═══════════════════════════════════════════════════╗');
          console.log(`║ 🔑 YOUR WHATSAPP PAIRING CODE: ${code}       ║`);
          console.log('║                                                   ║');
          console.log('║ 1. Open WhatsApp on your phone                    ║');
          console.log('║ 2. Tap Settings > Linked Devices > Link a Device  ║');
          console.log('║ 3. Tap "Link with phone number instead"           ║');
          console.log('║ 4. Enter the 8-digit code shown above             ║');
          console.log('╚═══════════════════════════════════════════════════╝\n');
        } catch (err: any) {
          logger.error({ err: err?.message || err }, 'Failed to request pairing code');
        }
      }, 3000);
    }

    // Handle credentials update
    this.sock.ev.on('creds.update', saveCreds);

    // Handle connection updates
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Handle QR code display (if not using pairing code)
      if (qr && !config.pairingPhoneNumber) {
        this.displayQR(qr);
      }

      // Handle connection status changes
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        logger.warn(
          { statusCode, reason: (lastDisconnect?.error as Boom)?.message || 'Unknown disconnect reason', isLoggedOut },
          'Connection closed'
        );

        if (!isLoggedOut) {
          logger.info('Reconnecting to WhatsApp in 3 seconds...');
          setTimeout(() => this.connect(), 3000);
        } else {
          logger.error('Device logged out (401). To reconnect, run `npm run clean:auth` and then `npm start` to generate a fresh pairing code.');
        }
      } else if (connection === 'open') {
        logger.info('🚀 Successfully connected to WhatsApp! Carnivore AI is now online.');
        reminderService.init(() => this.sock);
        const userJid = this.sock?.user?.id;
        const userName = this.sock?.user?.name;
        console.log('\n=============================================');
        console.log(`🦁 Logged in as: Carnivore (${userName || 'User'}) (${userJid?.split(':')[0] || 'Unknown'})`);
        console.log(`👤 Creator: Tazim`);
        console.log(`🤖 AI Trigger: ${config.commandPrefix} or mention in groups`);
        console.log(`🎙️ Voice Note Transcription: ${config.autoTranscribeAudio ? 'Active' : 'Disabled'}`);
        console.log('⏰ Background Reminders: Active');
        console.log('=============================================\n');
      }
    });

    // Handle incoming messages
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      for (const msg of messages) {
        if (msg.key.id && msg.message) {
          messageStore.set(msg.key.id, msg.message);
          if (messageStore.size > 200) {
            const oldestKey = messageStore.keys().next().value;
            if (oldestKey) messageStore.delete(oldestKey);
          }
        }

        if (this.sock && msg.message) {
          await messageHandler.handleMessage(this.sock, msg);
        }
      }
    });

    return this.sock;
  }

  private displayQR(qr: string) {
    console.log('\n=============================================');
    console.log('📱 SCAN THIS QR CODE WITH YOUR WHATSAPP APP');
    console.log('Open WhatsApp > Linked Devices > Link a Device:');
    console.log('=============================================\n');
    qrcode.generate(qr, { small: true });
    console.log('\n=============================================\n');
  }

  public getSocket(): WASocket | null {
    return this.sock;
  }
}

export const waClient = new WhatsAppClient();
