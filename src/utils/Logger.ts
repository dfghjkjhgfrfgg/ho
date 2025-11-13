import winston from 'winston';
import { ArbitrageOpportunity, TradeExecutionResult } from '../contracts/types';
import { RiskAssessment } from '../risk/RiskManager';

/**
 * Structured logging for the arbitrage bot
 */
export class Logger {
  private logger: winston.Logger;

  constructor(logLevel: string = 'info') {
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              let msg = `${timestamp} [${level}]: ${message}`;
              if (Object.keys(meta).length > 0) {
                msg += ` ${JSON.stringify(meta, null, 2)}`;
              }
              return msg;
            })
          )
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error'
        }),
        new winston.transports.File({
          filename: 'logs/combined.log'
        }),
        new winston.transports.File({
          filename: 'logs/trades.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        })
      ]
    });
  }

  /**
   * Log bot startup
   */
  logStartup(config: any): void {
    this.logger.info('Kashi Arbitrage Bot Starting', {
      dryRun: config.dryRun,
      minProfitUSD: config.minProfitUSD,
      minProfitPercentage: config.minProfitPercentage,
      maxPositionSize: config.maxPositionSizeETH,
      markets: config.kashiMarkets
    });
  }

  /**
   * Log opportunity detection
   */
  logOpportunityDetected(opportunity: ArbitrageOpportunity): void {
    this.logger.info('Arbitrage Opportunity Detected', {
      id: opportunity.id,
      supplyMarket: `${opportunity.supplyMarket.assetSymbol}-${opportunity.supplyMarket.collateralSymbol}`,
      borrowMarket: `${opportunity.borrowMarket.assetSymbol}-${opportunity.borrowMarket.collateralSymbol}`,
      spread: opportunity.spreadPercent.toFixed(4),
      expectedProfit: opportunity.expectedNetProfit.toFixed(2),
      profitPercentage: opportunity.profitPercentage.toFixed(2),
      worthExecuting: opportunity.worthExecuting,
      reason: opportunity.reason
    });
  }

  /**
   * Log risk assessment
   */
  logRiskAssessment(
    opportunityId: string,
    assessment: RiskAssessment
  ): void {
    const level = assessment.canProceed ? 'info' : 'warn';

    this.logger.log(level, 'Risk Assessment Complete', {
      opportunityId,
      passed: assessment.passed,
      canProceed: assessment.canProceed,
      riskScore: assessment.riskScore,
      recommendation: assessment.recommendation,
      warnings: assessment.warnings.length,
      criticalIssues: assessment.criticalIssues.length,
      checks: assessment.checks.map(c => ({
        name: c.name,
        passed: c.passed,
        severity: c.severity,
        message: c.message
      }))
    });
  }

  /**
   * Log trade execution
   */
  logTradeExecution(result: TradeExecutionResult): void {
    const level = result.success ? 'info' : 'error';

    this.logger.log(level, 'Trade Execution Result', {
      success: result.success,
      opportunityId: result.opportunity.id,
      transactionHash: result.transactionHash,
      actualProfit: result.actualProfit?.toFixed(2),
      gasUsed: result.gasUsed?.toFixed(0),
      error: result.error,
      timestamp: result.timestamp
    });

    // Also log to trades file
    if (result.success) {
      this.logTrade(result);
    }
  }

  /**
   * Log successful trade to dedicated file
   */
  private logTrade(result: TradeExecutionResult): void {
    this.logger.info('TRADE_EXECUTED', {
      txHash: result.transactionHash,
      profit: result.actualProfit?.toFixed(2),
      opportunity: {
        id: result.opportunity.id,
        spread: result.opportunity.spreadPercent.toFixed(4),
        amount: result.opportunity.optimalAmount.toFixed(0)
      }
    });
  }

  /**
   * Log market scan
   */
  logMarketScan(marketsCount: number, opportunitiesFound: number): void {
    this.logger.debug('Market Scan Complete', {
      marketsScanned: marketsCount,
      opportunitiesFound
    });
  }

  /**
   * Log position monitoring
   */
  logPositionMonitoring(
    positionId: string,
    health: string,
    recommendation: string
  ): void {
    this.logger.info('Position Health Check', {
      positionId,
      health,
      recommendation
    });
  }

  /**
   * Log errors
   */
  logError(context: string, error: any): void {
    this.logger.error(`Error in ${context}`, {
      message: error.message,
      stack: error.stack,
      ...error
    });
  }

  /**
   * Log warnings
   */
  logWarning(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log info
   */
  logInfo(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  /**
   * Log debug
   */
  logDebug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  /**
   * Create logs directory if it doesn't exist
   */
  static ensureLogsDirectory(): void {
    const fs = require('fs');
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
    }
  }
}
