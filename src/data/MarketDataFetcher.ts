import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import { KashiMarketData, MarketPair } from '../contracts/types';
import { KASHI_PAIR_ABI, ERC20_ABI } from '../contracts/KashiPairABI';
import { ArbitrageMath } from '../math/ArbitrageMath';

/**
 * Fetches real-time market data from Kashi lending pairs
 */
export class MarketDataFetcher {
  private provider: ethers.Provider;

  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }

  /**
   * Fetch complete market data for a Kashi pair
   */
  async fetchMarketData(pairAddress: string): Promise<KashiMarketData> {
    const pairContract = new ethers.Contract(
      pairAddress,
      KASHI_PAIR_ABI,
      this.provider
    );

    try {
      // Fetch all data in parallel for efficiency
      const [
        assetAddress,
        collateralAddress,
        totalAssetData,
        totalBorrowData,
        totalCollateralShare,
        accrueInfo,
        exchangeRate
      ] = await Promise.all([
        pairContract.asset(),
        pairContract.collateral(),
        pairContract.totalAsset(),
        pairContract.totalBorrow(),
        pairContract.totalCollateralShare(),
        pairContract.accrueInfo(),
        pairContract.exchangeRate()
      ]);

      // Get token symbols
      const [assetSymbol, collateralSymbol] = await Promise.all([
        this.getTokenSymbol(assetAddress),
        this.getTokenSymbol(collateralAddress)
      ]);

      // Parse total asset (elastic = actual amount, base = shares)
      const totalAssetElastic = new BigNumber(totalAssetData.elastic.toString());
      const totalBorrowElastic = new BigNumber(totalBorrowData.elastic.toString());

      // Calculate utilization
      const utilization = ArbitrageMath.calculateUtilization(
        totalBorrowElastic,
        totalAssetElastic
      );

      // Parse interest rate
      const interestPerSecond = new BigNumber(accrueInfo.interestPerSecond.toString())
        .div(new BigNumber(10).pow(18));

      // Calculate APYs
      const borrowAPY = ArbitrageMath.calculateBorrowAPY(interestPerSecond);
      const protocolFee = new BigNumber(0.1); // 10% protocol fee (typical for Kashi)
      const supplyAPY = ArbitrageMath.calculateSupplyAPY(
        borrowAPY,
        utilization,
        protocolFee
      );

      // Calculate available liquidity
      const availableLiquidity = totalAssetElastic.minus(totalBorrowElastic);

      // Get oracle price (if available)
      let oraclePrice = new BigNumber(1);
      try {
        const exchangeRateBN = new BigNumber(exchangeRate.toString());
        oraclePrice = exchangeRateBN.div(new BigNumber(10).pow(18));
      } catch (error) {
        // Use default if oracle fails
      }

      return {
        pairAddress,
        asset: assetAddress,
        collateral: collateralAddress,
        assetSymbol,
        collateralSymbol,
        totalAsset: totalAssetElastic,
        totalBorrow: totalBorrowElastic,
        totalCollateral: new BigNumber(totalCollateralShare.toString()),
        interestPerSecond,
        lastAccrued: new BigNumber(accrueInfo.lastAccrued.toString()),
        utilization,
        supplyAPY,
        borrowAPY,
        exchangeRate: new BigNumber(exchangeRate.toString()),
        protocolFee,
        oraclePrice,
        availableLiquidity,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch market data for ${pairAddress}: ${error}`
      );
    }
  }

  /**
   * Fetch market data for multiple pairs in parallel
   */
  async fetchMultipleMarkets(
    pairAddresses: string[]
  ): Promise<KashiMarketData[]> {
    const promises = pairAddresses.map(address =>
      this.fetchMarketData(address)
    );

    const results = await Promise.allSettled(promises);

    return results
      .filter((result): result is PromiseFulfilledResult<KashiMarketData> =>
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  /**
   * Get token symbol from address
   */
  private async getTokenSymbol(tokenAddress: string): Promise<string> {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.provider
      );
      return await tokenContract.symbol();
    } catch (error) {
      return 'UNKNOWN';
    }
  }

  /**
   * Get token decimals
   */
  async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.provider
      );
      return await tokenContract.decimals();
    } catch (error) {
      return 18; // Default to 18
    }
  }

  /**
   * Get token balance for an address
   */
  async getTokenBalance(
    tokenAddress: string,
    walletAddress: string
  ): Promise<BigNumber> {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.provider
      );
      const balance = await tokenContract.balanceOf(walletAddress);
      return new BigNumber(balance.toString());
    } catch (error) {
      throw new Error(
        `Failed to get balance for ${tokenAddress}: ${error}`
      );
    }
  }

  /**
   * Check if we need to approve token spending
   */
  async needsApproval(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
    amount: BigNumber
  ): Promise<boolean> {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        this.provider
      );
      const allowance = await tokenContract.allowance(
        ownerAddress,
        spenderAddress
      );
      const allowanceBN = new BigNumber(allowance.toString());
      return allowanceBN.lt(amount);
    } catch (error) {
      return true; // Assume we need approval if check fails
    }
  }

  /**
   * Get current gas price
   */
  async getCurrentGasPrice(): Promise<BigNumber> {
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(0);
    return new BigNumber(gasPrice.toString());
  }

  /**
   * Estimate gas cost in USD for a transaction
   */
  async estimateGasCostUSD(
    estimatedGasUnits: BigNumber,
    ethPriceUSD: number = 2000 // Default ETH price
  ): Promise<BigNumber> {
    const gasPrice = await this.getCurrentGasPrice();
    const gasCostWei = gasPrice.times(estimatedGasUnits);
    const gasCostETH = gasCostWei.div(new BigNumber(10).pow(18));
    return gasCostETH.times(ethPriceUSD);
  }
}
