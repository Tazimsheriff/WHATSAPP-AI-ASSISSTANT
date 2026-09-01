import { db, ExpenseItem } from './db.js';
import { aiService } from './ai.js';
import { logger } from '../utils/logger.js';

export class ExpenseService {
  /**
   * Logs an expense from text input like: "!expense 450 lunch with team"
   */
  public logExpenseFromText(
    chatId: string,
    senderName: string,
    input: string
  ): { success: boolean; message: string; item?: ExpenseItem } {
    const text = input.trim();
    // Pattern: "!expense 450 category/description" or "!expense $20 Starbucks"
    const match = text.match(/^([₹$€£]?\s*(\d+(?:\.\d{1,2})?))\s*(.*)$/i);

    if (!match) {
      return {
        success: false,
        message: '⚠️ *Invalid expense format.*\n\nExamples:\n• `!expense 450 Lunch with team`\n• `!expense 1200 Grocery shopping`\n• `!expense 350 Uber ride`'
      };
    }

    const amount = parseFloat(match[2]);
    const rawDesc = match[3]?.trim() || 'General Expense';

    // Infer category
    let category = 'General';
    const lower = rawDesc.toLowerCase();
    if (lower.includes('lunch') || lower.includes('dinner') || lower.includes('food') || lower.includes('coffee') || lower.includes('snack') || lower.includes('restaurant')) category = 'Food & Dining';
    else if (lower.includes('uber') || lower.includes('ola') || lower.includes('taxi') || lower.includes('petrol') || lower.includes('fuel') || lower.includes('flight')) category = 'Transport';
    else if (lower.includes('grocery') || lower.includes('supermarket') || lower.includes('vegetable') || lower.includes('milk')) category = 'Groceries';
    else if (lower.includes('movie') || lower.includes('game') || lower.includes('netflix') || lower.includes('spotify')) category = 'Entertainment';
    else if (lower.includes('bill') || lower.includes('recharge') || lower.includes('wifi') || lower.includes('electricity')) category = 'Utilities';
    else if (lower.includes('shopping') || lower.includes('cloth') || lower.includes('amazon')) category = 'Shopping';

    const item = db.addExpense(chatId, senderName, amount, category, rawDesc);
    return {
      success: true,
      message: `💰 *Expense Logged!*\n\n💵 *Amount:* ₹${item.amount.toFixed(2)}\n🏷️ *Category:* ${item.category}\n📝 *Description:* ${item.description}\n📅 *Date:* ${item.dateStr}\n🆔 *ID:* \`#${item.id}\``,
      item
    };
  }

  /**
   * Analyzes receipt photo buffer and extracts expense details automatically
   */
  public async logExpenseFromReceipt(
    imageBuffer: Buffer,
    mimeType: string,
    chatId: string,
    senderName: string
  ): Promise<string> {
    try {
      logger.info({ chatId }, 'Analyzing receipt image for expense extraction');
      const prompt = `Extract receipt information from this image.
Return ONLY a valid JSON object in this exact format (no backticks, no code blocks):
{
  "isReceipt": true,
  "amount": 0.00,
  "vendor": "Store or Restaurant Name",
  "category": "Food & Dining / Groceries / Transport / Shopping / Utilities / General",
  "description": "Short summary of purchased items",
  "currency": "INR"
}`;

      const rawJson = await aiService.analyzeImage(imageBuffer, mimeType, prompt, senderName, chatId);
      const cleanJson = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (!parsed.amount || isNaN(parsed.amount)) {
        return `📄 *Receipt Analyzed:*\n\n${rawJson}`;
      }

      const item = db.addExpense(
        chatId,
        senderName,
        Number(parsed.amount),
        parsed.category || 'General',
        `${parsed.vendor ? `[${parsed.vendor}] ` : ''}${parsed.description || 'Receipt Purchase'}`
      );

      return `🧾 *Receipt Successfully Scanned & Logged!*\n\n🏪 *Vendor:* ${parsed.vendor || 'Unknown'}\n💵 *Total Amount:* ₹${item.amount.toFixed(2)}\n🏷️ *Category:* ${item.category}\n📝 *Items:* ${item.description}\n📅 *Date:* ${item.dateStr}\n🆔 *ID:* \`#${item.id}\``;
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to extract receipt');
      return '⚠️ *Could not automatically parse receipt.* You can manually log it via `!expense <amount> <description>`.';
    }
  }

  /**
   * Generates formatted summary of all logged expenses
   */
  public getExpenseSummary(chatId: string): string {
    const items = db.getExpenses(chatId);
    if (items.length === 0) {
      return '💰 *No expenses recorded yet.*\n\nLog one with:\n`!expense 250 Lunch with team`\nOr snap a photo of any receipt!';
    }

    let total = 0;
    const categoryTotals: Record<string, number> = {};

    for (const item of items) {
      total += item.amount;
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.amount;
    }

    const categoryLines = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `• *${cat}:* ₹${amt.toFixed(2)} (${Math.round((amt / total) * 100)}%)`)
      .join('\n');

    const recent = items.slice(-5).reverse().map(e => `• [#${e.id}] ₹${e.amount} - ${e.description} _(${e.dateStr})_`).join('\n');

    return `📊 *Expense Summary & Budget Breakdown:*\n\n💵 *Total Spent:* ₹${total.toFixed(2)}\n🔢 *Total Entries:* ${items.length}\n\n*By Category:*\n${categoryLines}\n\n*Recent Entries:*\n${recent}\n\n💡 _To download a full spreadsheet: \`!export expenses\`_`;
  }

  /**
   * Generates CSV string for WhatsApp document export
   */
  public generateCSV(chatId: string): { filename: string; buffer: Buffer } {
    const items = db.getExpenses(chatId);
    const headers = 'ID,Date,Category,Amount,Description,LoggedBy,Timestamp\n';
    const rows = items.map(e => `"${e.id}","${e.dateStr}","${e.category}",${e.amount},"${e.description.replace(/"/g, '""')}","${e.senderName}","${e.createdAt}"`).join('\n');
    const csvContent = headers + rows;

    return {
      filename: `expenses_${new Date().toISOString().split('T')[0]}.csv`,
      buffer: Buffer.from(csvContent, 'utf-8')
    };
  }
}

export const expenseService = new ExpenseService();
