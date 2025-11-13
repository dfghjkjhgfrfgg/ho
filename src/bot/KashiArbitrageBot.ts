import { ethers } from 'ethers';
import { BotConfig, ArbitrageOpportunity } from '../contracts/types';
import { MarketDataFetcher } from '../data/MarketDataFetcher';
import { OpportunityDetector } from '../strategy/OpportunityDetector';
import { TradeExecutor } from '../execution/TradeExecutor';
import { RiskManager } from '../risk/RiskManager';
import { Logger } from '../utils/Logger';
import { Config } from '../utils/Config';

/**
 * Main Kashi Arbitrage Bot
 * Scans markets, detects opportunities, and executes profitable trades
 * Uses MATHEMATICS, not hope
 */
export class KashiArbitrageBot {
  private config: BotConfig;
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private dataFetcher: MarketDataFetcher;
  private opportunityDetector: OpportunityDetector;
  private tradeExecutor: TradeExecutor;
  private riskManager: RiskManager;
  private logger: Logger;
  private isRunning: boolean = false;
  private marketAddresses: string[];

  constructor(config: BotConfig) {
    this.config = config;
    this.logger = new Logger(config.logLevel);

    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    // Initialize wallet
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);

    // Initialize components
    this.dataFetcher = new MarketDataFetcher(this.provider);
    this.opportunityDetector = new OpportunityDetector(config);
    this.tradeExecutor = new TradeExecutor(
      this.wallet,
      config,
      this.dataFetcher
    );
    this.riskManager = new RiskManager();

    // Resolve market addresses
    this.marketAddresses = Config.resolveMarketAddresses(config.kashiMarkets);

    if (this.marketAddresses.length === 0) {
      this.logger.logWarning(
        'No valid market addresses found. Please update Config.getKashiPairAddresses() with actual addresses.'
      );
    }
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    this.logger.logStartup(this.config);

    if (this.config.dryRun) {
      this.logger.logInfo('Running in DRY RUN mode - no trades will be executed');
    }

    this.isRunning = true;

    // Main bot loop
    while (this.isRunning) {
      try {
        await this.runCycle();
        await this.sleep(this.config.executionIntervalMs);
      } catch (error) {
        this.logger.logError('Bot cycle', error);
        await this.sleep(5000); // Wait 5s on error
      }
    }
  }

  /**
   * Stop the bot
   */
  stop(): void {
    this.logger.logInfo('Stopping bot...');
    this.isRunning = false;
  }

  /**
   * Run one complete bot cycle
   */
  private async runCycle(): Promise<void> {
    this.logger.logDebug('Starting new cycle');

    // 1. Fetch market data
    const markets = await this.dataFetcher.fetchMultipleMarkets(
      this.marketAddresses
    );

    if (markets.length === 0) {
      this.logger.logWarning('No market data fetched');
      return;
    }

    // 2. Detect opportunities
    const opportunities = await this.opportunityDetector.detectOpportunities(
      markets,
      await this.getETHPriceUSD()
    );

    this.logger.logMarketScan(markets.length, opportunities.length);

    // 3. Process opportunities
    for (const opportunity of opportunities) {
      await this.processOpportunity(opportunity);
    }
  }

  /**
   * Process a single arbitrage opportunity
   */
  private async processOpportunity(
    opportunity: ArbitrageOpportunity
  ): Promise<void> {
    this.logger.logOpportunityDetected(opportunity);

    // Skip if not worth executing
    if (!opportunity.worthExecuting) {
      this.logger.logDebug('Opportunity not worth executing', {
        id: opportunity.id,
        reason: opportunity.reason
      });
      return;
    }

    // Perform risk assessment
    const riskAssessment = this.riskManager.assessRisk(opportunity);
    this.logger.logRiskAssessment(opportunity.id, riskAssessment);

    // Only proceed if risk checks pass
    if (!riskAssessment.canProceed) {
      this.logger.logWarning('Risk assessment failed, skipping execution', {
        opportunityId: opportunity.id,
        recommendation: riskAssessment.recommendation
      });
      return;
    }

    // Execute the trade
    const result = await this.tradeExecutor.execute(opportunity);
    this.logger.logTradeExecution(result);

    // If execution failed, log and continue
    if (!result.success) {
      this.logger.logError('Trade execution failed', result.error);
    }
  }

  /**
   * Get current ETH price in USD
   * In production, you'd want to fetch this from an oracle or price feed
   */
  private async getETHPriceUSD(): Promise<number> {
    // TODO: Implement actual price fetching
    // For now, return a default value
    return 2000; // $2000 per ETH
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get bot status
   */
  getStatus(): {
    isRunning: boolean;
    config: BotConfig;
    marketCount: number;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      marketCount: this.marketAddresses.length
    };
  }

  /**
   * Emergency stop - close all positions and stop bot
   */
  async emergencyStop(): Promise<void> {
    this.logger.logWarning('EMERGENCY STOP TRIGGERED');

    this.isRunning = false;

    // TODO: Close all open positions
    // This would require tracking active positions

    this.logger.logInfo('Emergency stop complete');
  }
}
