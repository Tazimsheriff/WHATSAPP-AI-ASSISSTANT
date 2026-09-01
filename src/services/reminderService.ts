import cron, { ScheduledTask } from 'node-cron';
import { WASocket } from '@whiskeysockets/baileys';
import { db, ReminderItem } from './db.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class ReminderService {
  private cronJob: ScheduledTask | null = null;
  private sockGetter: (() => WASocket | null) | null = null;

  /**
   * Initializes background polling for due reminders every 30 seconds
   */
  public init(getSocket: () => WASocket | null): void {
    this.sockGetter = getSocket;
    // Check every 30 seconds
    this.cronJob = cron.schedule('*/30 * * * * *', async () => {
      await this.checkDueReminders();
    });
    logger.info('⏰ Proactive Reminder scheduler initialized (polling every 30s)');
  }

  /**
   * Evaluates due reminders and sends proactive WhatsApp messages
   */
  private async checkDueReminders(): Promise<void> {
    const sock = this.sockGetter ? this.sockGetter() : null;
    if (!sock) return;

    const now = Date.now();
    const due = db.getDueReminders(now);

    for (const reminder of due) {
      try {
        logger.info({ id: reminder.id, task: reminder.task, chatId: reminder.chatId }, '⏰ Firing due reminder');
        const alertMessage = `⏰ *REMINDER ALERT!*\n\nHey ${reminder.senderName || 'there'}! Here is your scheduled reminder:\n👉 *${reminder.task}*\n\n_(Scheduled for ${reminder.targetDateStr})_`;

        await sock.sendMessage(reminder.chatId, { text: alertMessage });
        db.markReminderComplete(reminder.id);
      } catch (err: any) {
        logger.error({ id: reminder.id, err: err.message }, 'Failed to send proactive reminder message');
      }
    }
  }

  /**
   * Parses natural language reminder prompt and schedules it
   */
  public parseAndSchedule(
    chatId: string,
    senderName: string,
    input: string
  ): { success: boolean; message: string; item?: ReminderItem } {
    const now = new Date();
    let targetTime: Date | null = null;
    let task = '';

    const text = input.trim();

    // 1. Regex: "in X minutes/hours/days to/that <task>" or "in X mins <task>"
    const relativeMatch = text.match(/^in\s+(\d+)\s*(mins?|minutes?|hrs?|hours?|days?|secs?|seconds?)(?:\s+(?:to|that|for))?\s*(.*)$/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2].toLowerCase();
      task = relativeMatch[3]?.trim() || 'Reminder';

      let ms = 0;
      if (unit.startsWith('sec')) ms = amount * 1000;
      else if (unit.startsWith('min')) ms = amount * 60 * 1000;
      else if (unit.startsWith('hr') || unit.startsWith('hour')) ms = amount * 60 * 60 * 1000;
      else if (unit.startsWith('day')) ms = amount * 24 * 60 * 60 * 1000;

      targetTime = new Date(now.getTime() + ms);
    }

    // 2. Regex: "tomorrow at 4pm <task>" or "tomorrow 16:30 <task>"
    if (!targetTime) {
      const tomorrowMatch = text.match(/^tomorrow(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(.*)$/i);
      if (tomorrowMatch) {
        let hour = parseInt(tomorrowMatch[1], 10);
        const minute = tomorrowMatch[2] ? parseInt(tomorrowMatch[2], 10) : 0;
        const meridian = tomorrowMatch[3]?.toLowerCase();
        task = tomorrowMatch[4]?.trim() || 'Reminder';

        if (meridian === 'pm' && hour < 12) hour += 12;
        if (meridian === 'am' && hour === 12) hour = 0;

        targetTime = new Date(now);
        targetTime.setDate(targetTime.getDate() + 1);
        targetTime.setHours(hour, minute, 0, 0);
      }
    }

    // 3. Regex: "at 5pm <task>" or "at 14:00 <task>"
    if (!targetTime) {
      const atMatch = text.match(/^at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(.*)$/i);
      if (atMatch) {
        let hour = parseInt(atMatch[1], 10);
        const minute = atMatch[2] ? parseInt(atMatch[2], 10) : 0;
        const meridian = atMatch[3]?.toLowerCase();
        task = atMatch[4]?.trim() || 'Reminder';

        if (meridian === 'pm' && hour < 12) hour += 12;
        if (meridian === 'am' && hour === 12) hour = 0;

        targetTime = new Date(now);
        targetTime.setHours(hour, minute, 0, 0);

        // If that time has already passed today, assume tomorrow
        if (targetTime.getTime() <= now.getTime()) {
          targetTime.setDate(targetTime.getDate() + 1);
        }
      }
    }

    // Fallback: default to 15 minutes if unparseable
    if (!targetTime || isNaN(targetTime.getTime())) {
      return {
        success: false,
        message: '⚠️ *Could not understand reminder time.*\n\nExamples:\n• `!remind in 30 mins to take medicine`\n• `!remind in 2 hours to submit project`\n• `!remind tomorrow at 9:00 am to call client`\n• `!remind at 6:30 pm to go to gym`'
      };
    }

    const item = db.addReminder(chatId, senderName, task || 'Scheduled Reminder', targetTime.getTime());
    return {
      success: true,
      message: `✅ *Reminder Set!*\n\n📌 *Task:* ${item.task}\n⏰ *Time:* ${item.targetDateStr}\n🆔 *ID:* \`#${item.id}\``,
      item
    };
  }

  /**
   * Lists active reminders for a chat
   */
  public listReminders(chatId: string): string {
    const items = db.getActiveReminders(chatId);
    if (items.length === 0) {
      return '⏰ *No active reminders.* Set one with:\n`!remind in 30 mins to check emails`';
    }

    const lines = items.map((r, i) => `${i + 1}. *[#${r.id}]* ${r.task}\n   ⏰ Due: ${r.targetDateStr}`);
    return `⏰ *Active Scheduled Reminders (${items.length}):*\n\n${lines.join('\n\n')}\n\n💡 _To cancel a reminder: \`!delreminder <ID>\`_`;
  }

  /**
   * Deletes a reminder by ID
   */
  public deleteReminder(id: string): boolean {
    return db.deleteReminder(id);
  }
}

export const reminderService = new ReminderService();
