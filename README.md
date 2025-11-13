# Kalshi Game Contract Trading Bot

**Mathematical Prediction Market Trading - Buy Low, Sell High**

A sophisticated trading bot for Kalshi prediction markets that uses mathematical analysis, game theory, and value betting principles to identify and execute profitable trades on sports and game contracts.

## Overview

This bot continuously monitors Kalshi prediction markets to find mispriced contracts using:
- **Mathematical pricing models** - Implied probabilities, expected value calculations
- **Kelly Criterion** - Optimal position sizing based on edge and bankroll
- **Value betting** - Identifying contracts where market price differs from fair value
- **Risk management** - Portfolio limits, exposure controls, and automatic exits
- **Game data analysis** - Sports-specific models and statistical analysis

## How It Works

### The Math Behind Prediction Markets

The bot identifies opportunities where the market price doesn't reflect the true probability:

```
Edge = Fair Probability - Implied Probability (from price)
Expected Value = (Win Probability × Profit) - (Loss Probability × Loss)
Kelly Fraction = (Edge × Odds) / Odds
Position Size = Bankroll × Kelly Fraction × Safety Factor
```

**Strategy:**
1. Scan Kalshi markets for sports/game contracts
2. Calculate fair value using multiple pricing models
3. Identify contracts with positive edge (> 5%)
4. Size positions using fractional Kelly Criterion
5. Execute trades when risk/reward is favorable
6. Manage positions and take profits/cut losses

**Key Formulas:**
- **Implied Probability**: `price / 100` (Kalshi prices are 0-100 cents)
- **Expected Value**: `(win_prob × payout) - (loss_prob × cost) / cost`
- **Edge**: `fair_probability - market_probability`
- **Kelly Sizing**: `(bp - q) / b` where b = net odds, p = win prob, q = loss prob

## Features

### Core Functionality
- Real-time market monitoring via Kalshi API
- Multi-model fair value calculation
- Automated opportunity detection and execution
- Position tracking and management
- Portfolio risk management
- Arbitrage detection (rare but risk-free when YES + NO < 100)

### Mathematical Models
- **Market efficiency model** - Uses current prices as baseline
- **Volume-weighted model** - Higher volume = more efficient pricing
- **Spread adjustment** - Wide spreads indicate uncertainty
- **Time decay** - Markets near expiration are more efficient
- **Sports-specific models** - Home field advantage, favorite/underdog bias
- **Weighted ensemble** - Combines models for final fair value

### Risk Management
- Kelly Criterion position sizing with fractional Kelly for safety
- Maximum position size limits (per trade)
- Maximum total exposure limits (across portfolio)
- Category concentration limits (max 50% in one category)
- Confidence-based sizing adjustments
- Time-to-expiration adjustments
- Automatic profit taking and loss cutting

### Safety Features
- Dry-run mode for paper trading
- Pre-trade risk validation
- Emergency stop functionality
- Comprehensive logging
- Portfolio health monitoring
- Error handling and recovery

## Installation

### Prerequisites
- Node.js v18 or higher
- Kalshi account (sign up at https://kalshi.com)
- API credentials from Kalshi
- Funds in your Kalshi account (for live trading)

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd kalshi-game-trading-bot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
```

4. Edit `.env` with your settings:
```bash
# Kalshi API Configuration
KALSHI_EMAIL=your.email@example.com
KALSHI_PASSWORD=your_password_here
KALSHI_API_URL=https://demo.kalshi.com/trade-api/v2

# Trading Parameters
MIN_EDGE=0.05                    # Minimum 5% edge required
MAX_POSITION_SIZE=100            # Max $100 per position
MAX_TOTAL_EXPOSURE=500           # Max $500 total exposure
KELLY_FRACTION=0.25              # Quarter Kelly for safety

# Market Categories
CATEGORIES=sports,nfl,nba,mlb

# Execution
DRY_RUN=true                     # Start in paper trading mode
SCAN_INTERVAL_MS=30000           # Scan every 30 seconds
```

5. Build the project:
```bash
npm run build
```

## Usage

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### First Steps
1. **Always start in DRY_RUN mode** to test without risking real money
2. **Use the demo API** first (`https://demo.kalshi.com/trade-api/v2`)
3. **Start with small limits** (MAX_POSITION_SIZE=10, MAX_TOTAL_EXPOSURE=50)
4. **Monitor the logs** to understand how the bot identifies opportunities
5. **Only go live** after you're comfortable with the bot's behavior

## Configuration

### Trading Parameters

| Parameter | Description | Default | Recommended Range |
|-----------|-------------|---------|-------------------|
| `MIN_EDGE` | Minimum edge to trade | 0.05 (5%) | 0.03 - 0.10 |
| `MAX_POSITION_SIZE` | Max $ per position | 100 | 10 - 500 |
| `MAX_TOTAL_EXPOSURE` | Max total $ exposure | 500 | 100 - 5000 |
| `KELLY_FRACTION` | Kelly safety factor | 0.25 | 0.1 - 0.5 |
| `SCAN_INTERVAL_MS` | Time between scans | 30000ms | 10000 - 60000 |

### Category Selection

Focus on specific market categories:
- `sports` - All sports markets
- `nfl, nba, mlb, nhl` - Specific leagues
- `soccer, tennis, golf` - Other sports
- `politics` - Political outcomes
- `weather` - Weather forecasts
- `economics` - Economic indicators

## Project Structure

```
kalshi-game-trading-bot/
├── src/
│   ├── api/
│   │   └── KalshiClient.ts           # Kalshi API client
│   ├── bot/
│   │   └── KalshiTradingBot.ts       # Main bot orchestrator
│   ├── types/
│   │   └── KalshiTypes.ts            # TypeScript types
│   ├── analysis/
│   │   └── MarketAnalyzer.ts         # Fair value calculation
│   ├── execution/
│   │   └── TradeExecutor.ts          # Trade execution
│   ├── math/
│   │   └── BettingMath.ts            # Mathematical models
│   ├── risk/
│   │   └── RiskManager.ts            # Risk management
│   ├── strategy/
│   │   └── OpportunityDetector.ts    # Opportunity detection
│   ├── utils/
│   │   ├── Config.ts                  # Configuration loader
│   │   └── Logger.ts                  # Logging system
│   └── index.ts                       # Entry point
├── logs/                              # Log files (auto-generated)
├── .env.example                       # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## How the Bot Identifies Opportunities

### 1. Market Scanning
- Fetches all open markets in specified categories
- Filters for adequate liquidity (tight spreads, volume)

### 2. Fair Value Calculation
Uses multiple models to estimate true probability:
- **Market price** (30% weight) - Current market consensus
- **Volume-weighted** (20% weight) - Adjusted for trading activity
- **Spread-adjusted** (15% weight) - Accounts for uncertainty
- **Time-adjusted** (15% weight) - Nearer events more reliable
- **Category-specific** (20% weight) - Sports/weather/politics models

### 3. Edge Detection
Compares fair value to market price:
```
If fair value = 60% and market ask = 50¢:
  Edge = 60% - 50% = 10% edge
  EV = (0.6 × $0.50) - (0.4 × $0.50) / $0.50 = 20% return

If edge > MIN_EDGE (5%): ✓ Opportunity found
```

### 4. Position Sizing
Uses Kelly Criterion for optimal size:
```
Full Kelly = (edge × decimal_odds) / decimal_odds
Fractional Kelly = Full Kelly × KELLY_FRACTION (0.25)
Contracts = (Bankroll × Fractional Kelly) / Price
```

### 5. Risk Validation
- Check sufficient balance
- Check total exposure limit
- Check position size limit
- Check category concentration
- Adjust for confidence and time to expiration

### 6. Execution
- Place limit order at current ask/bid
- Monitor for fill
- Track position for exit opportunities

## Example Output

```
============================================================
KALSHI PREDICTION MARKET TRADING BOT
Mathematical Trading - Buy Low, Sell High
============================================================

🔶 DRY RUN MODE - No real trades will be executed

Starting Kalshi Trading Bot...
Portfolio Summary:
  Balance: $1,000.00
  Positions: 0
  Exposure: $0.00
  P&L: $0.00

Scanning every 30 seconds

============================================================
Starting market scan...
Found 47 open markets

Found 3 opportunities in target categories

Top Opportunities:
------------------------------------------------------------
1. Will the Lakers win vs Warriors?
   BUY YES: Fair value 65.0% vs market 52¢. Edge: 13.0%, EV: 25.0%. Models: Market Price (52%), Sports Model (68%)
   Action: BUY 15 contracts @ 52¢
   Total cost: $7.80

2. Will it snow in NYC tomorrow?
   BUY NO: Fair value 75.0% vs market 68¢. Edge: 7.0%, EV: 10.3%. Models: Weather Model (78%), Market Price (68%)
   Action: BUY 10 contracts @ 68¢
   Total cost: $6.80

Executing trade:
  BUY 15 x LAKERS-WIN yes

[DRY RUN] Would buy 15 contracts of LAKERS-WIN yes @ 52¢
[DRY RUN] Total cost: $7.80
[DRY RUN] Expected value: 25.0%
✓ Trade executed successfully!
```

## Monitoring

### Logs
The bot maintains detailed logs in the `logs/` directory:
- `combined.log` - All log messages
- `error.log` - Errors only

### Key Metrics to Watch
1. **Edge** - Higher is better (aim for > 5%)
2. **Expected Value** - Return per dollar (aim for > 10%)
3. **Win Rate** - Track actual vs expected (should converge over time)
4. **Portfolio Exposure** - Stay within limits
5. **P&L** - Track realized and unrealized gains/losses

## Risks & Disclaimers

### Trading Risks
- **Market risk**: Probabilities can change rapidly
- **Execution risk**: Orders may not fill at desired prices
- **Model risk**: Fair value estimates can be wrong
- **Liquidity risk**: Spreads can widen, reducing profitability
- **API risk**: Connectivity issues can prevent trading
- **Bankruptcy risk**: You can lose your entire trading capital

### Important Notes
- This bot is for educational purposes
- Past performance doesn't guarantee future results
- Prediction markets involve substantial risk
- Only trade with money you can afford to lose
- Test thoroughly in demo mode before going live
- Monitor positions regularly
- Understand the mathematics before using

## Safety & Best Practices

1. **Always test in dry-run mode first**
2. **Start with the demo API** to learn without risk
3. **Begin with small position sizes** ($10-50)
4. **Set conservative limits** - protect your bankroll
5. **Monitor the bot actively** - don't set and forget
6. **Review trades daily** - learn from successes and failures
7. **Keep API keys secure** - never commit them
8. **Use fractional Kelly** - full Kelly is too aggressive
9. **Diversify across categories** - don't overconcentrate
10. **Take breaks** - markets will always be there

## Advanced Features

### Arbitrage Detection
The bot automatically detects rare arbitrage opportunities where:
```
YES ask + NO ask < 100¢
Example: YES @ 48¢, NO @ 49¢ = 97¢ total cost, 100¢ payout = 3¢ guaranteed profit
```

### Position Management
- **Profit taking**: Automatically exits at 50%+ gains
- **Loss cutting**: Exits at 30%+ losses
- **Time decay**: Reduces position size near expiration
- **Emergency exits**: Urgent exits for approaching expiration

### Correlation Analysis
Avoids overexposure by:
- Limiting positions in same event (max 1 side per market)
- Reducing size for correlated markets
- Capping category exposure (max 50% per category)

## Troubleshooting

### No opportunities found
- Markets may be efficiently priced
- Try lowering `MIN_EDGE` slightly (3-4%)
- Expand `CATEGORIES` to more markets
- Check that markets are open and have volume

### Trades not executing
- Ensure `DRY_RUN=false` for live trading
- Verify sufficient account balance
- Check API credentials are correct
- Ensure within exposure limits

### API errors
- Check Kalshi API status
- Verify credentials haven't expired
- Ensure API URL is correct (demo vs production)
- Check rate limits (bot includes rate limiting)

## Future Enhancements

Potential improvements:
- Machine learning models for fair value
- Historical backtesting framework
- Multi-leg strategies (parlays, hedging)
- Real-time data feeds (sports scores, weather)
- Telegram/Discord alerts
- Web dashboard for monitoring
- Advanced correlation modeling
- Market maker strategies

## Disclaimer

**USE AT YOUR OWN RISK**

This bot is provided for educational purposes. Trading prediction markets involves substantial risk of loss. The authors are not responsible for any financial losses incurred through use of this software.

- Not financial advice
- No guarantees of profit
- You can lose money
- Markets can be unpredictable
- Models can be wrong
- Test thoroughly before live trading

By using this software, you acknowledge that you understand the risks involved and accept full responsibility for your trading decisions.

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
1. Check the logs first (`logs/combined.log`)
2. Review configuration settings in `.env`
3. Ensure API credentials are valid
4. Test in demo mode first

---

**Remember: This bot uses MATHEMATICS to find value, not speculation. But even mathematical models can fail in real-world conditions. Trade responsibly and never risk more than you can afford to lose.**
