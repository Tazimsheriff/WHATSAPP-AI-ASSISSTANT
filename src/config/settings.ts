import fs from 'fs';
import path from 'path';
import { config } from './index.js';

interface BotSettings {
  autoReplyDms: boolean;
}

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

class SettingsManager {
  private settings: BotSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): BotSettings {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch {
      // ignore
    }
    return {
      autoReplyDms: config.autoReplyDms
    };
  }

  public get autoReplyDms(): boolean {
    return this.settings.autoReplyDms;
  }

  public setAutoReplyDms(val: boolean): void {
    this.settings.autoReplyDms = val;
    this.save();
  }

  private save(): void {
    try {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }
}

export const botSettings = new SettingsManager();
