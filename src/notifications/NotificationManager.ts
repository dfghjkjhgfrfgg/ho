import { Telegraf } from 'telegraf';
import { Client, WebhookClient } from 'discord.js';
import Logger from '../utils/Logger';
import { Position, TradeResult, TradingSignal } from '../types';

export class NotificationManager {
  private telegramBot: Telegraf | null = null;
  private discordWebhook: WebhookClient | null = null;
  private telegramChatId: string | null = null;
  private enabled: { telegram: boolean; discord: boolean };

  constructor(config: {
    telegram: boolean;
    discord: boolean;
    telegramBotToken?: string;
    telegramChatId?: string;
    discordWebhook?: string;
  }) {
    this.enabled = {
      telegram: config.telegram,
      discord: config.discord,
    };

    // Initialize Telegram bot
    if (config.telegram && config.telegramBotToken && config.telegramChatId) {
      try {
        this.telegramBot = new Telegraf(config.telegramBotToken);
        this.telegramChatId = config.telegramChatId;
        Logger.info('Telegram bot initialized');
      } catch (error) {
        Logger.error('Failed to initialize Telegram bot', error);
      }
    }

    // Initialize Discord webhook
    if (config.discord && config.discordWebhook) {
      try {
        this.discordWebhook = new WebhookClient({ url: config.discordWebhook });
        Logger.info('Discord webhook initialized');
      } catch (error) {
        Logger.error('Failed to initialize Discord webhook', error);
      }
    }
  }

  /**
   * Send trade notification
   */
  public async notifyTrade(
    type: 'BUY' | 'SELL',
    tokenSymbol: string,
    amount: number,
    price: number,
    result: TradeResult
  ): Promise<void> {
    const emoji = type === 'BUY' ? '🟢' : '🔴';
    const value = amount * price;

    const message = `${emoji} **${type} ${tokenSymbol}**

Amount: ${amount.toFixed(4)}
Price: $${price.toFixed(6)}
Value: $${value.toFixed(2)}
${result.success ? `✅ Success` : `❌ Failed: ${result.error}`}
${result.txSignature ? `TX: ${result.txSignature.slice(0, 20)}...` : ''}`;

    await this.send(message);
  }

  /**
   * Send trading signal notification
   */
  public async notifySignal(tokenSymbol: string, signal: TradingSignal): Promise<void> {
    const emoji =
      signal.action === 'BUY' ? '📈' : signal.action === 'SELL' ? '📉' : '⏸️';

    const message = `${emoji} **Trading Signal: ${tokenSymbol}**

Action: ${signal.action}
Confidence: ${signal.confidence.toFixed(1)}%
Strength: ${signal.strength}/10

Key Indicators:
• RSI: ${signal.indicators.rsi.toFixed(1)}
• MACD: ${signal.indicators.macd.histogram > 0 ? 'Bullish' : 'Bearish'}
• BB Position: ${this.getBBPosition(signal.indicators)}

Reasons:
${signal.reasons.map((r) => `• ${r}`).join('\n')}`;

    await this.send(message);
  }

  /**
   * Send position update
   */
  public async notifyPositionUpdate(
    action: 'OPENED' | 'CLOSED' | 'STOP_LOSS' | 'TAKE_PROFIT',
    position: Position
  ): Promise<void> {
    let emoji = '';
    let title = '';

    switch (action) {
      case 'OPENED':
        emoji = '🆕';
        title = 'Position Opened';
        break;
      case 'CLOSED':
        emoji = position.pnl >= 0 ? '✅' : '❌';
        title = 'Position Closed';
        break;
      case 'STOP_LOSS':
        emoji = '🛑';
        title = 'Stop Loss Triggered';
        break;
      case 'TAKE_PROFIT':
        emoji = '🎯';
        title = 'Take Profit Reached';
        break;
    }

    const message = `${emoji} **${title}: ${position.tokenSymbol}**

Entry: $${position.entryPrice.toFixed(6)}
Current: $${position.currentPrice.toFixed(6)}
Amount: ${position.amount.toFixed(4)}

${
  action !== 'OPENED'
    ? `P&L: ${position.pnl >= 0 ? '+' : ''}$${position.pnl.toFixed(2)} (${position.pnlPercent >= 0 ? '+' : ''}${position.pnlPercent.toFixed(2)}%)`
    : `Stop Loss: $${position.stopLoss.toFixed(6)}
Take Profit: $${position.takeProfit.toFixed(6)}`
}`;

    await this.send(message);
  }

  /**
   * Send security alert
   */
  public async notifySecurityAlert(
    tokenSymbol: string,
    tokenAddress: string,
    warnings: string[]
  ): Promise<void> {
    const message = `⚠️ **Security Alert: ${tokenSymbol}**

Token: ${tokenAddress}

Warnings:
${warnings.map((w) => `${w}`).join('\n')}

❌ Trade blocked for safety!`;

    await this.send(message, true); // Priority message
  }

  /**
   * Send daily summary
   */
  public async notifyDailySummary(data: {
    trades: number;
    wins: number;
    losses: number;
    pnl: number;
    winRate: number;
  }): Promise<void> {
    const emoji = data.pnl >= 0 ? '📊' : '📉';

    const message = `${emoji} **Daily Summary**

Trades: ${data.trades}
Wins: ${data.wins} | Losses: ${data.losses}
Win Rate: ${data.winRate.toFixed(1)}%

P&L: ${data.pnl >= 0 ? '+' : ''}$${data.pnl.toFixed(2)}

${data.pnl >= 0 ? '✨ Great trading day!' : '💪 Tomorrow is a new opportunity!'}`;

    await this.send(message);
  }

  /**
   * Send error notification
   */
  public async notifyError(error: string, details?: any): Promise<void> {
    const message = `🚨 **Error Alert**

${error}

${details ? `Details: ${JSON.stringify(details, null, 2)}` : ''}

Please check the logs for more information.`;

    await this.send(message, true);
  }

  /**
   * Send bot status
   */
  public async notifyStatus(
    status: 'STARTED' | 'STOPPED' | 'ERROR',
    message?: string
  ): Promise<void> {
    const emoji = status === 'STARTED' ? '🟢' : status === 'STOPPED' ? '🔴' : '⚠️';

    const msg = `${emoji} **Bot ${status}**

${message || ''}
Time: ${new Date().toLocaleString()}`;

    await this.send(msg, true);
  }

  /**
   * Send generic message
   */
  private async send(message: string, priority: boolean = false): Promise<void> {
    try {
      // Send to Telegram
      if (this.enabled.telegram && this.telegramBot && this.telegramChatId) {
        await this.telegramBot.telegram
          .sendMessage(this.telegramChatId, message, {
            parse_mode: 'Markdown',
          })
          .catch((error) => {
            Logger.error('Failed to send Telegram message', error);
          });
      }

      // Send to Discord
      if (this.enabled.discord && this.discordWebhook) {
        await this.discordWebhook
          .send({
            content: message,
            username: 'Crypto Trading Bot',
          })
          .catch((error) => {
            Logger.error('Failed to send Discord message', error);
          });
      }
    } catch (error) {
      Logger.error('Failed to send notification', error);
    }
  }

  /**
   * Get Bollinger Band position description
   */
  private getBBPosition(indicators: any): string {
    const { current } = indicators.volume;
    const { upper, middle, lower } = indicators.bollingerBands;

    // Assuming current price is passed separately
    // This is a simplified version
    return 'Middle';
  }

  /**
   * Test notifications
   */
  public async testNotifications(): Promise<void> {
    await this.send('🧪 **Test Notification**\n\nIf you see this, notifications are working correctly!');
  }
}

export default NotificationManager;
