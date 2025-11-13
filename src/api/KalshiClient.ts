import axios, { AxiosInstance, AxiosError } from 'axios';
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
 * Kalshi API Client
 * Handles authentication, rate limiting, and all API interactions
 */
export class KalshiClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private email: string;
  private password: string;
  private baseUrl: string;
  private logger = Logger.getInstance();
  private lastRequestTime = 0;
  private minRequestInterval = 100; // 100ms between requests for rate limiting

  constructor(email: string, password: string, baseUrl: string) {
    this.email = email;
    this.password = password;
    this.baseUrl = baseUrl;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

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
   * Authenticate with Kalshi and get access token
   */
  async authenticate(): Promise<void> {
    try {
      this.logger.info('Authenticating with Kalshi...');

      const response = await this.client.post<KalshiAuthResponse>('/login', {
        email: this.email,
        password: this.password,
      });

      this.token = response.data.token;

      // Token expires in 30 minutes, refresh 5 minutes early
      this.tokenExpiry = new Date(Date.now() + 25 * 60 * 1000);

      this.logger.info('Authentication successful');
    } catch (error) {
      this.logger.error('Authentication failed:', error);
      throw new Error('Failed to authenticate with Kalshi');
    }
  }

  /**
   * Ensure we have a valid token, refresh if needed
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.token || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
      await this.authenticate();
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
    await this.ensureAuthenticated();
    await this.rateLimit();

    const config = {
      method,
      url: endpoint,
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      ...(data && { data }),
    };

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
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/markets?${queryParams.toString()}`;
    return this.request<{ markets: KalshiMarket[]; cursor?: string }>('GET', endpoint);
  }

  /**
   * Get specific market by ticker
   */
  async getMarket(ticker: string): Promise<KalshiMarket> {
    return this.request<KalshiMarket>('GET', `/markets/${ticker}`);
  }

  /**
   * Get event details
   */
  async getEvent(eventTicker: string): Promise<KalshiEvent> {
    return this.request<KalshiEvent>('GET', `/events/${eventTicker}`);
  }

  /**
   * Get orderbook for a market
   */
  async getOrderbook(ticker: string, depth = 5): Promise<KalshiOrderbook> {
    return this.request<KalshiOrderbook>('GET', `/markets/${ticker}/orderbook?depth=${depth}`);
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

    return this.request<KalshiOrder>('POST', '/orders', params);
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
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/orders?${queryParams.toString()}`;
    return this.request<{ orders: KalshiOrder[]; cursor?: string }>('GET', endpoint);
  }

  /**
   * Get portfolio positions
   */
  async getPositions(): Promise<KalshiPosition[]> {
    const response = await this.request<{ positions: KalshiPosition[] }>('GET', '/portfolio/positions');
    return response.positions;
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
        m => m.category.toLowerCase().includes(category.toLowerCase())
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
        this.logger.error('Authentication error - token may be expired');
        this.token = null;
        this.tokenExpiry = null;
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
      await this.ensureAuthenticated();
      await this.getBalance();
      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }
}
