import { KalshiClient } from '../api/KalshiClient';
import { OpportunityDetector } from '../strategy/OpportunityDetector';
import { TradeExecutor } from '../execution/TradeExecutor';
import { RiskManager } from '../risk/RiskManager';
import { KalshiConfig, TradingOpportunity } from '../types/KalshiTypes';
import { Logger } from '../utils/Logger';

/**
 * Main Kalshi Trading Bot
 * Scans markets, detects opportunities, and executes profitable trades
 */
export class KalshiTradingBot {
  private client: KalshiClient;
  private detector: OpportunityDetector;
  private executor: TradeExecutor;
  private riskManager: RiskManager;
  private config: KalshiConfig;
  private logger = Logger.getInstance();
  private isRunning = false;
  private scanInterval: NodeJS.Timeout | null = null;

  constructor(config: KalshiConfig) {
    this.config = config;
    this.client = new KalshiClient(config.email, config.password, config.baseUrl);
    this.detector = new OpportunityDetector(config);
    this.executor = new TradeExecutor(this.client, config);
    this.riskManager = new RiskManager(this.client, config);
  }

  /**
   * Start the trading bot
   */
  async start(): Promise<void> {
    this.logger.info('Starting Kalshi Trading Bot...');

    try {
      // Authenticate with Kalshi
      await this.client.authenticate();

      // Health check
      const healthy = await this.client.healthCheck();
      if (!healthy) {
        throw new Error('Kalshi API health check failed');
      }

      // Get initial portfolio state
      const portfolio = await this.riskManager.getPortfolioSummary();
      this.logger.info('Portfolio Summary:');
      this.logger.info(`  Balance: $${(portfolio.totalBalance / 100).toFixed(2)}`);
      this.logger.info(`  Positions: ${portfolio.positionCount}`);
      this.logger.info(`  Exposure: $${(portfolio.totalExposure / 100).toFixed(2)}`);
      this.logger.info(`  P&L: $${((portfolio.realizedPnl + portfolio.unrealizedPnl) / 100).toFixed(2)}`);

      // Start scanning loop
      this.isRunning = true;
      this.logger.info(`Scanning every ${this.config.scanIntervalMs / 1000} seconds`);
      await this.scan(); // Run once immediately

      // Schedule recurring scans
      this.scanInterval = setInterval(async () => {
        await this.scan();
      }, this.config.scanIntervalMs);

    } catch (error: any) {
      this.logger.error('Failed to start bot:', error);
      throw error;
    }
  }

  /**
   * Stop the trading bot
   */
  stop(): void {
    this.logger.info('Stopping bot...');
    this.isRunning = false;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    this.logger.info('Bot stopped');
  }

  /**
   * Emergency stop - cancel orders and stop trading
   */
  async emergencyStop(): Promise<void> {
    this.logger.warn('EMERGENCY STOP');
    this.stop();
    await this.riskManager.emergencyStop();
  }

  /**
   * Main scanning loop
   */
  private async scan(): Promise<void> {
    try {
      this.logger.info('='.repeat(60));
      this.logger.info('Starting market scan...');

      // Step 1: Fetch markets
      const markets = await this.fetchMarkets();
      this.logger.info(`Found ${markets.length} open markets`);

      if (markets.length === 0) {
        this.logger.info('No markets to scan');
        return;
      }

      // Step 2: Find opportunities
      const opportunities = await this.detector.findOpportunities(markets);

      if (opportunities.length === 0) {
        this.logger.info('No opportunities found');
        return;
      }

      // Filter by categories
      const filteredOpportunities = this.detector.filterByCategory(
        opportunities,
        this.config.categories
      );

      this.logger.info(`Found ${filteredOpportunities.length} opportunities in target categories`);

      // Step 3: Log top opportunities
      this.logOpportunities(filteredOpportunities.slice(0, 5));

      // Step 4: Execute trades (if not dry run)
      await this.executeOpportunities(filteredOpportunities);

      // Step 5: Manage existing positions
      await this.managePositions();

      // Step 6: Portfolio health check
      await this.performHealthCheck();

    } catch (error: any) {
      this.logger.error('Error during scan:', error);
    }
  }

  /**
   * Fetch markets from Kalshi
   */
  private async fetchMarkets() {
    const allMarkets = [];

    // Fetch by category if specified
    if (this.config.categories.length > 0) {
      for (const category of this.config.categories) {
        try {
          const categoryMarkets = await this.client.getMarketsByCategory(category);
          allMarkets.push(...categoryMarkets);
        } catch (error) {
          this.logger.warn(`Failed to fetch ${category} markets:`, error);
        }
      }
    } else {
      // Fetch all open markets
      const response = await this.client.getMarkets({ status: 'open', limit: 200 });
      allMarkets.push(...response.markets);
    }

    return allMarkets;
  }

  /**
   * Log top opportunities
   */
  private logOpportunities(opportunities: TradingOpportunity[]): void {
    if (opportunities.length === 0) return;

    this.logger.info('\nTop Opportunities:');
    this.logger.info('-'.repeat(60));

    opportunities.forEach((opp, index) => {
      this.logger.info(`${index + 1}. ${opp.title}`);
      this.logger.info(`   ${opp.reasoning}`);
      this.logger.info(`   Action: ${opp.action.toUpperCase()} ${opp.recommendedSize} contracts @ ${opp.currentPrice}¢`);
      this.logger.info(`   Total cost: $${(opp.recommendedSize * opp.currentPrice / 100).toFixed(2)}`);
      this.logger.info('');
    });
  }

  /**
   * Execute trading opportunities
   */
  private async executeOpportunities(opportunities: TradingOpportunity[]): Promise<void> {
    if (opportunities.length === 0) return;

    // Execute top opportunity only (conservative approach)
    const topOpp = opportunities[0];

    // Check risk approval
    const riskCheck = await this.riskManager.canTakePosition(topOpp);

    if (!riskCheck.approved) {
      this.logger.warn(`Position rejected: ${riskCheck.reason}`);
      return;
    }

    // Adjust position size based on confidence
    const adjustedSize = this.riskManager.adjustPositionSize(
      topOpp,
      topOpp.recommendedSize
    );

    if (adjustedSize !== topOpp.recommendedSize) {
      this.logger.info(
        `Adjusted position size: ${topOpp.recommendedSize} -> ${adjustedSize} contracts`
      );
      topOpp.recommendedSize = adjustedSize;
    }

    // Execute trade
    this.logger.info(`\nExecuting trade:`);
    this.logger.info(`  ${topOpp.action.toUpperCase()} ${topOpp.recommendedSize} x ${topOpp.ticker} ${topOpp.side}`);

    const result = await this.executor.executeTrade(topOpp);

    if (result.success) {
      this.logger.info(`✓ Trade executed successfully!`);
      this.logger.info(`  Order ID: ${result.orderId}`);
      this.logger.info(`  Cost: $${(result.totalCost / 100).toFixed(2)}`);
    } else {
      this.logger.error(`✗ Trade failed: ${result.error}`);
    }
  }

  /**
   * Manage existing positions
   */
  private async managePositions(): Promise<void> {
    const exits = await this.riskManager.identifyExitOpportunities();

    if (exits.length === 0) return;

    this.logger.info(`\nFound ${exits.length} exit opportunities:`);

    for (const exit of exits) {
      if (exit.urgency === 'high') {
        this.logger.warn(`URGENT EXIT: ${exit.ticker} - ${exit.reason}`);

        // Execute exit
        try {
          const market = await this.client.getMarket(exit.ticker);
          const bidPrice = exit.side === 'yes' ? market.yes_bid : market.no_bid;

          const result = await this.executor.exitPosition(
            exit.ticker,
            exit.side,
            exit.contracts,
            bidPrice
          );

          if (result.success) {
            this.logger.info(`✓ Exited ${exit.ticker}: $${(result.totalCost / 100).toFixed(2)}`);
          }
        } catch (error) {
          this.logger.error(`Failed to exit ${exit.ticker}:`, error);
        }
      } else {
        this.logger.info(`  ${exit.ticker}: ${exit.reason} (${exit.urgency})`);
      }
    }
  }

  /**
   * Perform portfolio health check
   */
  private async performHealthCheck(): Promise<void> {
    const health = await this.riskManager.healthCheck();

    if (!health.healthy) {
      this.logger.error('\nPORTFOLIO HEALTH CHECK FAILED:');
      health.issues.forEach((issue) => this.logger.error(`  - ${issue}`));

      if (health.issues.length > 0) {
        this.logger.warn('Consider reducing exposure or closing positions');
      }
    }

    if (health.warnings.length > 0) {
      this.logger.warn('\nPortfolio Warnings:');
      health.warnings.forEach((warning) => this.logger.warn(`  - ${warning}`));
    }
  }

  /**
   * Get bot status
   */
  getStatus(): {
    running: boolean;
    mode: string;
    config: {
      minEdge: number;
      maxPosition: number;
      maxExposure: number;
      categories: string[];
    };
  } {
    return {
      running: this.isRunning,
      mode: this.config.dryRun ? 'DRY RUN' : 'LIVE',
      config: {
        minEdge: this.config.minEdge,
        maxPosition: this.config.maxPositionSize,
        maxExposure: this.config.maxTotalExposure,
        categories: this.config.categories,
      },
    };
  }
}
