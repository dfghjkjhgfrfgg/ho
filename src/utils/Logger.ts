import winston from 'winston';

/**
 * Singleton logger for the Kalshi trading bot
 */
export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor(logLevel: string = 'info') {
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              let msg = `${timestamp} [${level}]: ${message}`;
              if (Object.keys(meta).length > 0 && Object.keys(meta).filter(k => k !== 'timestamp').length > 0) {
                const cleanMeta = { ...meta };
                delete cleanMeta.timestamp;
                msg += ` ${JSON.stringify(cleanMeta)}`;
              }
              return msg;
            })
          )
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error'
        }),
        new winston.transports.File({
          filename: 'logs/combined.log'
        })
      ]
    });
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: any): void {
    if (error instanceof Error) {
      this.logger.error(message, {
        message: error.message,
        stack: error.stack
      });
    } else {
      this.logger.error(message, error);
    }
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  /**
   * Create logs directory if it doesn't exist
   */
  static ensureLogsDirectory(): void {
    const fs = require('fs');
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
    }
  }
}
