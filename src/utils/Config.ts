import { config as dotenvConfig } from 'dotenv';
import { BotConfig } from '../contracts/types';

/**
 * Load and validate configuration
 */
export class Config {
  static load(): BotConfig {
    // Load environment variables
    dotenvConfig();

    const config: BotConfig = {
      // RPC
      rpcUrl: process.env.RPC_URL || '',
      chainId: parseInt(process.env.CHAIN_ID || '1'),

      // Wallet
      privateKey: process.env.PRIVATE_KEY || '',

      // Trading parameters
      minProfitUSD: parseFloat(process.env.MIN_PROFIT_USD || '50'),
      minProfitPercentage: parseFloat(process.env.MIN_PROFIT_PERCENTAGE || '0.5'),
      maxPositionSizeETH: parseFloat(process.env.MAX_POSITION_SIZE_ETH || '10'),
      gasPriceLimitGwei: parseFloat(process.env.GAS_PRICE_LIMIT_GWEI || '100'),

      // Markets
      kashiMarkets: (process.env.KASHI_MARKETS || '').split(',').filter(Boolean),

      // Execution
      dryRun: process.env.DRY_RUN === 'true',
      executionIntervalMs: parseInt(process.env.EXECUTION_INTERVAL_MS || '5000'),

      // Logging
      logLevel: process.env.LOG_LEVEL || 'info'
    };

    this.validate(config);
    return config;
  }

  private static validate(config: BotConfig): void {
    const errors: string[] = [];

    if (!config.rpcUrl) {
      errors.push('RPC_URL is required');
    }

    if (!config.privateKey && !config.dryRun) {
      errors.push('PRIVATE_KEY is required (unless DRY_RUN=true)');
    }

    if (config.minProfitUSD <= 0) {
      errors.push('MIN_PROFIT_USD must be positive');
    }

    if (config.minProfitPercentage <= 0) {
      errors.push('MIN_PROFIT_PERCENTAGE must be positive');
    }

    if (config.maxPositionSizeETH <= 0) {
      errors.push('MAX_POSITION_SIZE_ETH must be positive');
    }

    if (config.kashiMarkets.length === 0) {
      errors.push('KASHI_MARKETS must contain at least one market');
    }

    if (errors.length > 0) {
      throw new Error(
        `Configuration validation failed:\n${errors.join('\n')}`
      );
    }
  }

  /**
   * Get well-known Kashi pair addresses
   * These are examples - replace with actual mainnet addresses
   */
  static getKashiPairAddresses(): { [key: string]: string } {
    return {
      'USDC-WETH': '0x...', // Add actual Kashi pair addresses
      'DAI-WETH': '0x...',
      'USDT-WETH': '0x...',
      // Add more pairs as needed
    };
  }

  /**
   * Resolve market names to addresses
   */
  static resolveMarketAddresses(marketNames: string[]): string[] {
    const knownPairs = this.getKashiPairAddresses();
    return marketNames
      .map(name => knownPairs[name])
      .filter(address => address && address !== '0x...');
  }
}
