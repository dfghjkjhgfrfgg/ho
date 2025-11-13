import dotenv from 'dotenv';
import { BotConfig, RiskParameters } from '../types';

dotenv.config();

export class Config {
  private static instance: Config;
  public config: BotConfig;

  private constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private loadConfig(): BotConfig {
    const riskParams: RiskParameters = {
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '1000'),
      maxPortfolioPercent: parseFloat(process.env.MAX_PORTFOLIO_PERCENT || '10'),
      stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT || '5'),
      takeProfitPercent: parseFloat(process.env.TAKE_PROFIT_PERCENT || '10'),
      trailingStopPercent: parseFloat(process.env.TRAILING_STOP_PERCENT || '3'),
      maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || '1'),
      maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '500'),
      minRiskRewardRatio: parseFloat(process.env.MIN_RISK_REWARD_RATIO || '2'),
      maxOpenPositions: parseInt(process.env.MAX_OPEN_POSITIONS || '5'),
    };

    return {
      mode: (process.env.BOT_MODE as 'LIVE' | 'PAPER' | 'BACKTEST') || 'PAPER',
      network: (process.env.SOLANA_NETWORK as 'mainnet-beta' | 'devnet' | 'testnet') || 'mainnet-beta',
      rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
      walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
      tradingPairs: process.env.TRADING_PAIRS?.split(',') || ['SOL/USDC'],
      scanInterval: parseInt(process.env.SCAN_INTERVAL || '5000'),
      minLiquidity: parseFloat(process.env.MIN_LIQUIDITY || '50000'),
      strategies: {
        rsi: process.env.ENABLE_RSI_STRATEGY === 'true',
        macd: process.env.ENABLE_MACD_STRATEGY === 'true',
        bollingerBands: process.env.ENABLE_BB_STRATEGY === 'true',
        emaStrategy: process.env.ENABLE_EMA_STRATEGY === 'true',
        volumeAnalysis: process.env.ENABLE_VOLUME_ANALYSIS === 'true',
        aiSentiment: process.env.ENABLE_AI_SENTIMENT === 'true',
      },
      risk: riskParams,
      notifications: {
        telegram: process.env.ENABLE_TELEGRAM === 'true',
        discord: process.env.ENABLE_DISCORD === 'true',
        telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
        telegramChatId: process.env.TELEGRAM_CHAT_ID,
        discordWebhook: process.env.DISCORD_WEBHOOK,
      },
      ai: {
        provider: (process.env.AI_PROVIDER as 'CLAUDE' | 'OPENAI' | 'BOTH') || 'CLAUDE',
        claudeApiKey: process.env.CLAUDE_API_KEY,
        openaiApiKey: process.env.OPENAI_API_KEY,
        enableSentiment: process.env.ENABLE_AI_SENTIMENT === 'true',
      },
      database: {
        enabled: process.env.ENABLE_DATABASE === 'true',
        type: (process.env.DATABASE_TYPE as 'POSTGRESQL' | 'SQLITE') || 'SQLITE',
        connectionString: process.env.DATABASE_URL,
      },
    };
  }

  private validateConfig(): void {
    const { config } = this;

    // Validate RPC endpoint
    if (!config.rpcEndpoint) {
      throw new Error('SOLANA_RPC_ENDPOINT is required');
    }

    // Validate wallet for live trading
    if (config.mode === 'LIVE' && !config.walletPrivateKey) {
      throw new Error('WALLET_PRIVATE_KEY is required for LIVE mode');
    }

    // Validate AI configuration if enabled
    if (config.ai.enableSentiment) {
      if (config.ai.provider === 'CLAUDE' && !config.ai.claudeApiKey) {
        throw new Error('CLAUDE_API_KEY is required when AI sentiment is enabled with Claude');
      }
      if (config.ai.provider === 'OPENAI' && !config.ai.openaiApiKey) {
        throw new Error('OPENAI_API_KEY is required when AI sentiment is enabled with OpenAI');
      }
      if (config.ai.provider === 'BOTH' && (!config.ai.claudeApiKey || !config.ai.openaiApiKey)) {
        throw new Error('Both CLAUDE_API_KEY and OPENAI_API_KEY are required when using BOTH providers');
      }
    }

    // Validate notification configuration
    if (config.notifications.telegram && (!config.notifications.telegramBotToken || !config.notifications.telegramChatId)) {
      throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required when Telegram is enabled');
    }

    if (config.notifications.discord && !config.notifications.discordWebhook) {
      throw new Error('DISCORD_WEBHOOK is required when Discord is enabled');
    }

    // Validate risk parameters
    if (config.risk.maxSlippage > 50) {
      throw new Error('MAX_SLIPPAGE cannot exceed 50%');
    }

    if (config.risk.minRiskRewardRatio < 1) {
      throw new Error('MIN_RISK_REWARD_RATIO must be at least 1');
    }

    if (config.risk.maxPortfolioPercent > 100) {
      throw new Error('MAX_PORTFOLIO_PERCENT cannot exceed 100%');
    }

    // Validate at least one strategy is enabled
    const strategies = Object.values(config.strategies);
    if (!strategies.some(enabled => enabled)) {
      console.warn('WARNING: No trading strategies are enabled. Enable at least one strategy.');
    }

    // Validate database configuration
    if (config.database.enabled && config.database.type === 'POSTGRESQL' && !config.database.connectionString) {
      throw new Error('DATABASE_URL is required when PostgreSQL is enabled');
    }
  }

  public getConfig(): BotConfig {
    return this.config;
  }

  public isLiveMode(): boolean {
    return this.config.mode === 'LIVE';
  }

  public isPaperMode(): boolean {
    return this.config.mode === 'PAPER';
  }

  public isBacktestMode(): boolean {
    return this.config.mode === 'BACKTEST';
  }
}

export default Config.getInstance();
