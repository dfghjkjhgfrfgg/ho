import { ethers } from 'ethers';
import BigNumber from 'bignumber.js';
import {
  ArbitrageOpportunity,
  TradeExecutionResult,
  BotConfig
} from '../contracts/types';
import { KASHI_PAIR_ABI, ERC20_ABI } from '../contracts/KashiPairABI';
import { MarketDataFetcher } from '../data/MarketDataFetcher';

/**
 * Executes arbitrage trades on Kashi markets
 */
export class TradeExecutor {
  private wallet: ethers.Wallet;
  private config: BotConfig;
  private dataFetcher: MarketDataFetcher;

  constructor(
    wallet: ethers.Wallet,
    config: BotConfig,
    dataFetcher: MarketDataFetcher
  ) {
    this.wallet = wallet;
    this.config = config;
    this.dataFetcher = dataFetcher;
  }

  /**
   * Execute an arbitrage opportunity
   */
  async execute(
    opportunity: ArbitrageOpportunity
  ): Promise<TradeExecutionResult> {
    const startTime = Date.now();

    try {
      // If dry run, just simulate
      if (this.config.dryRun) {
        return this.simulateExecution(opportunity);
      }

      // Pre-execution validations
      const validationResult = await this.validateExecution(opportunity);
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Validation failed: ${validationResult.reason}`,
          opportunity,
          timestamp: Date.now()
        };
      }

      // Execute the arbitrage strategy:
      // 1. Supply to the high-yield market
      // 2. Borrow from the low-rate market
      // 3. Monitor and manage position

      // Step 1: Approve tokens if needed
      await this.ensureApprovals(opportunity);

      // Step 2: Supply asset to supply market
      const supplyTx = await this.supplyAsset(
        opportunity.supplyMarket.pairAddress,
        opportunity.optimalAmount
      );

      // Step 3: Borrow asset from borrow market
      const borrowTx = await this.borrowAsset(
        opportunity.borrowMarket.pairAddress,
        opportunity.optimalAmount
      );

      // Calculate actual profit (simplified - would need to track over time)
      const actualProfit = opportunity.expectedNetProfit;

      return {
        success: true,
        transactionHash: borrowTx.hash,
        opportunity,
        actualProfit,
        gasUsed: new BigNumber(
          (await supplyTx.wait())?.gasUsed?.toString() || '0'
        ),
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: `Execution failed: ${error}`,
        opportunity,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Validate that the opportunity is still valid before execution
   */
  private async validateExecution(
    opportunity: ArbitrageOpportunity
  ): Promise<{ valid: boolean; reason?: string }> {
    // Re-fetch current market data to ensure opportunity still exists
    const [currentSupplyMarket, currentBorrowMarket] = await Promise.all([
      this.dataFetcher.fetchMarketData(opportunity.supplyMarket.pairAddress),
      this.dataFetcher.fetchMarketData(opportunity.borrowMarket.pairAddress)
    ]);

    // Check if spread is still favorable
    const currentSpread = currentSupplyMarket.supplyAPY.minus(
      currentBorrowMarket.borrowAPY
    );
    const originalSpread = opportunity.spreadPercent.div(100);

    if (currentSpread.lt(originalSpread.times(0.8))) {
      // Spread decreased by more than 20%
      return {
        valid: false,
        reason: 'Spread decreased significantly since detection'
      };
    }

    // Check if sufficient liquidity is available
    if (
      currentSupplyMarket.availableLiquidity.lt(opportunity.optimalAmount) ||
      currentBorrowMarket.availableLiquidity.lt(opportunity.optimalAmount)
    ) {
      return {
        valid: false,
        reason: 'Insufficient liquidity available'
      };
    }

    // Check wallet balance
    const assetBalance = await this.dataFetcher.getTokenBalance(
      opportunity.supplyMarket.asset,
      this.wallet.address
    );

    if (assetBalance.lt(opportunity.optimalAmount)) {
      return {
        valid: false,
        reason: `Insufficient balance. Need ${opportunity.optimalAmount.toString()}, have ${assetBalance.toString()}`
      };
    }

    // Check gas price
    const currentGasPrice = await this.dataFetcher.getCurrentGasPrice();
    const maxGasPrice = new BigNumber(this.config.gasPriceLimitGwei).times(
      new BigNumber(10).pow(9)
    );

    if (currentGasPrice.gt(maxGasPrice)) {
      return {
        valid: false,
        reason: `Gas price too high: ${currentGasPrice
          .div(new BigNumber(10).pow(9))
          .toString()} gwei`
      };
    }

    return { valid: true };
  }

  /**
   * Ensure token approvals are in place
   */
  private async ensureApprovals(
    opportunity: ArbitrageOpportunity
  ): Promise<void> {
    const assetAddress = opportunity.supplyMarket.asset;
    const supplyPairAddress = opportunity.supplyMarket.pairAddress;
    const borrowPairAddress = opportunity.borrowMarket.pairAddress;

    // Check and approve for supply market
    const needsSupplyApproval = await this.dataFetcher.needsApproval(
      assetAddress,
      this.wallet.address,
      supplyPairAddress,
      opportunity.optimalAmount
    );

    if (needsSupplyApproval) {
      await this.approveToken(
        assetAddress,
        supplyPairAddress,
        opportunity.optimalAmount
      );
    }

    // Check and approve for borrow market (for repayment)
    const needsBorrowApproval = await this.dataFetcher.needsApproval(
      assetAddress,
      this.wallet.address,
      borrowPairAddress,
      opportunity.optimalAmount
    );

    if (needsBorrowApproval) {
      await this.approveToken(
        assetAddress,
        borrowPairAddress,
        opportunity.optimalAmount
      );
    }
  }

  /**
   * Approve token spending
   */
  private async approveToken(
    tokenAddress: string,
    spenderAddress: string,
    amount: BigNumber
  ): Promise<void> {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      this.wallet
    );

    // Approve max uint256 for convenience (standard practice)
    const maxUint256 = ethers.MaxUint256;

    const tx = await tokenContract.approve(spenderAddress, maxUint256);
    await tx.wait();
  }

  /**
   * Supply asset to a Kashi pair
   */
  private async supplyAsset(
    pairAddress: string,
    amount: BigNumber
  ): Promise<ethers.ContractTransactionResponse> {
    const pairContract = new ethers.Contract(
      pairAddress,
      KASHI_PAIR_ABI,
      this.wallet
    );

    // addAsset(fraction, to)
    // fraction: amount to add (in shares, but we use amount for simplicity)
    // to: recipient address
    const tx = await pairContract.addAsset(
      amount.toFixed(0),
      this.wallet.address
    );

    return tx;
  }

  /**
   * Borrow asset from a Kashi pair
   */
  private async borrowAsset(
    pairAddress: string,
    amount: BigNumber
  ): Promise<ethers.ContractTransactionResponse> {
    const pairContract = new ethers.Contract(
      pairAddress,
      KASHI_PAIR_ABI,
      this.wallet
    );

    // borrow(to, amount)
    const tx = await pairContract.borrow(
      this.wallet.address,
      amount.toFixed(0)
    );

    return tx;
  }

  /**
   * Repay borrowed asset
   */
  async repayBorrow(
    pairAddress: string,
    amount: BigNumber
  ): Promise<ethers.ContractTransactionResponse> {
    const pairContract = new ethers.Contract(
      pairAddress,
      KASHI_PAIR_ABI,
      this.wallet
    );

    const tx = await pairContract.repay(this.wallet.address, amount.toFixed(0));

    return tx;
  }

  /**
   * Remove supplied asset
   */
  async removeAsset(
    pairAddress: string,
    amount: BigNumber
  ): Promise<ethers.ContractTransactionResponse> {
    const pairContract = new ethers.Contract(
      pairAddress,
      KASHI_PAIR_ABI,
      this.wallet
    );

    const tx = await pairContract.removeAsset(
      amount.toFixed(0),
      this.wallet.address
    );

    return tx;
  }

  /**
   * Simulate execution without actually sending transactions
   */
  private simulateExecution(
    opportunity: ArbitrageOpportunity
  ): TradeExecutionResult {
    return {
      success: true,
      transactionHash: '0x' + '0'.repeat(64), // Dummy hash
      opportunity,
      actualProfit: opportunity.expectedNetProfit,
      gasUsed: new BigNumber(300000),
      timestamp: Date.now()
    };
  }

  /**
   * Emergency function to close all positions
   */
  async closeAllPositions(
    supplyPairAddress: string,
    borrowPairAddress: string
  ): Promise<void> {
    // Get current positions
    const supplyPairContract = new ethers.Contract(
      supplyPairAddress,
      KASHI_PAIR_ABI,
      this.wallet
    );

    const borrowPairContract = new ethers.Contract(
      borrowPairAddress,
      KASHI_PAIR_ABI,
      this.wallet
    );

    // Repay all borrows first
    const borrowBalance = await borrowPairContract.userBorrowPart(
      this.wallet.address
    );
    if (borrowBalance > 0) {
      await this.repayBorrow(borrowPairAddress, new BigNumber(borrowBalance.toString()));
    }

    // Remove all supplied assets
    const supplyBalance = await supplyPairContract.balanceOf(this.wallet.address);
    if (supplyBalance > 0) {
      await this.removeAsset(supplyPairAddress, new BigNumber(supplyBalance.toString()));
    }
  }
}
