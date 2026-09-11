import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { IPositionState, IWhaleAlert } from '../types';
import { eventBus } from '../utils/eventBus';
import { logger } from '../utils/logger';
import { config } from '../config';
import {
  getBondingCurvePDA,
  parseBondingCurveAccount,
  calculateTokenPriceSol,
} from '../utils/pumpfun';
import { simulator } from '../utils/simulator';
import { aiService } from '../services/aiService';

export class TrackerAgent {
  private connection: Connection;
  private activePositions: Map<string, IPositionState> = new Map();
  private trackingInterval: NodeJS.Timeout | null = null;
  private knownWhales: Map<string, number> = new Map(); // address -> lastKnownBalance
  private initialSupply = 1000000000; // 1 Billion tokens

  constructor(connection?: Connection) {
    this.connection = connection || new Connection(config.rpcUrl, 'confirmed');
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.on('POSITION_OPENED', (position: IPositionState) => {
      if (position.isCopyTrade) return; // Copy trade operates independently from AI agents
      this.addPosition(position);
    });

    eventBus.on('POSITION_CLOSED', (summary: { tokenAddress: string }) => {
      this.removePosition(summary.tokenAddress);
    });
  }

  public addPosition(position: IPositionState): void {
    const initialVirtualSol = position.previousVirtualSol || 30.0;
    const trackedPos: IPositionState = {
      ...position,
      entryVirtualSol: initialVirtualSol,
      previousVirtualSol: initialVirtualSol,
      currentVirtualSol: initialVirtualSol,
      solDeltaPercent: 0,
      gainMultiplier: 1.0,
      isWhaleDump: false,
      isExitTriggered: false,
      exitReason: 'NONE',
      hasExternalBuyerVolume: false,
      isTrailingLockActive: false,
      momentumTimerSeconds: 3,
      tickCount: 0,
      lastPolledAt: new Date().toISOString(),
    };

    this.activePositions.set(position.tokenAddress, trackedPos);
    logger.info(
      `[TrackerAgent] Started 1s scalper tracking for [${position.symbol}] (${position.tokenAddress.slice(0, 8)}...) | Active: ${this.activePositions.size}/${config.maxOpenPositions} | 3s Momentum Guard ARMED.`
    );

    this.scanInitialWhales(position.tokenAddress);

    if (!this.trackingInterval) {
      this.trackingInterval = setInterval(() => {
        this.tickTracking();
      }, config.trackerIntervalMs);
    }
  }

  public removePosition(tokenAddress: string): void {
    this.activePositions.delete(tokenAddress);
    logger.info(`[TrackerAgent] Position tracking stopped for ${tokenAddress.slice(0, 8)}... Remaining active: ${this.activePositions.size}`);
    if (this.activePositions.size === 0 && this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  public stopTracking(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    this.activePositions.clear();
    this.knownWhales.clear();
    logger.info('[TrackerAgent] All position tracking stopped.');
  }

  private async scanInitialWhales(tokenAddress: string): Promise<void> {
    if (config.dryRunMode) {
      return;
    }

    try {
      const mintPubkey = new PublicKey(tokenAddress);
      const largestAccounts = await this.connection.getTokenLargestAccounts(mintPubkey);
      const bondingCurvePda = getBondingCurvePDA(mintPubkey);

      for (const acc of largestAccounts.value) {
        if (acc.address.toBase58() === bondingCurvePda.toBase58()) continue;

        const balance = acc.uiAmount || 0;
        const percentOfSupply = (balance / this.initialSupply) * 100;

        if (percentOfSupply >= config.whaleSupplyPercentThreshold) {
          this.knownWhales.set(acc.address.toBase58(), balance);
          logger.info(
            `[TrackerAgent] Whale Identified: ${acc.address.toBase58().slice(0, 8)}... holding ${balance.toLocaleString()} tokens (${percentOfSupply.toFixed(2)}% supply)`
          );
        }
      }
    } catch (err: unknown) {
      logger.warn(`[TrackerAgent] Initial whale scan non-fatal error: ${err}`);
    }
  }

  private async tickTracking(): Promise<void> {
    if (this.activePositions.size === 0) return;

    for (const [tokenAddress, pos] of Array.from(this.activePositions.entries())) {
      try {
        pos.tickCount = (pos.tickCount || 0) + 1;

        let currentVirtualSol = pos.previousVirtualSol || 30.0;
        let currentVirtualToken = 1073000000;

        // Live Mainnet polling: fetch from pump.fun frontend API or Solana RPC
        let liveCoin: any = null;
        try {
          const res = await axios.get(`https://frontend-api.pump.fun/coins/${tokenAddress}`, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            },
            timeout: 3000,
          });
          if (res.data && res.data.virtual_sol_reserves) {
            liveCoin = res.data;
          }
        } catch {
          // Fallback to on-chain RPC
        }

        let currentPriceSol = 0;
        let isPumpFunToken = false;

        if (liveCoin && liveCoin.virtual_sol_reserves) {
          isPumpFunToken = true;
          currentVirtualSol = Number(liveCoin.virtual_sol_reserves) / 1e9;
          if (liveCoin.virtual_token_reserves) {
            currentVirtualToken = Number(liveCoin.virtual_token_reserves) / 1e6;
          }
          currentPriceSol = currentVirtualSol / currentVirtualToken;
        } else {
          try {
            const mintPubkey = new PublicKey(tokenAddress);
            const bondingCurvePda = getBondingCurvePDA(mintPubkey);
            const curveAccount = await this.connection.getAccountInfo(bondingCurvePda);
            if (curveAccount?.data) {
              const curveData = parseBondingCurveAccount(curveAccount.data);
              currentVirtualSol = Number(curveData.virtualSolReserves) / 1e9;
              currentVirtualToken = Number(curveData.virtualTokenReserves) / 1e6;
              currentPriceSol = currentVirtualSol / currentVirtualToken;
              isPumpFunToken = true;
            }
          } catch {
            currentVirtualSol = pos.previousVirtualSol || 30.0;
          }
        }

        // If not a Pump.fun bonding curve coin (e.g. Raydium, Meteora, graduated token from Axiom)
        if (!isPumpFunToken || currentPriceSol <= 0) {
          try {
            const dexRes = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, {
              headers: { Accept: 'application/json' },
              timeout: 2500,
            });
            if (dexRes.data?.pairs && dexRes.data.pairs.length > 0) {
              const pair = dexRes.data.pairs[0];
              const priceNative = Number(pair.priceNative || 0);
              if (priceNative > 0) {
                currentPriceSol = priceNative;
              }
            }
          } catch {
            // fallback to previous price
          }
        }

        if (currentPriceSol <= 0) {
          currentPriceSol = pos.currentPriceSol || pos.entryPriceSol || 0.000001;
        }

        // Whale Dump Detection
        const prevSol = pos.previousVirtualSol || currentVirtualSol;
        const solDelta = currentVirtualSol - prevSol;
        const solDeltaPercent = prevSol > 0 ? (solDelta / prevSol) * 100 : 0;
        const isWhaleDump = solDeltaPercent <= -config.whaleSupplyPercentThreshold || solDelta <= -1.5;

        // 1. 3-second momentum guard
        const elapsedSeconds = Math.max(0, (Date.now() - pos.entryTimestamp) / 1000);
        const remainingSeconds = Math.max(0, Math.ceil(3 - elapsedSeconds));
        pos.momentumTimerSeconds = remainingSeconds;

        // 2. Check for incoming buy activity from other traders
        const entrySol = pos.entryVirtualSol || 30.0;
        if (currentVirtualSol > entrySol + 0.005 || solDelta > 0.005) {
          if (!pos.hasExternalBuyerVolume) {
            pos.hasExternalBuyerVolume = true;
            logger.info(`[TrackerAgent] 🚀 Buyer volume detected for [${pos.symbol}]! Momentum confirmed.`);
          }
        }

        // 3. PnL & Multiplier
        const pnlPercent = ((currentPriceSol - pos.entryPriceSol) / pos.entryPriceSol) * 100;
        const gainMultiplier = parseFloat((currentPriceSol / pos.entryPriceSol).toFixed(2));

        // 4. Trailing Lock: If PnL reaches >= +3%, lock Stop Loss at +1%
        if (pnlPercent >= 3.0 && !pos.isTrailingLockActive) {
          pos.isTrailingLockActive = true;
          logger.info(`[TrackerAgent] 🔒 Trailing Lock ARMED for [${pos.symbol}] (Peak >= +3%)! Stop Loss locked at +1%.`);
        }

        // 5. Check All Exit Triggers
        let isMomentumAbort = false;
        if (!pos.isCopyTrade && elapsedSeconds >= 3 && !pos.hasExternalBuyerVolume) {
          isMomentumAbort = true;
        }

        const isTrailingStopLoss = pos.isTrailingLockActive && pnlPercent <= 1.0;
        const isTakeProfit = pnlPercent >= 8.0 || (config.takeProfitMultiplier > 1.0 && gainMultiplier >= config.takeProfitMultiplier && pnlPercent >= 5.0);
        const isStopLoss = !pos.isTrailingLockActive && pnlPercent <= -config.stopLossPercent;

        const isExitTriggered = isWhaleDump || isMomentumAbort || isTrailingStopLoss || isTakeProfit || isStopLoss;

        let exitReason = 'NONE';
        if (isWhaleDump) {
          exitReason = 'WHALE_DUMP_EMERGENCY';
        } else if (isMomentumAbort) {
          exitReason = 'EXIT: NO BUY MOMENTUM IN 3 SECONDS (SNIPER ABORT)';
          logger.warn(`[TrackerAgent] EXIT: NO BUY MOMENTUM IN 3 SECONDS (SNIPER ABORT) on [${pos.symbol}]`);
        } else if (isTrailingStopLoss) {
          exitReason = 'TRAILING_STOP_LOCK_1PCT';
          logger.info(`[TrackerAgent] *** TRAILING LOCK TRIGGERED (+1%) on [${pos.symbol}] ***`);
        } else if (isTakeProfit) {
          exitReason = 'TAKE_PROFIT_8PCT';
        } else if (isStopLoss) {
          exitReason = 'STOP_LOSS';
        }

        pos.previousVirtualSol = currentVirtualSol;
        pos.currentVirtualSol = currentVirtualSol;
        pos.currentPriceSol = currentPriceSol;
        if (currentPriceSol > pos.peakPriceSol) {
          pos.peakPriceSol = currentPriceSol;
        }
        pos.gainMultiplier = gainMultiplier;
        pos.pnlPercent = parseFloat(pnlPercent.toFixed(2));
        pos.solDeltaPercent = parseFloat(solDeltaPercent.toFixed(2));
        pos.isWhaleDump = isWhaleDump;
        pos.isExitTriggered = isExitTriggered;
        pos.exitReason = exitReason;
        pos.lastPolledAt = new Date().toISOString();

        const tokenAmountNumber = Number(pos.amountToken) / 1e6;
        const currentSolValue = tokenAmountNumber * currentPriceSol;
        const entrySolValue = tokenAmountNumber * pos.entryPriceSol;
        pos.pnlSol = currentSolValue - entrySolValue;

        // Periodic AI analysis
        if (pos.tickCount % 5 === 0 || solDeltaPercent <= -3.0) {
          aiService
            .analyzeTrackerWithAI({
              symbol: pos.symbol,
              pnlPercent,
              gainMultiplier,
              solDeltaPercent,
              currentVirtualSol,
            })
            .then((aiAnalysis) => {
              if (aiAnalysis && this.activePositions.has(tokenAddress)) {
                pos.aiTrackerSentiment = `[${aiAnalysis.sentiment}] ${aiAnalysis.analysis}`;
                pos.aiModel = aiAnalysis.model;
              }
            })
            .catch(() => {});
        }

        logger.info(
          `[TrackerAgent] [${pos.symbol}] PnL: ${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}% | Multiplier: ${gainMultiplier}x | ΔSOL: ${solDeltaPercent.toFixed(2)}% | Price: ${currentPriceSol.toExponential(4)} SOL`
        );

        simulator.setActiveTrade({ ...pos });
        eventBus.emit('POSITION_UPDATE', { ...pos });

        if (isWhaleDump) {
          const alert: IWhaleAlert = {
            tokenAddress: pos.tokenAddress,
            symbol: pos.symbol,
            whaleAddress: 'CURVE_RESERVES_DROP',
            amountTokens: 0n,
            percentOfSupply: Math.abs(solDeltaPercent),
            detectedAt: Date.now(),
          };
          logger.warn(
            `[TrackerAgent] !!! WHALE DUMP DETECTED for [${pos.symbol}] !!! Net outflow: ${solDelta.toFixed(2)} SOL`
          );
          eventBus.emit('WHALE_DUMP_WARNING', alert);
        }
      } catch (err: unknown) {
        logger.debug(`[TrackerAgent] Non-fatal tick error for ${tokenAddress}: ${err}`);
      }
    }

    eventBus.emit('ACTIVE_POSITIONS_UPDATE', Array.from(this.activePositions.values()));
  }
}
