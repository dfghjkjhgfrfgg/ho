import BigNumber from 'bignumber.js';
import { KashiMarketData, ArbitrageOpportunity, BotConfig } from '../contracts/types';
import { ArbitrageMath } from '../math/ArbitrageMath';
import { v4 as uuidv4 } from 'uuid';

/**
 * Detects arbitrage opportunities across Kashi markets using mathematical analysis
 * NO HOPE, ONLY MATH
 */
export class OpportunityDetector {
  private config: BotConfig;
  private readonly SECONDS_PER_DAY = 86400;
  private readonly AVERAGE_HOLD_TIME_DAYS = 1; // Assume 1 day hold time
  private readonly ESTIMATED_GAS_UNITS = new BigNumber(300000); // ~300k gas for complex arb

  constructor(config: BotConfig) {
    this.config = config;
  }

  /**
   * Scan all markets and find arbitrage opportunities
   * Strategy: Find rate differentials where we can:
   * 1. Supply asset to Market A (earn supply APY)
   * 2. Borrow same asset from Market B (pay borrow APY)
   * 3. Profit = Supply APY - Borrow APY (if positive)
   */
  async detectOpportunities(
    markets: KashiMarketData[],
    ethPriceUSD: number = 2000
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    // Compare each market pair
    for (let i = 0; i < markets.length; i++) {
      for (let j = i + 1; j < markets.length; j++) {
        const marketA = markets[i];
        const marketB = markets[j];

        // Only compare markets with the same asset
        if (marketA.asset !== marketB.asset) {
          continue;
        }

        // Check both directions
        const oppAtoB = await this.analyzeArbitrage(
          marketA,
          marketB,
          'A_TO_B',
          ethPriceUSD
        );
        if (oppAtoB) {
          opportunities.push(oppAtoB);
        }

        const oppBtoA = await this.analyzeArbitrage(
          marketB,
          marketA,
          'B_TO_A',
          ethPriceUSD
        );
        if (oppBtoA) {
          opportunities.push(oppBtoA);
        }
      }
    }

    // Sort by profit percentage (best first)
    return opportunities.sort((a, b) =>
      b.profitPercentage.minus(a.profitPercentage).toNumber()
    );
  }

  /**
   * Analyze a specific arbitrage direction
   * supplyMarket: Where we supply (earn interest)
   * borrowMarket: Where we borrow (pay interest)
   */
  private async analyzeArbitrage(
    supplyMarket: KashiMarketData,
    borrowMarket: KashiMarketData,
    direction: 'A_TO_B' | 'B_TO_A',
    ethPriceUSD: number
  ): Promise<ArbitrageOpportunity | null> {
    // Calculate the interest rate spread
    const spreadBps = supplyMarket.supplyAPY
      .minus(borrowMarket.borrowAPY)
      .times(10000);

    // Must have positive spread to be profitable
    const minSpreadBps = this.config.minProfitPercentage * 100;
    if (spreadBps.lt(minSpreadBps)) {
      return null;
    }

    // Calculate maximum position size based on liquidity
    const maxLiquidity = BigNumber.min(
      supplyMarket.availableLiquidity,
      borrowMarket.availableLiquidity
    );

    const maxPositionETH = new BigNumber(this.config.maxPositionSizeETH).times(
      new BigNumber(10).pow(18)
    );

    const maxAmount = BigNumber.min(maxLiquidity, maxPositionETH);

    // Calculate optimal position size (don't impact market too much)
    const optimalAmount = ArbitrageMath.calculateOptimalPositionSize(
      maxLiquidity,
      maxPositionETH,
      new BigNumber(0.03) // Max 3% utilization impact
    );

    // Estimate costs
    const estimatedGasCost = await this.estimateGasCost(ethPriceUSD);
    const slippageBps = new BigNumber(30); // 0.3% slippage estimate
    const estimatedSlippage = optimalAmount.times(slippageBps).div(10000);

    // Calculate profitability
    const holdTimeSeconds = new BigNumber(
      this.SECONDS_PER_DAY * this.AVERAGE_HOLD_TIME_DAYS
    );

    const profitCalc = ArbitrageMath.calculateArbitrageProfit({
      borrowRate: supplyMarket.supplyAPY,
      supplyRate: borrowMarket.borrowAPY,
      amount: optimalAmount,
      timeHeldSeconds: holdTimeSeconds,
      gasCostUSD: estimatedGasCost,
      slippageBps
    });

    // Calculate utilization impact
    const supplyImpact = ArbitrageMath.calculateUtilizationImpact(
      supplyMarket.totalBorrow,
      supplyMarket.totalAsset,
      optimalAmount,
      false // We're supplying
    );

    const borrowImpact = ArbitrageMath.calculateUtilizationImpact(
      borrowMarket.totalBorrow,
      borrowMarket.totalAsset,
      optimalAmount,
      true // We're borrowing
    );

    const totalUtilizationImpact = supplyImpact.utilizationChange
      .abs()
      .plus(borrowImpact.utilizationChange.abs());

    // Calculate liquidation risk (simplified)
    const liquidationRisk = this.calculateLiquidationRisk(
      borrowMarket.utilization,
      borrowImpact.newUtilization
    );

    // Check if opportunity is worth executing
    const worthExecuting = this.isWorthExecuting(
      profitCalc.netProfit,
      profitCalc.profitPercentage,
      liquidationRisk,
      totalUtilizationImpact
    );

    const reason = this.getExecutionReason(
      worthExecuting,
      profitCalc.netProfit,
      profitCalc.profitPercentage,
      liquidationRisk
    );

    return {
      id: uuidv4(),
      timestamp: Date.now(),
      supplyMarket,
      borrowMarket,
      spreadBps,
      spreadPercent: spreadBps.div(100),
      direction,
      optimalAmount,
      maxAmount,
      expectedGrossProfit: profitCalc.grossProfit,
      expectedNetProfit: profitCalc.netProfit,
      profitPercentage: profitCalc.profitPercentage,
      estimatedGasCost,
      estimatedSlippage,
      utilizationImpact: totalUtilizationImpact,
      liquidationRisk,
      worthExecuting,
      reason
    };
  }

  /**
   * Estimate gas cost for the arbitrage transaction
   */
  private async estimateGasCost(ethPriceUSD: number): Promise<BigNumber> {
    const gasPriceGwei = new BigNumber(this.config.gasPriceLimitGwei);
    const gasPriceWei = gasPriceGwei.times(new BigNumber(10).pow(9));
    const gasCostWei = gasPriceWei.times(this.ESTIMATED_GAS_UNITS);
    const gasCostETH = gasCostWei.div(new BigNumber(10).pow(18));
    return gasCostETH.times(ethPriceUSD);
  }

  /**
   * Calculate liquidation risk based on utilization
   * Higher utilization = higher risk
   */
  private calculateLiquidationRisk(
    currentUtilization: BigNumber,
    newUtilization: BigNumber
  ): BigNumber {
    // Risk increases exponentially as utilization approaches 100%
    const utilizationPct = newUtilization.times(100);

    if (utilizationPct.lt(70)) {
      return new BigNumber(0.01); // 1% risk
    } else if (utilizationPct.lt(85)) {
      return new BigNumber(0.05); // 5% risk
    } else if (utilizationPct.lt(95)) {
      return new BigNumber(0.15); // 15% risk
    } else {
      return new BigNumber(0.50); // 50% risk - very dangerous
    }
  }

  /**
   * Determine if opportunity is worth executing
   */
  private isWorthExecuting(
    netProfit: BigNumber,
    profitPercentage: BigNumber,
    liquidationRisk: BigNumber,
    utilizationImpact: BigNumber
  ): boolean {
    // Must be profitable
    if (netProfit.lte(0)) {
      return false;
    }

    // Must meet minimum profit thresholds
    if (netProfit.lt(this.config.minProfitUSD)) {
      return false;
    }

    if (profitPercentage.lt(this.config.minProfitPercentage)) {
      return false;
    }

    // Risk checks
    if (liquidationRisk.gt(0.2)) {
      // Max 20% liquidation risk
      return false;
    }

    if (utilizationImpact.gt(0.1)) {
      // Max 10% total utilization impact
      return false;
    }

    return true;
  }

  /**
   * Get human-readable reason for execution decision
   */
  private getExecutionReason(
    worthExecuting: boolean,
    netProfit: BigNumber,
    profitPercentage: BigNumber,
    liquidationRisk: BigNumber
  ): string {
    if (!worthExecuting) {
      if (netProfit.lte(0)) {
        return 'Not profitable after costs';
      }
      if (netProfit.lt(this.config.minProfitUSD)) {
        return `Net profit ${netProfit.toFixed(2)} < minimum ${
          this.config.minProfitUSD
        }`;
      }
      if (profitPercentage.lt(this.config.minProfitPercentage)) {
        return `Profit % ${profitPercentage.toFixed(
          2
        )}% < minimum ${this.config.minProfitPercentage}%`;
      }
      if (liquidationRisk.gt(0.2)) {
        return `Liquidation risk ${liquidationRisk
          .times(100)
          .toFixed(1)}% too high`;
      }
      return 'Failed risk checks';
    }

    return `Profitable: $${netProfit.toFixed(2)} (${profitPercentage.toFixed(
      2
    )}%)`;
  }
}

// Note: We need to install uuid
// Add to package.json dependencies: "uuid": "^9.0.0"
// Add to devDependencies: "@types/uuid": "^9.0.0"
