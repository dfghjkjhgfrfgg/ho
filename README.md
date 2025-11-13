# 🚀 Solana Crypto Trading Bot

**Professional-Grade Automated Trading with AI, Mathematical Strategies, and Security Features**

A comprehensive cryptocurrency trading bot for the Solana blockchain featuring Phantom Wallet integration, Raydium DEX trading, AI-powered sentiment analysis, mathematical technical indicators, and robust risk management.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Web3.js-9945FF)](https://solana.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## ⚠️ CRITICAL DISCLAIMER

**THIS SOFTWARE IS PROVIDED FOR EDUCATIONAL PURPOSES ONLY**

- Cryptocurrency trading involves substantial risk of loss
- You can lose all your invested capital
- Past performance does not guarantee future results
- No warranties or guarantees are provided
- Use at your own risk - the authors are not responsible for any losses
- Always test thoroughly in PAPER mode before live trading
- Never invest more than you can afford to lose

## ✨ Features

### 🔐 Security Features
- **Honeypot Detection** - Identifies tokens that can't be sold
- **Rug Pull Protection** - Analyzes liquidity locks, LP burns, and mint authority
- **Contract Verification** - Checks for suspicious functions and ownership
- **Holder Analysis** - Detects dangerous concentration of token ownership
- **Security Scoring** - 0-100 safety score for each token

### 📊 Mathematical Trading Strategies
- **RSI (Relative Strength Index)** - Identify overbought/oversold conditions
- **MACD (Moving Average Convergence Divergence)** - Trend momentum analysis
- **Bollinger Bands** - Volatility and price range analysis
- **EMA/SMA Crossovers** - 9, 21, 50, 200 period moving averages
- **Volume Analysis** - Volume-weighted price analysis (VWAP)
- **Support/Resistance Levels** - Automated level detection
- **Fibonacci Retracement** - Key price level identification
- **Pattern Recognition** - Bullish/bearish reversal patterns

### 🤖 AI & Sentiment Analysis
- **Claude AI Integration** - Advanced natural language understanding
- **OpenAI GPT-4 Integration** - Market prediction and analysis
- **Twitter/X Sentiment** - Real-time social media sentiment tracking
- **News Analysis** - Automated crypto news sentiment analysis
- **On-chain Analytics** - Whale movement detection and analysis
- **Trending Token Detection** - Identify tokens gaining momentum

### ⚙️ Risk Management
- **Position Sizing** - Automatic calculation based on portfolio percentage
- **Stop Loss** - Configurable stop loss percentages
- **Take Profit** - Automatic profit taking at target levels
- **Trailing Stop** - Dynamic stop loss that follows price
- **Daily Loss Limits** - Circuit breaker for bad days
- **Risk/Reward Ratios** - Minimum 1:2 or 1:3 ratios enforced
- **Max Slippage Protection** - Reject trades with excessive slippage
- **Portfolio Diversification** - Limit exposure per token

### 📈 Data & Analysis
- **DexScreener Integration** - Real-time price and liquidity data
- **CoinGecko Integration** - Token information and trending data
- **Historical Data** - OHLCV candles for technical analysis
- **Multi-Timeframe Analysis** - 1m, 5m, 15m, 1h, 4h, 1D timeframes
- **Liquidity Depth Analysis** - Ensure sufficient liquidity before trading

### 🔔 Notifications
- **Telegram Bot** - Real-time trade alerts and updates
- **Discord Webhooks** - Notifications to Discord channels
- **Trade Alerts** - Buy/sell execution notifications
- **Signal Alerts** - Trading signals even when not executing
- **Security Warnings** - Immediate alerts for dangerous tokens
- **Daily Summaries** - Performance reports

### 💾 Data Storage
- **PostgreSQL Support** - Production-ready relational database
- **SQLite Support** - Lightweight local database
- **Trade History** - Complete record of all trades
- **Position Tracking** - Monitor open and closed positions
- **Performance Metrics** - Win rate, P&L, Sharpe ratio, drawdown

### 🎮 Trading Modes
- **LIVE** - Real trading with real money (use with caution!)
- **PAPER** - Simulated trading with virtual capital
- **BACKTEST** - Test strategies on historical data

### 🌐 Web Dashboard & API
- **RESTful API** - Control bot via HTTP endpoints
- **Real-time Status** - Monitor bot status and performance
- **Trade History** - View all past trades
- **Performance Charts** - Visualize equity curve and drawdowns
- **Configuration Management** - Update settings on the fly

## 📦 Installation

### Prerequisites

- **Node.js** v18 or higher
- **npm** or **yarn**
- **Solana Wallet** (Phantom or similar) for live trading
- **Database** (Optional: PostgreSQL or SQLite)

### Quick Start

1. **Clone the repository:**
```bash
git clone <repository-url>
cd solana-crypto-trading-bot
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
```

4. **Edit `.env` file:**
```bash
nano .env  # or your preferred editor
```

**Minimum configuration for PAPER mode:**
```env
BOT_MODE=PAPER
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
ENABLE_DATABASE=true
DATABASE_TYPE=SQLITE
```

5. **Build the project:**
```bash
npm run build
```

6. **Run in development mode:**
```bash
npm run dev
```

7. **Or run in production:**
```bash
npm start
```

## 🔧 Configuration

### Bot Mode

Set `BOT_MODE` in `.env`:

- **PAPER** (Recommended for testing) - Simulated trading with $10,000 virtual capital
- **LIVE** (Danger!) - Real trading with real money
- **BACKTEST** - Historical data testing

### Trading Strategies

Enable/disable strategies in `.env`:

```env
ENABLE_RSI_STRATEGY=true
ENABLE_MACD_STRATEGY=true
ENABLE_BB_STRATEGY=true
ENABLE_EMA_STRATEGY=true
ENABLE_VOLUME_ANALYSIS=true
ENABLE_AI_SENTIMENT=true
```

### Risk Management

Configure risk parameters:

```env
MAX_POSITION_SIZE=1000           # Maximum $1000 per trade
MAX_PORTFOLIO_PERCENT=10         # Max 10% of portfolio per trade
STOP_LOSS_PERCENT=5              # 5% stop loss
TAKE_PROFIT_PERCENT=10           # 10% take profit
TRAILING_STOP_PERCENT=3          # 3% trailing stop
MAX_SLIPPAGE=1                   # 1% max slippage
MAX_DAILY_LOSS=500               # Stop trading after $500 daily loss
MIN_RISK_REWARD_RATIO=2          # Minimum 1:2 risk/reward
MAX_OPEN_POSITIONS=5             # Maximum 5 concurrent positions
```

### AI Configuration

Set up Claude or OpenAI:

```env
AI_PROVIDER=CLAUDE               # Options: CLAUDE, OPENAI, BOTH
CLAUDE_API_KEY=sk-ant-...        # Get from console.anthropic.com
OPENAI_API_KEY=sk-...            # Get from platform.openai.com
ENABLE_AI_SENTIMENT=true
```

### Notifications

#### Telegram

1. Create a bot with [@BotFather](https://t.me/BotFather)
2. Get your chat ID from [@userinfobot](https://t.me/userinfobot)
3. Configure:

```env
ENABLE_TELEGRAM=true
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=123456789
```

#### Discord

1. Create a webhook in your Discord server
2. Configure:

```env
ENABLE_DISCORD=true
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
```

### Database

#### SQLite (Default - Easiest)

```env
ENABLE_DATABASE=true
DATABASE_TYPE=SQLITE
```

#### PostgreSQL (Production)

```env
ENABLE_DATABASE=true
DATABASE_TYPE=POSTGRESQL
DATABASE_URL=postgresql://user:password@localhost:5432/trading_bot
```

## 🎯 Usage

### Start the Bot

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

**With PM2 (recommended for production):**
```bash
npm install -g pm2
pm2 start npm --name "trading-bot" -- start
pm2 logs trading-bot
pm2 monit
```

### API Server

Start the API server for the web dashboard:

```bash
npm run api
```

API will be available at `http://localhost:3001`

### API Endpoints

- `GET /health` - Health check
- `GET /api/status` - Bot status
- `POST /api/start` - Start bot
- `POST /api/stop` - Stop bot
- `GET /api/trades` - Get trade history
- `GET /api/performance` - Get performance metrics
- `GET /api/config` - Get configuration

## 📊 Project Structure

```
solana-crypto-trading-bot/
├── src/
│   ├── ai/
│   │   └── SentimentAnalyzer.ts      # AI sentiment analysis
│   ├── api/
│   │   └── ApiServer.ts              # RESTful API server
│   ├── bot/
│   │   └── TradingBot.ts             # Main bot orchestrator
│   ├── config/
│   │   └── index.ts                  # Configuration management
│   ├── data/
│   │   └── DataFetcher.ts            # Market data fetching
│   ├── database/
│   │   └── DatabaseManager.ts        # Database operations
│   ├── exchange/
│   │   └── RaydiumExchange.ts        # Raydium DEX integration
│   ├── notifications/
│   │   └── NotificationManager.ts    # Telegram/Discord alerts
│   ├── risk/
│   │   └── RiskManager.ts            # Risk management
│   ├── security/
│   │   └── SecurityAnalyzer.ts       # Token security analysis
│   ├── strategies/
│   │   └── TechnicalAnalysis.ts      # Trading strategies
│   ├── types/
│   │   └── index.ts                  # TypeScript types
│   ├── utils/
│   │   └── Logger.ts                 # Logging system
│   ├── wallet/
│   │   └── WalletManager.ts          # Wallet integration
│   └── index.ts                      # Entry point
├── logs/                             # Log files (auto-created)
├── .env.example                      # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## 🔍 How It Works

### 1. Market Scanning

The bot continuously scans for trading opportunities:

1. Fetches list of tokens (trending, configured pairs, or new listings)
2. For each token, performs security analysis
3. Gets current price and liquidity data
4. Fetches historical OHLCV data

### 2. Security Analysis

Before considering any trade:

- Checks if token is a honeypot
- Verifies mint/freeze authority status
- Analyzes liquidity locks and burns
- Checks holder distribution
- Calculates security score (0-100)

Tokens with score < 50 or honeypot detection are automatically rejected.

### 3. Technical Analysis

Calculates multiple indicators:

- RSI (14 period)
- MACD (12, 26, 9)
- Bollinger Bands (20, 2)
- EMAs (9, 21, 50, 200)
- SMAs (9, 21, 50, 200)
- Volume metrics (VWAP)
- Support/Resistance levels
- Fibonacci retracements

### 4. Signal Generation

Combines indicators to generate trading signals:

- Bullish signals: RSI oversold, MACD bullish crossover, price at lower BB, golden cross
- Bearish signals: RSI overbought, MACD bearish crossover, price at upper BB, death cross
- Confidence score (0-100) based on indicator agreement

### 5. AI Sentiment (Optional)

If enabled, analyzes:

- Twitter/X mentions and sentiment
- News articles and sentiment
- On-chain whale movements
- AI prediction (UP/DOWN/SIDEWAYS)

### 6. Risk Management

Before executing:

- Checks if signal confidence > 70%
- Validates security score > 50
- Ensures sufficient liquidity
- Calculates position size based on portfolio
- Verifies risk/reward ratio > 2:1
- Checks daily loss limits
- Ensures max open positions not exceeded

### 7. Trade Execution

If all checks pass:

1. Calculates optimal position size
2. Executes swap on Raydium DEX
3. Opens position with stop loss and take profit
4. Saves to database
5. Sends notifications

### 8. Position Monitoring

Continuously monitors open positions:

- Updates current price every 5 seconds
- Adjusts trailing stops
- Checks stop loss / take profit levels
- Auto-closes positions when targets hit

## 📈 Performance Metrics

The bot tracks comprehensive metrics:

- **Total Trades** - Number of executed trades
- **Win Rate** - Percentage of profitable trades
- **Total P&L** - Total profit/loss in USD
- **Average Win** - Average profit per winning trade
- **Average Loss** - Average loss per losing trade
- **Profit Factor** - Gross profit / gross loss
- **Sharpe Ratio** - Risk-adjusted returns
- **Max Drawdown** - Largest peak-to-trough decline

## 🛡️ Safety Features

### Multiple Safety Layers

1. **Security Analysis** - Pre-trade token verification
2. **Risk Limits** - Position size and portfolio limits
3. **Stop Losses** - Automatic loss protection
4. **Daily Limits** - Circuit breaker for bad days
5. **Slippage Protection** - Reject trades with high slippage
6. **Paper Mode** - Test without risking real money

### Best Practices

1. ✅ **Start with PAPER mode** - Test for at least a week
2. ✅ **Use small position sizes** - Start with 1-2% of portfolio
3. ✅ **Enable all safety features** - Don't disable risk management
4. ✅ **Monitor regularly** - Check logs and performance daily
5. ✅ **Use premium RPC** - Helius, QuickNode, or Alchemy
6. ✅ **Keep credentials secure** - Never commit private keys
7. ✅ **Set realistic expectations** - No bot guarantees profit
8. ✅ **Understand the code** - Review before trusting with money

## ⚠️ Risks & Warnings

### Financial Risks

- **Market Risk** - Crypto markets are extremely volatile
- **Liquidation Risk** - Positions can be closed at a loss
- **Slippage Risk** - Execution price may differ from expected
- **Gas Fees** - Transaction costs reduce profitability
- **Smart Contract Risk** - DEX contracts could have vulnerabilities

### Technical Risks

- **API Failures** - Data sources or RPCs may go down
- **Network Issues** - Solana network can experience congestion
- **Bug Risk** - Software may contain bugs despite testing
- **False Signals** - Indicators can give wrong signals
- **AI Errors** - AI predictions are not always accurate

### Security Risks

- **Rug Pulls** - Even with checks, some scams may pass through
- **Sandwich Attacks** - MEV bots may front-run your trades
- **Wallet Compromise** - If private key is stolen, funds are lost

## 🐛 Troubleshooting

### Bot won't start

- Check `.env` configuration is correct
- Verify RPC endpoint is accessible
- Ensure Node.js version is 18+
- Check logs for error messages

### No trading signals

- Verify strategies are enabled in `.env`
- Check if market scan interval is too long
- Review security thresholds (may be too strict)
- Ensure sufficient liquidity in markets

### Trades failing

- Check wallet has sufficient SOL balance
- Verify slippage tolerance is not too low
- Ensure RPC endpoint has good connectivity
- Check Solana network status

### Database errors

- Verify DATABASE_URL is correct (PostgreSQL)
- Check database permissions
- Ensure database exists and is accessible

## 📚 Additional Resources

### Learning Resources

- [Solana Documentation](https://docs.solana.com/)
- [Raydium Documentation](https://docs.raydium.io/)
- [Technical Analysis Guide](https://www.investopedia.com/terms/t/technicalanalysis.asp)
- [Risk Management Principles](https://www.investopedia.com/terms/r/riskmanagement.asp)

### Solana RPC Providers

- [Helius](https://helius.dev/) - Premium RPC (recommended)
- [QuickNode](https://www.quicknode.com/) - High-performance RPC
- [Alchemy](https://www.alchemy.com/) - Developer-friendly RPC
- [GenesysGo](https://genesysgo.com/) - Reliable infrastructure

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 💬 Support

For questions and issues:

1. Check this README
2. Review the logs in `logs/` directory
3. Check `.env` configuration
4. Open an issue on GitHub

## ⭐ Acknowledgments

Built with:
- [@solana/web3.js](https://github.com/solana-labs/solana-web3.js) - Solana JavaScript API
- [@raydium-io/raydium-sdk](https://github.com/raydium-io/raydium-sdk) - Raydium DEX SDK
- [technical-indicators](https://github.com/anandanand84/technicalindicators) - Technical analysis library
- [Anthropic Claude](https://www.anthropic.com/) - AI sentiment analysis
- [OpenAI GPT-4](https://openai.com/) - AI predictions

---

## 🎯 Final Reminder

**This bot is a tool, not a money-printing machine.**

- Requires monitoring and adjustment
- Markets are unpredictable
- Past performance ≠ future results
- Only risk what you can afford to lose
- Test extensively before live trading
- Stay informed about market conditions
- Use responsibly

**Happy trading! 🚀**

---

*Made with ❤️ for the Solana community*
