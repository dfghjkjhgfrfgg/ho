import { Connection } from '@solana/web3.js';
import WalletManager from '../wallet/WalletManager';
import RaydiumExchange from '../exchange/RaydiumExchange';
import SecurityAnalyzer from '../security/SecurityAnalyzer';
import TechnicalAnalysis from '../strategies/TechnicalAnalysis';
import SentimentAnalyzer from '../ai/SentimentAnalyzer';
import RiskManager from '../risk/RiskManager';
import DataFetcher from '../data/DataFetcher';
import NotificationManager from '../notifications/NotificationManager';
import DatabaseManager from '../database/DatabaseManager';
import Logger from '../utils/Logger';
import Config from '../config';
import { BotConfig, TradeRecord, Position } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class TradingBot {
  private config: BotConfig;
  private wallet: WalletManager;
  private exchange: RaydiumExchange;
  private security: SecurityAnalyzer;
  private technical: TechnicalAnalysis;
  private sentiment: SentimentAnalyzer | null = null;
  private risk: RiskManager;
  private data: DataFetcher;
  private notifications: NotificationManager;
  private database: DatabaseManager;
  private isRunning: boolean = false;
  private scanIntervalId: NodeJS.Timeout | null = null;
  private portfolioValue: number = 0;

  constructor() {
    this.config = Config.getConfig();

    // Initialize components
    this.wallet = new WalletManager(this.config.rpcEndpoint);
    const connection = this.wallet.getConnection();

    this.exchange = new RaydiumExchange(connection);
    this.security = new SecurityAnalyzer(connection);
    this.technical = new TechnicalAnalysis();
    this.risk = new RiskManager(this.config.risk);
    this.data = new DataFetcher();
    this.notifications = new NotificationManager(this.config.notifications);
    this.database = new DatabaseManager(
      this.config.database.enabled,
      this.config.database.type,
      this.config.database.connectionString
    );

    // Initialize AI sentiment if enabled
    if (this.config.ai.enableSentiment) {
      this.sentiment = new SentimentAnalyzer(
        this.config.ai.provider,
        this.config.ai.claudeApiKey,
        this.config.ai.openaiApiKey
      );
    }

    Logger.info('Trading bot initialized', {
      mode: this.config.mode,
      network: this.config.network,
    });
  }

  /**
   * Start the trading bot
   */
  public async start(): Promise<void> {
    try {
      Logger.info('Starting trading bot...');

      // Initialize wallet if in live mode
      if (this.config.mode === 'LIVE' && this.config.walletPrivateKey) {
        await this.wallet.initialize(this.config.walletPrivateKey);
        const balance = await this.wallet.getBalance();
        this.portfolioValue = balance * 100; // Assuming SOL = $100 (update with real price)

        Logger.info('Wallet connected', {
          publicKey: this.wallet.getPublicKey().toBase58(),
          balance: balance.toFixed(4),
        });
      } else {
        // Paper trading mode
        this.portfolioValue = 10000; // Start with $10,000 paper money
        Logger.info('Paper trading mode - starting with $10,000 virtual capital');
      }

      // Initialize database
      await this.database.initialize();

      // Send start notification
      await this.notifications.notifyStatus('STARTED', `Mode: ${this.config.mode}`);

      // Start scanning for opportunities
      this.isRunning = true;
      this.scanIntervalId = setInterval(
        () => this.scanMarkets(),
        this.config.scanInterval
      );

      // Monitor open positions
      setInterval(() => this.monitorPositions(), 5000); // Check every 5 seconds

      Logger.info('Trading bot started successfully');
    } catch (error) {
      Logger.error('Failed to start trading bot', error);
      await this.notifications.notifyError('Failed to start bot', error);
      throw error;
    }
  }

  /**
   * Stop the trading bot
   */
  public async stop(): Promise<void> {
    try {
      Logger.info('Stopping trading bot...');

      this.isRunning = false;

      if (this.scanIntervalId) {
        clearInterval(this.scanIntervalId);
        this.scanIntervalId = null;
      }

      // Close all open positions
      await this.closeAllPositions();

      // Close database connection
      await this.database.close();

      // Send stop notification
      await this.notifications.notifyStatus('STOPPED');

      Logger.info('Trading bot stopped');
    } catch (error) {
      Logger.error('Error stopping trading bot', error);
    }
  }

  /**
   * Scan markets for trading opportunities
   */
  private async scanMarkets(): Promise<void> {
    if (!this.isRunning) return;

    try {
      Logger.debug('Scanning markets for opportunities...');

      // Get tokens to scan
      const tokens = await this.getTokensToScan();

      for (const token of tokens) {
        try {
          await this.analyzeToken(token);
        } catch (error) {
          Logger.error(`Failed to analyze token ${token.symbol}`, error);
        }
      }
    } catch (error) {
      Logger.error('Market scan failed', error);
    }
  }

  /**
   * Get list of tokens to scan
   */
  private async getTokensToScan(): Promise<Array<{ address: string; symbol: string }>> {
    try {
      // Option 1: Use configured trading pairs
      if (this.config.tradingPairs.length > 0) {
        return this.config.tradingPairs.map((pair) => ({
          address: 'PLACEHOLDER', // You need actual token addresses
          symbol: pair.split('/')[0],
        }));
      }

      // Option 2: Get trending tokens
      if (this.sentiment) {
        const trending = await this.sentiment.getTrendingTokens();
        return trending.slice(0, 10);
      }

      // Option 3: Get new listings
      const newListings = await this.data.getNewListings();
      return newListings.slice(0, 10).map((token: any) => ({
        address: token.tokenAddress,
        symbol: token.symbol,
      }));
    } catch (error) {
      Logger.error('Failed to get tokens to scan', error);
      return [];
    }
  }

  /**
   * Analyze a token for trading opportunity
   */
  private async analyzeToken(token: { address: string; symbol: string }): Promise<void> {
    try {
      Logger.debug(`Analyzing ${token.symbol}...`);

      // 1. Security check (fastest - do this first)
      const securityAnalysis = await this.security.analyzeToken(token.address);

      if (securityAnalysis.isHoneypot || securityAnalysis.score < 50) {
        Logger.warn(`Token ${token.symbol} failed security check`, {
          score: securityAnalysis.score,
          warnings: securityAnalysis.warnings,
        });
        await this.notifications.notifySecurityAlert(
          token.symbol,
          token.address,
          securityAnalysis.warnings
        );
        return;
      }

      // 2. Get price data
      const priceData = await this.data.getDexScreenerData(token.address);
      if (!priceData || priceData.liquidity < this.config.minLiquidity) {
        Logger.debug(`Insufficient liquidity for ${token.symbol}`);
        return;
      }

      // 3. Get historical data for technical analysis
      const historicalData = await this.data.getHistoricalData(token.address, '1h', 200);
      if (historicalData.length < 200) {
        Logger.debug(`Insufficient historical data for ${token.symbol}`);
        return;
      }

      // 4. Calculate technical indicators
      const indicators = this.technical.calculateIndicators(historicalData);
      if (!indicators) {
        Logger.debug(`Failed to calculate indicators for ${token.symbol}`);
        return;
      }

      // 5. Generate trading signal
      const signal = this.technical.generateSignal(indicators, priceData.price);

      // 6. Get AI sentiment if enabled
      let sentimentScore = 0;
      if (this.sentiment && this.config.strategies.aiSentiment) {
        const sentiment = await this.sentiment.analyzeSentiment(token.symbol, token.address);
        sentimentScore = sentiment.score;

        // Adjust signal confidence based on sentiment
        if (signal.action === 'BUY' && sentiment.overall === 'BULLISH') {
          signal.confidence += 10;
        } else if (signal.action === 'SELL' && sentiment.overall === 'BEARISH') {
          signal.confidence += 10;
        } else if (
          (signal.action === 'BUY' && sentiment.overall === 'BEARISH') ||
          (signal.action === 'SELL' && sentiment.overall === 'BULLISH')
        ) {
          signal.confidence -= 20;
        }
      }

      // 7. Check if we should execute trade
      if (signal.action === 'BUY' && signal.confidence >= 70) {
        await this.executeBuy(token, priceData.price, signal.confidence);
      } else if (signal.action === 'SELL' && signal.confidence >= 70) {
        // Check if we have open position
        const openPosition = this.risk
          .getOpenPositions()
          .find((p) => p.tokenAddress === token.address);

        if (openPosition) {
          await this.executeSell(openPosition);
        }
      } else if (signal.confidence >= 60) {
        // Send signal notification even if not trading
        await this.notifications.notifySignal(token.symbol, signal);
      }
    } catch (error) {
      Logger.error(`Failed to analyze token ${token.symbol}`, error);
    }
  }

  /**
   * Execute a buy order
   */
  private async executeBuy(
    token: { address: string; symbol: string },
    price: number,
    confidence: number
  ): Promise<void> {
    try {
      Logger.info(`Attempting to buy ${token.symbol}`, { price, confidence });

      // Calculate position size
      const positionSize = this.risk.calculatePositionSize(
        price,
        this.portfolioValue,
        0.1 // volatility placeholder
      );

      // Risk management check
      const riskCheck = this.risk.canOpenTrade(
        token.symbol,
        token.address,
        price,
        positionSize,
        this.portfolioValue
      );

      if (!riskCheck.allowed) {
        Logger.warn(`Trade blocked by risk management: ${riskCheck.reason}`);
        return;
      }

      // Execute trade
      let result;
      if (this.config.mode === 'LIVE') {
        result = await this.exchange.executeSwap(
          {
            inputMint: 'So11111111111111111111111111111111111111112', // SOL
            outputMint: token.address,
            amount: positionSize * price, // Amount in SOL
            slippage: this.config.risk.maxSlippage,
          },
          this.wallet.getKeypair()
        );
      } else {
        // Paper trading
        result = {
          success: true,
          txSignature: 'PAPER_' + uuidv4(),
          executedPrice: price,
          slippage: 0.5,
          timestamp: Date.now(),
        };
      }

      if (result.success) {
        // Open position
        const position = this.risk.openPosition(
          token.address,
          token.symbol,
          price,
          positionSize
        );

        // Save to database
        const trade: TradeRecord = {
          id: uuidv4(),
          tokenAddress: token.address,
          tokenSymbol: token.symbol,
          type: 'BUY',
          amount: positionSize,
          price,
          value: positionSize * price,
          fees: 0,
          slippage: result.slippage || 0,
          txSignature: result.txSignature || '',
          strategy: 'TECHNICAL_ANALYSIS',
          confidence,
          timestamp: Date.now(),
        };

        await this.database.saveTrade(trade);
        await this.database.savePosition(position);

        // Send notifications
        await this.notifications.notifyTrade('BUY', token.symbol, positionSize, price, result);
        await this.notifications.notifyPositionUpdate('OPENED', position);

        Logger.trade('BUY_SUCCESS', {
          symbol: token.symbol,
          amount: positionSize,
          price,
          confidence,
        });
      } else {
        Logger.error('Buy order failed', result.error);
        await this.notifications.notifyError(`Buy order failed for ${token.symbol}`, result.error);
      }
    } catch (error) {
      Logger.error('Failed to execute buy', error);
      await this.notifications.notifyError(`Failed to buy ${token.symbol}`, error);
    }
  }

  /**
   * Execute a sell order
   */
  private async executeSell(position: Position): Promise<void> {
    try {
      Logger.info(`Attempting to sell ${position.tokenSymbol}`, {
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice,
      });

      let result;
      if (this.config.mode === 'LIVE') {
        result = await this.exchange.executeSwap(
          {
            inputMint: position.tokenAddress,
            outputMint: 'So11111111111111111111111111111111111111112', // SOL
            amount: position.amount,
            slippage: this.config.risk.maxSlippage,
          },
          this.wallet.getKeypair()
        );
      } else {
        // Paper trading
        result = {
          success: true,
          txSignature: 'PAPER_' + uuidv4(),
          executedPrice: position.currentPrice,
          slippage: 0.5,
          timestamp: Date.now(),
        };
      }

      if (result.success) {
        // Close position
        const closedPosition = this.risk.closePosition(
          position.id,
          result.executedPrice || position.currentPrice
        );

        if (closedPosition) {
          // Save to database
          const trade: TradeRecord = {
            id: uuidv4(),
            tokenAddress: position.tokenAddress,
            tokenSymbol: position.tokenSymbol,
            type: 'SELL',
            amount: position.amount,
            price: closedPosition.currentPrice,
            value: closedPosition.value,
            fees: 0,
            slippage: result.slippage || 0,
            txSignature: result.txSignature || '',
            strategy: 'TECHNICAL_ANALYSIS',
            confidence: 0,
            pnl: closedPosition.pnl,
            timestamp: Date.now(),
          };

          await this.database.saveTrade(trade);
          await this.database.savePosition(closedPosition);

          // Send notifications
          await this.notifications.notifyTrade(
            'SELL',
            position.tokenSymbol,
            position.amount,
            closedPosition.currentPrice,
            result
          );
          await this.notifications.notifyPositionUpdate('CLOSED', closedPosition);

          Logger.trade('SELL_SUCCESS', {
            symbol: position.tokenSymbol,
            pnl: closedPosition.pnl,
            pnlPercent: closedPosition.pnlPercent,
          });
        }
      } else {
        Logger.error('Sell order failed', result.error);
        await this.notifications.notifyError(
          `Sell order failed for ${position.tokenSymbol}`,
          result.error
        );
      }
    } catch (error) {
      Logger.error('Failed to execute sell', error);
      await this.notifications.notifyError(`Failed to sell ${position.tokenSymbol}`, error);
    }
  }

  /**
   * Monitor open positions for stop loss / take profit
   */
  private async monitorPositions(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const positions = this.risk.getOpenPositions();

      for (const position of positions) {
        // Get current price
        const priceData = await this.data.getDexScreenerData(position.tokenAddress);
        if (!priceData) continue;

        // Update position
        this.risk.updatePosition(position.id, priceData.price);
        await this.database.savePosition(position);

        // Check if should close
        const shouldClose = this.risk.shouldClosePosition(position);
        if (shouldClose.shouldClose) {
          Logger.info(`Closing position: ${shouldClose.reason}`, {
            symbol: position.tokenSymbol,
            entryPrice: position.entryPrice,
            currentPrice: position.currentPrice,
          });

          await this.executeSell(position);
        }
      }
    } catch (error) {
      Logger.error('Failed to monitor positions', error);
    }
  }

  /**
   * Close all open positions
   */
  private async closeAllPositions(): Promise<void> {
    const positions = this.risk.getOpenPositions();

    for (const position of positions) {
      try {
        await this.executeSell(position);
      } catch (error) {
        Logger.error(`Failed to close position ${position.tokenSymbol}`, error);
      }
    }
  }

  /**
   * Get bot status
   */
  public getStatus(): {
    isRunning: boolean;
    mode: string;
    portfolioValue: number;
    openPositions: number;
    dailyPnL: number;
  } {
    return {
      isRunning: this.isRunning,
      mode: this.config.mode,
      portfolioValue: this.portfolioValue,
      openPositions: this.risk.getOpenPositions().length,
      dailyPnL: this.risk.getDailyPnL(),
    };
  }
}

export default TradingBot;
