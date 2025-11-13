/**
 * TypeScript types for Kalshi API
 */

export interface KalshiConfig {
  apiKeyId: string;
  privateKeyPath: string;
  baseUrl: string;
  dryRun: boolean;
  minEdge: number; // Minimum edge required (e.g., 0.05 = 5%)
  maxPositionSize: number; // Max USD per position
  maxTotalExposure: number; // Max total USD exposure
  kellyFraction: number; // Kelly Criterion fraction (0.25 = quarter Kelly)
  scanIntervalMs: number;
  categories: string[]; // Market categories to monitor (e.g., ["sports", "nfl", "nba"])
}

export interface KalshiAuthResponse {
  token: string;
  member_id: string;
  expiry: string;
}

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  market_type: string;
  title: string;
  subtitle: string;
  open_time: string;
  close_time: string;
  expiration_time: string;
  status: 'open' | 'closed' | 'settled';
  yes_bid: number;
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  volume: number;
  volume_24h: number;
  liquidity: number;
  result: string | null;
  can_close_early: boolean;
  category: string;
  risk_limit_cents: number;
}

export interface KalshiEvent {
  event_ticker: string;
  series_ticker: string;
  title: string;
  subtitle: string;
  category: string;
  strike_date: string;
  markets: KalshiMarket[];
}

export interface KalshiOrderbook {
  yes: OrderbookSide[];
  no: OrderbookSide[];
}

export interface OrderbookSide {
  price: number;
  count: number;
}

export interface KalshiOrder {
  order_id: string;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  type: 'limit' | 'market';
  yes_price?: number;
  no_price?: number;
  count: number;
  status: 'resting' | 'pending' | 'executed' | 'canceled';
  created_time: string;
  expiration_time?: string;
}

export interface KalshiPosition {
  ticker: string;
  position: number; // Positive = long yes, negative = short yes (long no)
  total_cost: number;
  fees_paid: number;
  market_exposure: number;
  realized_pnl: number;
  unrealized_pnl: number;
}

export interface KalshiBalance {
  balance: number; // cents
  payout: number; // cents
}

export interface TradingOpportunity {
  ticker: string;
  title: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  currentPrice: number;
  fairValue: number;
  edge: number; // Expected edge percentage
  expectedValue: number; // EV per dollar
  kellyFraction: number; // Suggested position size as fraction of bankroll
  recommendedSize: number; // Recommended number of contracts
  maxSize: number; // Maximum allowed contracts
  reasoning: string;
  confidence: number; // 0-1 confidence score
  category: string;
  expirationTime: string;
}

export interface BettingModel {
  fairValue: number; // Fair probability (0-1)
  confidence: number; // Model confidence (0-1)
  factors: {
    name: string;
    value: number;
    weight: number;
  }[];
}

export interface TradeResult {
  success: boolean;
  orderId?: string;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  contracts: number;
  price: number;
  totalCost: number;
  error?: string;
  timestamp: string;
}

export interface PortfolioSummary {
  totalBalance: number;
  totalExposure: number;
  positionCount: number;
  realizedPnl: number;
  unrealizedPnl: number;
  positions: KalshiPosition[];
}
