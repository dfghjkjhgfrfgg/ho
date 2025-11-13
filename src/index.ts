import TradingBot from './bot/TradingBot';
import Logger from './utils/Logger';
import Config from './config';

// Handle graceful shutdown
let bot: TradingBot | null = null;

async function main() {
  try {
    Logger.info('='.repeat(60));
    Logger.info('🚀 Solana Crypto Trading Bot');
    Logger.info('='.repeat(60));

    const config = Config.getConfig();
    Logger.info(`Mode: ${config.mode}`);
    Logger.info(`Network: ${config.network}`);
    Logger.info(`RPC: ${config.rpcEndpoint}`);
    Logger.info('='.repeat(60));

    // Create and start bot
    bot = new TradingBot();
    await bot.start();

    Logger.info('Bot is now running. Press Ctrl+C to stop.');
  } catch (error) {
    Logger.error('Fatal error', error);
    process.exit(1);
  }
}

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  Logger.info('\nReceived SIGINT, shutting down gracefully...');
  if (bot) {
    await bot.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  Logger.info('\nReceived SIGTERM, shutting down gracefully...');
  if (bot) {
    await bot.stop();
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  Logger.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Start the bot
main();
