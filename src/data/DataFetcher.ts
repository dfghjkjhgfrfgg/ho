import axios from 'axios';
import { PriceData, OHLCV, TokenInfo } from '../types';
import Logger from '../utils/Logger';

export class DataFetcher {
  private dexScreenerCache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout: number = 10000; // 10 seconds

  /**
   * Get token price and data from DexScreener
   */
  public async getDexScreenerData(tokenAddress: string): Promise<PriceData | null> {
    try {
      // Check cache
      const cached = this.dexScreenerCache.get(tokenAddress);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      const response = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
        { timeout: 5000 }
      );

      if (response.data && response.data.pairs && response.data.pairs.length > 0) {
        // Get the pair with highest liquidity
        const pair = response.data.pairs.sort(
          (a: any, b: any) => b.liquidity.usd - a.liquidity.usd
        )[0];

        const priceData: PriceData = {
          price: parseFloat(pair.priceUsd) || 0,
          priceChange24h: parseFloat(pair.priceChange.h24) || 0,
          volume24h: parseFloat(pair.volume.h24) || 0,
          marketCap: parseFloat(pair.marketCap) || 0,
          liquidity: parseFloat(pair.liquidity.usd) || 0,
          timestamp: Date.now(),
        };

        // Update cache
        this.dexScreenerCache.set(tokenAddress, {
          data: priceData,
          timestamp: Date.now(),
        });

        return priceData;
      }

      return null;
    } catch (error) {
      Logger.error('Failed to fetch DexScreener data', error, { tokenAddress });
      return null;
    }
  }

  /**
   * Get historical OHLCV data
   */
  public async getHistoricalData(
    tokenAddress: string,
    timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
    limit: number = 200
  ): Promise<OHLCV[]> {
    try {
      // DexScreener doesn't provide historical data directly
      // You would need to use another API like CoinGecko Pro, Birdeye, or store your own data

      // Placeholder: Generate mock data for testing
      Logger.warn('Historical data fetching not fully implemented - using mock data');

      const now = Date.now();
      const candles: OHLCV[] = [];

      const timeframeMs = this.getTimeframeMs(timeframe);

      for (let i = limit - 1; i >= 0; i--) {
        const timestamp = now - i * timeframeMs;
        const basePrice = 100 + Math.random() * 10;

        candles.push({
          timestamp,
          open: basePrice,
          high: basePrice + Math.random() * 2,
          low: basePrice - Math.random() * 2,
          close: basePrice + (Math.random() - 0.5) * 2,
          volume: Math.random() * 1000000,
        });
      }

      return candles;
    } catch (error) {
      Logger.error('Failed to fetch historical data', error);
      return [];
    }
  }

  /**
   * Get token info from CoinGecko
   */
  public async getCoinGeckoData(tokenAddress: string): Promise<TokenInfo | null> {
    try {
      // CoinGecko API for Solana tokens
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/solana/contract/${tokenAddress}`,
        { timeout: 5000 }
      );

      if (response.data) {
        return {
          address: tokenAddress,
          symbol: response.data.symbol.toUpperCase(),
          name: response.data.name,
          decimals: 9, // Solana default
          logoURI: response.data.image?.large,
          coingeckoId: response.data.id,
        };
      }

      return null;
    } catch (error) {
      // Token might not be listed on CoinGecko
      Logger.debug('Token not found on CoinGecko', { tokenAddress });
      return null;
    }
  }

  /**
   * Get trending tokens from CoinGecko
   */
  public async getTrendingTokens(): Promise<TokenInfo[]> {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/search/trending', {
        timeout: 5000,
      });

      if (response.data && response.data.coins) {
        return response.data.coins.slice(0, 20).map((coin: any) => ({
          address: coin.item.id,
          symbol: coin.item.symbol,
          name: coin.item.name,
          decimals: 9,
          logoURI: coin.item.large,
          coingeckoId: coin.item.id,
        }));
      }

      return [];
    } catch (error) {
      Logger.error('Failed to fetch trending tokens', error);
      return [];
    }
  }

  /**
   * Get new token listings from DexScreener
   */
  public async getNewListings(chain: string = 'solana'): Promise<any[]> {
    try {
      const response = await axios.get(
        `https://api.dexscreener.com/token-profiles/latest/v1`,
        { timeout: 5000 }
      );

      if (response.data) {
        return response.data.filter((token: any) => token.chainId === chain).slice(0, 50);
      }

      return [];
    } catch (error) {
      Logger.error('Failed to fetch new listings', error);
      return [];
    }
  }

  /**
   * Get top gainers
   */
  public async getTopGainers(chain: string = 'solana', limit: number = 20): Promise<any[]> {
    try {
      // DexScreener top gainers endpoint
      const response = await axios.get(
        `https://api.dexscreener.com/latest/dex/search?q=${chain}`,
        { timeout: 5000 }
      );

      if (response.data && response.data.pairs) {
        // Sort by 24h price change
        const sorted = response.data.pairs
          .filter((p: any) => p.chainId === chain)
          .sort((a: any, b: any) => {
            const aChange = parseFloat(a.priceChange?.h24 || '0');
            const bChange = parseFloat(b.priceChange?.h24 || '0');
            return bChange - aChange;
          })
          .slice(0, limit);

        return sorted;
      }

      return [];
    } catch (error) {
      Logger.error('Failed to fetch top gainers', error);
      return [];
    }
  }

  /**
   * Get token holders count (requires external service)
   */
  public async getHolderCount(tokenAddress: string): Promise<number> {
    try {
      // Use Helius or similar service
      // This is a placeholder
      return 0;
    } catch (error) {
      Logger.error('Failed to fetch holder count', error);
      return 0;
    }
  }

  /**
   * Search tokens by symbol or name
   */
  public async searchTokens(query: string): Promise<TokenInfo[]> {
    try {
      const response = await axios.get(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
        { timeout: 5000 }
      );

      if (response.data && response.data.pairs) {
        // Extract unique tokens
        const tokensMap = new Map<string, TokenInfo>();

        response.data.pairs.forEach((pair: any) => {
          if (!tokensMap.has(pair.baseToken.address)) {
            tokensMap.set(pair.baseToken.address, {
              address: pair.baseToken.address,
              symbol: pair.baseToken.symbol,
              name: pair.baseToken.name,
              decimals: 9,
            });
          }
        });

        return Array.from(tokensMap.values()).slice(0, 10);
      }

      return [];
    } catch (error) {
      Logger.error('Failed to search tokens', error);
      return [];
    }
  }

  /**
   * Convert timeframe string to milliseconds
   */
  private getTimeframeMs(timeframe: string): number {
    const map: { [key: string]: number } = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };

    return map[timeframe] || 60 * 60 * 1000; // Default 1h
  }

  /**
   * Get current gas price / priority fee
   */
  public async getCurrentPriorityFee(): Promise<number> {
    try {
      // Query Solana for recent priority fees
      // This is a simplified version
      return 0.00001; // Default micro-lamports per compute unit
    } catch (error) {
      Logger.error('Failed to get priority fee', error);
      return 0.00001;
    }
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.dexScreenerCache.clear();
    Logger.info('Data cache cleared');
  }
}

export default DataFetcher;
