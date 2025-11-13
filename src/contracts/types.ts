import BigNumber from 'bignumber.js';

/**
 * Kashi Pair Market Data
 */
export interface KashiMarketData {
  pairAddress: string;
  asset: string;           // Asset token address
  collateral: string;      // Collateral token address
  assetSymbol: string;
  collateralSymbol: string;

  // Core metrics
  totalAsset: BigNumber;
  totalBorrow: BigNumber;
  totalCollateral: BigNumber;

  // Interest rates
  interestPerSecond: BigNumber;
  lastAccrued: BigNumber;

  // Utilization
  utilization: BigNumber;

  // APYs
  supplyAPY: BigNumber;
  borrowAPY: BigNumber;

  // Exchange rate
  exchangeRate: BigNumber;

  // Protocol fee
  protocolFee: BigNumber;

  // Oracle price
  oraclePrice: BigNumber;

  // Available liquidity
  availableLiquidity: BigNumber;

  // Timestamp
  timestamp: number;
}

/**
 * Arbitrage Opportunity
 */
export interface ArbitrageOpportunity {
  id: string;
  timestamp: number;

  // Markets involved
  supplyMarket: KashiMarketData;
  borrowMarket: KashiMarketData;

  // Opportunity metrics
  spreadBps: BigNumber;
  spreadPercent: BigNumber;
  direction: 'A_TO_B' | 'B_TO_A';

  // Position sizing
  optimalAmount: BigNumber;
  maxAmount: BigNumber;

  // Profitability
  expectedGrossProfit: BigNumber;
  expectedNetProfit: BigNumber;
  profitPercentage: BigNumber;

  // Costs
  estimatedGasCost: BigNumber;
  estimatedSlippage: BigNumber;

  // Risk metrics
  utilizationImpact: BigNumber;
  liquidationRisk: BigNumber;

  // Execution readiness
  worthExecuting: boolean;
  reason: string;
}

/**
 * Bot Configuration
 */
export interface BotConfig {
  // RPC
  rpcUrl: string;
  chainId: number;

  // Wallet
  privateKey: string;

  // Trading parameters
  minProfitUSD: number;
  minProfitPercentage: number;
  maxPositionSizeETH: number;
  gasPriceLimitGwei: number;

  // Markets to monitor
  kashiMarkets: string[];

  // Execution
  dryRun: boolean;
  executionIntervalMs: number;

  // Logging
  logLevel: string;
}

/**
 * Trade Execution Result
 */
export interface TradeExecutionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  opportunity: ArbitrageOpportunity;
  actualProfit?: BigNumber;
  gasUsed?: BigNumber;
  timestamp: number;
}

/**
 * Market Pair Configuration
 */
export interface MarketPair {
  asset: string;
  collateral: string;
  pairAddress: string;
}
