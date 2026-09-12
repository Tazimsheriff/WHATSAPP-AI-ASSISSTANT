import nodemailer, { Transporter, SendMailOptions as NodemailerMailOptions } from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface SendEmailResult {
  success: boolean;
  to: string;
  subject: string;
  body: string;
  preview: string;
  messageId?: string;
  isConfigured: boolean;
  error?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initTransporter();
  }

  /**
   * Initializes the nodemailer transporter if SMTP credentials are provided
   */
  public initTransporter(): void {
    try {
      if (config.smtpHost && config.smtpUser && config.smtpPass) {
        this.transporter = nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpSecure,
          auth: {
            user: config.smtpUser,
            pass: config.smtpPass
          }
        });
        this.isConfigured = true;
        logger.info(
          { host: config.smtpHost, port: config.smtpPort, user: config.smtpUser },
          'Email service initialized with SMTP credentials'
        );
      } else {
        this.isConfigured = false;
        this.transporter = null;
        logger.info('SMTP credentials not fully configured. Email service will run in simulated / unconfigured mode.');
      }
    } catch (err: any) {
      this.isConfigured = false;
      this.transporter = null;
      logger.error({ err: err?.message || err }, 'Failed to initialize nodemailer transporter');
    }
  }

  /**
   * Checks if SMTP service has valid configuration
   */
  public getIsConfigured(): boolean {
    // Re-check in case config was dynamically updated or reloaded
    if (!this.transporter && config.smtpHost && config.smtpUser && config.smtpPass) {
      this.initTransporter();
    }
    return this.isConfigured;
  }

  /**
   * Validates standard email address format
   */
  public isValidEmail(email: string): boolean {
    if (!email) return false;
    const clean = email.trim();
    // Support single email or comma/semicolon-separated list of emails
    const emails = clean.split(/[,;]+/).map(e => e.trim().replace(/[<>]/g, '').replace(/\.+$/, '')).filter(Boolean);
    if (emails.length === 0) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emails.every(e => emailRegex.test(e));
  }

  /**
   * Generates a clean short body preview
   */
  public generateBodyPreview(body: string, maxLength: number = 220): string {
    const cleanBody = body.trim().replace(/\r\n/g, '\n');
    if (cleanBody.length <= maxLength) {
      return cleanBody;
    }
    return cleanBody.slice(0, maxLength).trim() + '...';
  }

  /**
   * Sends an email via configured SMTP credentials and returns a structured result
   */
  public async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const rawTo = (options.to || '').trim();
    const to = rawTo
      .split(/[,;]+/)
      .map(e => e.trim().replace(/[<>]/g, '').replace(/\.+$/, ''))
      .filter(Boolean)
      .join(', ');
    const subject = (options.subject || 'No Subject').trim();
    const body = (options.body || '').trim();
    const preview = this.generateBodyPreview(body);

    // 1. Validate recipient email
    if (!to || !this.isValidEmail(to)) {
      return {
        success: false,
        to: rawTo,
        subject,
        body,
        preview,
        isConfigured: this.getIsConfigured(),
        error: `Invalid recipient email address: "${rawTo}"`
      };
    }

    // 2. Check if SMTP configuration exists
    if (!this.getIsConfigured() || !this.transporter) {
      logger.warn({ to, subject }, 'Cannot send email: SMTP credentials are not configured');
      return {
        success: false,
        to,
        subject,
        body,
        preview,
        isConfigured: false,
        error: 'SMTP credentials not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file.'
      };
    }

    // 3. Dispatch email using nodemailer
    try {
      const from = options.from || config.smtpFrom || config.smtpUser;
      const mailOptions: NodemailerMailOptions = {
        from,
        to,
        subject,
        text: body,
        html: options.html || body.replace(/\n/g, '<br/>')
      };

      if (options.cc) mailOptions.cc = options.cc;
      if (options.bcc) mailOptions.bcc = options.bcc;

      logger.info({ to, subject, from }, 'Dispatching outgoing email via SMTP...');
      const info = await this.transporter.sendMail(mailOptions);
      logger.info({ messageId: info.messageId, to, subject }, 'Email sent successfully');

      return {
        success: true,
        to,
        subject,
        body,
        preview,
        messageId: info.messageId,
        isConfigured: true
      };
    } catch (err: any) {
      logger.error({ err: err?.message || err, to, subject }, 'Failed to send email via nodemailer');
      return {
        success: false,
        to,
        subject,
        body,
        preview,
        isConfigured: true,
        error: err?.message || 'Unknown SMTP delivery error'
      };
    }
  }

  /**
   * Formats email execution outcome into a structured WhatsApp response
   */
  public formatEmailConfirmation(result: SendEmailResult): string {
    const previewFormatted = result.preview
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');

    if (result.success) {
      let msg = `📧 *Email Sent Successfully!*\n\n`;
      msg += `👤 *To:* \`${result.to}\`\n`;
      msg += `📌 *Subject:* *${result.subject}*\n\n`;
      msg += `📝 *Body Preview:*\n${previewFormatted}\n\n`;
      if (result.messageId) {
        msg += `🆔 *Message ID:* \`${result.messageId}\`\n`;
      }
      msg += `✨ _Dispatched via Carnivore AI Assistant using SMTP_`;
      return msg;
    }

    // Failure / Not configured response
    let msg = `⚠️ *Email Sending Failed*\n\n`;
    msg += `👤 *Recipient:* \`${result.to || 'Unknown'}\`\n`;
    msg += `📌 *Subject:* *${result.subject}*\n\n`;
    msg += `📝 *Drafted Body Preview:*\n${previewFormatted}\n\n`;
    msg += `❌ *Error:* ${result.error || 'Failed to dispatch email.'}\n\n`;
    if (!result.isConfigured) {
      msg += `💡 *Setup Note:* Add \`SMTP_HOST\`, \`SMTP_USER\`, and \`SMTP_PASS\` to your \`.env\` file to enable live email delivery.`;
    }
    return msg;
  }
}

export const emailService = new EmailService();
