# Quick Setup Guide

## Installation Steps

1. **Install Dependencies**
```bash
npm install
```

2. **Create Environment File**
```bash
cp .env.example .env
```

3. **Configure Your Bot**

Edit `.env` and add:
- Your RPC URL (get free one from Alchemy or Infura)
- Your private key (for live trading)
- Adjust profit thresholds

4. **Update Kashi Pair Addresses**

Edit `src/utils/Config.ts` and add real Kashi pair addresses:
```typescript
static getKashiPairAddresses(): { [key: string]: string } {
  return {
    'USDC-WETH': '0xYourActualKashiPairAddress',
    'DAI-WETH': '0xYourActualKashiPairAddress',
    // Find addresses at https://app.sushi.com/lend
  };
}
```

5. **Build the Bot**
```bash
npm run build
```

6. **Test in Dry Run Mode**
```bash
# Make sure DRY_RUN=true in .env
npm start
```

7. **Go Live** (when ready)
```bash
# Set DRY_RUN=false in .env
npm start
```

## Finding Kashi Pair Addresses

1. Visit https://app.sushi.com/lend
2. Select a lending pair
3. Get the contract address from Etherscan
4. Add to Config.ts

## Important Notes

- **ALWAYS test in dry-run mode first**
- **Start with small position sizes**
- **Monitor gas prices**
- **Keep private keys secure**
- **You can lose money - trade responsibly**

## Need Help?

Check the main README.md for detailed documentation.
