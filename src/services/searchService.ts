import { aiService } from './ai.js';
import { logger } from '../utils/logger.js';

export class SearchService {
  /**
   * Performs live web search using DuckDuckGo HTML / Instant Answers and summarizes findings with AI
   */
  public async searchAndSummarize(query: string, senderName: string = 'User'): Promise<string> {
    try {
      logger.info({ query }, 'Performing live web search');
      const searchResults = await this.fetchDuckDuckGoResults(query);

      let context = searchResults.length > 0
        ? searchResults.map((r, i) => `[Result ${i + 1}]: ${r.title}\nSnippet: ${r.snippet}\nSource: ${r.url}`).join('\n\n')
        : 'No direct web snippets found.';

      const summaryPrompt = `You are Carnivore, a real-time web research AI assistant created by Tazim.
The user "${senderName}" searched for: "${query}".

Here are the live web search results:
${context}

Please provide a concise, accurate, and up-to-date answer to the user's query based on the search results. Include source URLs or references where applicable. Format nicely with WhatsApp markdown (*bold*, bullets).`;

      const reply = await aiService.generateReply('web_search', summaryPrompt, senderName, false);
      return `🌐 *Live Web Search: "${query}"*\n\n${reply}`;
    } catch (err: any) {
      logger.error({ err: err.message }, 'Web search failed');
      return `⚠️ *Web Search Error:* ${err.message || 'Unable to fetch search results at this time.'}`;
    }
  }

  /**
   * Fetches search snippets from DuckDuckGo HTML endpoint
   */
  private async fetchDuckDuckGoResults(query: string): Promise<Array<{ title: string; snippet: string; url: string }>> {
    try {
      const encoded = encodeURIComponent(query);
      const url = `https://html.duckduckgo.com/html/?q=${encoded}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!res.ok) {
        return [];
      }

      const html = await res.text();
      const results: Array<{ title: string; snippet: string; url: string }> = [];

      // Extract results via regex
      const resultRegex = /<a class="result__url" href="([^"]+)".*?<a class="result__snippet[^"]*"[^>]*>(.*?)<\/a>/gis;
      let match;
      while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
        const rawUrl = match[1]?.trim() || '';
        const rawSnippet = match[2]?.replace(/<[^>]*>/g, '').trim() || '';

        // Decode DDG redirect URL if present
        let cleanUrl = rawUrl;
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          cleanUrl = decodeURIComponent(uddgMatch[1]);
        }

        if (rawSnippet && cleanUrl) {
          results.push({
            title: `Web Result ${results.length + 1}`,
            snippet: rawSnippet,
            url: cleanUrl
          });
        }
      }

      return results;
    } catch (err: any) {
      logger.warn({ err: err.message }, 'DuckDuckGo scraping failed, continuing with LLM baseline knowledge');
      return [];
    }
  }
}

export const searchService = new SearchService();
