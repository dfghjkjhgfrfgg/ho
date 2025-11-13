import { Position, RiskParameters, TradeResult } from '../types';
import Logger from '../utils/Logger';
import BigNumber from 'bignumber.js';
import { v4 as uuidv4 } from 'uuid';

export class RiskManager {
  private riskParams: RiskParameters;
  private positions: Map<string, Position> = new Map();
  private dailyPnL: number = 0;
  private dailyPnLReset: number = Date.now();

  constructor(riskParams: RiskParameters) {
    this.riskParams = riskParams;
  }

  /**
   * Check if trade passes risk management rules
   */
  public canOpenTrade(
    tokenSymbol: string,
    tokenAddress: string,
    entryPrice: number,
    amount: number,
    portfolioValue: number
  ): { allowed: boolean; reason?: string } {
    try {
      // Reset daily P&L if new day
      this.checkDailyPnLReset();

      // Check max open positions
      if (this.positions.size >= this.riskParams.maxOpenPositions) {
        return {
          allowed: false,
          reason: `Maximum open positions reached (${this.riskParams.maxOpenPositions})`,
        };
      }

      // Check position size in USD
      const positionValue = entryPrice * amount;
      if (positionValue > this.riskParams.maxPositionSize) {
        return {
          allowed: false,
          reason: `Position size exceeds maximum ($${this.riskParams.maxPositionSize})`,
        };
      }

      // Check portfolio percentage
      const portfolioPercent = (positionValue / portfolioValue) * 100;
      if (portfolioPercent > this.riskParams.maxPortfolioPercent) {
        return {
          allowed: false,
          reason: `Position exceeds ${this.riskParams.maxPortfolioPercent}% of portfolio`,
        };
      }

      // Check daily loss limit
      if (Math.abs(this.dailyPnL) >= this.riskParams.maxDailyLoss) {
        return {
          allowed: false,
          reason: `Daily loss limit reached ($${this.riskParams.maxDailyLoss})`,
        };
      }

      // Check if already have position in this token
      const existingPosition = Array.from(this.positions.values()).find(
        (p) => p.tokenAddress === tokenAddress && p.status === 'OPEN'
      );

      if (existingPosition) {
        return {
          allowed: false,
          reason: `Already have open position in ${tokenSymbol}`,
        };
      }

      return { allowed: true };
    } catch (error) {
      Logger.error('Risk check failed', error);
      return {
        allowed: false,
        reason: 'Risk check failed',
      };
    }
  }

  /**
   * Open a new position
   */
  public openPosition(
    tokenAddress: string,
    tokenSymbol: string,
    entryPrice: number,
    amount: number
  ): Position {
    const stopLoss = entryPrice * (1 - this.riskParams.stopLossPercent / 100);
    const takeProfit = entryPrice * (1 + this.riskParams.takeProfitPercent / 100);
    const trailingStop = entryPrice * (1 - this.riskParams.trailingStopPercent / 100);

    const position: Position = {
      id: uuidv4(),
      tokenAddress,
      tokenSymbol,
      entryPrice,
      currentPrice: entryPrice,
      amount,
      value: entryPrice * amount,
      pnl: 0,
      pnlPercent: 0,
      stopLoss,
      takeProfit,
      trailingStop,
      openedAt: Date.now(),
      status: 'OPEN',
    };

    this.positions.set(position.id, position);

    Logger.risk('Position opened', {
      id: position.id,
      symbol: tokenSymbol,
      entryPrice,
      amount,
      stopLoss,
      takeProfit,
    });

    return position;
  }

  /**
   * Update position with current price
   */
  public updatePosition(positionId: string, currentPrice: number): Position | null {
    const position = this.positions.get(positionId);
    if (!position) return null;

    position.currentPrice = currentPrice;
    position.value = currentPrice * position.amount;
    position.pnl = (currentPrice - position.entryPrice) * position.amount;
    position.pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

    // Update trailing stop if price moved favorably
    if (currentPrice > position.entryPrice) {
      const newTrailingStop =
        currentPrice * (1 - this.riskParams.trailingStopPercent / 100);
      if (newTrailingStop > position.trailingStop) {
        position.trailingStop = newTrailingStop;
        Logger.risk('Trailing stop updated', {
          id: positionId,
          symbol: position.tokenSymbol,
          newTrailingStop,
        });
      }
    }

    return position;
  }

  /**
   * Check if position should be closed
   */
  public shouldClosePosition(position: Position): {
    shouldClose: boolean;
    reason?: string;
  } {
    // Check stop loss
    if (position.currentPrice <= position.stopLoss) {
      return {
        shouldClose: true,
        reason: `Stop loss hit at $${position.stopLoss.toFixed(4)}`,
      };
    }

    // Check trailing stop
    if (position.currentPrice <= position.trailingStop) {
      return {
        shouldClose: true,
        reason: `Trailing stop hit at $${position.trailingStop.toFixed(4)}`,
      };
    }

    // Check take profit
    if (position.currentPrice >= position.takeProfit) {
      return {
        shouldClose: true,
        reason: `Take profit reached at $${position.takeProfit.toFixed(4)}`,
      };
    }

    return { shouldClose: false };
  }

  /**
   * Close a position
   */
  public closePosition(positionId: string, closePrice: number): Position | null {
    const position = this.positions.get(positionId);
    if (!position) return null;

    position.status = 'CLOSED';
    position.currentPrice = closePrice;
    position.pnl = (closePrice - position.entryPrice) * position.amount;
    position.pnlPercent = ((closePrice - position.entryPrice) / position.entryPrice) * 100;

    // Update daily P&L
    this.dailyPnL += position.pnl;

    Logger.risk('Position closed', {
      id: positionId,
      symbol: position.tokenSymbol,
      entryPrice: position.entryPrice,
      closePrice,
      pnl: position.pnl.toFixed(2),
      pnlPercent: position.pnlPercent.toFixed(2),
    });

    return position;
  }

  /**
   * Calculate position size based on risk
   */
  public calculatePositionSize(
    entryPrice: number,
    portfolioValue: number,
    volatility: number
  ): number {
    try {
      // Kelly Criterion for position sizing
      // f = (bp - q) / b
      // where:
      // f = fraction of portfolio to bet
      // b = odds (risk/reward ratio)
      // p = probability of winning
      // q = probability of losing (1 - p)

      // Simplified: risk 1-2% of portfolio per trade
      const riskPercent = 1.5; // 1.5% of portfolio
      const riskAmount = (portfolioValue * riskPercent) / 100;

      // Calculate position size based on stop loss
      const stopDistance = this.riskParams.stopLossPercent / 100;
      const positionValue = riskAmount / stopDistance;

      // Apply constraints
      const maxPositionValue = Math.min(
        positionValue,
        this.riskParams.maxPositionSize,
        (portfolioValue * this.riskParams.maxPortfolioPercent) / 100
      );

      const positionSize = maxPositionValue / entryPrice;

      return positionSize;
    } catch (error) {
      Logger.error('Position size calculation failed', error);
      return 0;
    }
  }

  /**
   * Calculate risk/reward ratio
   */
  public calculateRiskReward(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
  ): number {
    const risk = entryPrice - stopLoss;
    const reward = takeProfit - entryPrice;

    if (risk <= 0) return 0;

    return reward / risk;
  }

  /**
   * Check if risk/reward ratio is acceptable
   */
  public isAcceptableRiskReward(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
  ): boolean {
    const ratio = this.calculateRiskReward(entryPrice, stopLoss, takeProfit);
    return ratio >= this.riskParams.minRiskRewardRatio;
  }

  /**
   * Get all open positions
   */
  public getOpenPositions(): Position[] {
    return Array.from(this.positions.values()).filter((p) => p.status === 'OPEN');
  }

  /**
   * Get position by ID
   */
  public getPosition(positionId: string): Position | null {
    return this.positions.get(positionId) || null;
  }

  /**
   * Get total portfolio exposure
   */
  public getTotalExposure(): number {
    return this.getOpenPositions().reduce((total, position) => total + position.value, 0);
  }

  /**
   * Get daily P&L
   */
  public getDailyPnL(): number {
    return this.dailyPnL;
  }

  /**
   * Reset daily P&L at start of new day
   */
  private checkDailyPnLReset(): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (now - this.dailyPnLReset >= oneDayMs) {
      Logger.info('Resetting daily P&L', { previousPnL: this.dailyPnL });
      this.dailyPnL = 0;
      this.dailyPnLReset = now;
    }
  }

  /**
   * Get risk parameters
   */
  public getRiskParameters(): RiskParameters {
    return { ...this.riskParams };
  }

  /**
   * Update risk parameters
   */
  public updateRiskParameters(params: Partial<RiskParameters>): void {
    this.riskParams = { ...this.riskParams, ...params };
    Logger.info('Risk parameters updated', params);
  }
}

export default RiskManager;
