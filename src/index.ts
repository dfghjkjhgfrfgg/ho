import { KashiArbitrageBot } from './bot/KashiArbitrageBot';
import { Config } from './utils/Config';
import { Logger } from './utils/Logger';

/**
 * Main entry point for the Kashi Arbitrage Trading Bot
 */
async function main() {
  // Ensure logs directory exists
  Logger.ensureLogsDirectory();

  // Load configuration
  let config;
  try {
    config = Config.load();
  } catch (error) {
    console.error('Failed to load configuration:', error);
    process.exit(1);
  }

  // Create and start bot
  const bot = new KashiArbitrageBot(config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    bot.stop();
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await bot.emergencyStop();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    await bot.emergencyStop();
    process.exit(1);
  });

  // Start the bot
  try {
    console.log('='.repeat(60));
    console.log('KASHI ARBITRAGE TRADING BOT');
    console.log('Mathematics-Based Trading - No Hope, Only Math');
    console.log('='.repeat(60));
    console.log('');

    await bot.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the bot
main().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});
