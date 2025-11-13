import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { SentimentAnalysis, NewsArticle } from '../types';
import Logger from '../utils/Logger';
import axios from 'axios';

export class SentimentAnalyzer {
  private claudeClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;
  private provider: 'CLAUDE' | 'OPENAI' | 'BOTH';

  constructor(
    provider: 'CLAUDE' | 'OPENAI' | 'BOTH',
    claudeApiKey?: string,
    openaiApiKey?: string
  ) {
    this.provider = provider;

    if ((provider === 'CLAUDE' || provider === 'BOTH') && claudeApiKey) {
      this.claudeClient = new Anthropic({ apiKey: claudeApiKey });
    }

    if ((provider === 'OPENAI' || provider === 'BOTH') && openaiApiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
    }
  }

  /**
   * Analyze overall sentiment for a token
   */
  public async analyzeSentiment(
    tokenSymbol: string,
    tokenAddress: string
  ): Promise<SentimentAnalysis> {
    try {
      Logger.ai('Starting sentiment analysis', { tokenSymbol, tokenAddress });

      // Gather data from multiple sources
      const [twitterSentiment, newsSentiment, onchainData] = await Promise.all([
        this.getTwitterSentiment(tokenSymbol),
        this.getNewsSentiment(tokenSymbol),
        this.getOnchainMetrics(tokenAddress),
      ]);

      // Aggregate sentiment scores
      const overallScore =
        (twitterSentiment.score + newsSentiment.score + onchainData.score) / 3;

      let overall: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
      if (overallScore > 30) overall = 'BULLISH';
      else if (overallScore < -30) overall = 'BEARISH';

      // Get AI prediction
      const aiAnalysis = await this.getAIPrediction(
        tokenSymbol,
        {
          twitter: twitterSentiment.score,
          news: newsSentiment.score,
          onchain: onchainData.score,
        },
        onchainData.whaleActivity
      );

      const sentiment: SentimentAnalysis = {
        overall,
        score: overallScore,
        sources: {
          twitter: twitterSentiment.score,
          news: newsSentiment.score,
          onchain: onchainData.score,
        },
        trendingScore: twitterSentiment.trendingScore,
        mentions24h: twitterSentiment.mentions,
        whaleActivity: onchainData.whaleActivity,
        aiAnalysis,
      };

      Logger.ai('Sentiment analysis complete', {
        tokenSymbol,
        overall,
        score: overallScore.toFixed(1),
        aiPrediction: aiAnalysis.prediction,
      });

      return sentiment;
    } catch (error) {
      Logger.error('Sentiment analysis failed', error);

      // Return neutral sentiment on error
      return {
        overall: 'NEUTRAL',
        score: 0,
        sources: {
          twitter: 0,
          news: 0,
          onchain: 0,
        },
        trendingScore: 0,
        mentions24h: 0,
        whaleActivity: {
          largeTransactions: 0,
          netFlow: 0,
        },
        aiAnalysis: {
          prediction: 'SIDEWAYS',
          confidence: 0,
          reasoning: ['Analysis failed'],
        },
      };
    }
  }

  /**
   * Get Twitter/X sentiment
   */
  private async getTwitterSentiment(
    tokenSymbol: string
  ): Promise<{ score: number; trendingScore: number; mentions: number }> {
    try {
      // In production, you would use Twitter API v2
      // For now, using a mock or third-party API like LunarCrush

      const response = await axios
        .get(`https://api.lunarcrush.com/v2?data=assets&symbol=${tokenSymbol}`, {
          timeout: 5000,
        })
        .catch(() => null);

      if (response && response.data && response.data.data) {
        const data = response.data.data[0];
        const sentimentScore = (data.sentiment - 3) * 25; // Convert 1-5 to -100 to 100

        return {
          score: sentimentScore,
          trendingScore: data.galaxy_score || 0,
          mentions: data.social_volume_24h || 0,
        };
      }

      // Fallback: neutral sentiment
      return {
        score: 0,
        trendingScore: 50,
        mentions: 0,
      };
    } catch (error) {
      Logger.error('Failed to get Twitter sentiment', error);
      return {
        score: 0,
        trendingScore: 50,
        mentions: 0,
      };
    }
  }

  /**
   * Get news sentiment
   */
  private async getNewsSentiment(
    tokenSymbol: string
  ): Promise<{ score: number; articles: NewsArticle[] }> {
    try {
      // Use CryptoPanic API or similar
      const response = await axios
        .get(`https://cryptopanic.com/api/v1/posts/?auth_token=demo&currencies=${tokenSymbol}`, {
          timeout: 5000,
        })
        .catch(() => null);

      if (response && response.data && response.data.results) {
        const articles: NewsArticle[] = response.data.results.slice(0, 10).map((item: any) => ({
          title: item.title,
          summary: item.title, // API doesn't provide summary
          url: item.url,
          sentiment: this.classifySentiment(item.votes),
          source: item.source.title,
          publishedAt: new Date(item.published_at).getTime(),
        }));

        // Calculate average sentiment
        const sentimentScores = articles.map((a) => {
          if (a.sentiment === 'POSITIVE') return 100;
          if (a.sentiment === 'NEGATIVE') return -100;
          return 0;
        });

        const avgSentiment =
          sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length || 0;

        return {
          score: avgSentiment,
          articles,
        };
      }

      return {
        score: 0,
        articles: [],
      };
    } catch (error) {
      Logger.error('Failed to get news sentiment', error);
      return {
        score: 0,
        articles: [],
      };
    }
  }

  /**
   * Get on-chain metrics and whale activity
   */
  private async getOnchainMetrics(
    tokenAddress: string
  ): Promise<{
    score: number;
    whaleActivity: { largeTransactions: number; netFlow: number };
  }> {
    try {
      // Use Helius or similar for on-chain data
      // This is a placeholder implementation

      // Check for large transactions (whale movements)
      const largeTransactions = 0; // Placeholder
      const netFlow = 0; // Positive = buying, negative = selling

      // Calculate sentiment from on-chain activity
      let score = 0;
      if (netFlow > 0) score += 30;
      if (netFlow < 0) score -= 30;

      return {
        score,
        whaleActivity: {
          largeTransactions,
          netFlow,
        },
      };
    } catch (error) {
      Logger.error('Failed to get on-chain metrics', error);
      return {
        score: 0,
        whaleActivity: {
          largeTransactions: 0,
          netFlow: 0,
        },
      };
    }
  }

  /**
   * Get AI prediction using Claude or OpenAI
   */
  private async getAIPrediction(
    tokenSymbol: string,
    sentimentScores: { twitter: number; news: number; onchain: number },
    whaleActivity: { largeTransactions: number; netFlow: number }
  ): Promise<{
    prediction: 'UP' | 'DOWN' | 'SIDEWAYS';
    confidence: number;
    reasoning: string[];
  }> {
    try {
      const prompt = `Analyze the following market data for ${tokenSymbol} and provide a short-term price prediction:

Twitter Sentiment: ${sentimentScores.twitter.toFixed(1)}/100
News Sentiment: ${sentimentScores.news.toFixed(1)}/100
On-chain Sentiment: ${sentimentScores.onchain.toFixed(1)}/100
Whale Activity: ${whaleActivity.largeTransactions} large transactions, Net Flow: ${whaleActivity.netFlow}

Based on this data, predict whether the price will go UP, DOWN, or SIDEWAYS in the short term (next 24-48 hours).
Provide your confidence level (0-100) and key reasoning points.

Respond in JSON format:
{
  "prediction": "UP" | "DOWN" | "SIDEWAYS",
  "confidence": 0-100,
  "reasoning": ["reason 1", "reason 2", ...]
}`;

      let response: string | null = null;

      // Try Claude first
      if (this.claudeClient && (this.provider === 'CLAUDE' || this.provider === 'BOTH')) {
        const message = await this.claudeClient.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        });

        response = message.content[0].type === 'text' ? message.content[0].text : null;
      }
      // Fallback to OpenAI
      else if (this.openaiClient && (this.provider === 'OPENAI' || this.provider === 'BOTH')) {
        const completion = await this.openaiClient.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        });

        response = completion.choices[0].message.content;
      }

      if (response) {
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            prediction: parsed.prediction || 'SIDEWAYS',
            confidence: parsed.confidence || 0,
            reasoning: parsed.reasoning || [],
          };
        }
      }

      // Fallback
      return {
        prediction: 'SIDEWAYS',
        confidence: 0,
        reasoning: ['AI analysis unavailable'],
      };
    } catch (error) {
      Logger.error('AI prediction failed', error);
      return {
        prediction: 'SIDEWAYS',
        confidence: 0,
        reasoning: ['AI analysis failed'],
      };
    }
  }

  /**
   * Classify sentiment from votes
   */
  private classifySentiment(votes: any): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
    if (!votes) return 'NEUTRAL';

    const positive = votes.positive || 0;
    const negative = votes.negative || 0;
    const total = positive + negative;

    if (total === 0) return 'NEUTRAL';

    const ratio = positive / total;
    if (ratio > 0.6) return 'POSITIVE';
    if (ratio < 0.4) return 'NEGATIVE';
    return 'NEUTRAL';
  }

  /**
   * Get trending tokens
   */
  public async getTrendingTokens(): Promise<
    Array<{ symbol: string; address: string; trendingScore: number }>
  > {
    try {
      // Use CoinGecko or DexScreener trending API
      const response = await axios.get('https://api.coingecko.com/api/v3/search/trending', {
        timeout: 5000,
      });

      if (response.data && response.data.coins) {
        return response.data.coins.slice(0, 10).map((coin: any) => ({
          symbol: coin.item.symbol,
          address: coin.item.id,
          trendingScore: coin.item.market_cap_rank || 0,
        }));
      }

      return [];
    } catch (error) {
      Logger.error('Failed to get trending tokens', error);
      return [];
    }
  }
}

export default SentimentAnalyzer;
