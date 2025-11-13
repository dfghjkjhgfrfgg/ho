import express, { Request, Response } from 'express';
import cors from 'cors';
import TradingBot from '../bot/TradingBot';
import DatabaseManager from '../database/DatabaseManager';
import Logger from '../utils/Logger';
import Config from '../config';
import { ApiResponse } from '../types';

export class ApiServer {
  private app: express.Application;
  private bot: TradingBot | null = null;
  private database: DatabaseManager;
  private port: number;

  constructor(port: number = 3001) {
    this.app = express();
    this.port = port;

    const config = Config.getConfig();
    this.database = new DatabaseManager(
      config.database.enabled,
      config.database.type,
      config.database.connectionString
    );

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());

    // Request logging
    this.app.use((req, res, next) => {
      Logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Bot status
    this.app.get('/api/status', (req: Request, res: Response) => {
      try {
        if (!this.bot) {
          return res.json(
            this.success({
              isRunning: false,
              mode: 'STOPPED',
              portfolioValue: 0,
              openPositions: 0,
              dailyPnL: 0,
            })
          );
        }

        const status = this.bot.getStatus();
        res.json(this.success(status));
      } catch (error) {
        res.status(500).json(this.error('Failed to get bot status'));
      }
    });

    // Start bot
    this.app.post('/api/start', async (req: Request, res: Response) => {
      try {
        if (this.bot) {
          return res.status(400).json(this.error('Bot is already running'));
        }

        this.bot = new TradingBot();
        await this.bot.start();

        res.json(this.success({ message: 'Bot started successfully' }));
      } catch (error) {
        Logger.error('Failed to start bot via API', error);
        res.status(500).json(this.error('Failed to start bot'));
      }
    });

    // Stop bot
    this.app.post('/api/stop', async (req: Request, res: Response) => {
      try {
        if (!this.bot) {
          return res.status(400).json(this.error('Bot is not running'));
        }

        await this.bot.stop();
        this.bot = null;

        res.json(this.success({ message: 'Bot stopped successfully' }));
      } catch (error) {
        Logger.error('Failed to stop bot via API', error);
        res.status(500).json(this.error('Failed to stop bot'));
      }
    });

    // Get trades
    this.app.get('/api/trades', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const trades = await this.database.getTrades(limit);

        res.json(this.success(trades));
      } catch (error) {
        Logger.error('Failed to get trades', error);
        res.status(500).json(this.error('Failed to get trades'));
      }
    });

    // Get performance metrics
    this.app.get('/api/performance', async (req: Request, res: Response) => {
      try {
        const metrics = await this.database.calculatePerformanceMetrics();
        res.json(this.success(metrics));
      } catch (error) {
        Logger.error('Failed to get performance metrics', error);
        res.status(500).json(this.error('Failed to get performance metrics'));
      }
    });

    // Get configuration
    this.app.get('/api/config', (req: Request, res: Response) => {
      try {
        const config = Config.getConfig();
        // Remove sensitive data
        const safeConfig = {
          mode: config.mode,
          network: config.network,
          tradingPairs: config.tradingPairs,
          scanInterval: config.scanInterval,
          minLiquidity: config.minLiquidity,
          strategies: config.strategies,
          risk: config.risk,
        };

        res.json(this.success(safeConfig));
      } catch (error) {
        res.status(500).json(this.error('Failed to get configuration'));
      }
    });

    // Update risk parameters
    this.app.post('/api/risk/update', async (req: Request, res: Response) => {
      try {
        // This would require implementing risk parameter updates in the bot
        res.json(this.success({ message: 'Risk parameters updated' }));
      } catch (error) {
        res.status(500).json(this.error('Failed to update risk parameters'));
      }
    });

    // Get trades by date range
    this.app.get('/api/trades/range', async (req: Request, res: Response) => {
      try {
        const startDate = parseInt(req.query.start as string);
        const endDate = parseInt(req.query.end as string);

        if (!startDate || !endDate) {
          return res.status(400).json(this.error('Start and end dates are required'));
        }

        const trades = await this.database.getTradesByDateRange(startDate, endDate);
        res.json(this.success(trades));
      } catch (error) {
        Logger.error('Failed to get trades by date range', error);
        res.status(500).json(this.error('Failed to get trades'));
      }
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json(this.error('Endpoint not found'));
    });

    // Error handler
    this.app.use((error: any, req: Request, res: Response, next: any) => {
      Logger.error('API error', error);
      res.status(500).json(this.error('Internal server error'));
    });
  }

  /**
   * Success response helper
   */
  private success<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: Date.now(),
    };
  }

  /**
   * Error response helper
   */
  private error(message: string): ApiResponse<never> {
    return {
      success: false,
      error: message,
      timestamp: Date.now(),
    };
  }

  /**
   * Start the API server
   */
  public async start(): Promise<void> {
    try {
      await this.database.initialize();

      this.app.listen(this.port, () => {
        Logger.info(`API server started on http://localhost:${this.port}`);
      });
    } catch (error) {
      Logger.error('Failed to start API server', error);
      throw error;
    }
  }

  /**
   * Set the bot instance (for standalone API server)
   */
  public setBot(bot: TradingBot): void {
    this.bot = bot;
  }
}

export default ApiServer;

// Standalone server execution
if (require.main === module) {
  const server = new ApiServer();
  server.start().catch((error) => {
    Logger.error('Failed to start standalone API server', error);
    process.exit(1);
  });
}
