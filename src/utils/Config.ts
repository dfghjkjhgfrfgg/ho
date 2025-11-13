import { config as dotenvConfig } from 'dotenv';
import { KalshiConfig } from '../types/KalshiTypes';

/**
 * Load and validate Kalshi bot configuration
 */
export class Config {
  static load(): KalshiConfig {
    // Load environment variables
    dotenvConfig();

    const config: KalshiConfig = {
      // Kalshi credentials
      apiKeyId: process.env.KALSHI_API_KEY_ID || '',
      privateKeyPath: process.env.KALSHI_PRIVATE_KEY_PATH || './kalshi_private_key.pem',
      baseUrl: process.env.KALSHI_API_URL || 'https://api.elections.kalshi.com/trade-api/v2',

      // Trading parameters
      minEdge: parseFloat(process.env.MIN_EDGE || '0.05'), // 5% edge minimum
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '100'), // $100 per position
      maxTotalExposure: parseFloat(process.env.MAX_TOTAL_EXPOSURE || '500'), // $500 total
      kellyFraction: parseFloat(process.env.KELLY_FRACTION || '0.25'), // Quarter Kelly

      // Execution
      dryRun: process.env.DRY_RUN === 'true',
      scanIntervalMs: parseInt(process.env.SCAN_INTERVAL_MS || '30000'), // 30 seconds

      // Categories to trade
      categories: (process.env.CATEGORIES || 'sports,nfl,nba,mlb').split(',').filter(Boolean),
    };

    this.validate(config);
    return config;
  }

  private static validate(config: KalshiConfig): void {
    const errors: string[] = [];

    if (!config.apiKeyId) {
      errors.push('KALSHI_API_KEY_ID is required');
    }

    if (!config.privateKeyPath) {
      errors.push('KALSHI_PRIVATE_KEY_PATH is required');
    }

    if (!config.baseUrl) {
      errors.push('KALSHI_API_URL is required');
    }

    if (config.minEdge <= 0 || config.minEdge >= 1) {
      errors.push('MIN_EDGE must be between 0 and 1');
    }

    if (config.maxPositionSize <= 0) {
      errors.push('MAX_POSITION_SIZE must be positive');
    }

    if (config.maxTotalExposure <= 0) {
      errors.push('MAX_TOTAL_EXPOSURE must be positive');
    }

    if (config.maxPositionSize > config.maxTotalExposure) {
      errors.push('MAX_POSITION_SIZE cannot exceed MAX_TOTAL_EXPOSURE');
    }

    if (config.kellyFraction <= 0 || config.kellyFraction > 1) {
      errors.push('KELLY_FRACTION must be between 0 and 1');
    }

    if (errors.length > 0) {
      throw new Error(
        `Configuration validation failed:\n${errors.join('\n')}`
      );
    }
  }

  /**
   * Get demo/sandbox configuration
   */
  static getDemoConfig(): Partial<KalshiConfig> {
    return {
      baseUrl: 'https://demo.kalshi.com/trade-api/v2',
      dryRun: true,
      maxPositionSize: 10,
      maxTotalExposure: 50,
    };
  }
}
