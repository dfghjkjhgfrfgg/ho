import winston from 'winston';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for readable output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create winston logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // File transport for errors only
    new winston.transports.File({
      filename: path.join(logDir, 'errors.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
    }),
    // File transport for trades
    new winston.transports.File({
      filename: path.join(logDir, 'trades.log'),
      level: 'info',
      maxsize: 10485760,
      maxFiles: 10,
    }),
  ],
});

// Create specialized loggers
export class Logger {
  static info(message: string, meta?: any): void {
    logger.info(message, meta);
  }

  static warn(message: string, meta?: any): void {
    logger.warn(message, meta);
  }

  static error(message: string, error?: Error | any, meta?: any): void {
    logger.error(message, {
      error: error?.message || error,
      stack: error?.stack,
      ...meta,
    });
  }

  static debug(message: string, meta?: any): void {
    logger.debug(message, meta);
  }

  static trade(action: string, data: any): void {
    logger.info(`[TRADE] ${action}`, {
      type: 'TRADE',
      action,
      ...data,
    });
  }

  static signal(signal: string, data: any): void {
    logger.info(`[SIGNAL] ${signal}`, {
      type: 'SIGNAL',
      signal,
      ...data,
    });
  }

  static security(message: string, data: any): void {
    logger.warn(`[SECURITY] ${message}`, {
      type: 'SECURITY',
      ...data,
    });
  }

  static ai(message: string, data: any): void {
    logger.info(`[AI] ${message}`, {
      type: 'AI',
      ...data,
    });
  }

  static risk(message: string, data: any): void {
    logger.warn(`[RISK] ${message}`, {
      type: 'RISK',
      ...data,
    });
  }

  static performance(message: string, data: any): void {
    logger.info(`[PERFORMANCE] ${message}`, {
      type: 'PERFORMANCE',
      ...data,
    });
  }
}

export default Logger;
