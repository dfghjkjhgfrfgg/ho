import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAccount,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { WalletInfo } from '../types';
import Logger from '../utils/Logger';
import bs58 from 'bs58';

export class WalletManager {
  private connection: Connection;
  private keypair: Keypair | null = null;
  private publicKey: PublicKey | null = null;

  constructor(rpcEndpoint: string) {
    this.connection = new Connection(rpcEndpoint, 'confirmed');
  }

  /**
   * Initialize wallet from private key
   */
  public async initialize(privateKey: string): Promise<void> {
    try {
      // Support both base58 and array format
      let secretKey: Uint8Array;

      if (privateKey.includes('[')) {
        // Array format: [1,2,3,...]
        const array = JSON.parse(privateKey);
        secretKey = Uint8Array.from(array);
      } else {
        // Base58 format
        secretKey = bs58.decode(privateKey);
      }

      this.keypair = Keypair.fromSecretKey(secretKey);
      this.publicKey = this.keypair.publicKey;

      Logger.info('Wallet initialized', {
        publicKey: this.publicKey.toBase58(),
      });

      // Log initial balance
      const balance = await this.getBalance();
      Logger.info(`Wallet balance: ${balance} SOL`);
    } catch (error) {
      Logger.error('Failed to initialize wallet', error);
      throw error;
    }
  }

  /**
   * Get SOL balance
   */
  public async getBalance(): Promise<number> {
    if (!this.publicKey) {
      throw new Error('Wallet not initialized');
    }

    try {
      const balance = await this.connection.getBalance(this.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      Logger.error('Failed to get balance', error);
      throw error;
    }
  }

  /**
   * Get all token accounts and balances
   */
  public async getWalletInfo(): Promise<WalletInfo> {
    if (!this.publicKey) {
      throw new Error('Wallet not initialized');
    }

    try {
      const solBalance = await this.getBalance();

      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        this.publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const tokens = tokenAccounts.value.map((account) => {
        const parsed = account.account.data.parsed;
        const info = parsed.info;

        return {
          mint: info.mint,
          symbol: 'UNKNOWN', // Will be enriched later
          balance: info.tokenAmount.amount,
          uiAmount: info.tokenAmount.uiAmount,
        };
      });

      return {
        publicKey: this.publicKey,
        balance: solBalance,
        tokens,
      };
    } catch (error) {
      Logger.error('Failed to get wallet info', error);
      throw error;
    }
  }

  /**
   * Get token balance for a specific mint
   */
  public async getTokenBalance(mintAddress: string): Promise<number> {
    if (!this.publicKey) {
      throw new Error('Wallet not initialized');
    }

    try {
      const mint = new PublicKey(mintAddress);
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mint,
        this.publicKey
      );

      const account = await getAccount(this.connection, associatedTokenAddress);
      return Number(account.amount) / Math.pow(10, account.decimals || 9);
    } catch (error) {
      // Token account doesn't exist
      return 0;
    }
  }

  /**
   * Sign and send transaction
   */
  public async signAndSendTransaction(transaction: Transaction): Promise<string> {
    if (!this.keypair) {
      throw new Error('Wallet not initialized');
    }

    try {
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = this.keypair.publicKey;

      // Sign and send
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.keypair],
        {
          commitment: 'confirmed',
          maxRetries: 3,
        }
      );

      Logger.info('Transaction sent', { signature });
      return signature;
    } catch (error) {
      Logger.error('Failed to sign and send transaction', error);
      throw error;
    }
  }

  /**
   * Simulate transaction (for testing)
   */
  public async simulateTransaction(transaction: Transaction): Promise<any> {
    if (!this.publicKey) {
      throw new Error('Wallet not initialized');
    }

    try {
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.publicKey;

      const simulation = await this.connection.simulateTransaction(transaction);
      return simulation;
    } catch (error) {
      Logger.error('Failed to simulate transaction', error);
      throw error;
    }
  }

  /**
   * Get connection
   */
  public getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get public key
   */
  public getPublicKey(): PublicKey {
    if (!this.publicKey) {
      throw new Error('Wallet not initialized');
    }
    return this.publicKey;
  }

  /**
   * Get keypair (use with caution)
   */
  public getKeypair(): Keypair {
    if (!this.keypair) {
      throw new Error('Wallet not initialized');
    }
    return this.keypair;
  }

  /**
   * Check if wallet is initialized
   */
  public isInitialized(): boolean {
    return this.keypair !== null && this.publicKey !== null;
  }
}

export default WalletManager;
