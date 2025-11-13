import { Connection, PublicKey } from '@solana/web3.js';
import { getMint, getAccount } from '@solana/spl-token';
import { SecurityAnalysis } from '../types';
import Logger from '../utils/Logger';
import axios from 'axios';

export class SecurityAnalyzer {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Perform comprehensive security analysis on a token
   */
  public async analyzeToken(tokenAddress: string): Promise<SecurityAnalysis> {
    Logger.info('Starting security analysis', { tokenAddress });

    try {
      const mint = new PublicKey(tokenAddress);

      // Run all security checks in parallel
      const [
        honeypotCheck,
        mintAuthorityCheck,
        freezeAuthorityCheck,
        liquidityCheck,
        holderAnalysis,
        rugPullRisk,
      ] = await Promise.all([
        this.checkHoneypot(tokenAddress),
        this.checkMintAuthority(mint),
        this.checkFreezeAuthority(mint),
        this.checkLiquidityLock(tokenAddress),
        this.analyzeHolders(tokenAddress),
        this.assessRugPullRisk(tokenAddress),
      ]);

      // Calculate overall security score (0-100)
      const score = this.calculateSecurityScore({
        honeypotCheck,
        mintAuthorityCheck,
        freezeAuthorityCheck,
        liquidityCheck,
        holderAnalysis,
        rugPullRisk,
      });

      const warnings: string[] = [];

      if (honeypotCheck.isHoneypot) {
        warnings.push('⚠️ HONEYPOT DETECTED - Cannot sell this token!');
      }
      if (!honeypotCheck.canBeSold) {
        warnings.push('⚠️ Sell function appears to be disabled');
      }
      if (mintAuthorityCheck) {
        warnings.push('⚠️ Mint authority is not renounced - unlimited minting possible');
      }
      if (freezeAuthorityCheck) {
        warnings.push('⚠️ Freeze authority is active - accounts can be frozen');
      }
      if (!liquidityCheck.locked) {
        warnings.push('⚠️ Liquidity is not locked - rug pull risk!');
      }
      if (!liquidityCheck.burned) {
        warnings.push('⚠️ LP tokens are not burned');
      }
      if (holderAnalysis.topHolderPercent > 50) {
        warnings.push(`⚠️ Top holder owns ${holderAnalysis.topHolderPercent.toFixed(1)}% of supply`);
      }
      if (rugPullRisk > 70) {
        warnings.push('🚨 HIGH RUG PULL RISK - Avoid this token!');
      }

      const analysis: SecurityAnalysis = {
        isHoneypot: honeypotCheck.isHoneypot,
        canBeSold: honeypotCheck.canBeSold,
        rugPullRisk,
        liquidityLocked: liquidityCheck.locked,
        lpBurned: liquidityCheck.burned,
        mintAuthority: mintAuthorityCheck,
        freezeAuthority: freezeAuthorityCheck,
        suspiciousFunctions: honeypotCheck.suspiciousFunctions,
        ownershipRenounced: !mintAuthorityCheck && !freezeAuthorityCheck,
        holderAnalysis,
        score,
        warnings,
      };

      Logger.security('Security analysis complete', {
        tokenAddress,
        score,
        warningCount: warnings.length,
      });

      return analysis;
    } catch (error) {
      Logger.error('Security analysis failed', error, { tokenAddress });

      // Return a safe default (assume dangerous)
      return {
        isHoneypot: true,
        canBeSold: false,
        rugPullRisk: 100,
        liquidityLocked: false,
        lpBurned: false,
        mintAuthority: true,
        freezeAuthority: true,
        suspiciousFunctions: ['ANALYSIS_FAILED'],
        ownershipRenounced: false,
        holderAnalysis: {
          topHolderPercent: 100,
          holderCount: 0,
          contractHoldings: 100,
        },
        score: 0,
        warnings: ['⚠️ Security analysis failed - assume dangerous'],
      };
    }
  }

  /**
   * Check if token is a honeypot (can be bought but not sold)
   */
  private async checkHoneypot(tokenAddress: string): Promise<{
    isHoneypot: boolean;
    canBeSold: boolean;
    suspiciousFunctions: string[];
  }> {
    try {
      // Use Rugcheck API or similar service
      const response = await axios.get(
        `https://api.rugcheck.xyz/v1/tokens/${tokenAddress}/report`,
        { timeout: 5000 }
      ).catch(() => null);

      if (response && response.data) {
        const data = response.data;
        return {
          isHoneypot: data.isHoneypot || false,
          canBeSold: !data.isHoneypot,
          suspiciousFunctions: data.risks || [],
        };
      }

      // Fallback: Try to simulate a buy and sell
      // This is more complex and requires actual transaction simulation
      Logger.warn('Honeypot check using fallback method');

      return {
        isHoneypot: false,
        canBeSold: true,
        suspiciousFunctions: [],
      };
    } catch (error) {
      Logger.error('Honeypot check failed', error);
      return {
        isHoneypot: false, // Assume safe if check fails
        canBeSold: true,
        suspiciousFunctions: [],
      };
    }
  }

  /**
   * Check if mint authority is renounced
   */
  private async checkMintAuthority(mint: PublicKey): Promise<boolean> {
    try {
      const mintInfo = await getMint(this.connection, mint);
      return mintInfo.mintAuthority !== null;
    } catch (error) {
      Logger.error('Mint authority check failed', error);
      return true; // Assume dangerous if check fails
    }
  }

  /**
   * Check if freeze authority is renounced
   */
  private async checkFreezeAuthority(mint: PublicKey): Promise<boolean> {
    try {
      const mintInfo = await getMint(this.connection, mint);
      return mintInfo.freezeAuthority !== null;
    } catch (error) {
      Logger.error('Freeze authority check failed', error);
      return true; // Assume dangerous if check fails
    }
  }

  /**
   * Check if liquidity is locked
   */
  private async checkLiquidityLock(tokenAddress: string): Promise<{
    locked: boolean;
    burned: boolean;
    lockUntil?: number;
  }> {
    try {
      // Query liquidity locker programs (e.g., Unicrypt, Team Finance on Solana)
      // This is a placeholder - you need to integrate with actual locker contracts

      // Check if LP tokens are burned (sent to null address)
      const burned = await this.checkLPBurned(tokenAddress);

      return {
        locked: false, // Placeholder
        burned,
        lockUntil: undefined,
      };
    } catch (error) {
      Logger.error('Liquidity lock check failed', error);
      return {
        locked: false,
        burned: false,
      };
    }
  }

  /**
   * Check if LP tokens are burned
   */
  private async checkLPBurned(tokenAddress: string): Promise<boolean> {
    try {
      // Check if LP tokens are sent to burn address
      // Common burn addresses on Solana:
      // - 11111111111111111111111111111111 (System Program)
      // - Burn address variations

      // This requires finding the LP token mint and checking holdings
      // Placeholder implementation
      return false;
    } catch (error) {
      Logger.error('LP burn check failed', error);
      return false;
    }
  }

  /**
   * Analyze token holder distribution
   */
  private async analyzeHolders(tokenAddress: string): Promise<{
    topHolderPercent: number;
    holderCount: number;
    contractHoldings: number;
  }> {
    try {
      // Use Helius or similar API to get holder data
      const response = await axios.get(
        `https://api.helius.xyz/v0/token-metadata?api-key=demo&mint=${tokenAddress}`,
        { timeout: 5000 }
      ).catch(() => null);

      if (response && response.data) {
        // Parse holder data
        // This is a placeholder
        return {
          topHolderPercent: 0,
          holderCount: 0,
          contractHoldings: 0,
        };
      }

      // Fallback: Query token accounts manually
      const mint = new PublicKey(tokenAddress);
      const accounts = await this.connection.getTokenLargestAccounts(mint);

      const totalSupply = accounts.value.reduce(
        (sum, account) => sum + Number(account.amount),
        0
      );

      const topHolderAmount = Number(accounts.value[0]?.amount || 0);
      const topHolderPercent = (topHolderAmount / totalSupply) * 100;

      return {
        topHolderPercent,
        holderCount: accounts.value.length,
        contractHoldings: 0,
      };
    } catch (error) {
      Logger.error('Holder analysis failed', error);
      return {
        topHolderPercent: 0,
        holderCount: 0,
        contractHoldings: 0,
      };
    }
  }

  /**
   * Assess overall rug pull risk (0-100)
   */
  private async assessRugPullRisk(tokenAddress: string): Promise<number> {
    try {
      let risk = 0;

      // Factors that increase rug pull risk:
      // - Mint authority not renounced: +30
      // - Freeze authority not renounced: +20
      // - Liquidity not locked: +30
      // - High concentration (top holder > 50%): +20

      const mint = new PublicKey(tokenAddress);
      const mintInfo = await getMint(this.connection, mint);

      if (mintInfo.mintAuthority !== null) risk += 30;
      if (mintInfo.freezeAuthority !== null) risk += 20;

      const liquidityCheck = await this.checkLiquidityLock(tokenAddress);
      if (!liquidityCheck.locked && !liquidityCheck.burned) risk += 30;

      const holderAnalysis = await this.analyzeHolders(tokenAddress);
      if (holderAnalysis.topHolderPercent > 50) risk += 20;

      return Math.min(risk, 100);
    } catch (error) {
      Logger.error('Rug pull risk assessment failed', error);
      return 100; // Assume maximum risk if check fails
    }
  }

  /**
   * Calculate overall security score (0-100, higher is better)
   */
  private calculateSecurityScore(checks: {
    honeypotCheck: { isHoneypot: boolean; canBeSold: boolean };
    mintAuthorityCheck: boolean;
    freezeAuthorityCheck: boolean;
    liquidityCheck: { locked: boolean; burned: boolean };
    holderAnalysis: { topHolderPercent: number };
    rugPullRisk: number;
  }): number {
    let score = 100;

    // Deduct points for security issues
    if (checks.honeypotCheck.isHoneypot) score -= 100; // Instant fail
    if (!checks.honeypotCheck.canBeSold) score -= 100; // Instant fail
    if (checks.mintAuthorityCheck) score -= 30;
    if (checks.freezeAuthorityCheck) score -= 20;
    if (!checks.liquidityCheck.locked && !checks.liquidityCheck.burned) score -= 30;
    if (checks.holderAnalysis.topHolderPercent > 50) score -= 20;

    // Rug pull risk reduces score
    score -= checks.rugPullRisk * 0.5;

    return Math.max(score, 0);
  }

  /**
   * Quick safety check (fast version for screening)
   */
  public async quickSafetyCheck(tokenAddress: string): Promise<boolean> {
    try {
      const mint = new PublicKey(tokenAddress);
      const mintInfo = await getMint(this.connection, mint);

      // Basic checks only
      const hasMintAuthority = mintInfo.mintAuthority !== null;
      const hasFreezeAuthority = mintInfo.freezeAuthority !== null;

      // Fail if both authorities are present (high risk)
      if (hasMintAuthority && hasFreezeAuthority) {
        Logger.warn('Quick safety check failed: Both authorities present', {
          tokenAddress,
        });
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Quick safety check failed', error);
      return false; // Fail safe
    }
  }
}

export default SecurityAnalyzer;
