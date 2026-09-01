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
      getMessage: async (key) => {
        if (key.id && messageStore.has(key.id)) {
          return messageStore.get(key.id);
        }
        return undefined;
      }
    });

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
          logger.error('Device logged out. Please delete auth_info_baileys folder and restart to scan new QR / code.');
        }
      } else if (connection === 'open') {
        logger.info('🚀 Successfully connected to WhatsApp! AI Assistant is now online.');
        reminderService.init(() => this.sock);
        const userJid = this.sock?.user?.id;
        const userName = this.sock?.user?.name;
        console.log('\n=============================================');
        console.log(`✅ Logged in as: ${userName || 'User'} (${userJid?.split(':')[0] || 'Unknown'})`);
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
