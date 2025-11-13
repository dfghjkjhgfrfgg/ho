import { PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';

// ==================== MARKET DATA TYPES ====================

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string;
}

export interface PriceData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  timestamp: number;
}

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ==================== TRADING STRATEGY TYPES ====================

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  ema: {
    ema9: number;
    ema21: number;
    ema50: number;
    ema200: number;
  };
  sma: {
    sma9: number;
    sma21: number;
    sma50: number;
    sma200: number;
  };
  volume: {
    current: number;
    average: number;
    volumeWeighted: number;
  };
}

export interface TradingSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-100
  strength: number; // 0-10
  indicators: TechnicalIndicators;
  reasons: string[];
  timestamp: number;
}

export interface SupportResistance {
  support: number[];
  resistance: number[];
  fibonacciLevels: {
    level: number;
    price: number;
  }[];
}

// ==================== SECURITY TYPES ====================

export interface SecurityAnalysis {
  isHoneypot: boolean;
  canBeSold: boolean;
  rugPullRisk: number; // 0-100
  liquidityLocked: boolean;
  lpBurned: boolean;
  mintAuthority: boolean;
  freezeAuthority: boolean;
  suspiciousFunctions: string[];
  ownershipRenounced: boolean;
  holderAnalysis: {
    topHolderPercent: number;
    holderCount: number;
    contractHoldings: number;
  };
  score: number; // 0-100 (higher is safer)
  warnings: string[];
}

// ==================== RISK MANAGEMENT TYPES ====================

export interface RiskParameters {
  maxPositionSize: number; // in USD
  maxPortfolioPercent: number; // max % of portfolio per trade
  stopLossPercent: number;
  takeProfitPercent: number;
  trailingStopPercent: number;
  maxSlippage: number;
  maxDailyLoss: number; // in USD
  minRiskRewardRatio: number; // e.g., 2.0 for 1:2
  maxOpenPositions: number;
}

export interface Position {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  entryPrice: number;
  currentPrice: number;
  amount: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  stopLoss: number;
  takeProfit: number;
  trailingStop: number;
  openedAt: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
}

export interface TradeResult {
  success: boolean;
  txSignature?: string;
  error?: string;
  executedPrice?: number;
  slippage?: number;
  fees?: number;
  timestamp: number;
}

// ==================== AI & SENTIMENT TYPES ====================

export interface SentimentAnalysis {
  overall: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score: number; // -100 to 100
  sources: {
    twitter: number;
    news: number;
    onchain: number;
  };
  trendingScore: number; // 0-100
  mentions24h: number;
  whaleActivity: {
    largeTransactions: number;
    netFlow: number; // positive = buying, negative = selling
  };
  aiAnalysis: {
    prediction: 'UP' | 'DOWN' | 'SIDEWAYS';
    confidence: number;
    reasoning: string[];
  };
}

export interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  source: string;
  publishedAt: number;
}

// ==================== EXCHANGE & WALLET TYPES ====================

export interface WalletInfo {
  publicKey: PublicKey;
  balance: number; // SOL balance
  tokens: {
    mint: string;
    symbol: string;
    balance: number;
    uiAmount: number;
  }[];
}

export interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippage: number;
  priorityFee?: number;
}

export interface LiquidityPool {
  id: string;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  reserveA: number;
  reserveB: number;
  liquidity: number;
  volume24h: number;
  fees24h: number;
  apy: number;
}

// ==================== DATABASE TYPES ====================

export interface TradeRecord {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  type: 'BUY' | 'SELL';
  amount: number;
  price: number;
  value: number;
  fees: number;
  slippage: number;
  txSignature: string;
  strategy: string;
  confidence: number;
  pnl?: number;
  timestamp: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercent: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
}

// ==================== BOT CONFIGURATION ====================

export interface BotConfig {
  mode: 'LIVE' | 'PAPER' | 'BACKTEST';
  network: 'mainnet-beta' | 'devnet' | 'testnet';
  rpcEndpoint: string;
  walletPrivateKey?: string;
  tradingPairs: string[];
  scanInterval: number; // ms
  minLiquidity: number; // USD
  strategies: {
    rsi: boolean;
    macd: boolean;
    bollingerBands: boolean;
    emaStrategy: boolean;
    volumeAnalysis: boolean;
    aiSentiment: boolean;
  };
  risk: RiskParameters;
  notifications: {
    telegram: boolean;
    discord: boolean;
    telegramBotToken?: string;
    telegramChatId?: string;
    discordWebhook?: string;
  };
  ai: {
    provider: 'CLAUDE' | 'OPENAI' | 'BOTH';
    claudeApiKey?: string;
    openaiApiKey?: string;
    enableSentiment: boolean;
  };
  database: {
    enabled: boolean;
    type: 'POSTGRESQL' | 'SQLITE';
    connectionString?: string;
  };
}

// ==================== API TYPES ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface BacktestConfig {
  startDate: number;
  endDate: number;
  initialCapital: number;
  tokens: string[];
  strategies: string[];
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: TradeRecord[];
  performance: PerformanceMetrics;
  equityCurve: {
    timestamp: number;
    equity: number;
  }[];
  drawdownCurve: {
    timestamp: number;
    drawdown: number;
  }[];
}
