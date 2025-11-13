import {
  RSI,
  MACD,
  BollingerBands,
  EMA,
  SMA,
  FibonacciRetracement,
} from 'technical-indicators';
import { OHLCV, TechnicalIndicators, TradingSignal, SupportResistance } from '../types';
import Logger from '../utils/Logger';
import BigNumber from 'bignumber.js';

export class TechnicalAnalysis {
  /**
   * Calculate all technical indicators for a price series
   */
  public calculateIndicators(candles: OHLCV[]): TechnicalIndicators | null {
    try {
      if (candles.length < 200) {
        Logger.warn('Insufficient candle data for full analysis', {
          candleCount: candles.length,
        });
        return null;
      }

      const closes = candles.map((c) => c.close);
      const highs = candles.map((c) => c.high);
      const lows = candles.map((c) => c.low);
      const volumes = candles.map((c) => c.volume);

      // Calculate RSI (14 period)
      const rsiValues = RSI.calculate({ values: closes, period: 14 });
      const rsi = rsiValues[rsiValues.length - 1] || 50;

      // Calculate MACD (12, 26, 9)
      const macdValues = MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      const macdCurrent = macdValues[macdValues.length - 1] || { MACD: 0, signal: 0, histogram: 0 };

      // Calculate Bollinger Bands (20 period, 2 std dev)
      const bbValues = BollingerBands.calculate({
        values: closes,
        period: 20,
        stdDev: 2,
      });
      const bbCurrent = bbValues[bbValues.length - 1] || { upper: 0, middle: 0, lower: 0 };

      // Calculate EMAs
      const ema9Values = EMA.calculate({ values: closes, period: 9 });
      const ema21Values = EMA.calculate({ values: closes, period: 21 });
      const ema50Values = EMA.calculate({ values: closes, period: 50 });
      const ema200Values = EMA.calculate({ values: closes, period: 200 });

      const ema = {
        ema9: ema9Values[ema9Values.length - 1] || 0,
        ema21: ema21Values[ema21Values.length - 1] || 0,
        ema50: ema50Values[ema50Values.length - 1] || 0,
        ema200: ema200Values[ema200Values.length - 1] || 0,
      };

      // Calculate SMAs
      const sma9Values = SMA.calculate({ values: closes, period: 9 });
      const sma21Values = SMA.calculate({ values: closes, period: 21 });
      const sma50Values = SMA.calculate({ values: closes, period: 50 });
      const sma200Values = SMA.calculate({ values: closes, period: 200 });

      const sma = {
        sma9: sma9Values[sma9Values.length - 1] || 0,
        sma21: sma21Values[sma21Values.length - 1] || 0,
        sma50: sma50Values[sma50Values.length - 1] || 0,
        sma200: sma200Values[sma200Values.length - 1] || 0,
      };

      // Calculate volume metrics
      const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
      const currentVolume = volumes[volumes.length - 1];
      const volumeWeighted = this.calculateVWAP(candles);

      const indicators: TechnicalIndicators = {
        rsi,
        macd: {
          macd: macdCurrent.MACD,
          signal: macdCurrent.signal,
          histogram: macdCurrent.histogram,
        },
        bollingerBands: {
          upper: bbCurrent.upper,
          middle: bbCurrent.middle,
          lower: bbCurrent.lower,
        },
        ema,
        sma,
        volume: {
          current: currentVolume,
          average: avgVolume,
          volumeWeighted,
        },
      };

      return indicators;
    } catch (error) {
      Logger.error('Failed to calculate indicators', error);
      return null;
    }
  }

  /**
   * Calculate Volume Weighted Average Price (VWAP)
   */
  private calculateVWAP(candles: OHLCV[]): number {
    try {
      let cumulativeTPV = 0; // Typical Price * Volume
      let cumulativeVolume = 0;

      for (const candle of candles) {
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        cumulativeTPV += typicalPrice * candle.volume;
        cumulativeVolume += candle.volume;
      }

      return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
    } catch (error) {
      Logger.error('Failed to calculate VWAP', error);
      return 0;
    }
  }

  /**
   * Generate trading signal based on multiple indicators
   */
  public generateSignal(indicators: TechnicalIndicators, currentPrice: number): TradingSignal {
    const reasons: string[] = [];
    let bullishPoints = 0;
    let bearishPoints = 0;

    // RSI Analysis
    if (indicators.rsi < 30) {
      bullishPoints += 2;
      reasons.push(`RSI oversold (${indicators.rsi.toFixed(1)})`);
    } else if (indicators.rsi > 70) {
      bearishPoints += 2;
      reasons.push(`RSI overbought (${indicators.rsi.toFixed(1)})`);
    }

    // MACD Analysis
    if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) {
      bullishPoints += 2;
      reasons.push('MACD bullish crossover');
    } else if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) {
      bearishPoints += 2;
      reasons.push('MACD bearish crossover');
    }

    // Bollinger Bands Analysis
    if (currentPrice <= indicators.bollingerBands.lower) {
      bullishPoints += 1;
      reasons.push('Price at lower Bollinger Band');
    } else if (currentPrice >= indicators.bollingerBands.upper) {
      bearishPoints += 1;
      reasons.push('Price at upper Bollinger Band');
    }

    // EMA Crossover Analysis (Golden Cross / Death Cross)
    if (indicators.ema.ema9 > indicators.ema.ema21 && indicators.ema.ema21 > indicators.ema.ema50) {
      bullishPoints += 3;
      reasons.push('Bullish EMA alignment (Golden Cross pattern)');
    } else if (indicators.ema.ema9 < indicators.ema.ema21 && indicators.ema.ema21 < indicators.ema.ema50) {
      bearishPoints += 3;
      reasons.push('Bearish EMA alignment (Death Cross pattern)');
    }

    // Long-term trend (200 EMA)
    if (currentPrice > indicators.ema.ema200) {
      bullishPoints += 1;
      reasons.push('Price above 200 EMA (long-term uptrend)');
    } else {
      bearishPoints += 1;
      reasons.push('Price below 200 EMA (long-term downtrend)');
    }

    // Volume Analysis
    const volumeRatio = indicators.volume.current / indicators.volume.average;
    if (volumeRatio > 1.5) {
      if (bullishPoints > bearishPoints) {
        bullishPoints += 1;
        reasons.push(`High volume supporting uptrend (${volumeRatio.toFixed(1)}x avg)`);
      } else {
        bearishPoints += 1;
        reasons.push(`High volume supporting downtrend (${volumeRatio.toFixed(1)}x avg)`);
      }
    }

    // Determine action and confidence
    const totalPoints = bullishPoints + bearishPoints;
    const netPoints = bullishPoints - bearishPoints;

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;

    if (netPoints > 3) {
      action = 'BUY';
      confidence = Math.min((bullishPoints / totalPoints) * 100, 100);
    } else if (netPoints < -3) {
      action = 'SELL';
      confidence = Math.min((bearishPoints / totalPoints) * 100, 100);
    } else {
      action = 'HOLD';
      confidence = 50;
    }

    const strength = Math.min(Math.abs(netPoints), 10);

    const signal: TradingSignal = {
      action,
      confidence,
      strength,
      indicators,
      reasons,
      timestamp: Date.now(),
    };

    Logger.signal(action, {
      confidence: confidence.toFixed(1),
      strength,
      bullishPoints,
      bearishPoints,
      reasonCount: reasons.length,
    });

    return signal;
  }

  /**
   * Identify support and resistance levels
   */
  public findSupportResistance(candles: OHLCV[]): SupportResistance {
    try {
      const closes = candles.map((c) => c.close);
      const highs = candles.map((c) => c.high);
      const lows = candles.map((c) => c.low);

      // Find local maxima and minima
      const support: number[] = [];
      const resistance: number[] = [];

      // Simple peak/trough detection
      for (let i = 10; i < closes.length - 10; i++) {
        const isResistance = highs[i] === Math.max(...highs.slice(i - 10, i + 10));
        const isSupport = lows[i] === Math.min(...lows.slice(i - 10, i + 10));

        if (isResistance && !resistance.includes(highs[i])) {
          resistance.push(highs[i]);
        }
        if (isSupport && !support.includes(lows[i])) {
          support.push(lows[i]);
        }
      }

      // Sort and limit to top 5
      support.sort((a, b) => b - a).splice(5);
      resistance.sort((a, b) => a - b).splice(5);

      // Calculate Fibonacci retracement levels
      const highestHigh = Math.max(...highs);
      const lowestLow = Math.min(...lows);
      const diff = highestHigh - lowestLow;

      const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      const fibonacciLevels = fibLevels.map((level) => ({
        level,
        price: lowestLow + diff * (1 - level),
      }));

      return {
        support,
        resistance,
        fibonacciLevels,
      };
    } catch (error) {
      Logger.error('Failed to find support/resistance', error);
      return {
        support: [],
        resistance: [],
        fibonacciLevels: [],
      };
    }
  }

  /**
   * Check for trend reversal signals
   */
  public detectReversalSignals(candles: OHLCV[]): {
    isReversal: boolean;
    direction: 'BULLISH' | 'BEARISH' | 'NONE';
    confidence: number;
    patterns: string[];
  } {
    try {
      const patterns: string[] = [];
      let reversalScore = 0;
      let direction: 'BULLISH' | 'BEARISH' | 'NONE' = 'NONE';

      if (candles.length < 10) {
        return { isReversal: false, direction, confidence: 0, patterns };
      }

      const recent = candles.slice(-10);
      const closes = recent.map((c) => c.close);
      const highs = recent.map((c) => c.high);
      const lows = recent.map((c) => c.low);

      // Check for bullish reversal patterns
      // 1. Bullish Engulfing
      if (
        recent[8].close < recent[8].open &&
        recent[9].close > recent[9].open &&
        recent[9].close > recent[8].open &&
        recent[9].open < recent[8].close
      ) {
        patterns.push('Bullish Engulfing');
        reversalScore += 3;
        direction = 'BULLISH';
      }

      // 2. Hammer (at bottom)
      const lastCandle = recent[9];
      const body = Math.abs(lastCandle.close - lastCandle.open);
      const lowerShadow = Math.min(lastCandle.close, lastCandle.open) - lastCandle.low;
      const upperShadow = lastCandle.high - Math.max(lastCandle.close, lastCandle.open);

      if (lowerShadow > body * 2 && upperShadow < body * 0.5) {
        patterns.push('Hammer');
        reversalScore += 2;
        direction = 'BULLISH';
      }

      // Check for bearish reversal patterns
      // 1. Bearish Engulfing
      if (
        recent[8].close > recent[8].open &&
        recent[9].close < recent[9].open &&
        recent[9].close < recent[8].open &&
        recent[9].open > recent[8].close
      ) {
        patterns.push('Bearish Engulfing');
        reversalScore += 3;
        direction = 'BEARISH';
      }

      // 2. Shooting Star (at top)
      if (upperShadow > body * 2 && lowerShadow < body * 0.5) {
        patterns.push('Shooting Star');
        reversalScore += 2;
        direction = 'BEARISH';
      }

      // 3. Divergence detection (simplified)
      const priceDirection = closes[9] > closes[0] ? 'UP' : 'DOWN';
      const indicators = this.calculateIndicators(candles);

      if (indicators) {
        // RSI divergence
        if (priceDirection === 'UP' && indicators.rsi < 50) {
          patterns.push('Bearish RSI Divergence');
          reversalScore += 2;
          direction = 'BEARISH';
        } else if (priceDirection === 'DOWN' && indicators.rsi > 50) {
          patterns.push('Bullish RSI Divergence');
          reversalScore += 2;
          direction = 'BULLISH';
        }
      }

      const confidence = Math.min(reversalScore * 20, 100);
      const isReversal = reversalScore >= 3;

      return {
        isReversal,
        direction,
        confidence,
        patterns,
      };
    } catch (error) {
      Logger.error('Failed to detect reversal signals', error);
      return {
        isReversal: false,
        direction: 'NONE',
        confidence: 0,
        patterns: [],
      };
    }
  }

  /**
   * Calculate volatility (Average True Range)
   */
  public calculateVolatility(candles: OHLCV[], period: number = 14): number {
    try {
      if (candles.length < period + 1) {
        return 0;
      }

      let atr = 0;
      for (let i = candles.length - period; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;

        const tr = Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );

        atr += tr;
      }

      return atr / period;
    } catch (error) {
      Logger.error('Failed to calculate volatility', error);
      return 0;
    }
  }
}

export default TechnicalAnalysis;
