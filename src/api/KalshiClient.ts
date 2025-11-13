import axios, { AxiosInstance, AxiosError } from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import {
  KalshiAuthResponse,
  KalshiMarket,
  KalshiEvent,
  KalshiOrderbook,
  KalshiOrder,
  KalshiPosition,
  KalshiBalance,
} from '../types/KalshiTypes';
import { Logger } from '../utils/Logger';

/**
 * Kalshi API Client with API Key Authentication
 * Handles authentication, rate limiting, and all API interactions
 */
export class KalshiClient {
  private client: AxiosInstance;
  private apiKeyId: string;
  private privateKey: string;
  private baseUrl: string;
  private logger = Logger.getInstance();
  private lastRequestTime = 0;
  private minRequestInterval = 100; // 100ms between requests for rate limiting

  constructor(apiKeyId: string, privateKeyPath: string, baseUrl: string) {
    this.apiKeyId = apiKeyId;
    this.baseUrl = baseUrl;

    // Load private key from file
    try {
      this.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      this.logger.info('Private key loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load private key:', error);
      throw new Error(`Failed to load private key from ${privateKeyPath}`);
    }

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => {
        // Add authentication headers
        const timestamp = Date.now().toString();
        const signature = this.signRequest(timestamp, config.method?.toUpperCase() || 'GET', config.url || '');

        config.headers['KALSHI-ACCESS-KEY'] = this.apiKeyId;
        config.headers['KALSHI-ACCESS-SIGNATURE'] = signature;
        config.headers['KALSHI-ACCESS-TIMESTAMP'] = timestamp;

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.handleError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Sign request using RSA private key
   */
  private signRequest(timestamp: string, method: string, path: string): string {
    // Kalshi signature format: timestamp + method + path
    const message = timestamp + method + path;

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    sign.end();

    const signature = sign.sign(this.privateKey, 'base64');
    return signature;
  }

  /**
   * Test authentication (no separate login needed with API keys)
   */
  async authenticate(): Promise<void> {
    try {
      this.logger.info('Testing Kalshi API authentication...');

      // Test by fetching balance
      await this.getBalance();

      this.logger.info('Authentication successful');
    } catch (error) {
      this.logger.error('Authentication failed:', error);
      throw new Error('Failed to authenticate with Kalshi');
    }
  }

  /**
   * Rate limiting - ensure minimum interval between requests
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<T> {
    await this.rateLimit();

    const config: any = {
      method,
      url: endpoint,
    };

    if (data) {
      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }
    }

    const response = await this.client.request<T>(config);
    return response.data;
  }

  /**
   * Get all markets with optional filters
   */
  async getMarkets(params?: {
    status?: 'open' | 'closed' | 'settled';
    series_ticker?: string;
    event_ticker?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ markets: KalshiMarket[]; cursor?: string }> {
    return this.request<{ markets: KalshiMarket[]; cursor?: string }>('GET', '/markets', params);
  }

  /**
   * Get specific market by ticker
   */
  async getMarket(ticker: string): Promise<KalshiMarket> {
    const response = await this.request<{ market: KalshiMarket }>('GET', `/markets/${ticker}`);
    return response.market;
  }

  /**
   * Get event details
   */
  async getEvent(eventTicker: string): Promise<KalshiEvent> {
    const response = await this.request<{ event: KalshiEvent }>('GET', `/events/${eventTicker}`);
    return response.event;
  }

  /**
   * Get orderbook for a market
   */
  async getOrderbook(ticker: string, depth = 5): Promise<KalshiOrderbook> {
    const response = await this.request<{ orderbook: KalshiOrderbook }>(
      'GET',
      `/markets/${ticker}/orderbook`,
      { depth }
    );
    return response.orderbook;
  }

  /**
   * Place an order
   */
  async placeOrder(params: {
    ticker: string;
    action: 'buy' | 'sell';
    side: 'yes' | 'no';
    count: number;
    type: 'limit' | 'market';
    yes_price?: number;
    no_price?: number;
    expiration_ts?: number;
  }): Promise<KalshiOrder> {
    this.logger.info(`Placing ${params.action} order for ${params.ticker}:`, {
      side: params.side,
      count: params.count,
      type: params.type,
      price: params.yes_price || params.no_price,
    });

    const response = await this.request<{ order: KalshiOrder }>('POST', '/orders', params);
    return response.order;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<void> {
    this.logger.info(`Canceling order ${orderId}`);
    await this.request('DELETE', `/orders/${orderId}`);
  }

  /**
   * Get all orders (active and historical)
   */
  async getOrders(params?: {
    ticker?: string;
    status?: 'resting' | 'pending' | 'executed' | 'canceled';
    limit?: number;
    cursor?: string;
  }): Promise<{ orders: KalshiOrder[]; cursor?: string }> {
    return this.request<{ orders: KalshiOrder[]; cursor?: string }>('GET', '/orders', params);
  }

  /**
   * Get portfolio positions
   */
  async getPositions(): Promise<KalshiPosition[]> {
    const response = await this.request<{ positions: KalshiPosition[] }>('GET', '/portfolio/positions');
    return response.positions || [];
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<KalshiBalance> {
    return this.request<KalshiBalance>('GET', '/portfolio/balance');
  }

  /**
   * Get markets by category
   */
  async getMarketsByCategory(category: string): Promise<KalshiMarket[]> {
    let allMarkets: KalshiMarket[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.getMarkets({
        status: 'open',
        limit: 200,
        cursor,
      });

      // Filter by category (case-insensitive)
      const categoryMarkets = response.markets.filter(
        m => m.category && m.category.toLowerCase().includes(category.toLowerCase())
      );

      allMarkets = allMarkets.concat(categoryMarkets);
      cursor = response.cursor;
    } while (cursor);

    return allMarkets;
  }

  /**
   * Search for markets by title/subtitle keywords
   */
  async searchMarkets(keywords: string[]): Promise<KalshiMarket[]> {
    const response = await this.getMarkets({ status: 'open', limit: 1000 });

    return response.markets.filter(market => {
      const searchText = `${market.title} ${market.subtitle}`.toLowerCase();
      return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
    });
  }

  /**
   * Error handling
   */
  private handleError(error: AxiosError): void {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        this.logger.error('Authentication error - check API key and signature');
      } else if (status === 429) {
        this.logger.warn('Rate limit exceeded - backing off');
      } else if (status >= 500) {
        this.logger.error(`Kalshi server error: ${status}`, data);
      } else {
        this.logger.error(`API error: ${status}`, data);
      }
    } else if (error.request) {
      this.logger.error('No response from Kalshi API - network error');
    } else {
      this.logger.error('Error setting up request:', error.message);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getBalance();
      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }
}
