import { waClient } from './client/whatsapp.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';

async function main() {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║       🦁 CARNIVORE AI ASSISTANT           ║
  ║         Created with ❤️ by Tazim           ║
  ╚═══════════════════════════════════════════╝
  `);

  logger.info(`Starting Carnivore AI Assistant by Tazim (Model: ${config.aiModel})...`);
  
  try {
    await waClient.connect();
  } catch (err) {
    logger.fatal({ err }, 'Fatal error during startup');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down WhatsApp AI Assistant...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down WhatsApp AI Assistant...');
  process.exit(0);
});

main();
