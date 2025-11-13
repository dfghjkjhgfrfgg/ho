# Kashi Arbitrage Trading Bot

**Mathematics-Based Trading - No Hope, Only Math**

A sophisticated arbitrage trading bot for Kashi lending markets that identifies and executes profitable opportunities using mathematical analysis rather than speculation.

## Overview

This bot continuously monitors Kashi lending pairs to find arbitrage opportunities by analyzing interest rate differentials. It uses pure mathematical calculations to:

- Calculate real-time supply and borrow APYs
- Detect profitable rate spreads between markets
- Compute optimal position sizes
- Estimate costs (gas, slippage)
- Assess risk factors
- Execute trades when profitable

## How It Works

### The Math Behind Arbitrage

The bot identifies opportunities where:

```
Profit = (SupplyAPY_MarketA - BorrowAPY_MarketB) × Amount × Time - Costs
```

**Strategy:**
1. Find two Kashi markets for the same asset
2. Supply to Market A (high supply APY)
3. Borrow from Market B (low borrow APY)
4. Profit from the interest rate differential

**Key Formulas:**
- **Utilization Rate**: `totalBorrow / totalAsset`
- **Supply APY**: `borrowAPY × utilization × (1 - protocolFee)`
- **Borrow APY**: `interestPerSecond × secondsPerYear`
- **Net Profit**: `grossProfit - gasCost - slippage`

## Features

### Core Functionality
- Real-time market data fetching from multiple Kashi pairs
- Mathematical opportunity detection (no speculation)
- Automatic trade execution
- Position monitoring and management
- Risk assessment and safety checks

### Risk Management
- Utilization limits (max 95%)
- Position concentration limits (max 20% of market)
- Liquidation risk monitoring (max 15%)
- Health factor tracking
- Gas price limits
- Minimum profit thresholds

### Safety Features
- Dry-run mode for testing
- Pre-execution validation
- Emergency stop functionality
- Comprehensive logging
- Error handling and recovery

## Installation

### Prerequisites
- Node.js v18 or higher
- An Ethereum RPC endpoint (Alchemy, Infura, etc.)
- Wallet with private key (for live trading)
- ETH for gas fees

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd kashi-arbitrage-bot
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
# RPC Configuration
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
CHAIN_ID=1

# Wallet Configuration (KEEP PRIVATE!)
PRIVATE_KEY=your_private_key_here

# Bot Configuration
MIN_PROFIT_USD=50
MIN_PROFIT_PERCENTAGE=0.5
MAX_POSITION_SIZE_ETH=10
GAS_PRICE_LIMIT_GWEI=100

# Kashi Markets to Monitor
KASHI_MARKETS=USDC-WETH,DAI-WETH,USDT-WETH

# Execution
DRY_RUN=true
EXECUTION_INTERVAL_MS=5000

# Logging
LOG_LEVEL=info
```

5. Update Kashi pair addresses in `src/utils/Config.ts`:
```typescript
static getKashiPairAddresses(): { [key: string]: string } {
  return {
    'USDC-WETH': '0xYourKashiPairAddress',
    'DAI-WETH': '0xYourKashiPairAddress',
    // Add actual mainnet Kashi pair addresses
  };
}
```

6. Build the project:
```bash
npm run build
```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Dry Run (Recommended First)
Set `DRY_RUN=true` in `.env` to simulate trades without executing them.

## Configuration

### Trading Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `MIN_PROFIT_USD` | Minimum profit in USD to execute trade | 50 |
| `MIN_PROFIT_PERCENTAGE` | Minimum profit percentage | 0.5% |
| `MAX_POSITION_SIZE_ETH` | Maximum position size in ETH | 10 |
| `GAS_PRICE_LIMIT_GWEI` | Maximum gas price to pay | 100 |
| `EXECUTION_INTERVAL_MS` | Time between scans | 5000ms |

### Risk Parameters (hardcoded in RiskManager)

| Parameter | Value | Description |
|-----------|-------|-------------|
| Max Utilization | 95% | Maximum utilization before rejecting |
| Max Concentration | 20% | Maximum % of market liquidity |
| Max Liquidation Risk | 15% | Maximum acceptable liquidation risk |
| Min Health Factor | 1.5x | Minimum collateralization ratio |

## Project Structure

```
kashi-arbitrage-bot/
├── src/
│   ├── bot/
│   │   └── KashiArbitrageBot.ts      # Main bot orchestrator
│   ├── contracts/
│   │   ├── types.ts                   # TypeScript types
│   │   └── KashiPairABI.ts           # Contract ABIs
│   ├── data/
│   │   └── MarketDataFetcher.ts      # Fetch market data
│   ├── execution/
│   │   └── TradeExecutor.ts          # Execute trades
│   ├── math/
│   │   └── ArbitrageMath.ts          # Mathematical calculations
│   ├── risk/
│   │   └── RiskManager.ts            # Risk assessment
│   ├── strategy/
│   │   └── OpportunityDetector.ts    # Detect opportunities
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

## Mathematical Components

### ArbitrageMath.ts
- `calculateInterestRate()` - Interest rate from utilization
- `calculateSupplyAPY()` - What lenders earn
- `calculateBorrowAPY()` - What borrowers pay
- `calculateUtilization()` - Current utilization ratio
- `calculateArbitrageProfit()` - Expected profit calculation
- `calculateOptimalPositionSize()` - Optimal trade size
- `detectArbitrageOpportunity()` - Identify arbitrage spreads

### OpportunityDetector.ts
- Scans all market pairs
- Compares interest rates
- Calculates profitability
- Estimates costs
- Applies profit thresholds

### RiskManager.ts
- Utilization checks
- Liquidity checks
- Concentration checks
- Liquidation risk assessment
- Position health monitoring

## Logging

The bot maintains detailed logs in the `logs/` directory:

- `combined.log` - All log messages
- `error.log` - Errors only
- `trades.log` - Successful trade executions

Log levels: `error`, `warn`, `info`, `debug`

## Safety & Best Practices

1. **Always test in dry-run mode first**
2. **Start with small position sizes**
3. **Monitor gas prices** - high gas can eliminate profits
4. **Use secure RPC endpoints** - rate limits can cause missed opportunities
5. **Keep private keys secure** - never commit them to version control
6. **Monitor positions regularly** - market conditions change
7. **Set appropriate profit thresholds** - don't chase small profits
8. **Understand the risks** - you can lose money

## Risks

- **Smart contract risk**: Kashi contracts could have bugs
- **Oracle risk**: Price oracles could be manipulated
- **Liquidation risk**: Positions can be liquidated if collateral value drops
- **Gas cost risk**: High gas prices can eliminate profits
- **Market risk**: Rates can change between detection and execution
- **Slippage risk**: Large trades can impact market rates
- **Network risk**: Failed transactions still cost gas

## Emergency Controls

The bot includes emergency stop functionality:

```typescript
// Graceful shutdown
CTRL+C or SIGTERM

// Emergency stop in code
await bot.emergencyStop();
```

## Monitoring

Track bot performance:
1. Monitor log files for opportunities and executions
2. Check transaction hashes on Etherscan
3. Track wallet balance changes
4. Monitor gas costs
5. Review risk assessments

## Troubleshooting

### No opportunities found
- Check that market addresses are correct
- Verify RPC connection is working
- Ensure markets have sufficient liquidity
- Lower profit thresholds (carefully)

### Transactions failing
- Check gas price limits
- Verify wallet has sufficient ETH
- Ensure token approvals are set
- Check for network congestion

### High gas costs
- Increase `GAS_PRICE_LIMIT_GWEI` cautiously
- Consider waiting for lower gas prices
- Optimize execution timing

## Advanced Features

### Position Monitoring
The bot can monitor ongoing positions:
```typescript
const health = riskManager.monitorPositionHealth(
  supplyMarket,
  borrowMarket,
  positionSize
);
```

### Custom Risk Parameters
Modify risk parameters in `RiskManager.ts` to suit your risk tolerance.

### Multiple Markets
Add more Kashi pairs to `KASHI_MARKETS` to increase opportunity surface.

## Future Enhancements

Potential improvements:
- Flash loan integration for capital efficiency
- Multi-hop arbitrage across 3+ markets
- Dynamic position sizing based on volatility
- MEV protection
- Telegram/Discord alerts
- Web dashboard for monitoring
- Backtesting framework
- Machine learning for gas price prediction

## Contributing

This is a foundation for a Kashi arbitrage bot. Consider:
- Adding more comprehensive tests
- Implementing additional safety checks
- Optimizing gas usage
- Adding more sophisticated strategies

## Disclaimer

**USE AT YOUR OWN RISK**

This bot is for educational purposes. Trading cryptocurrency involves substantial risk of loss. The authors are not responsible for any financial losses incurred through use of this software.

- Not financial advice
- No guarantees of profit
- You can lose money
- Smart contracts can fail
- Markets can be manipulated
- Test thoroughly before live trading

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
1. Check the logs first
2. Review configuration settings
3. Ensure RPC endpoint is working
4. Verify market addresses are correct

---

**Remember: This bot uses MATHEMATICS to find arbitrage, not hope. But even mathematical models can fail in real-world conditions. Trade responsibly.**
