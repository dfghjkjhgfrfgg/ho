import { KalshiClient } from '../api/KalshiClient';
import {
  KalshiConfig,
  TradingOpportunity,
  PortfolioSummary,
  KalshiPosition,
} from '../types/KalshiTypes';
import { Logger } from '../utils/Logger';

/**
 * Manages risk and portfolio exposure for Kalshi trading
 * Implements position sizing, exposure limits, and portfolio management
 */
export class RiskManager {
  private client: KalshiClient;
  private config: KalshiConfig;
  private logger = Logger.getInstance();

  constructor(client: KalshiClient, config: KalshiConfig) {
    this.client = client;
    this.config = config;
  }

  /**
   * Get current portfolio summary
   */
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const [balance, positions] = await Promise.all([
      this.client.getBalance(),
      this.client.getPositions(),
    ]);

    const totalExposure = positions.reduce(
      (sum, pos) => sum + pos.market_exposure,
      0
    );

    const realizedPnl = positions.reduce(
      (sum, pos) => sum + pos.realized_pnl,
      0
    );

    const unrealizedPnl = positions.reduce(
      (sum, pos) => sum + pos.unrealized_pnl,
      0
    );

    return {
      totalBalance: balance.balance,
      totalExposure,
      positionCount: positions.length,
      realizedPnl,
      unrealizedPnl,
      positions,
    };
  }

  /**
   * Check if opportunity passes risk constraints
   */
  async canTakePosition(
    opportunity: TradingOpportunity
  ): Promise<{ approved: boolean; reason?: string }> {
    // Check 1: Get current portfolio state
    const portfolio = await this.getPortfolioSummary();

    // Check 2: Validate bankroll
    const balance = portfolio.totalBalance / 100; // Convert cents to dollars
    if (balance < opportunity.recommendedSize * opportunity.currentPrice / 100) {
      return {
        approved: false,
        reason: `Insufficient balance: $${balance.toFixed(2)}`,
      };
    }

    // Check 3: Check total exposure limit
    const currentExposure = portfolio.totalExposure / 100; // Convert to dollars
    const newPositionCost = (opportunity.recommendedSize * opportunity.currentPrice) / 100;
    const totalExposure = currentExposure + newPositionCost;

    if (totalExposure > this.config.maxTotalExposure) {
      return {
        approved: false,
        reason: `Would exceed max exposure: $${totalExposure.toFixed(2)} > $${this.config.maxTotalExposure}`,
      };
    }

    // Check 4: Position size limit
    if (newPositionCost > this.config.maxPositionSize) {
      return {
        approved: false,
        reason: `Position too large: $${newPositionCost.toFixed(2)} > $${this.config.maxPositionSize}`,
      };
    }

    // Check 5: Minimum edge requirement
    if (opportunity.edge < this.config.minEdge) {
      return {
        approved: false,
        reason: `Edge too low: ${(opportunity.edge * 100).toFixed(1)}% < ${(this.config.minEdge * 100).toFixed(1)}%`,
      };
    }

    // Check 6: Correlation/concentration check
    const concentrationCheck = await this.checkConcentration(
      portfolio,
      opportunity
    );

    if (!concentrationCheck.approved) {
      return concentrationCheck;
    }

    return { approved: true };
  }

  /**
   * Check for portfolio concentration risk
   */
  private async checkConcentration(
    portfolio: PortfolioSummary,
    opportunity: TradingOpportunity
  ): Promise<{ approved: boolean; reason?: string }> {
    // Count positions in same category
    const categoryPositions = portfolio.positions.filter((pos) =>
      opportunity.category.toLowerCase().includes(pos.ticker.toLowerCase().slice(0, 3))
    );

    const categoryExposure = categoryPositions.reduce(
      (sum, pos) => sum + pos.market_exposure,
      0
    ) / 100;

    const maxCategoryExposure = this.config.maxTotalExposure * 0.5; // Max 50% in one category

    const newPositionCost = (opportunity.recommendedSize * opportunity.currentPrice) / 100;

    if (categoryExposure + newPositionCost > maxCategoryExposure) {
      return {
        approved: false,
        reason: `Category overexposure: ${opportunity.category} already has $${categoryExposure.toFixed(2)}`,
      };
    }

    // Check if we already have a position in this exact market
    const existingPosition = portfolio.positions.find(
      (pos) => pos.ticker === opportunity.ticker
    );

    if (existingPosition) {
      // Only allow adding to position if on same side
      const existingSide = existingPosition.position > 0 ? 'yes' : 'no';
      if (existingSide !== opportunity.side) {
        return {
          approved: false,
          reason: `Already have opposite position in ${opportunity.ticker}`,
        };
      }
    }

    return { approved: true };
  }

  /**
   * Adjust position size based on confidence and risk
   */
  adjustPositionSize(
    opportunity: TradingOpportunity,
    baseSize: number
  ): number {
    let adjustedSize = baseSize;

    // Adjust for confidence
    // Lower confidence = smaller position
    if (opportunity.confidence < 0.7) {
      adjustedSize = Math.floor(adjustedSize * 0.5);
    } else if (opportunity.confidence < 0.8) {
      adjustedSize = Math.floor(adjustedSize * 0.75);
    }

    // Adjust for time to expiration
    const expirationDate = new Date(opportunity.expirationTime);
    const now = new Date();
    const hoursUntilExpiration =
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Reduce size for events far in future (more uncertainty)
    if (hoursUntilExpiration > 168) {
      // > 7 days
      adjustedSize = Math.floor(adjustedSize * 0.5);
    } else if (hoursUntilExpiration > 72) {
      // > 3 days
      adjustedSize = Math.floor(adjustedSize * 0.75);
    }

    // Reduce size for events very close to expiration (execution risk)
    if (hoursUntilExpiration < 2) {
      adjustedSize = Math.floor(adjustedSize * 0.3);
    }

    return Math.max(1, adjustedSize);
  }

  /**
   * Identify positions that should be closed
   */
  async identifyExitOpportunities(): Promise<{
    ticker: string;
    side: 'yes' | 'no';
    contracts: number;
    reason: string;
    urgency: 'low' | 'medium' | 'high';
  }[]> {
    const positions = await this.client.getPositions();
    const exits: any[] = [];

    for (const position of positions) {
      // Skip positions with no contracts
      if (position.position === 0) {
        continue;
      }

      const side = position.position > 0 ? 'yes' : 'no';
      const contracts = Math.abs(position.position);

      // Exit if close to expiration
      try {
        const market = await this.client.getMarket(position.ticker);
        const expirationDate = new Date(market.expiration_time);
        const now = new Date();
        const hoursUntilExpiration =
          (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilExpiration < 1) {
          exits.push({
            ticker: position.ticker,
            side,
            contracts,
            reason: 'Approaching expiration',
            urgency: 'high' as const,
          });
          continue;
        }

        // Exit if showing good profit
        const profitPercent = position.unrealized_pnl / position.total_cost;
        if (profitPercent > 0.5) {
          // 50% profit
          exits.push({
            ticker: position.ticker,
            side,
            contracts,
            reason: `Take profit: ${(profitPercent * 100).toFixed(1)}% gain`,
            urgency: 'low' as const,
          });
        }

        // Exit if showing large loss
        if (profitPercent < -0.3) {
          // 30% loss
          exits.push({
            ticker: position.ticker,
            side,
            contracts,
            reason: `Cut loss: ${(profitPercent * 100).toFixed(1)}% loss`,
            urgency: 'high' as const,
          });
        }
      } catch (error) {
        this.logger.error(`Error analyzing position ${position.ticker}:`, error);
      }
    }

    return exits;
  }

  /**
   * Calculate risk metrics for reporting
   */
  async calculateRiskMetrics(): Promise<{
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    averageWin: number;
    averageLoss: number;
  }> {
    // This would require historical trade data
    // Simplified version for now
    const portfolio = await this.getPortfolioSummary();

    const totalPnl = portfolio.realizedPnl + portfolio.unrealizedPnl;
    const initialBalance = 10000 * 100; // Assume $10k starting (in cents)

    return {
      sharpeRatio: 0, // Would need return history
      maxDrawdown: 0, // Would need balance history
      winRate: 0, // Would need trade history
      profitFactor: totalPnl > 0 ? 1.5 : 0.5, // Placeholder
      averageWin: 0,
      averageLoss: 0,
    };
  }

  /**
   * Emergency stop - cancel all orders and prepare to close positions
   */
  async emergencyStop(): Promise<void> {
    this.logger.warn('EMERGENCY STOP INITIATED');

    try {
      // Get all pending orders
      const ordersResponse = await this.client.getOrders({
        status: 'resting',
      });

      // Cancel all pending orders
      for (const order of ordersResponse.orders) {
        try {
          await this.client.cancelOrder(order.order_id);
          this.logger.info(`Canceled order ${order.order_id}`);
        } catch (error) {
          this.logger.error(`Failed to cancel order ${order.order_id}:`, error);
        }
      }

      const portfolio = await this.getPortfolioSummary();
      this.logger.warn(
        `Emergency stop complete. Portfolio: ${portfolio.positionCount} positions, $${(portfolio.totalExposure / 100).toFixed(2)} exposure`
      );
    } catch (error) {
      this.logger.error('Error during emergency stop:', error);
      throw error;
    }
  }

  /**
   * Health check - verify portfolio is within risk limits
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      const portfolio = await this.getPortfolioSummary();

      // Check total exposure
      const exposureDollars = portfolio.totalExposure / 100;
      if (exposureDollars > this.config.maxTotalExposure) {
        issues.push(
          `Total exposure $${exposureDollars.toFixed(2)} exceeds limit $${this.config.maxTotalExposure}`
        );
      } else if (exposureDollars > this.config.maxTotalExposure * 0.9) {
        warnings.push(
          `Total exposure $${exposureDollars.toFixed(2)} near limit $${this.config.maxTotalExposure}`
        );
      }

      // Check balance
      const balanceDollars = portfolio.totalBalance / 100;
      if (balanceDollars < 100) {
        // Less than $100
        issues.push(`Low balance: $${balanceDollars.toFixed(2)}`);
      }

      // Check position count
      if (portfolio.positionCount > 20) {
        warnings.push(`High position count: ${portfolio.positionCount}`);
      }

      // Check for large unrealized losses
      if (portfolio.unrealizedPnl < -5000) {
        // -$50
        issues.push(
          `Large unrealized loss: $${(portfolio.unrealizedPnl / 100).toFixed(2)}`
        );
      }
    } catch (error: any) {
      issues.push(`Health check failed: ${error.message}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      warnings,
    };
  }
}
