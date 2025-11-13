import { KalshiClient } from '../api/KalshiClient';
import {
  TradingOpportunity,
  TradeResult,
  KalshiOrder,
  KalshiConfig,
} from '../types/KalshiTypes';
import { Logger } from '../utils/Logger';

/**
 * Executes trades on Kalshi
 * Handles order placement, monitoring, and execution
 */
export class TradeExecutor {
  private client: KalshiClient;
  private logger = Logger.getInstance();
  private config: KalshiConfig;
  private pendingOrders: Map<string, KalshiOrder> = new Map();

  constructor(client: KalshiClient, config: KalshiConfig) {
    this.client = client;
    this.config = config;
  }

  /**
   * Execute a trading opportunity
   */
  async executeTrade(opportunity: TradingOpportunity): Promise<TradeResult> {
    const { ticker, side, action, currentPrice, recommendedSize } = opportunity;

    this.logger.info(`Executing trade: ${action} ${recommendedSize} contracts of ${ticker} ${side} @ ${currentPrice}¢`);

    // Dry run mode - simulate only
    if (this.config.dryRun) {
      return this.simulateTrade(opportunity);
    }

    try {
      // Place limit order at current ask/bid price
      const price = action === 'buy' ? currentPrice : currentPrice;

      const order = await this.client.placeOrder({
        ticker,
        action,
        side,
        count: recommendedSize,
        type: 'limit',
        yes_price: side === 'yes' ? price : undefined,
        no_price: side === 'no' ? price : undefined,
      });

      this.pendingOrders.set(order.order_id, order);

      this.logger.info(`Order placed successfully: ${order.order_id}`);

      // Monitor order for a short time to see if it fills
      const filledOrder = await this.monitorOrder(order.order_id, 5000); // 5 seconds

      const totalCost = (filledOrder ? recommendedSize : 0) * price;

      return {
        success: filledOrder !== null,
        orderId: order.order_id,
        ticker,
        side,
        action,
        contracts: recommendedSize,
        price,
        totalCost,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`Trade execution failed: ${error.message}`);

      return {
        success: false,
        ticker,
        side,
        action,
        contracts: 0,
        price: currentPrice,
        totalCost: 0,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Simulate a trade (dry run mode)
   */
  private simulateTrade(opportunity: TradingOpportunity): TradeResult {
    const { ticker, side, action, currentPrice, recommendedSize } = opportunity;

    const totalCost = recommendedSize * currentPrice / 100;

    this.logger.info(`[DRY RUN] Would ${action} ${recommendedSize} contracts of ${ticker} ${side} @ ${currentPrice}¢`);
    this.logger.info(`[DRY RUN] Total cost: $${totalCost.toFixed(2)}`);
    this.logger.info(`[DRY RUN] Expected value: ${(opportunity.expectedValue * 100).toFixed(1)}%`);

    return {
      success: true,
      orderId: `DRY_RUN_${Date.now()}`,
      ticker,
      side,
      action,
      contracts: recommendedSize,
      price: currentPrice,
      totalCost: totalCost * 100, // Convert to cents
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Monitor an order to see if it gets filled
   */
  private async monitorOrder(
    orderId: string,
    timeoutMs: number
  ): Promise<KalshiOrder | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const orders = await this.client.getOrders({});

        const order = orders.orders.find((o) => o.order_id === orderId);

        if (!order) {
          this.logger.warn(`Order ${orderId} not found`);
          return null;
        }

        if (order.status === 'executed') {
          this.logger.info(`Order ${orderId} filled!`);
          this.pendingOrders.delete(orderId);
          return order;
        }

        if (order.status === 'canceled') {
          this.logger.warn(`Order ${orderId} was canceled`);
          this.pendingOrders.delete(orderId);
          return null;
        }

        // Still pending, wait a bit
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        this.logger.error(`Error monitoring order: ${error.message}`);
        return null;
      }
    }

    this.logger.info(`Order ${orderId} timeout - still pending`);
    return null;
  }

  /**
   * Cancel a pending order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      await this.client.cancelOrder(orderId);
      this.pendingOrders.delete(orderId);
      this.logger.info(`Order ${orderId} canceled`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to cancel order ${orderId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Cancel all pending orders
   */
  async cancelAllOrders(): Promise<void> {
    this.logger.info(`Canceling ${this.pendingOrders.size} pending orders...`);

    const cancelPromises = Array.from(this.pendingOrders.keys()).map((orderId) =>
      this.cancelOrder(orderId)
    );

    await Promise.all(cancelPromises);
  }

  /**
   * Get pending orders
   */
  getPendingOrders(): KalshiOrder[] {
    return Array.from(this.pendingOrders.values());
  }

  /**
   * Execute exit strategy for a position
   */
  async exitPosition(
    ticker: string,
    side: 'yes' | 'no',
    contracts: number,
    currentBidPrice: number
  ): Promise<TradeResult> {
    this.logger.info(`Exiting position: Sell ${contracts} contracts of ${ticker} ${side} @ ${currentBidPrice}¢`);

    if (this.config.dryRun) {
      const totalProceeds = contracts * currentBidPrice / 100;
      this.logger.info(`[DRY RUN] Would sell ${contracts} contracts for $${totalProceeds.toFixed(2)}`);

      return {
        success: true,
        orderId: `DRY_RUN_EXIT_${Date.now()}`,
        ticker,
        side,
        action: 'sell',
        contracts,
        price: currentBidPrice,
        totalCost: totalProceeds * 100, // Convert to cents
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const order = await this.client.placeOrder({
        ticker,
        action: 'sell',
        side,
        count: contracts,
        type: 'limit',
        yes_price: side === 'yes' ? currentBidPrice : undefined,
        no_price: side === 'no' ? currentBidPrice : undefined,
      });

      this.logger.info(`Exit order placed: ${order.order_id}`);

      const totalProceeds = contracts * currentBidPrice;

      return {
        success: true,
        orderId: order.order_id,
        ticker,
        side,
        action: 'sell',
        contracts,
        price: currentBidPrice,
        totalCost: totalProceeds,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`Exit failed: ${error.message}`);

      return {
        success: false,
        ticker,
        side,
        action: 'sell',
        contracts: 0,
        price: currentBidPrice,
        totalCost: 0,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute arbitrage trade (buy both YES and NO)
   */
  async executeArbitrage(
    ticker: string,
    yesContracts: number,
    noContracts: number,
    yesPrice: number,
    noPrice: number
  ): Promise<{ yesResult: TradeResult; noResult: TradeResult }> {
    this.logger.info(`EXECUTING ARBITRAGE on ${ticker}:`);
    this.logger.info(`  YES: ${yesContracts} contracts @ ${yesPrice}¢`);
    this.logger.info(`  NO: ${noContracts} contracts @ ${noPrice}¢`);
    this.logger.info(`  Profit: ${100 - yesPrice - noPrice}¢ per pair`);

    const yesOpportunity: TradingOpportunity = {
      ticker,
      title: 'Arbitrage YES',
      side: 'yes',
      action: 'buy',
      currentPrice: yesPrice,
      fairValue: 0,
      edge: 0,
      expectedValue: 0,
      kellyFraction: 0,
      recommendedSize: yesContracts,
      maxSize: yesContracts,
      reasoning: 'Arbitrage opportunity',
      confidence: 1,
      category: 'arbitrage',
      expirationTime: '',
    };

    const noOpportunity: TradingOpportunity = {
      ticker,
      title: 'Arbitrage NO',
      side: 'no',
      action: 'buy',
      currentPrice: noPrice,
      fairValue: 0,
      edge: 0,
      expectedValue: 0,
      kellyFraction: 0,
      recommendedSize: noContracts,
      maxSize: noContracts,
      reasoning: 'Arbitrage opportunity',
      confidence: 1,
      category: 'arbitrage',
      expirationTime: '',
    };

    const [yesResult, noResult] = await Promise.all([
      this.executeTrade(yesOpportunity),
      this.executeTrade(noOpportunity),
    ]);

    return { yesResult, noResult };
  }
}
