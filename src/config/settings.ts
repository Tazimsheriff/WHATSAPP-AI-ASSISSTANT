import fs from 'fs';
import path from 'path';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

export type MemberAccessMode = 'all' | 'whitelist' | 'admin_only' | 'disabled';

export interface BotSettings {
  autoReplyDms: boolean;
  isAiKilled: boolean; // Master kill switch
  memberAccessMode: MemberAccessMode;
  allowedUsers: string[]; // List of cleaned phone numbers / JIDs
  blockedUsers: string[]; // List of cleaned phone numbers / JIDs
  disabledChats: string[]; // List of chat IDs (groups or DMs) where AI is turned off
}

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

export function cleanUserIdentifier(user: string): string {
  if (!user) return '';
  const withoutSuffix = user.split('@')[0].split(':')[0].trim();
  const digitsOnly = withoutSuffix.replace(/[^0-9]/g, '');
  return digitsOnly || withoutSuffix.toLowerCase();
}

class SettingsManager {
  private settings: BotSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): BotSettings {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          autoReplyDms: typeof parsed.autoReplyDms === 'boolean' ? parsed.autoReplyDms : config.autoReplyDms,
          isAiKilled: !!parsed.isAiKilled,
          memberAccessMode: parsed.memberAccessMode || 'all',
          allowedUsers: Array.isArray(parsed.allowedUsers) ? parsed.allowedUsers : [],
          blockedUsers: Array.isArray(parsed.blockedUsers) ? parsed.blockedUsers : [],
          disabledChats: Array.isArray(parsed.disabledChats) ? parsed.disabledChats : []
        };
      }
    } catch (err: any) {
      logger.error({ err: err?.message || err }, 'Failed to load settings.json, initializing defaults');
    }

    return {
      autoReplyDms: config.autoReplyDms,
      isAiKilled: false,
      memberAccessMode: 'all',
      allowedUsers: [],
      blockedUsers: [],
      disabledChats: []
    };
  }

  // --- GETTERS & SETTERS ---
  public get autoReplyDms(): boolean {
    return this.settings.autoReplyDms;
  }

  public setAutoReplyDms(val: boolean): void {
    this.settings.autoReplyDms = val;
    this.save();
  }

  public get isAiKilled(): boolean {
    return this.settings.isAiKilled;
  }

  public setAiKilled(val: boolean): void {
    this.settings.isAiKilled = val;
    this.save();
  }

  public get memberAccessMode(): MemberAccessMode {
    return this.settings.memberAccessMode;
  }

  public setMemberAccessMode(mode: MemberAccessMode): void {
    this.settings.memberAccessMode = mode;
    this.save();
  }

  public get allowedUsers(): string[] {
    return [...this.settings.allowedUsers];
  }

  public get blockedUsers(): string[] {
    return [...this.settings.blockedUsers];
  }

  public get disabledChats(): string[] {
    return [...this.settings.disabledChats];
  }

  // --- ALLOW / WHITELIST OPERATIONS ---
  public allowUser(user: string): { success: boolean; cleanId: string; wasBlocked: boolean } {
    const cleanId = cleanUserIdentifier(user);
    if (!cleanId) return { success: false, cleanId: '', wasBlocked: false };

    // Remove from blocked list if present
    const wasBlocked = this.unblockUser(cleanId);

    if (!this.settings.allowedUsers.includes(cleanId)) {
      this.settings.allowedUsers.push(cleanId);
      this.save();
    }
    return { success: true, cleanId, wasBlocked };
  }

  public disallowUser(user: string): boolean {
    const cleanId = cleanUserIdentifier(user);
    const idx = this.settings.allowedUsers.indexOf(cleanId);
    if (idx !== -1) {
      this.settings.allowedUsers.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // --- BLOCK / BLACKLIST OPERATIONS ---
  public blockUser(user: string): { success: boolean; cleanId: string; wasAllowed: boolean } {
    const cleanId = cleanUserIdentifier(user);
    if (!cleanId) return { success: false, cleanId: '', wasAllowed: false };

    // Remove from allowed list if present
    const wasAllowed = this.disallowUser(cleanId);

    if (!this.settings.blockedUsers.includes(cleanId)) {
      this.settings.blockedUsers.push(cleanId);
      this.save();
    }
    return { success: true, cleanId, wasAllowed };
  }

  public unblockUser(user: string): boolean {
    const cleanId = cleanUserIdentifier(user);
    const idx = this.settings.blockedUsers.indexOf(cleanId);
    if (idx !== -1) {
      this.settings.blockedUsers.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public isUserBlocked(user: string): boolean {
    const cleanId = cleanUserIdentifier(user);
    return this.settings.blockedUsers.includes(cleanId);
  }

  public isUserAllowed(user: string): boolean {
    const cleanId = cleanUserIdentifier(user);
    return this.settings.allowedUsers.includes(cleanId);
  }

  // --- CHAT ENABLE / DISABLE OPERATIONS ---
  public disableChat(chatId: string): boolean {
    if (!this.settings.disabledChats.includes(chatId)) {
      this.settings.disabledChats.push(chatId);
      this.save();
      return true;
    }
    return false;
  }

  public enableChat(chatId: string): boolean {
    const idx = this.settings.disabledChats.indexOf(chatId);
    if (idx !== -1) {
      this.settings.disabledChats.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public isChatDisabled(chatId: string): boolean {
    return this.settings.disabledChats.includes(chatId);
  }

  // --- PERMISSION EVALUATOR ---
  public canUserUseAi(params: {
    senderJid: string;
    isFromMe: boolean;
    isGroup: boolean;
    isGroupAdmin?: boolean;
    chatId: string;
  }): { allowed: boolean; reason?: string } {
    const { senderJid, isFromMe, isGroup, isGroupAdmin, chatId } = params;

    // Bot Owner / Self is always allowed
    if (isFromMe) {
      return { allowed: true };
    }

    // If AI is completely killed
    if (this.settings.isAiKilled) {
      return { allowed: false, reason: 'AI_KILLED' };
    }

    // If the specific chat is disabled
    if (this.settings.disabledChats.includes(chatId)) {
      return { allowed: false, reason: 'CHAT_DISABLED' };
    }

    const cleanId = cleanUserIdentifier(senderJid);

    // If explicitly blocked
    if (this.settings.blockedUsers.includes(cleanId)) {
      return { allowed: false, reason: 'USER_BLOCKED' };
    }

    // Check Member Access Mode
    switch (this.settings.memberAccessMode) {
      case 'all':
        return { allowed: true };

      case 'whitelist':
        if (this.settings.allowedUsers.includes(cleanId)) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'NOT_WHITELISTED' };

      case 'admin_only':
        if (isGroup && isGroupAdmin) {
          return { allowed: true };
        }
        if (this.settings.allowedUsers.includes(cleanId)) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'ADMIN_ONLY' };

      case 'disabled':
        return { allowed: false, reason: 'MEMBERS_DISABLED' };

      default:
        return { allowed: true };
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err: any) {
      logger.error({ err: err?.message || err }, 'Failed to write settings to disk');
    }
  }
}

export const botSettings = new SettingsManager();
