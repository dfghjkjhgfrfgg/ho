import { Pool } from 'pg';
import { TradeRecord, PerformanceMetrics, Position } from '../types';
import Logger from '../utils/Logger';
import path from 'path';

export class DatabaseManager {
  private pool: Pool | null = null;
  private type: 'POSTGRESQL' | 'SQLITE';
  private enabled: boolean;

  constructor(
    enabled: boolean,
    type: 'POSTGRESQL' | 'SQLITE',
    connectionString?: string
  ) {
    this.enabled = enabled;
    this.type = type;

    if (enabled && type === 'POSTGRESQL' && connectionString) {
      this.pool = new Pool({ connectionString });
      Logger.info('Database connection initialized (PostgreSQL)');
    } else if (enabled && type === 'SQLITE') {
      // For SQLite, you would use better-sqlite3 or similar
      Logger.info('Database connection initialized (SQLite)');
    }
  }

  /**
   * Initialize database schema
   */
  public async initialize(): Promise<void> {
    if (!this.enabled || !this.pool) return;

    try {
      // Create trades table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS trades (
          id VARCHAR(36) PRIMARY KEY,
          token_address VARCHAR(44) NOT NULL,
          token_symbol VARCHAR(20) NOT NULL,
          type VARCHAR(4) NOT NULL,
          amount DECIMAL(20, 8) NOT NULL,
          price DECIMAL(20, 8) NOT NULL,
          value DECIMAL(20, 2) NOT NULL,
          fees DECIMAL(20, 8) NOT NULL,
          slippage DECIMAL(5, 2) NOT NULL,
          tx_signature VARCHAR(88) NOT NULL,
          strategy VARCHAR(50) NOT NULL,
          confidence DECIMAL(5, 2) NOT NULL,
          pnl DECIMAL(20, 2),
          timestamp BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create positions table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS positions (
          id VARCHAR(36) PRIMARY KEY,
          token_address VARCHAR(44) NOT NULL,
          token_symbol VARCHAR(20) NOT NULL,
          entry_price DECIMAL(20, 8) NOT NULL,
          current_price DECIMAL(20, 8) NOT NULL,
          amount DECIMAL(20, 8) NOT NULL,
          value DECIMAL(20, 2) NOT NULL,
          pnl DECIMAL(20, 2) NOT NULL,
          pnl_percent DECIMAL(10, 4) NOT NULL,
          stop_loss DECIMAL(20, 8) NOT NULL,
          take_profit DECIMAL(20, 8) NOT NULL,
          trailing_stop DECIMAL(20, 8) NOT NULL,
          opened_at BIGINT NOT NULL,
          closed_at BIGINT,
          status VARCHAR(10) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create performance_metrics table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL,
          total_trades INTEGER NOT NULL,
          winning_trades INTEGER NOT NULL,
          losing_trades INTEGER NOT NULL,
          win_rate DECIMAL(5, 2) NOT NULL,
          total_pnl DECIMAL(20, 2) NOT NULL,
          total_pnl_percent DECIMAL(10, 4) NOT NULL,
          avg_win DECIMAL(20, 2) NOT NULL,
          avg_loss DECIMAL(20, 2) NOT NULL,
          profit_factor DECIMAL(10, 4) NOT NULL,
          max_drawdown DECIMAL(10, 4) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date)
        );
      `);

      // Create indexes
      await this.pool.query(
        'CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);'
      );
      await this.pool.query(
        'CREATE INDEX IF NOT EXISTS idx_trades_token ON trades(token_address);'
      );
      await this.pool.query(
        'CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);'
      );

      Logger.info('Database schema initialized');
    } catch (error) {
      Logger.error('Failed to initialize database', error);
      throw error;
    }
  }

  /**
   * Save trade record
   */
  public async saveTrade(trade: TradeRecord): Promise<void> {
    if (!this.enabled || !this.pool) return;

    try {
      await this.pool.query(
        `INSERT INTO trades (
          id, token_address, token_symbol, type, amount, price, value,
          fees, slippage, tx_signature, strategy, confidence, pnl, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          trade.id,
          trade.tokenAddress,
          trade.tokenSymbol,
          trade.type,
          trade.amount,
          trade.price,
          trade.value,
          trade.fees,
          trade.slippage,
          trade.txSignature,
          trade.strategy,
          trade.confidence,
          trade.pnl || null,
          trade.timestamp,
        ]
      );

      Logger.info('Trade saved to database', { id: trade.id });
    } catch (error) {
      Logger.error('Failed to save trade', error);
    }
  }

  /**
   * Update trade with P&L
   */
  public async updateTradePnL(tradeId: string, pnl: number): Promise<void> {
    if (!this.enabled || !this.pool) return;

    try {
      await this.pool.query('UPDATE trades SET pnl = $1 WHERE id = $2', [pnl, tradeId]);

      Logger.debug('Trade P&L updated', { id: tradeId, pnl });
    } catch (error) {
      Logger.error('Failed to update trade P&L', error);
    }
  }

  /**
   * Save position
   */
  public async savePosition(position: Position): Promise<void> {
    if (!this.enabled || !this.pool) return;

    try {
      await this.pool.query(
        `INSERT INTO positions (
          id, token_address, token_symbol, entry_price, current_price,
          amount, value, pnl, pnl_percent, stop_loss, take_profit,
          trailing_stop, opened_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          current_price = $5,
          value = $7,
          pnl = $8,
          pnl_percent = $9,
          trailing_stop = $12,
          status = $14,
          updated_at = CURRENT_TIMESTAMP`,
        [
          position.id,
          position.tokenAddress,
          position.tokenSymbol,
          position.entryPrice,
          position.currentPrice,
          position.amount,
          position.value,
          position.pnl,
          position.pnlPercent,
          position.stopLoss,
          position.takeProfit,
          position.trailingStop,
          position.openedAt,
          position.status,
        ]
      );

      Logger.debug('Position saved', { id: position.id });
    } catch (error) {
      Logger.error('Failed to save position', error);
    }
  }

  /**
   * Get all trades
   */
  public async getTrades(limit: number = 100): Promise<TradeRecord[]> {
    if (!this.enabled || !this.pool) return [];

    try {
      const result = await this.pool.query(
        'SELECT * FROM trades ORDER BY timestamp DESC LIMIT $1',
        [limit]
      );

      return result.rows.map(this.mapTradeRow);
    } catch (error) {
      Logger.error('Failed to get trades', error);
      return [];
    }
  }

  /**
   * Get trades by date range
   */
  public async getTradesByDateRange(
    startDate: number,
    endDate: number
  ): Promise<TradeRecord[]> {
    if (!this.enabled || !this.pool) return [];

    try {
      const result = await this.pool.query(
        'SELECT * FROM trades WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp ASC',
        [startDate, endDate]
      );

      return result.rows.map(this.mapTradeRow);
    } catch (error) {
      Logger.error('Failed to get trades by date range', error);
      return [];
    }
  }

  /**
   * Calculate performance metrics
   */
  public async calculatePerformanceMetrics(): Promise<PerformanceMetrics> {
    if (!this.enabled || !this.pool) {
      return this.getEmptyMetrics();
    }

    try {
      const result = await this.pool.query(`
        SELECT
          COUNT(*) as total_trades,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
          SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
          SUM(pnl) as total_pnl,
          AVG(CASE WHEN pnl > 0 THEN pnl ELSE NULL END) as avg_win,
          AVG(CASE WHEN pnl < 0 THEN pnl ELSE NULL END) as avg_loss
        FROM trades
        WHERE pnl IS NOT NULL
      `);

      const row = result.rows[0];
      const totalTrades = parseInt(row.total_trades) || 0;
      const winningTrades = parseInt(row.winning_trades) || 0;
      const losingTrades = parseInt(row.losing_trades) || 0;
      const totalPnL = parseFloat(row.total_pnl) || 0;
      const avgWin = parseFloat(row.avg_win) || 0;
      const avgLoss = parseFloat(row.avg_loss) || 0;

      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

      return {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        totalPnL,
        totalPnLPercent: 0, // Would need initial capital to calculate
        avgWin,
        avgLoss: Math.abs(avgLoss),
        profitFactor,
        sharpeRatio: 0, // Complex calculation
        maxDrawdown: 0, // Complex calculation
        dailyPnL: 0,
        weeklyPnL: 0,
        monthlyPnL: 0,
      };
    } catch (error) {
      Logger.error('Failed to calculate performance metrics', error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * Map database row to TradeRecord
   */
  private mapTradeRow(row: any): TradeRecord {
    return {
      id: row.id,
      tokenAddress: row.token_address,
      tokenSymbol: row.token_symbol,
      type: row.type,
      amount: parseFloat(row.amount),
      price: parseFloat(row.price),
      value: parseFloat(row.value),
      fees: parseFloat(row.fees),
      slippage: parseFloat(row.slippage),
      txSignature: row.tx_signature,
      strategy: row.strategy,
      confidence: parseFloat(row.confidence),
      pnl: row.pnl ? parseFloat(row.pnl) : undefined,
      timestamp: parseInt(row.timestamp),
    };
  }

  /**
   * Get empty metrics
   */
  private getEmptyMetrics(): PerformanceMetrics {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnL: 0,
      totalPnLPercent: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      dailyPnL: 0,
      weeklyPnL: 0,
      monthlyPnL: 0,
    };
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      Logger.info('Database connection closed');
    }
  }
}

export default DatabaseManager;
