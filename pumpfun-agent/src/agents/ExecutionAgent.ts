import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
import axios from 'axios';
import { ITokenData, IPositionState } from '../types';
import { eventBus } from '../utils/eventBus';
import { logger } from '../utils/logger';
import { config } from '../config';
import {
  createPumpFunBuyInstruction,
  getBondingCurvePDA,
  parseBondingCurveAccount,
  calculateTokensForSol,
  calculateTokenPriceSol,
} from '../utils/pumpfun';
import { createJitoTipInstruction, sendJitoBundle } from '../utils/jito';
import { simulator } from '../utils/simulator';
import { aiService } from '../services/aiService';

export class ExecutionAgent {
  private connection: Connection;
  private wallet: Keypair | null = null;
  private isExecuting = false;
  private activeMints: Set<string> = new Set();

  constructor(connection?: Connection) {
    this.connection = connection || new Connection(config.rpcUrl, 'confirmed');
    this.initializeWallet();
    this.setupEventListeners();
  }

  private initializeWallet(): void {
    if (config.privateKey) {
      try {
        const secretKey = bs58.decode(config.privateKey);
        this.wallet = Keypair.fromSecretKey(secretKey);
        logger.info(`[ExecutionAgent] Wallet loaded: ${this.wallet.publicKey.toBase58()}`);
      } catch (err: unknown) {
        logger.error(`[ExecutionAgent] Failed to decode PRIVATE_KEY: ${err}`);
        if (!config.dryRunMode) {
          throw new Error('Invalid PRIVATE_KEY in non-dry-run mode');
        }
      }
    } else if (config.dryRunMode) {
      logger.info('[ExecutionAgent] Operating in DRY_RUN_MODE. Real wallet private key not required.');
    }
  }

  private setupEventListeners(): void {
    eventBus.on('AUDIT_PASSED', async ({ token }) => {
      await this.executeBuy(token);
    });

    eventBus.on('POSITION_OPENED', (pos: IPositionState) => {
      if (pos.isCopyTrade) return; // Copy trade does not occupy scanner limits
      this.activeMints.add(pos.tokenAddress);
      if (this.activeMints.size >= config.maxOpenPositions) {
        logger.info(`[ExecutionAgent] Max open positions (${config.maxOpenPositions}) reached. Pausing scanner.`);
        eventBus.emit('PAUSE_SCAN');
      }
    });

    eventBus.on('POSITION_CLOSED', (summary: { tokenAddress: string }) => {
      this.activeMints.delete(summary.tokenAddress);
      if (this.activeMints.size < config.maxOpenPositions) {
        logger.info(`[ExecutionAgent] Active positions (${this.activeMints.size}/${config.maxOpenPositions}) below limit. Resuming scanner.`);
        eventBus.emit('RESUME_SCAN');
      }
    });
  }

  public async executeBuy(token: ITokenData): Promise<void> {
    if (this.activeMints.size >= config.maxOpenPositions) {
      logger.warn(`[ExecutionAgent] Max open positions (${this.activeMints.size}/${config.maxOpenPositions}) reached. Skipping buy for [${token.symbol}].`);
      return;
    }

    if (this.activeMints.has(token.mint)) {
      logger.warn(`[ExecutionAgent] Token [${token.symbol}] already has an active position. Skipping duplicate buy.`);
      return;
    }

    if (this.isExecuting) {
      logger.warn(`[ExecutionAgent] Execution currently busy with another transaction. Skipping token [${token.symbol}].`);
      return;
    }

    this.isExecuting = true;
    const startTime = Date.now();

    try {
      logger.info(
        `[ExecutionAgent] Initiating BUY Order for [${token.symbol}] (${token.mint.slice(0, 8)}...) [Position ${this.activeMints.size + 1}/${config.maxOpenPositions}] | Amount: ${config.buyAmountSol} SOL | Slippage: ${config.slippageBps} bps`
      );

      if (this.activeMints.size + 1 >= config.maxOpenPositions) {
        eventBus.emit('PAUSE_SCAN');
      }

      if (config.dryRunMode) {
        await this.executeDryRunBuy(token);
      } else {
        await this.executeLiveBuy(token);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
      logger.error(`[ExecutionAgent] Critical error during Buy execution: ${errorMsg}`);
      if (this.activeMints.size < config.maxOpenPositions) {
        eventBus.emit('RESUME_SCAN');
      }
    } finally {
      this.isExecuting = false;
      logger.info(`[ExecutionAgent] Buy lifecycle finished in ${Date.now() - startTime}ms.`);
    }
  }

  private async executeDryRunBuy(token: ITokenData): Promise<void> {
    // 1. Fetch live mainnet reserves for this real coin
    let liveCurve: { virtualSolReserves: bigint; virtualTokenReserves: bigint } | undefined = undefined;
    const rawPayload = (token.rawPayload as Record<string, any>) || {};

    try {
      const res = await axios.get(`https://frontend-api.pump.fun/coins/${token.mint}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        timeout: 3500,
      });
      if (res.data && res.data.virtual_sol_reserves) {
        liveCurve = {
          virtualSolReserves: BigInt(Math.floor(Number(res.data.virtual_sol_reserves))),
          virtualTokenReserves: BigInt(Math.floor(Number(res.data.virtual_token_reserves))),
        };
      }
    } catch {
      if (rawPayload.virtual_sol_reserves && rawPayload.virtual_token_reserves) {
        liveCurve = {
          virtualSolReserves: BigInt(Math.floor(Number(rawPayload.virtual_sol_reserves))),
          virtualTokenReserves: BigInt(Math.floor(Number(rawPayload.virtual_token_reserves))),
        };
      }
    }

    // Money Management Rule: Max 10% of total balance per trade
    const paperBal = simulator.getSolBalance();
    const entryAmountSol = config.dryRunMode
      ? Math.max(0.01, Math.min(config.buyAmountSol, Number((paperBal * 0.10).toFixed(4))))
      : config.buyAmountSol;

    const buyResult = simulator.executePaperBuy(
      token.mint,
      entryAmountSol,
      liveCurve
    );

    if (!buyResult.success) {
      logger.error(`[ExecutionAgent] [PaperBuy] Buy failed: ${buyResult.error}`);
      eventBus.emit('RESUME_SCAN');
      return;
    }

    let aiExecutionPlan = 'Jito MEV instant bundle paper routed';
    let aiModel = config.agent3Model;

    try {
      const planPromise = aiService.planExecutionWithAI({
        symbol: token.symbol,
        mint: token.mint,
        buyAmountSol: config.buyAmountSol,
        slippageBps: config.slippageBps,
      });

      // Race for 2500ms so trading pipeline never stalls
      const plan = await Promise.race([
        planPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);

      if (plan) {
        aiExecutionPlan = plan.execution_note;
        aiModel = plan.model;
        logger.info(`[ExecutionAgent:Grok] Strategy: "${aiExecutionPlan}" | Model: ${aiModel}`);
      } else {
        planPromise
          .then((bgPlan) => {
            if (bgPlan) {
              logger.info(
                `[ExecutionAgent:Grok] Strategy (Async): "${bgPlan.execution_note}" | Model: ${bgPlan.model}`
              );
            }
          })
          .catch(() => {});
      }
    } catch (aiErr) {
      logger.debug(`[ExecutionAgent:Grok] Fallback notice: ${aiErr}`);
    }

    const initialVirtualSol = liveCurve
      ? Number(liveCurve.virtualSolReserves) / 1e9
      : rawPayload.virtual_sol_reserves
      ? Number(rawPayload.virtual_sol_reserves) / 1e9
      : 30.0;

    const isCopyTrade = token.keywordsFound?.includes('COPY_TRADE') || false;

    const position: IPositionState = {
      tokenAddress: token.mint,
      symbol: token.symbol,
      name: token.name,
      entryPriceSol: buyResult.priceSol,
      currentPriceSol: buyResult.priceSol,
      amountToken: buyResult.tokensBought,
      entryTimestamp: Date.now(),
      pnlPercent: 0,
      pnlSol: 0,
      peakPriceSol: buyResult.priceSol,
      status: 'OPEN',
      entryTxSignature: buyResult.signature,
      isCopyTrade,
      previousVirtualSol: initialVirtualSol,
      currentVirtualSol: initialVirtualSol,
      solDeltaPercent: 0,
      gainMultiplier: 1.0,
      isWhaleDump: false,
      isExitTriggered: false,
      exitReason: 'NONE',
      tickCount: 0,
      lastPolledAt: new Date().toISOString(),
      aiExecutionPlan,
      aiModel,
    };

    simulator.setActiveTrade(position);

    logger.info(
      `[ExecutionAgent] [PaperBuy] >>> POSITION_OPENED <<< [${token.symbol}] | Tokens: ${(
        Number(position.amountToken) / 1e6
      ).toFixed(2)} | Entry Price: ${position.entryPriceSol.toExponential(4)} SOL | Sig: ${position.entryTxSignature}`
    );

    eventBus.emit('POSITION_OPENED', position);
  }

  private async executeLiveBuy(token: ITokenData): Promise<void> {
    if (!this.wallet) {
      throw new Error('Cannot execute live buy: Wallet is not initialized.');
    }

    const mintPubkey = new PublicKey(token.mint);
    const bondingCurvePda = getBondingCurvePDA(mintPubkey);

    // Fetch bonding curve account data to calculate minimum tokens out
    const curveAccountInfo = await this.connection.getAccountInfo(bondingCurvePda);
    if (!curveAccountInfo || !curveAccountInfo.data) {
      throw new Error(`Failed to fetch bonding curve account for mint ${token.mint}`);
    }

    const curveData = parseBondingCurveAccount(curveAccountInfo.data);
    const buyLamports = BigInt(Math.floor(config.buyAmountSol * 1e9));

    // Calculate expected tokens out
    const expectedTokensOut = calculateTokensForSol(buyLamports, curveData);
    if (expectedTokensOut <= 0n) {
      throw new Error('Calculated token output is zero.');
    }

    // Apply slippage tolerance
    const slippageMultiplier = 10000n - BigInt(config.slippageBps);
    const minTokensOut = (expectedTokensOut * slippageMultiplier) / 10000n;

    // Build instructions
    const userAta = getAssociatedTokenAddressSync(
      mintPubkey,
      this.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const instructions = [
      // Priority Fee
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: config.priorityFeeMicroLamports,
      }),
      // Create ATA if not exists
      createAssociatedTokenAccountIdempotentInstruction(
        this.wallet.publicKey,
        userAta,
        this.wallet.publicKey,
        mintPubkey
      ),
      // Pump.fun Buy Instruction
      createPumpFunBuyInstruction(
        this.wallet.publicKey,
        mintPubkey,
        expectedTokensOut,
        buyLamports
      ),
    ];

    // Jito MEV Tip Instruction if tip > 0
    if (config.jitoTipSol > 0) {
      const tipLamports = BigInt(Math.floor(config.jitoTipSol * 1e9));
      instructions.push(createJitoTipInstruction(this.wallet.publicKey, tipLamports));
    }

    // Compile Versioned Transaction
    const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
    const messageV0 = new TransactionMessage({
      payerKey: this.wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions,
    }).compileToV0Message();

    const versionedTx = new VersionedTransaction(messageV0);
    versionedTx.sign([this.wallet]);

    logger.info(`[ExecutionAgent] Sending Buy Transaction via Jito MEV Block Engine...`);
    const bundleId = await sendJitoBundle([versionedTx]);

    let txSignature = '';
    if (bundleId) {
      txSignature = bs58.encode(versionedTx.signatures[0]);
      logger.info(`[ExecutionAgent] Bundle submitted. Tx Signature: ${txSignature}`);
    } else {
      logger.warn('[ExecutionAgent] Jito failed. Fallback to standard high-priority RPC broadcast...');
      txSignature = await this.connection.sendRawTransaction(versionedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });
      logger.info(`[ExecutionAgent] Broadcasted via RPC. Sig: ${txSignature}`);
    }

    // Wait for confirmation
    const confirmation = await this.connection.confirmTransaction(
      {
        signature: txSignature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'confirmed'
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction confirmed with error: ${JSON.stringify(confirmation.value.err)}`);
    }

    const entryPriceSol = calculateTokenPriceSol(curveData);
    const initialVirtualSol = Number(curveData.virtualSolReserves) / 1e9;

    let aiExecutionPlan = 'Live Jito MEV transaction confirmed';
    let aiModel = config.agent3Model;

    try {
      const planPromise = aiService.planExecutionWithAI({
        symbol: token.symbol,
        mint: token.mint,
        buyAmountSol: config.buyAmountSol,
        slippageBps: config.slippageBps,
      });

      const plan = await Promise.race([
        planPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);

      if (plan) {
        aiExecutionPlan = plan.execution_note;
        aiModel = plan.model;
      } else {
        planPromise
          .then((bgPlan) => {
            if (bgPlan) {
              logger.info(
                `[ExecutionAgent:Grok] Live Strategy (Async): "${bgPlan.execution_note}" | Model: ${bgPlan.model}`
              );
            }
          })
          .catch(() => {});
      }
    } catch {
      // Non-fatal
    }

    const isCopyTrade = token.keywordsFound?.includes('COPY_TRADE') || false;

    const position: IPositionState = {
      tokenAddress: token.mint,
      symbol: token.symbol,
      name: token.name,
      entryPriceSol,
      currentPriceSol: entryPriceSol,
      amountToken: expectedTokensOut,
      entryTimestamp: Date.now(),
      pnlPercent: 0,
      pnlSol: 0,
      peakPriceSol: entryPriceSol,
      status: 'OPEN',
      entryTxSignature: txSignature,
      isCopyTrade,
      previousVirtualSol: initialVirtualSol,
      currentVirtualSol: initialVirtualSol,
      solDeltaPercent: 0,
      gainMultiplier: 1.0,
      isWhaleDump: false,
      isExitTriggered: false,
      exitReason: 'NONE',
      tickCount: 0,
      lastPolledAt: new Date().toISOString(),
      aiExecutionPlan,
      aiModel,
    };

    logger.info(
      `[ExecutionAgent] >>> POSITION_OPENED <<< [${token.symbol}] On-Chain! Entry: ${entryPriceSol.toExponential(4)} SOL | Amount: ${(
        Number(expectedTokensOut) / 1e6
      ).toFixed(2)} tokens`
    );

    eventBus.emit('POSITION_OPENED', position);
  }
}
