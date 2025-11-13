import BigNumber from 'bignumber.js';
import { ArbitrageOpportunity, KashiMarketData } from '../contracts/types';

/**
 * Risk management and safety checks for arbitrage trades
 */
export class RiskManager {
  private readonly MAX_UTILIZATION = new BigNumber(0.95); // 95%
  private readonly MAX_POSITION_CONCENTRATION = new BigNumber(0.2); // 20% of liquidity
  private readonly MAX_LIQUIDATION_RISK = new BigNumber(0.15); // 15%
  private readonly MIN_HEALTH_FACTOR = new BigNumber(1.5); // 1.5x collateralization

  /**
   * Perform comprehensive risk assessment
   */
  assessRisk(opportunity: ArbitrageOpportunity): RiskAssessment {
    const checks: RiskCheck[] = [];

    // Check 1: Utilization risk
    checks.push(this.checkUtilization(opportunity));

    // Check 2: Liquidity risk
    checks.push(this.checkLiquidity(opportunity));

    // Check 3: Concentration risk
    checks.push(this.checkConcentration(opportunity));

    // Check 4: Liquidation risk
    checks.push(this.checkLiquidationRisk(opportunity));

    // Check 5: Profitability risk
    checks.push(this.checkProfitability(opportunity));

    // Check 6: Market impact
    checks.push(this.checkMarketImpact(opportunity));

    const failedChecks = checks.filter(c => !c.passed);
    const criticalFailures = failedChecks.filter(c => c.severity === 'critical');

    return {
      passed: failedChecks.length === 0,
      canProceed: criticalFailures.length === 0,
      riskScore: this.calculateRiskScore(checks),
      checks,
      warnings: failedChecks.filter(c => c.severity === 'warning'),
      criticalIssues: criticalFailures,
      recommendation: this.getRecommendation(checks)
    };
  }

  /**
   * Check utilization levels
   */
  private checkUtilization(opportunity: ArbitrageOpportunity): RiskCheck {
    const supplyUtilization = opportunity.supplyMarket.utilization;
    const borrowUtilization = opportunity.borrowMarket.utilization;

    const maxUtilization = BigNumber.max(supplyUtilization, borrowUtilization);

    if (maxUtilization.gt(this.MAX_UTILIZATION)) {
      return {
        name: 'Utilization Check',
        passed: false,
        severity: 'critical',
        message: `Utilization too high: ${maxUtilization
          .times(100)
          .toFixed(2)}%`,
        value: maxUtilization.toNumber()
      };
    }

    if (maxUtilization.gt(0.85)) {
      return {
        name: 'Utilization Check',
        passed: false,
        severity: 'warning',
        message: `Utilization elevated: ${maxUtilization
          .times(100)
          .toFixed(2)}%`,
        value: maxUtilization.toNumber()
      };
    }

    return {
      name: 'Utilization Check',
      passed: true,
      severity: 'info',
      message: `Utilization acceptable: ${maxUtilization
        .times(100)
        .toFixed(2)}%`,
      value: maxUtilization.toNumber()
    };
  }

  /**
   * Check available liquidity
   */
  private checkLiquidity(opportunity: ArbitrageOpportunity): RiskCheck {
    const minLiquidity = BigNumber.min(
      opportunity.supplyMarket.availableLiquidity,
      opportunity.borrowMarket.availableLiquidity
    );

    const requiredLiquidity = opportunity.optimalAmount;

    if (minLiquidity.lt(requiredLiquidity)) {
      return {
        name: 'Liquidity Check',
        passed: false,
        severity: 'critical',
        message: `Insufficient liquidity. Need ${requiredLiquidity.toFixed(
          0
        )}, available ${minLiquidity.toFixed(0)}`,
        value: minLiquidity.toNumber()
      };
    }

    const liquidityBuffer = minLiquidity.div(requiredLiquidity);
    if (liquidityBuffer.lt(1.2)) {
      return {
        name: 'Liquidity Check',
        passed: false,
        severity: 'warning',
        message: `Low liquidity buffer: ${liquidityBuffer.toFixed(2)}x`,
        value: liquidityBuffer.toNumber()
      };
    }

    return {
      name: 'Liquidity Check',
      passed: true,
      severity: 'info',
      message: `Sufficient liquidity: ${liquidityBuffer.toFixed(2)}x buffer`,
      value: liquidityBuffer.toNumber()
    };
  }

  /**
   * Check position concentration
   */
  private checkConcentration(opportunity: ArbitrageOpportunity): RiskCheck {
    const supplyConcentration = opportunity.optimalAmount.div(
      opportunity.supplyMarket.totalAsset
    );
    const borrowConcentration = opportunity.optimalAmount.div(
      opportunity.borrowMarket.totalAsset
    );

    const maxConcentration = BigNumber.max(
      supplyConcentration,
      borrowConcentration
    );

    if (maxConcentration.gt(this.MAX_POSITION_CONCENTRATION)) {
      return {
        name: 'Concentration Check',
        passed: false,
        severity: 'warning',
        message: `Position too concentrated: ${maxConcentration
          .times(100)
          .toFixed(2)}% of market`,
        value: maxConcentration.toNumber()
      };
    }

    return {
      name: 'Concentration Check',
      passed: true,
      severity: 'info',
      message: `Position size acceptable: ${maxConcentration
        .times(100)
        .toFixed(2)}% of market`,
      value: maxConcentration.toNumber()
    };
  }

  /**
   * Check liquidation risk
   */
  private checkLiquidationRisk(opportunity: ArbitrageOpportunity): RiskCheck {
    const liquidationRisk = opportunity.liquidationRisk;

    if (liquidationRisk.gt(this.MAX_LIQUIDATION_RISK)) {
      return {
        name: 'Liquidation Risk Check',
        passed: false,
        severity: 'critical',
        message: `Liquidation risk too high: ${liquidationRisk
          .times(100)
          .toFixed(2)}%`,
        value: liquidationRisk.toNumber()
      };
    }

    if (liquidationRisk.gt(0.05)) {
      return {
        name: 'Liquidation Risk Check',
        passed: false,
        severity: 'warning',
        message: `Elevated liquidation risk: ${liquidationRisk
          .times(100)
          .toFixed(2)}%`,
        value: liquidationRisk.toNumber()
      };
    }

    return {
      name: 'Liquidation Risk Check',
      passed: true,
      severity: 'info',
      message: `Liquidation risk acceptable: ${liquidationRisk
        .times(100)
        .toFixed(2)}%`,
      value: liquidationRisk.toNumber()
    };
  }

  /**
   * Check profitability after all costs
   */
  private checkProfitability(opportunity: ArbitrageOpportunity): RiskCheck {
    const netProfit = opportunity.expectedNetProfit;
    const profitPercentage = opportunity.profitPercentage;

    if (netProfit.lte(0)) {
      return {
        name: 'Profitability Check',
        passed: false,
        severity: 'critical',
        message: `Not profitable: $${netProfit.toFixed(2)}`,
        value: netProfit.toNumber()
      };
    }

    if (profitPercentage.lt(0.5)) {
      return {
        name: 'Profitability Check',
        passed: false,
        severity: 'warning',
        message: `Low profit margin: ${profitPercentage.toFixed(2)}%`,
        value: profitPercentage.toNumber()
      };
    }

    return {
      name: 'Profitability Check',
      passed: true,
      severity: 'info',
      message: `Profitable: $${netProfit.toFixed(
        2
      )} (${profitPercentage.toFixed(2)}%)`,
      value: netProfit.toNumber()
    };
  }

  /**
   * Check market impact
   */
  private checkMarketImpact(opportunity: ArbitrageOpportunity): RiskCheck {
    const utilizationImpact = opportunity.utilizationImpact;

    if (utilizationImpact.gt(0.1)) {
      return {
        name: 'Market Impact Check',
        passed: false,
        severity: 'warning',
        message: `High market impact: ${utilizationImpact
          .times(100)
          .toFixed(2)}% utilization change`,
        value: utilizationImpact.toNumber()
      };
    }

    return {
      name: 'Market Impact Check',
      passed: true,
      severity: 'info',
      message: `Low market impact: ${utilizationImpact
        .times(100)
        .toFixed(2)}% utilization change`,
      value: utilizationImpact.toNumber()
    };
  }

  /**
   * Calculate overall risk score (0-100, lower is better)
   */
  private calculateRiskScore(checks: RiskCheck[]): number {
    let score = 0;

    checks.forEach(check => {
      if (!check.passed) {
        if (check.severity === 'critical') {
          score += 40;
        } else if (check.severity === 'warning') {
          score += 15;
        }
      }
    });

    return Math.min(score, 100);
  }

  /**
   * Get execution recommendation
   */
  private getRecommendation(checks: RiskCheck[]): string {
    const criticalFailures = checks.filter(
      c => !c.passed && c.severity === 'critical'
    );
    const warnings = checks.filter(
      c => !c.passed && c.severity === 'warning'
    );

    if (criticalFailures.length > 0) {
      return `DO NOT EXECUTE: ${criticalFailures.length} critical issue(s)`;
    }

    if (warnings.length > 2) {
      return `CAUTION: ${warnings.length} warnings - proceed with extreme caution`;
    }

    if (warnings.length > 0) {
      return `PROCEED WITH CAUTION: ${warnings.length} warning(s)`;
    }

    return 'SAFE TO EXECUTE: All checks passed';
  }

  /**
   * Monitor ongoing position health
   */
  monitorPositionHealth(
    supplyMarket: KashiMarketData,
    borrowMarket: KashiMarketData,
    positionSize: BigNumber
  ): PositionHealth {
    const currentSpread = supplyMarket.supplyAPY.minus(
      borrowMarket.borrowAPY
    );

    const healthFactor = this.calculateHealthFactor(
      supplyMarket,
      borrowMarket,
      positionSize
    );

    const status = this.determineHealthStatus(healthFactor, currentSpread);

    return {
      healthFactor,
      currentSpread,
      supplyUtilization: supplyMarket.utilization,
      borrowUtilization: borrowMarket.utilization,
      status,
      shouldClose: status === 'critical',
      recommendation: this.getHealthRecommendation(status, healthFactor)
    };
  }

  /**
   * Calculate health factor for position
   */
  private calculateHealthFactor(
    supplyMarket: KashiMarketData,
    borrowMarket: KashiMarketData,
    positionSize: BigNumber
  ): BigNumber {
    // Simplified health factor calculation
    // Real implementation would account for collateralization ratios
    const supplyValue = positionSize;
    const borrowValue = positionSize;

    return supplyValue.div(borrowValue);
  }

  /**
   * Determine position health status
   */
  private determineHealthStatus(
    healthFactor: BigNumber,
    currentSpread: BigNumber
  ): HealthStatus {
    if (healthFactor.lt(1.1) || currentSpread.lt(-0.01)) {
      return 'critical';
    }

    if (healthFactor.lt(1.3) || currentSpread.lt(0)) {
      return 'warning';
    }

    if (healthFactor.lt(1.5) || currentSpread.lt(0.005)) {
      return 'caution';
    }

    return 'healthy';
  }

  /**
   * Get health-based recommendation
   */
  private getHealthRecommendation(
    status: HealthStatus,
    healthFactor: BigNumber
  ): string {
    switch (status) {
      case 'critical':
        return `CLOSE POSITION IMMEDIATELY: Health factor ${healthFactor.toFixed(
          2
        )}`;
      case 'warning':
        return `CLOSE POSITION SOON: Health factor ${healthFactor.toFixed(2)}`;
      case 'caution':
        return `MONITOR CLOSELY: Health factor ${healthFactor.toFixed(2)}`;
      default:
        return `HEALTHY: Health factor ${healthFactor.toFixed(2)}`;
    }
  }
}

// Types
export interface RiskAssessment {
  passed: boolean;
  canProceed: boolean;
  riskScore: number;
  checks: RiskCheck[];
  warnings: RiskCheck[];
  criticalIssues: RiskCheck[];
  recommendation: string;
}

export interface RiskCheck {
  name: string;
  passed: boolean;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
}

export interface PositionHealth {
  healthFactor: BigNumber;
  currentSpread: BigNumber;
  supplyUtilization: BigNumber;
  borrowUtilization: BigNumber;
  status: HealthStatus;
  shouldClose: boolean;
  recommendation: string;
}

export type HealthStatus = 'healthy' | 'caution' | 'warning' | 'critical';
