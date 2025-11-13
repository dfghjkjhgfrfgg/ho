import BigNumber from 'bignumber.js';

/**
 * Core mathematical calculations for Kashi arbitrage opportunities
 * Uses pure mathematics, not speculation or hope
 */
export class ArbitrageMath {
  /**
   * Calculate the current interest rate based on utilization
   * Formula: interestRate = baseRate + (utilization * slope)
   */
  static calculateInterestRate(
    utilization: BigNumber,
    baseRate: BigNumber,
    interestPerSecond: BigNumber,
    kink: BigNumber
  ): BigNumber {
    // Below kink: linear increase
    if (utilization.lte(kink)) {
      return baseRate.plus(utilization.times(interestPerSecond));
    }

    // Above kink: steeper increase to discourage over-utilization
    const excessUtilization = utilization.minus(kink);
    const kinkRate = baseRate.plus(kink.times(interestPerSecond));
    return kinkRate.plus(excessUtilization.times(interestPerSecond.times(5)));
  }

  /**
   * Calculate supply APY (what lenders earn)
   * Formula: supplyAPY = borrowAPY * utilization * (1 - protocolFee)
   */
  static calculateSupplyAPY(
    borrowAPY: BigNumber,
    utilization: BigNumber,
    protocolFee: BigNumber
  ): BigNumber {
    const netRate = new BigNumber(1).minus(protocolFee);
    return borrowAPY.times(utilization).times(netRate);
  }

  /**
   * Calculate borrow APY (what borrowers pay)
   */
  static calculateBorrowAPY(interestPerSecond: BigNumber): BigNumber {
    // Convert per-second rate to annual
    const secondsPerYear = new BigNumber(31536000);
    return interestPerSecond.times(secondsPerYear);
  }

  /**
   * Calculate utilization rate
   * Formula: utilization = totalBorrow / totalAsset
   */
  static calculateUtilization(
    totalBorrow: BigNumber,
    totalAsset: BigNumber
  ): BigNumber {
    if (totalAsset.isZero()) return new BigNumber(0);
    return totalBorrow.div(totalAsset);
  }

  /**
   * Calculate expected profit from arbitrage opportunity
   * This is the mathematical core: buy low (supply rate), sell high (borrow rate)
   *
   * Profit = (borrowRate - supplyRate) * amount * timeHeld - gasCosts - slippage
   */
  static calculateArbitrageProfit(params: {
    borrowRate: BigNumber;      // Rate we receive for borrowing
    supplyRate: BigNumber;      // Rate we pay for supplying
    amount: BigNumber;          // Amount to arbitrage
    timeHeldSeconds: BigNumber; // Expected time to hold position
    gasCostUSD: BigNumber;      // Gas cost in USD
    slippageBps: BigNumber;     // Slippage in basis points
  }): {
    grossProfit: BigNumber;
    netProfit: BigNumber;
    profitPercentage: BigNumber;
    worthExecuting: boolean;
  } {
    const {
      borrowRate,
      supplyRate,
      amount,
      timeHeldSeconds,
      gasCostUSD,
      slippageBps
    } = params;

    // Interest differential (the arbitrage spread)
    const rateDifferential = borrowRate.minus(supplyRate);

    // Gross profit from rate differential
    const grossInterestProfit = rateDifferential
      .times(amount)
      .times(timeHeldSeconds)
      .div(31536000); // Convert annual rate to period rate

    // Slippage cost
    const slippageCost = amount.times(slippageBps).div(10000);

    // Net profit after costs
    const netProfit = grossInterestProfit
      .minus(gasCostUSD)
      .minus(slippageCost);

    // Profit percentage
    const profitPercentage = netProfit.div(amount).times(100);

    return {
      grossProfit: grossInterestProfit,
      netProfit,
      profitPercentage,
      worthExecuting: netProfit.gt(0) && profitPercentage.gte(0.1) // Min 0.1% profit
    };
  }

  /**
   * Calculate optimal position size based on available liquidity and risk parameters
   * Formula: optimalSize = min(maxSize, availableLiquidity * utilizationTarget)
   */
  static calculateOptimalPositionSize(
    availableLiquidity: BigNumber,
    maxPositionSize: BigNumber,
    targetUtilizationImpact: BigNumber = new BigNumber(0.05) // Max 5% impact
  ): BigNumber {
    const liquidityBasedSize = availableLiquidity.times(targetUtilizationImpact);
    return BigNumber.min(maxPositionSize, liquidityBasedSize);
  }

  /**
   * Calculate price impact of a trade on utilization
   * This helps us understand how our trade will affect rates
   */
  static calculateUtilizationImpact(
    currentTotalBorrow: BigNumber,
    currentTotalAsset: BigNumber,
    tradeAmount: BigNumber,
    isBorrow: boolean
  ): {
    currentUtilization: BigNumber;
    newUtilization: BigNumber;
    utilizationChange: BigNumber;
  } {
    const currentUtilization = this.calculateUtilization(
      currentTotalBorrow,
      currentTotalAsset
    );

    let newUtilization: BigNumber;
    if (isBorrow) {
      const newBorrow = currentTotalBorrow.plus(tradeAmount);
      newUtilization = this.calculateUtilization(newBorrow, currentTotalAsset);
    } else {
      const newAsset = currentTotalAsset.plus(tradeAmount);
      newUtilization = this.calculateUtilization(currentTotalBorrow, newAsset);
    }

    return {
      currentUtilization,
      newUtilization,
      utilizationChange: newUtilization.minus(currentUtilization)
    };
  }

  /**
   * Calculate if an arbitrage opportunity exists between two markets
   * Market A: Lower rate (we supply here)
   * Market B: Higher rate (we borrow here)
   */
  static detectArbitrageOpportunity(
    marketA: {
      supplyAPY: BigNumber;
      borrowAPY: BigNumber;
      availableLiquidity: BigNumber;
    },
    marketB: {
      supplyAPY: BigNumber;
      borrowAPY: BigNumber;
      availableLiquidity: BigNumber;
    },
    minProfitBps: BigNumber = new BigNumber(50) // Min 0.5% spread
  ): {
    opportunityExists: boolean;
    direction: 'A_TO_B' | 'B_TO_A' | 'NONE';
    spreadBps: BigNumber;
    maxSize: BigNumber;
  } {
    // Check A -> B: Supply to A, Borrow from B
    const spreadAtoB = marketB.borrowAPY.minus(marketA.supplyAPY);
    const spreadBpsAtoB = spreadAtoB.times(10000);

    // Check B -> A: Supply to B, Borrow from A
    const spreadBtoA = marketA.borrowAPY.minus(marketB.supplyAPY);
    const spreadBpsBtoA = spreadBtoA.times(10000);

    // Determine best direction
    if (spreadBpsAtoB.gte(minProfitBps) && spreadBpsAtoB.gte(spreadBpsBtoA)) {
      return {
        opportunityExists: true,
        direction: 'A_TO_B',
        spreadBps: spreadBpsAtoB,
        maxSize: BigNumber.min(
          marketA.availableLiquidity,
          marketB.availableLiquidity
        )
      };
    } else if (spreadBpsBtoA.gte(minProfitBps)) {
      return {
        opportunityExists: true,
        direction: 'B_TO_A',
        spreadBps: spreadBpsBtoA,
        maxSize: BigNumber.min(
          marketA.availableLiquidity,
          marketB.availableLiquidity
        )
      };
    }

    return {
      opportunityExists: false,
      direction: 'NONE',
      spreadBps: new BigNumber(0),
      maxSize: new BigNumber(0)
    };
  }

  /**
   * Calculate compound interest over time
   * Formula: A = P(1 + r/n)^(nt)
   */
  static calculateCompoundInterest(
    principal: BigNumber,
    annualRate: BigNumber,
    compoundingsPerYear: BigNumber,
    years: BigNumber
  ): BigNumber {
    const ratePerPeriod = annualRate.div(compoundingsPerYear);
    const periods = compoundingsPerYear.times(years);
    const base = new BigNumber(1).plus(ratePerPeriod);

    // A = P * (1 + r/n)^(nt)
    return principal.times(base.pow(periods.toNumber()));
  }

  /**
   * Convert basis points to decimal
   */
  static bpsToDecimal(bps: BigNumber): BigNumber {
    return bps.div(10000);
  }

  /**
   * Convert decimal to basis points
   */
  static decimalToBps(decimal: BigNumber): BigNumber {
    return decimal.times(10000);
  }
}
