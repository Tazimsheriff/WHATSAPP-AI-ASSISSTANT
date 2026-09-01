import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface MemoryItem {
  id: string;
  chatId: string;
  fact: string;
  category?: string;
  createdAt: string;
}

export interface ReminderItem {
  id: string;
  chatId: string;
  senderName: string;
  task: string;
  targetTimestamp: number; // epoch ms
  targetDateStr: string;
  isCompleted: boolean;
  createdAt: string;
}

export interface ExpenseItem {
  id: string;
  chatId: string;
  senderName: string;
  amount: number;
  category: string;
  description: string;
  currency: string;
  dateStr: string;
  createdAt: string;
}

interface DatabaseSchema {
  memories: MemoryItem[];
  reminders: ReminderItem[];
  expenses: ExpenseItem[];
}

export class DatabaseService {
  private filePath: string;
  private data: DatabaseSchema = {
    memories: [],
    reminders: [],
    expenses: []
  };

  constructor() {
    // Save inside authFolder so it automatically persists on Railway Volume!
    const folder = config.authFolder || './auth_info_baileys';
    if (!fs.existsSync(folder)) {
      try {
        fs.mkdirSync(folder, { recursive: true });
      } catch (err) {
        logger.error({ err }, 'Failed to create database directory');
      }
    }
    this.filePath = path.join(folder, 'assistant_database.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.memories) this.data.memories = [];
        if (!this.data.reminders) this.data.reminders = [];
        if (!this.data.expenses) this.data.expenses = [];
        logger.info(`Loaded database with ${this.data.memories.length} memories, ${this.data.reminders.length} reminders, ${this.data.expenses.length} expenses.`);
      } else {
        this.save();
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to load database, initializing defaults');
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to write database to disk');
    }
  }

  // --- MEMORY OPERATIONS ---
  public addMemory(chatId: string, fact: string, category: string = 'general'): MemoryItem {
    const item: MemoryItem = {
      id: Math.random().toString(36).substring(2, 8).toUpperCase(),
      chatId,
      fact: fact.trim(),
      category,
      createdAt: new Date().toISOString()
    };
    this.data.memories.push(item);
    this.save();
    return item;
  }

  public getMemories(chatId?: string): MemoryItem[] {
    if (!chatId) return this.data.memories;
    return this.data.memories.filter(m => m.chatId === chatId || m.chatId === 'global');
  }

  public deleteMemory(id: string): boolean {
    const idx = this.data.memories.findIndex(m => m.id.toLowerCase() === id.toLowerCase());
    if (idx !== -1) {
      this.data.memories.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public clearMemories(chatId: string): number {
    const initial = this.data.memories.length;
    this.data.memories = this.data.memories.filter(m => m.chatId !== chatId);
    this.save();
    return initial - this.data.memories.length;
  }

  // --- REMINDER OPERATIONS ---
  public addReminder(chatId: string, senderName: string, task: string, targetTimestamp: number): ReminderItem {
    const item: ReminderItem = {
      id: Math.random().toString(36).substring(2, 7).toUpperCase(),
      chatId,
      senderName,
      task: task.trim(),
      targetTimestamp,
      targetDateStr: new Date(targetTimestamp).toLocaleString('en-US', { timeZone: config.defaultTimezone }),
      isCompleted: false,
      createdAt: new Date().toISOString()
    };
    this.data.reminders.push(item);
    this.save();
    return item;
  }

  public getActiveReminders(chatId?: string): ReminderItem[] {
    return this.data.reminders.filter(r => !r.isCompleted && (!chatId || r.chatId === chatId));
  }

  public getDueReminders(currentTimestamp: number): ReminderItem[] {
    return this.data.reminders.filter(r => !r.isCompleted && r.targetTimestamp <= currentTimestamp);
  }

  public markReminderComplete(id: string): boolean {
    const item = this.data.reminders.find(r => r.id === id);
    if (item) {
      item.isCompleted = true;
      this.save();
      return true;
    }
    return false;
  }

  public deleteReminder(id: string): boolean {
    const idx = this.data.reminders.findIndex(r => r.id.toLowerCase() === id.toLowerCase());
    if (idx !== -1) {
      this.data.reminders.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // --- EXPENSE OPERATIONS ---
  public addExpense(
    chatId: string,
    senderName: string,
    amount: number,
    category: string,
    description: string,
    currency: string = 'INR'
  ): ExpenseItem {
    const item: ExpenseItem = {
      id: Math.random().toString(36).substring(2, 7).toUpperCase(),
      chatId,
      senderName,
      amount,
      category: category.trim() || 'General',
      description: description.trim() || 'Expense',
      currency,
      dateStr: new Date().toLocaleDateString('en-US', { timeZone: config.defaultTimezone }),
      createdAt: new Date().toISOString()
    };
    this.data.expenses.push(item);
    this.save();
    return item;
  }

  public getExpenses(chatId?: string): ExpenseItem[] {
    if (!chatId) return this.data.expenses;
    return this.data.expenses.filter(e => e.chatId === chatId);
  }

  public clearExpenses(chatId: string): number {
    const initial = this.data.expenses.length;
    this.data.expenses = this.data.expenses.filter(e => e.chatId !== chatId);
    this.save();
    return initial - this.data.expenses.length;
  }
}

export const db = new DatabaseService();
