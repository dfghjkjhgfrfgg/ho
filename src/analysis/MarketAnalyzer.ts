import { KalshiMarket } from '../types/KalshiTypes';
import { BettingMath } from '../math/BettingMath';
import { Logger } from '../utils/Logger';

/**
 * Analyzes Kalshi markets to determine fair value
 * Uses multiple models and data sources for pricing
 */
export class MarketAnalyzer {
  private logger = Logger.getInstance();

  /**
   * Calculate fair value probability for a market
   * Uses multiple models and returns weighted average
   */
  async calculateFairValue(market: KalshiMarket): Promise<{
    fairProbability: number;
    confidence: number;
    models: { name: string; probability: number; weight: number }[];
  }> {
    const models: { name: string; probability: number; weight: number }[] = [];

    // Model 1: Market Efficiency (use market price as baseline)
    const marketProb = BettingMath.getMarketImpliedProbability(
      market.yes_bid,
      market.yes_ask
    );
    models.push({
      name: 'Market Price',
      probability: marketProb,
      weight: 0.3,
    });

    // Model 2: Volume-weighted probability
    // Higher volume = more efficient pricing
    const volumeWeight = this.calculateVolumeWeight(market.volume_24h);
    models.push({
      name: 'Volume-Weighted',
      probability: marketProb,
      weight: volumeWeight * 0.2,
    });

    // Model 3: Spread-adjusted probability
    // Narrow spreads = more confident pricing
    const spreadAdjustedProb = this.adjustForSpread(market);
    models.push({
      name: 'Spread-Adjusted',
      probability: spreadAdjustedProb,
      weight: 0.15,
    });

    // Model 4: Time decay adjustment
    // Markets closer to expiration are typically more efficient
    const timeAdjustedProb = this.adjustForTimeToExpiration(market);
    models.push({
      name: 'Time-Adjusted',
      probability: timeAdjustedProb,
      weight: 0.15,
    });

    // Model 5: Category-specific analysis
    const categoryModel = await this.analyzeCategorySpecific(market);
    if (categoryModel) {
      models.push(categoryModel);
    }

    // Calculate weighted fair value
    const fairProbability = BettingMath.calculateFairValue(models);

    // Calculate confidence based on model agreement
    const confidence = this.calculateModelConfidence(models);

    this.logger.debug(`Fair value for ${market.ticker}: ${fairProbability.toFixed(3)} (confidence: ${confidence.toFixed(2)})`);

    return { fairProbability, confidence, models };
  }

  /**
   * Calculate volume weight (0-1)
   * Higher volume = higher confidence in market price
   */
  private calculateVolumeWeight(volume24h: number): number {
    // Normalize volume to 0-1 scale
    // Using logarithmic scale for volume
    if (volume24h === 0) return 0.1;

    const logVolume = Math.log10(volume24h + 1);
    const maxLogVolume = 6; // 1M volume

    return Math.min(1, logVolume / maxLogVolume);
  }

  /**
   * Adjust probability based on bid/ask spread
   * Wider spreads indicate uncertainty
   */
  private adjustForSpread(market: KalshiMarket): number {
    const spread = market.yes_ask - market.yes_bid;
    const midPrice = (market.yes_bid + market.yes_ask) / 2;
    const marketProb = BettingMath.priceToImpliedProbability(midPrice);

    // Wide spreads suggest uncertainty - move toward 50%
    const spreadFactor = spread / 100; // Normalize spread
    const uncertaintyAdjustment = (0.5 - marketProb) * spreadFactor;

    return marketProb + uncertaintyAdjustment;
  }

  /**
   * Adjust based on time to expiration
   * Markets closer to expiration typically have better information
   */
  private adjustForTimeToExpiration(market: KalshiMarket): number {
    const now = new Date();
    const expiration = new Date(market.expiration_time);
    const hoursUntilExpiration =
      (expiration.getTime() - now.getTime()) / (1000 * 60 * 60);

    const marketProb = BettingMath.getMarketImpliedProbability(
      market.yes_bid,
      market.yes_ask
    );

    // If very close to expiration (< 24 hours), trust market more
    if (hoursUntilExpiration < 24) {
      return marketProb;
    }

    // If far from expiration (> 7 days), move toward uncertainty
    if (hoursUntilExpiration > 168) {
      const daysOut = hoursUntilExpiration / 24;
      const uncertaintyFactor = Math.min(0.3, daysOut / 30);
      return marketProb + (0.5 - marketProb) * uncertaintyFactor;
    }

    return marketProb;
  }

  /**
   * Category-specific analysis
   * Different models for different market types
   */
  private async analyzeCategorySpecific(
    market: KalshiMarket
  ): Promise<{ name: string; probability: number; weight: number } | null> {
    const category = market.category.toLowerCase();
    const title = market.title.toLowerCase();

    // Sports markets
    if (category.includes('sport') || category.includes('nfl') ||
        category.includes('nba') || category.includes('mlb') ||
        category.includes('nhl') || category.includes('soccer')) {
      return this.analyzeSportsMarket(market);
    }

    // Weather markets
    if (category.includes('weather') || title.includes('temperature')) {
      return this.analyzeWeatherMarket(market);
    }

    // Economic markets
    if (category.includes('econom') || title.includes('inflation') ||
        title.includes('gdp') || title.includes('employment')) {
      return this.analyzeEconomicMarket(market);
    }

    return null;
  }

  /**
   * Analyze sports markets using game theory
   */
  private analyzeSportsMarket(
    market: KalshiMarket
  ): { name: string; probability: number; weight: number } {
    // Parse market title for teams/players
    const marketProb = BettingMath.getMarketImpliedProbability(
      market.yes_bid,
      market.yes_ask
    );

    // In a real implementation, you would:
    // 1. Parse team names from title
    // 2. Fetch team statistics (win rate, home/away, head-to-head)
    // 3. Calculate Elo ratings
    // 4. Analyze recent form
    // 5. Account for injuries, rest days, etc.
    // 6. Use regression models or ML

    // For now, use heuristics based on market properties
    let adjustedProb = marketProb;

    // Home field advantage (if detectable)
    if (market.title.includes('home') || market.title.includes('@')) {
      // Typically 2-3% advantage for home team
      if (marketProb < 0.5) {
        adjustedProb = marketProb * 1.02;
      }
    }

    // Favorites vs underdogs
    // Heavy favorites (>80%) often overvalued
    if (marketProb > 0.8) {
      adjustedProb = marketProb * 0.98;
    }
    // Heavy underdogs (<20%) often undervalued
    else if (marketProb < 0.2) {
      adjustedProb = marketProb * 1.02;
    }

    return {
      name: 'Sports Model',
      probability: Math.max(0.01, Math.min(0.99, adjustedProb)),
      weight: 0.2,
    };
  }

  /**
   * Analyze weather markets
   */
  private analyzeWeatherMarket(
    market: KalshiMarket
  ): { name: string; probability: number; weight: number } {
    // Weather markets are typically efficient due to forecasts
    // Trust the market price heavily
    const marketProb = BettingMath.getMarketImpliedProbability(
      market.yes_bid,
      market.yes_ask
    );

    // In real implementation:
    // - Fetch weather forecast data from NOAA, Weather.com, etc.
    // - Compare forecast probability to market price
    // - Analyze historical forecast accuracy
    // - Account for time to event

    return {
      name: 'Weather Model',
      probability: marketProb,
      weight: 0.25,
    };
  }

  /**
   * Analyze economic markets
   */
  private analyzeEconomicMarket(
    market: KalshiMarket
  ): { name: string; probability: number; weight: number } {
    const marketProb = BettingMath.getMarketImpliedProbability(
      market.yes_bid,
      market.yes_ask
    );

    // Economic data markets (CPI, jobs, etc.)
    // In real implementation:
    // - Fetch consensus estimates from Bloomberg, Reuters, etc.
    // - Analyze historical beat/miss rates
    // - Consider economic indicators
    // - Use time-series models

    return {
      name: 'Economic Model',
      probability: marketProb,
      weight: 0.2,
    };
  }

  /**
   * Calculate confidence based on model agreement
   * Higher agreement = higher confidence
   */
  private calculateModelConfidence(
    models: { name: string; probability: number; weight: number }[]
  ): number {
    if (models.length < 2) return 0.5;

    // Calculate variance of model probabilities
    const probabilities = models.map((m) => m.probability);
    const mean =
      probabilities.reduce((sum, p) => sum + p, 0) / probabilities.length;
    const variance =
      probabilities.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) /
      probabilities.length;
    const stdDev = Math.sqrt(variance);

    // Low standard deviation = high confidence
    // Map stdDev (0-0.5) to confidence (1-0)
    const confidence = Math.max(0, 1 - stdDev * 4);

    return confidence;
  }

  /**
   * Detect potential mispricing
   * Returns opportunities where market price differs from fair value
   */
  detectMispricing(
    market: KalshiMarket,
    fairProbability: number,
    minEdge: number
  ): {
    hasMispricing: boolean;
    side: 'yes' | 'no';
    action: 'buy' | 'sell';
    edge: number;
    price: number;
  } | null {
    // Check YES side for buying opportunities
    const yesBuyEdge = BettingMath.calculateEdge(
      fairProbability,
      market.yes_ask
    );
    if (yesBuyEdge >= minEdge) {
      return {
        hasMispricing: true,
        side: 'yes',
        action: 'buy',
        edge: yesBuyEdge,
        price: market.yes_ask,
      };
    }

    // Check NO side for buying opportunities
    // Buying NO is equivalent to selling YES
    const noProbability = 1 - fairProbability;
    const noBuyEdge = BettingMath.calculateEdge(noProbability, market.no_ask);
    if (noBuyEdge >= minEdge) {
      return {
        hasMispricing: true,
        side: 'no',
        action: 'buy',
        edge: noBuyEdge,
        price: market.no_ask,
      };
    }

    // Check for selling opportunities (if we have a position)
    // Selling YES when market overvalues it
    const yesSellEdge = BettingMath.calculateEdge(
      fairProbability,
      market.yes_bid
    );
    if (yesSellEdge <= -minEdge) {
      // Negative edge means market is overpriced
      return {
        hasMispricing: true,
        side: 'yes',
        action: 'sell',
        edge: Math.abs(yesSellEdge),
        price: market.yes_bid,
      };
    }

    return null;
  }

  /**
   * Analyze market liquidity
   * Returns whether market has sufficient liquidity for trading
   */
  analyzeLiquidity(market: KalshiMarket, desiredContracts: number): {
    sufficient: boolean;
    spread: number;
    spreadPercent: number;
    volume24h: number;
  } {
    const spread = market.yes_ask - market.yes_bid;
    const midPrice = (market.yes_bid + market.yes_ask) / 2;
    const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 100;

    // Consider sufficient if:
    // 1. Spread is reasonable (< 10%)
    // 2. 24h volume suggests activity
    const sufficient = spreadPercent < 10 && market.volume_24h > 0;

    return {
      sufficient,
      spread,
      spreadPercent,
      volume24h: market.volume_24h,
    };
  }
}
