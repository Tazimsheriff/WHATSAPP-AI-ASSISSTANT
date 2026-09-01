import { google, calendar_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface MeetingOptions {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[]; // email addresses
  timeZone?: string;
  createMeetLink?: boolean;
}

export interface MeetingResult {
  success: boolean;
  title: string;
  startTime: Date;
  endTime: Date;
  timeZone: string;
  meetLink?: string;
  calendarLink?: string;
  attendees: string[];
  isApiCreated: boolean;
  error?: string;
}

export class CalendarService {
  private calendar: calendar_v3.Calendar | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initCalendarClient();
  }

  /**
   * Initializes Google Calendar API client using service account or oauth
   */
  private initCalendarClient() {
    try {
      let authClient: any = null;

      // 1. Check for Service Account JSON Key File
      if (config.googleServiceAccountKeyFile) {
        const keyFilePath = path.isAbsolute(config.googleServiceAccountKeyFile)
          ? config.googleServiceAccountKeyFile
          : path.join(process.cwd(), config.googleServiceAccountKeyFile);

        if (fs.existsSync(keyFilePath)) {
          authClient = new google.auth.GoogleAuth({
            keyFile: keyFilePath,
            scopes: ['https://www.googleapis.com/auth/calendar']
          });
          logger.info('Google Calendar initialized with Service Account Key File');
        }
      }

      // 2. Check for Service Account Email + Private Key in .env
      if (!authClient && config.googleServiceAccountEmail && config.googlePrivateKey) {
        const formattedKey = config.googlePrivateKey.replace(/\\n/g, '\n');
        authClient = new google.auth.JWT({
          email: config.googleServiceAccountEmail,
          key: formattedKey,
          scopes: ['https://www.googleapis.com/auth/calendar']
        });
        logger.info('Google Calendar initialized with Service Account credentials from env');
      }

      if (authClient) {
        this.calendar = google.calendar({ version: 'v3', auth: authClient });
        this.isConfigured = true;
      } else {
        logger.info('Google Calendar API not configured. Web calendar links will be generated.');
      }
    } catch (err: any) {
      logger.error({ err: err?.message || err }, 'Failed to initialize Google Calendar API client');
    }
  }

  /**
   * Creates a meeting on Google Calendar with Google Meet link & attendee invites
   */
  public async scheduleMeeting(options: MeetingOptions): Promise<MeetingResult> {
    const timeZone = options.timeZone || config.defaultTimezone || 'Asia/Kolkata';
    const attendees = (options.attendees || []).filter(e => this.isValidEmail(e));

    // If Google API credentials configured, create directly via API
    if (this.isConfigured && this.calendar) {
      try {
        const calendarId = config.googleCalendarId || 'primary';
        const eventRequestBody: calendar_v3.Schema$Event = {
          summary: options.title,
          description: options.description || `Scheduled via WhatsApp AI Assistant`,
          start: {
            dateTime: options.startTime.toISOString(),
            timeZone
          },
          end: {
            dateTime: options.endTime.toISOString(),
            timeZone
          },
          attendees: attendees.map(email => ({ email })),
          conferenceData: {
            createRequest: {
              requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              conferenceSolutionKey: {
                type: 'hangoutsMeet'
              }
            }
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 60 },
              { method: 'popup', minutes: 10 }
            ]
          }
        };

        const response = await this.calendar.events.insert({
          calendarId,
          requestBody: eventRequestBody,
          conferenceDataVersion: 1,
          sendUpdates: attendees.length > 0 ? 'all' : 'none'
        });

        const event = response.data;
        const meetLink =
          event.hangoutLink ||
          event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ||
          undefined;

        logger.info({ eventId: event.id, meetLink, attendees }, 'Google Calendar event created successfully');

        return {
          success: true,
          title: options.title,
          startTime: options.startTime,
          endTime: options.endTime,
          timeZone,
          meetLink,
          calendarLink: event.htmlLink || undefined,
          attendees,
          isApiCreated: true
        };
      } catch (apiErr: any) {
        logger.error({ err: apiErr?.message || apiErr }, 'Google Calendar API insert failed, falling back to web link');
      }
    }

    // Fallback: Generate 1-click Google Calendar web link with Google Meet & attendees prefilled
    const webLink = this.generateCalendarWebLink({
      ...options,
      attendees,
      timeZone
    });

    return {
      success: true,
      title: options.title,
      startTime: options.startTime,
      endTime: options.endTime,
      timeZone,
      calendarLink: webLink,
      attendees,
      isApiCreated: false
    };
  }

  /**
   * Generates a 1-click Google Calendar event creation URL
   */
  public generateCalendarWebLink(options: MeetingOptions): string {
    const formatGCalDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const startStr = formatGCalDate(options.startTime);
    const endStr = formatGCalDate(options.endTime);

    const baseUrl = 'https://calendar.google.com/calendar/render';
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: options.title,
      dates: `${startStr}/${endStr}`,
      details: options.description || 'Scheduled via WhatsApp AI Assistant'
    });

    if (options.attendees && options.attendees.length > 0) {
      params.append('add', options.attendees.join(','));
    }

    if (options.timeZone) {
      params.append('ctz', options.timeZone);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Validates email format
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }
}

export const calendarService = new CalendarService();
