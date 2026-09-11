import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import bs58 from 'bs58';
import axios from 'axios';
import {
  IPositionState,
  IWhaleAlert,
  IPositionCloseSummary,
} from '../types';
import { eventBus } from '../utils/eventBus';
import { logger } from '../utils/logger';
import { config } from '../config';
import {
  createPumpFunSellInstruction,
  getBondingCurvePDA,
  parseBondingCurveAccount,
  calculateSolForTokens,
} from '../utils/pumpfun';
import { createJitoTipInstruction, sendJitoBundle } from '../utils/jito';
import { simulator } from '../utils/simulator';
import { aiService } from '../services/aiService';

export class ExitAgent {
  private connection: Connection;
  private wallet: Keypair | null = null;
  private activePositions: Map<string, IPositionState> = new Map();
  private exitingMints: Set<string> = new Set();

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
      } catch (err: unknown) {
        logger.error(`[ExitAgent] Failed to decode wallet key: ${err}`);
      }
    }
  }

  private setupEventListeners(): void {
    eventBus.on('POSITION_OPENED', (position: IPositionState) => {
      if (position.isCopyTrade) return; // Copy trade exits independently when influencer sells
      this.activePositions.set(position.tokenAddress, { ...position });
      this.exitingMints.delete(position.tokenAddress);
      logger.info(
        `[ExitAgent] Monitoring exits for [${position.symbol}] (${this.activePositions.size}/${config.maxOpenPositions} active) | TP: ${config.takeProfitMultiplier}x | SL: -${config.stopLossPercent}%`
      );
    });

    eventBus.on('POSITION_UPDATE', (position: IPositionState) => {
      if (position.isCopyTrade) return;
      this.activePositions.set(position.tokenAddress, { ...position });
      this.evaluateTriggers(position);
    });

    eventBus.on('WHALE_DUMP_WARNING', (alert: IWhaleAlert) => {
      this.handleWhaleDumpWarning(alert);
    });
  }

  private async evaluateTriggers(position: IPositionState): Promise<void> {
    if (this.exitingMints.has(position.tokenAddress)) return;

    if (position.isExitTriggered && position.exitReason && position.exitReason !== 'NONE') {
      logger.info(`[ExitAgent] *** EXIT CONDITION TRIGGERED on [${position.symbol}]: ${position.exitReason} ***`);
      await this.executeExit(position.tokenAddress, position.exitReason);
      return;
    }

    // Trigger 1: Take Profit (TP +8% / 1.08x)
    const currentGainMultiplier = position.currentPriceSol / position.entryPriceSol;
    if (position.pnlPercent >= 8.0 || (config.takeProfitMultiplier > 1.0 && currentGainMultiplier >= config.takeProfitMultiplier && position.pnlPercent >= 5.0)) {
      logger.info(
        `[ExitAgent] *** TAKE PROFIT (+8%) TRIGGERED *** [${position.symbol}] PnL: +${position.pnlPercent.toFixed(2)}% | Multiplier: ${currentGainMultiplier.toFixed(2)}x (Hit & Run Exit)!`
      );
      await this.executeExit(position.tokenAddress, 'TAKE_PROFIT_8PCT');
      return;
    }

    // Trigger 2: Trailing Lock (+1% Break-Even Lock from +3% peak)
    if (position.isTrailingLockActive && position.pnlPercent <= 1.0) {
      logger.info(
        `[ExitAgent] *** TRAILING LOCK TRIGGERED (+1%) *** [${position.symbol}] Locking profit at +${position.pnlPercent.toFixed(2)}%!`
      );
      await this.executeExit(position.tokenAddress, 'TRAILING_STOP_LOCK_1PCT');
      return;
    }

    // Trigger 3: Stop Loss (SL -4%)
    if (!position.isTrailingLockActive && position.pnlPercent <= -config.stopLossPercent) {
      logger.warn(
        `[ExitAgent] *** STOP LOSS (-4%) TRIGGERED *** [${position.symbol}] PnL: ${position.pnlPercent.toFixed(2)}% (Limit: -${config.stopLossPercent}%)!`
      );
      await this.executeExit(position.tokenAddress, 'STOP_LOSS');
      return;
    }
  }

  private async handleWhaleDumpWarning(alert: IWhaleAlert): Promise<void> {
    if (!this.activePositions.has(alert.tokenAddress)) return;
    if (this.exitingMints.has(alert.tokenAddress)) return;

    logger.warn(
      `[ExitAgent] *** EMERGENCY WHALE DUMP EXIT TRIGGERED for [${alert.symbol}] *** Dumping position immediately!`
    );
    await this.executeExit(alert.tokenAddress, 'WHALE_DUMP_EMERGENCY');
  }

  public async executeExit(
    tokenAddress: string,
    reason: string
  ): Promise<void> {
    const position = this.activePositions.get(tokenAddress);
    if (!position || this.exitingMints.has(tokenAddress)) return;

    this.exitingMints.add(tokenAddress);
    position.status = 'CLOSING';
    const startTime = Date.now();
    const posCopy = { ...position };

    logger.info(
      `[ExitAgent] Executing SELL ALL for [${posCopy.symbol}] | Reason: ${reason} | Amount: ${(
        Number(posCopy.amountToken) / 1e6
      ).toFixed(2)} tokens`
    );

    try {
      if (config.dryRunMode) {
        await this.executeDryRunSell(posCopy, reason, startTime);
      } else {
        await this.executeLiveSell(posCopy, reason, startTime);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
      logger.error(`[ExitAgent] Critical error executing Sell for [${posCopy.symbol}]: ${errorMsg}`);
      this.exitingMints.delete(tokenAddress);
      if (this.activePositions.has(tokenAddress)) {
        this.activePositions.get(tokenAddress)!.status = 'OPEN';
      }
    }
  }

  private async executeDryRunSell(
    position: IPositionState,
    reason: string,
    startTime: number
  ): Promise<void> {
    // 1. Fetch real live mainnet curve reserves at moment of exit
    let liveCurve: { virtualSolReserves: bigint; virtualTokenReserves: bigint } | undefined = undefined;
    try {
      const res = await axios.get(`https://frontend-api.pump.fun/coins/${position.tokenAddress}`, {
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
      // Fallback
    }

    const sellResult = simulator.executePaperSell(position.tokenAddress, position.amountToken, liveCurve);

    if (!sellResult.success) {
      throw new Error(`Paper sell failed: ${sellResult.error}`);
    }

    const durationMs = Date.now() - position.entryTimestamp;
    const pnlSol = sellResult.netPnlSol;
    const pnlPercent = sellResult.netPnlPercent;
    const gainMultiplier = parseFloat((sellResult.priceSol / position.entryPriceSol).toFixed(2));

    const summary: IPositionCloseSummary = {
      tokenAddress: position.tokenAddress,
      symbol: position.symbol,
      entryPriceSol: position.entryPriceSol,
      exitPriceSol: sellResult.priceSol,
      amountToken: position.amountToken,
      pnlSol,
      pnlPercent,
      gainMultiplier,
      solDeltaPercent: position.solDeltaPercent || 0,
      durationMs,
      exitReason: reason,
      txSignature: sellResult.signature,
      closedAt: new Date().toISOString(),
    };

    await this.finalizePositionClose(summary, position);
  }

  private async executeLiveSell(
    position: IPositionState,
    reason: string,
    startTime: number
  ): Promise<void> {
    if (!this.wallet) {
      throw new Error('Cannot execute live sell: Wallet is not initialized.');
    }

    const mintPubkey = new PublicKey(position.tokenAddress);
    const bondingCurvePda = getBondingCurvePDA(mintPubkey);

    const curveAccountInfo = await this.connection.getAccountInfo(bondingCurvePda);
    if (!curveAccountInfo || !curveAccountInfo.data) {
      throw new Error(`Failed to fetch bonding curve for mint ${position.tokenAddress}`);
    }

    const curveData = parseBondingCurveAccount(curveAccountInfo.data);
    const expectedSolOutLamports = calculateSolForTokens(position.amountToken, curveData);

    // Slippage tolerance: for emergency dumps allow higher slippage to guarantee exit
    const isEmergency = reason === 'WHALE_DUMP' || reason === 'WHALE_DUMP_EMERGENCY';
    const slippageBps = isEmergency ? Math.max(config.slippageBps, 2000) : config.slippageBps;
    const slippageMultiplier = 10000n - BigInt(slippageBps);
    const minSolOutputLamports = (expectedSolOutLamports * slippageMultiplier) / 10000n;

    const instructions = [
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: config.priorityFeeMicroLamports * 2, // Double priority fee for fast exit
      }),
      createPumpFunSellInstruction(
        this.wallet.publicKey,
        mintPubkey,
        position.amountToken,
        minSolOutputLamports
      ),
    ];

    if (config.jitoTipSol > 0) {
      const tipLamports = BigInt(Math.floor(config.jitoTipSol * 1e9));
      instructions.push(createJitoTipInstruction(this.wallet.publicKey, tipLamports));
    }

    const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
    const messageV0 = new TransactionMessage({
      payerKey: this.wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions,
    }).compileToV0Message();

    const versionedTx = new VersionedTransaction(messageV0);
    versionedTx.sign([this.wallet]);

    logger.info(`[ExitAgent] Submitting Sell Transaction via Jito MEV...`);
    const bundleId = await sendJitoBundle([versionedTx]);

    let txSignature = '';
    if (bundleId) {
      txSignature = bs58.encode(versionedTx.signatures[0]);
    } else {
      logger.warn('[ExitAgent] Jito bundle failed, falling back to direct RPC broadcast...');
      txSignature = await this.connection.sendRawTransaction(versionedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });
    }

    const confirmation = await this.connection.confirmTransaction(
      {
        signature: txSignature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'confirmed'
    );

    if (confirmation.value.err) {
      throw new Error(`Sell transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    const exitPriceSol = Number(expectedSolOutLamports) / 1e9 / (Number(position.amountToken) / 1e6);
    const pnlSol = (Number(expectedSolOutLamports) / 1e9) - (Number(position.amountToken) / 1e6) * position.entryPriceSol;
    const pnlPercent = ((exitPriceSol - position.entryPriceSol) / position.entryPriceSol) * 100;
    const gainMultiplier = parseFloat((exitPriceSol / position.entryPriceSol).toFixed(2));
    const durationMs = Date.now() - position.entryTimestamp;

    const summary: IPositionCloseSummary = {
      tokenAddress: position.tokenAddress,
      symbol: position.symbol,
      entryPriceSol: position.entryPriceSol,
      exitPriceSol,
      amountToken: position.amountToken,
      pnlSol,
      pnlPercent,
      gainMultiplier,
      solDeltaPercent: position.solDeltaPercent || 0,
      durationMs,
      exitReason: reason,
      txSignature,
      closedAt: new Date().toISOString(),
    };

    await this.finalizePositionClose(summary, position);
  }

  private async finalizePositionClose(summary: IPositionCloseSummary, position: IPositionState): Promise<void> {
    logger.info('================================================================');
    logger.info(`[ExitAgent] >>> POSITION CLOSED: [${summary.symbol}] <<<`);
    logger.info(`[ExitAgent] Reason:         ${summary.exitReason}`);
    logger.info(`[ExitAgent] Entry Price:    ${summary.entryPriceSol.toExponential(4)} SOL`);
    logger.info(`[ExitAgent] Exit Price:     ${summary.exitPriceSol.toExponential(4)} SOL`);
    logger.info(`[ExitAgent] PnL SOL:        ${summary.pnlSol >= 0 ? '+' : ''}${summary.pnlSol.toFixed(4)} SOL`);
    logger.info(`[ExitAgent] PnL Percent:    ${summary.pnlPercent >= 0 ? '+' : ''}${summary.pnlPercent.toFixed(2)}%`);
    logger.info(`[ExitAgent] Duration:       ${(summary.durationMs / 1000).toFixed(1)}s`);
    logger.info(`[ExitAgent] Tx Signature:   ${summary.txSignature}`);
    const paperStats = simulator.getPaperStats();
    logger.info(`[PaperTrading Summary] Initial: ${paperStats.initialBalanceSol.toFixed(2)} SOL | Current: ${paperStats.currentBalanceSol.toFixed(4)} SOL | Net PnL: ${paperStats.totalPaperPnlPercent >= 0 ? '+' : ''}${paperStats.totalPaperPnlPercent.toFixed(2)}% | Trades: ${paperStats.totalTrades} (Win Rate: ${paperStats.winRatePercent}%) | Status: [${paperStats.status}]`);
    logger.info('================================================================');

    // Agen 5: Synthesize Exit with Claude Opus 4.8
    try {
      const aiSynthesis = await aiService.synthesizeExitWithAI({
        symbol: summary.symbol,
        exitReason: summary.exitReason,
        pnlPercent: summary.pnlPercent,
        pnlSol: summary.pnlSol,
        gainMultiplier: summary.gainMultiplier,
        durationMs: summary.durationMs,
      });
      if (aiSynthesis) {
        summary.aiExitReport = aiSynthesis.exit_report;
        summary.aiPostMortem = aiSynthesis.post_mortem;
        summary.aiModel = aiSynthesis.model;
        logger.info(
          `[ExitAgent:ClaudeOpus] Post-Mortem: "${aiSynthesis.post_mortem}" | Report: "${aiSynthesis.exit_report}"`
        );
      }
    } catch (aiErr) {
      logger.debug(`[ExitAgent:ClaudeOpus] Fallback notice: ${aiErr}`);
    }

    // Node 14: Send Webhook / Telegram Alert
    const webhookPayload = {
      event: 'POSITION_CLOSED',
      token: summary.symbol,
      mint: summary.tokenAddress,
      exit_reason: summary.exitReason,
      gain_multiplier: `${summary.gainMultiplier || (summary.exitPriceSol / summary.entryPriceSol).toFixed(2)}x`,
      pnl_percent: `${summary.pnlPercent.toFixed(2)}%`,
      sol_delta: `${position.solDeltaPercent || 0}%`,
      ai_exit_report: summary.aiExitReport || 'Closed according to trading strategy',
      ai_post_mortem: summary.aiPostMortem || '',
      closed_at: summary.closedAt || new Date().toISOString(),
    };

    if (config.webhookUrl) {
      try {
        await axios.post(config.webhookUrl, webhookPayload, { timeout: 4000 });
        logger.info(`[ExitAgent] Webhook alert successfully dispatched to ${config.webhookUrl}`);
      } catch (err: unknown) {
        logger.debug(`[ExitAgent] Webhook notification dispatch note: ${err}`);
      }
    }

    // Reset state for this specific token
    this.activePositions.delete(position.tokenAddress);
    this.exitingMints.delete(position.tokenAddress);
    simulator.removeActiveTrade(position.tokenAddress);

    // Emit event and signal scanner to resume if under capacity
    eventBus.emit('POSITION_CLOSED', summary);
    if (this.activePositions.size < config.maxOpenPositions) {
      eventBus.emit('RESUME_SCAN');
    }
  }
}
