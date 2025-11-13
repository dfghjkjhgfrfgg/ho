import BigNumber from 'bignumber.js';
import { Logger } from '../utils/Logger';

/**
 * Mathematical models for betting and prediction markets
 * All probabilities are 0-1, prices are in cents (0-100)
 */
export class BettingMath {
  private static logger = Logger.getInstance();

  /**
   * Convert Kalshi price (cents) to implied probability
   * Price in cents: 0-100 maps to 0-1 probability
   */
  static priceToImpliedProbability(priceCents: number): number {
    return priceCents / 100;
  }

  /**
   * Convert probability to Kalshi price (cents)
   */
  static probabilityToPrice(probability: number): number {
    return Math.round(probability * 100);
  }

  /**
   * Calculate the market's implied probability from bid/ask spread
   * Uses mid-price for fair market estimate
   */
  static getMarketImpliedProbability(bid: number, ask: number): number {
    const midPrice = (bid + ask) / 2;
    return this.priceToImpliedProbability(midPrice);
  }

  /**
   * Calculate expected value of a bet
   * EV = (Probability of Win × Amount Won) - (Probability of Loss × Amount Lost)
   * Returns expected profit per dollar wagered
   */
  static calculateExpectedValue(
    fairProbability: number,
    priceCents: number
  ): number {
    const impliedProbability = this.priceToImpliedProbability(priceCents);
    const costPerContract = priceCents;
    const payoutPerContract = 100;

    // EV = (Win Probability × Profit if Win) - (Loss Probability × Loss if Loss)
    const winProfit = payoutPerContract - costPerContract;
    const lossAmount = costPerContract;

    const ev = fairProbability * winProfit - (1 - fairProbability) * lossAmount;

    // Return as percentage of cost
    return ev / costPerContract;
  }

  /**
   * Calculate edge (advantage) over market
   * Edge = Fair Probability - Implied Probability
   * Positive edge means opportunity
   */
  static calculateEdge(fairProbability: number, priceCents: number): number {
    const impliedProbability = this.priceToImpliedProbability(priceCents);
    return fairProbability - impliedProbability;
  }

  /**
   * Kelly Criterion for optimal position sizing
   * f* = (bp - q) / b
   * where:
   * - b = net odds received (decimal odds - 1)
   * - p = probability of winning
   * - q = probability of losing (1 - p)
   * Returns fraction of bankroll to wager (0-1)
   */
  static kellyFraction(fairProbability: number, priceCents: number): number {
    const costPerContract = priceCents / 100; // Convert to dollars
    const payoutPerContract = 1; // $1 payout

    // Net odds (b)
    const netOdds = (payoutPerContract - costPerContract) / costPerContract;

    // Kelly formula
    const p = fairProbability;
    const q = 1 - fairProbability;
    const kelly = (netOdds * p - q) / netOdds;

    // Clamp to reasonable range (0 to 1)
    return Math.max(0, Math.min(1, kelly));
  }

  /**
   * Calculate optimal position size using Kelly Criterion
   * Uses fractional Kelly for safety (typically 0.25 or 0.5)
   */
  static calculateKellyPosition(
    fairProbability: number,
    priceCents: number,
    bankrollCents: number,
    kellyFraction = 0.25 // Quarter Kelly for safety
  ): number {
    const fullKelly = this.kellyFraction(fairProbability, priceCents);
    const adjustedKelly = fullKelly * kellyFraction;

    // Calculate number of contracts
    const positionSizeCents = bankrollCents * adjustedKelly;
    const contracts = Math.floor(positionSizeCents / priceCents);

    return Math.max(0, contracts);
  }

  /**
   * Calculate breakeven probability needed for a bet
   * The probability at which EV = 0
   */
  static breakevenProbability(priceCents: number): number {
    // At breakeven: p * (100 - price) = (1-p) * price
    // Solving for p: p = price / 100
    return priceCents / 100;
  }

  /**
   * Calculate implied odds from probability
   * American odds format
   */
  static probabilityToAmericanOdds(probability: number): number {
    if (probability >= 0.5) {
      // Favorite (negative odds)
      return -Math.round((probability / (1 - probability)) * 100);
    } else {
      // Underdog (positive odds)
      return Math.round(((1 - probability) / probability) * 100);
    }
  }

  /**
   * Calculate Sharpe ratio for a betting strategy
   * Sharpe = (Expected Return - Risk-free Rate) / Standard Deviation
   */
  static calculateSharpe(
    expectedReturn: number,
    winRate: number,
    avgWin: number,
    avgLoss: number,
    numberOfBets: number
  ): number {
    // Calculate variance
    const winVariance = winRate * Math.pow(avgWin - expectedReturn, 2);
    const lossVariance = (1 - winRate) * Math.pow(avgLoss - expectedReturn, 2);
    const variance = winVariance + lossVariance;
    const stdDev = Math.sqrt(variance);

    // Sharpe (assuming risk-free rate = 0 for simplicity)
    if (stdDev === 0) return 0;
    return expectedReturn / stdDev;
  }

  /**
   * Calculate correlation-adjusted position size
   * Reduces position size when markets are correlated
   */
  static adjustForCorrelation(
    basePosition: number,
    correlationFactor: number
  ): number {
    // Correlation factor: 0 = independent, 1 = perfectly correlated
    // Reduce position size as correlation increases
    const adjustment = 1 - correlationFactor * 0.5;
    return Math.floor(basePosition * adjustment);
  }

  /**
   * Calculate maximum drawdown risk
   * Estimates potential loss streak impact
   */
  static maxDrawdownRisk(
    winProbability: number,
    avgBetSize: number,
    bankroll: number,
    maxLosses = 10
  ): number {
    // Probability of losing N times in a row
    const lossStreakProb = Math.pow(1 - winProbability, maxLosses);

    // Expected loss from losing streak
    const totalLoss = avgBetSize * maxLosses;

    return totalLoss / bankroll;
  }

  /**
   * Detect arbitrage opportunities across YES/NO markets
   * Returns true if both sides can be bought for less than 100 cents
   */
  static detectArbitrage(
    yesAskCents: number,
    noAskCents: number
  ): { hasArbitrage: boolean; profit: number } {
    const totalCost = yesAskCents + noAskCents;
    const payout = 100; // Always pays 100 cents

    const hasArbitrage = totalCost < payout;
    const profit = hasArbitrage ? payout - totalCost : 0;

    return { hasArbitrage, profit };
  }

  /**
   * Calculate fair value using multiple pricing models
   * Weighted average of different approaches
   */
  static calculateFairValue(models: {
    name: string;
    probability: number;
    weight: number;
  }[]): number {
    const totalWeight = models.reduce((sum, m) => sum + m.weight, 0);

    if (totalWeight === 0) {
      this.logger.warn('No model weights provided, using equal weights');
      return (
        models.reduce((sum, m) => sum + m.probability, 0) / models.length
      );
    }

    const weightedSum = models.reduce(
      (sum, m) => sum + m.probability * m.weight,
      0
    );

    return weightedSum / totalWeight;
  }

  /**
   * Calculate confidence interval for a probability estimate
   * Returns [lower bound, upper bound] at given confidence level
   */
  static confidenceInterval(
    probability: number,
    sampleSize: number,
    confidenceLevel = 0.95
  ): [number, number] {
    // Using normal approximation for binomial distribution
    const z = confidenceLevel === 0.95 ? 1.96 : 2.576; // 95% or 99%

    const stdError = Math.sqrt(
      (probability * (1 - probability)) / sampleSize
    );

    const margin = z * stdError;

    return [
      Math.max(0, probability - margin),
      Math.min(1, probability + margin),
    ];
  }

  /**
   * Adjust position size for volatility
   * Higher volatility = smaller positions
   */
  static volatilityAdjustedSize(
    baseSize: number,
    volatility: number
  ): number {
    // Volatility from 0-1, where 1 is extremely volatile
    // Reduce size proportionally
    const adjustment = 1 - volatility * 0.5;
    return Math.floor(baseSize * adjustment);
  }

  /**
   * Calculate required win rate to be profitable
   */
  static requiredWinRate(avgWin: number, avgLoss: number): number {
    // Required win rate = Risk / (Risk + Reward)
    return avgLoss / (avgLoss + avgWin);
  }

  /**
   * Calculate profit factor
   * Ratio of gross profit to gross loss
   */
  static profitFactor(
    totalWins: number,
    totalLosses: number
  ): number {
    if (totalLosses === 0) return Infinity;
    return totalWins / totalLosses;
  }

  /**
   * Validate that a bet meets minimum criteria
   */
  static isValidBet(
    fairProbability: number,
    priceCents: number,
    minEdge: number,
    minEV: number
  ): { valid: boolean; reason?: string } {
    // Check edge
    const edge = this.calculateEdge(fairProbability, priceCents);
    if (edge < minEdge) {
      return { valid: false, reason: `Edge too low: ${edge.toFixed(3)}` };
    }

    // Check expected value
    const ev = this.calculateExpectedValue(fairProbability, priceCents);
    if (ev < minEV) {
      return {
        valid: false,
        reason: `Expected value too low: ${ev.toFixed(3)}`,
      };
    }

    // Check probabilities are in valid range
    if (fairProbability <= 0 || fairProbability >= 1) {
      return {
        valid: false,
        reason: 'Fair probability must be between 0 and 1',
      };
    }

    return { valid: true };
  }
}
