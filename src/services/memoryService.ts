import { db, MemoryItem } from './db.js';
import { logger } from '../utils/logger.js';

export class MemoryService {
  /**
   * Stores a new fact or preference into long-term memory
   */
  public storeMemory(chatId: string, fact: string, category?: string): MemoryItem {
    logger.info({ chatId, fact }, 'Storing fact in long-term memory');
    return db.addMemory(chatId, fact, category);
  }

  /**
   * Retrieves all memories formatted as readable text
   */
  public listMemories(chatId: string): string {
    const items = db.getMemories(chatId);
    if (items.length === 0) {
      return '🧠 *Memory is currently empty.* Tell me something to remember like:\n`!remember my gym time is 7 AM` or `!remember my passport number is X`';
    }

    const lines = items.map((m, i) => `${i + 1}. *[#${m.id}]* ${m.fact} _(${new Date(m.createdAt).toLocaleDateString()})_`);
    return `🧠 *Your Long-Term Memories & Facts (${items.length}):*\n\n${lines.join('\n')}\n\n💡 _To delete a fact, use: \`!forget <ID>\`_`;
  }

  /**
   * Deletes a memory by ID
   */
  public forgetMemory(id: string): boolean {
    return db.deleteMemory(id);
  }

  /**
   * Clears all memories for a chat
   */
  public clearAll(chatId: string): number {
    return db.clearMemories(chatId);
  }

  /**
   * Returns memories formatted for injection into the AI system prompt
   */
  public getMemoryPromptContext(chatId: string): string {
    const items = db.getMemories(chatId);
    if (items.length === 0) return '';

    const facts = items.map(m => `- ${m.fact}`).join('\n');
    return `\n\n[USER FACTS & LONG-TERM MEMORY]:\nThe following facts have been stored by the user across previous conversations. Use them seamlessly when relevant without repeating this block verbatim:\n${facts}\n`;
  }
}

export const memoryService = new MemoryService();
