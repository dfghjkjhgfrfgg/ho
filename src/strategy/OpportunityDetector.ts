import { KalshiMarket, TradingOpportunity, KalshiConfig } from '../types/KalshiTypes';
import { MarketAnalyzer } from '../analysis/MarketAnalyzer';
import { BettingMath } from '../math/BettingMath';
import { Logger } from '../utils/Logger';

/**
 * Detects trading opportunities in Kalshi markets
 * Finds mispriced contracts and calculates optimal position sizes
 */
export class OpportunityDetector {
  private analyzer: MarketAnalyzer;
  private logger = Logger.getInstance();
  private config: KalshiConfig;

  constructor(config: KalshiConfig) {
    this.config = config;
    this.analyzer = new MarketAnalyzer();
  }

  /**
   * Scan markets and find trading opportunities
   */
  async findOpportunities(markets: KalshiMarket[]): Promise<TradingOpportunity[]> {
    this.logger.info(`Scanning ${markets.length} markets for opportunities...`);

    const opportunities: TradingOpportunity[] = [];

    for (const market of markets) {
      // Skip closed or settled markets
      if (market.status !== 'open') {
        continue;
      }

      // Skip markets with very low liquidity
      const liquidity = this.analyzer.analyzeLiquidity(market, 1);
      if (!liquidity.sufficient) {
        this.logger.debug(`Skipping ${market.ticker} - insufficient liquidity`);
        continue;
      }

      // Calculate fair value
      const { fairProbability, confidence, models } =
        await this.analyzer.calculateFairValue(market);

      // Check both YES and NO sides for opportunities
      const yesOpportunity = this.evaluateSide(
        market,
        'yes',
        fairProbability,
        confidence,
        models
      );

      if (yesOpportunity) {
        opportunities.push(yesOpportunity);
      }

      const noOpportunity = this.evaluateSide(
        market,
        'no',
        1 - fairProbability,
        confidence,
        models
      );

      if (noOpportunity) {
        opportunities.push(noOpportunity);
      }
    }

    // Sort by expected value (best first)
    opportunities.sort((a, b) => b.expectedValue - a.expectedValue);

    this.logger.info(`Found ${opportunities.length} opportunities`);

    return opportunities;
  }

  /**
   * Evaluate one side of a market (YES or NO)
   */
  private evaluateSide(
    market: KalshiMarket,
    side: 'yes' | 'no',
    fairProbability: number,
    confidence: number,
    models: { name: string; probability: number; weight: number }[]
  ): TradingOpportunity | null {
    // Get current prices
    const askPrice = side === 'yes' ? market.yes_ask : market.no_ask;
    const bidPrice = side === 'yes' ? market.yes_bid : market.no_bid;

    // Evaluate buying opportunity
    const buyOpp = this.evaluateBuy(
      market,
      side,
      askPrice,
      fairProbability,
      confidence,
      models
    );

    if (buyOpp) {
      return buyOpp;
    }

    // Evaluate selling opportunity (if we would have a position)
    const sellOpp = this.evaluateSell(
      market,
      side,
      bidPrice,
      fairProbability,
      confidence,
      models
    );

    return sellOpp;
  }

  /**
   * Evaluate buying opportunity
   */
  private evaluateBuy(
    market: KalshiMarket,
    side: 'yes' | 'no',
    askPrice: number,
    fairProbability: number,
    confidence: number,
    models: { name: string; probability: number; weight: number }[]
  ): TradingOpportunity | null {
    // Calculate edge
    const edge = BettingMath.calculateEdge(fairProbability, askPrice);

    // Must meet minimum edge requirement
    if (edge < this.config.minEdge) {
      return null;
    }

    // Calculate expected value
    const expectedValue = BettingMath.calculateExpectedValue(
      fairProbability,
      askPrice
    );

    // Validate the bet
    const validation = BettingMath.isValidBet(
      fairProbability,
      askPrice,
      this.config.minEdge,
      0.05 // Minimum 5% EV
    );

    if (!validation.valid) {
      return null;
    }

    // Calculate Kelly fraction
    const kellyFraction = BettingMath.kellyFraction(
      fairProbability,
      askPrice
    );

    // Apply fractional Kelly for safety
    const adjustedKelly = kellyFraction * this.config.kellyFraction;

    // Calculate position size
    // Note: maxPositionSize is in dollars, askPrice is in cents
    const maxContracts = Math.floor(
      (this.config.maxPositionSize * 100) / askPrice
    );

    const recommendedContracts = Math.min(
      maxContracts,
      Math.floor((this.config.maxTotalExposure * 100 * adjustedKelly) / askPrice)
    );

    // Must be at least 1 contract
    if (recommendedContracts < 1) {
      return null;
    }

    // Build reasoning
    const reasoning = this.buildReasoning(
      'buy',
      side,
      fairProbability,
      askPrice,
      edge,
      expectedValue,
      models
    );

    return {
      ticker: market.ticker,
      title: market.title,
      side,
      action: 'buy',
      currentPrice: askPrice,
      fairValue: BettingMath.probabilityToPrice(fairProbability),
      edge,
      expectedValue,
      kellyFraction: adjustedKelly,
      recommendedSize: recommendedContracts,
      maxSize: maxContracts,
      reasoning,
      confidence,
      category: market.category,
      expirationTime: market.expiration_time,
    };
  }

  /**
   * Evaluate selling opportunity
   * Used to exit positions when market becomes overpriced
   */
  private evaluateSell(
    market: KalshiMarket,
    side: 'yes' | 'no',
    bidPrice: number,
    fairProbability: number,
    confidence: number,
    models: { name: string; probability: number; weight: number }[]
  ): TradingOpportunity | null {
    // For selling, we want the market to OVERVALUE the contract
    // This means market price > fair value
    const edge = -BettingMath.calculateEdge(fairProbability, bidPrice);

    // Must meet minimum edge requirement (market is overpriced enough)
    if (edge < this.config.minEdge) {
      return null;
    }

    // Build reasoning
    const reasoning = this.buildReasoning(
      'sell',
      side,
      fairProbability,
      bidPrice,
      edge,
      0, // EV doesn't apply to exits
      models
    );

    return {
      ticker: market.ticker,
      title: market.title,
      side,
      action: 'sell',
      currentPrice: bidPrice,
      fairValue: BettingMath.probabilityToPrice(fairProbability),
      edge,
      expectedValue: 0,
      kellyFraction: 0,
      recommendedSize: 0, // Will be determined by actual position
      maxSize: 0,
      reasoning,
      confidence,
      category: market.category,
      expirationTime: market.expiration_time,
    };
  }

  /**
   * Build human-readable reasoning for the opportunity
   */
  private buildReasoning(
    action: 'buy' | 'sell',
    side: 'yes' | 'no',
    fairProbability: number,
    price: number,
    edge: number,
    expectedValue: number,
    models: { name: string; probability: number; weight: number }[]
  ): string {
    const fairPercent = (fairProbability * 100).toFixed(1);
    const pricePercent = price.toFixed(0);
    const edgePercent = (edge * 100).toFixed(1);
    const evPercent = (expectedValue * 100).toFixed(1);

    let reasoning = `${action.toUpperCase()} ${side.toUpperCase()}: `;

    if (action === 'buy') {
      reasoning += `Fair value ${fairPercent}% vs market ${pricePercent}¢. `;
      reasoning += `Edge: ${edgePercent}%, EV: ${evPercent}%. `;
    } else {
      reasoning += `Market overpriced at ${pricePercent}¢ vs fair ${fairPercent}%. `;
      reasoning += `Edge on exit: ${edgePercent}%. `;
    }

    // Add top contributing models
    const topModels = models
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 2);

    reasoning += 'Models: ';
    reasoning += topModels
      .map((m) => `${m.name} (${(m.probability * 100).toFixed(0)}%)`)
      .join(', ');

    return reasoning;
  }

  /**
   * Filter opportunities by category
   */
  filterByCategory(
    opportunities: TradingOpportunity[],
    categories: string[]
  ): TradingOpportunity[] {
    if (categories.length === 0) {
      return opportunities;
    }

    return opportunities.filter((opp) =>
      categories.some((cat) =>
        opp.category.toLowerCase().includes(cat.toLowerCase())
      )
    );
  }

  /**
   * Detect arbitrage opportunities
   * Rare but risk-free profit when YES + NO < 100
   */
  detectArbitrage(market: KalshiMarket): {
    hasArbitrage: boolean;
    profit: number;
    yesContracts: number;
    noContracts: number;
  } {
    const result = BettingMath.detectArbitrage(
      market.yes_ask,
      market.no_ask
    );

    if (result.hasArbitrage) {
      this.logger.info(`ARBITRAGE FOUND in ${market.ticker}! Profit: ${result.profit}¢ per contract pair`);

      // Calculate how many contracts we can buy
      const maxSpend = this.config.maxPositionSize * 100; // Convert to cents
      const costPerPair = market.yes_ask + market.no_ask;
      const maxPairs = Math.floor(maxSpend / costPerPair);

      return {
        hasArbitrage: true,
        profit: result.profit,
        yesContracts: maxPairs,
        noContracts: maxPairs,
      };
    }

    return {
      hasArbitrage: false,
      profit: 0,
      yesContracts: 0,
      noContracts: 0,
    };
  }

  /**
   * Analyze correlation between markets
   * Helps avoid overexposure to correlated events
   */
  estimateCorrelation(market1: KalshiMarket, market2: KalshiMarket): number {
    // Simple heuristic-based correlation estimation
    // In a real implementation, use historical price movements

    // Same event = highly correlated
    if (market1.event_ticker === market2.event_ticker) {
      return 0.8;
    }

    // Same category = moderately correlated
    if (market1.category === market2.category) {
      // Check if they share keywords
      const title1Words = market1.title.toLowerCase().split(' ');
      const title2Words = market2.title.toLowerCase().split(' ');

      const commonWords = title1Words.filter((word) =>
        title2Words.includes(word)
      );

      if (commonWords.length > 2) {
        return 0.5;
      }

      return 0.3;
    }

    // Different categories = low correlation
    return 0.1;
  }

  /**
   * Get summary statistics for opportunities
   */
  getOpportunitySummary(opportunities: TradingOpportunity[]): {
    count: number;
    totalExpectedValue: number;
    averageEdge: number;
    averageConfidence: number;
    byCategory: { [category: string]: number };
  } {
    const count = opportunities.length;

    if (count === 0) {
      return {
        count: 0,
        totalExpectedValue: 0,
        averageEdge: 0,
        averageConfidence: 0,
        byCategory: {},
      };
    }

    const totalExpectedValue = opportunities.reduce(
      (sum, opp) => sum + opp.expectedValue,
      0
    );

    const averageEdge =
      opportunities.reduce((sum, opp) => sum + opp.edge, 0) / count;

    const averageConfidence =
      opportunities.reduce((sum, opp) => sum + opp.confidence, 0) / count;

    const byCategory: { [category: string]: number } = {};
    opportunities.forEach((opp) => {
      byCategory[opp.category] = (byCategory[opp.category] || 0) + 1;
    });

    return {
      count,
      totalExpectedValue,
      averageEdge,
      averageConfidence,
      byCategory,
    };
  }
}
