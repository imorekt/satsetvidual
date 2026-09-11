import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import {
  ITokenData,
  BondingCurveAccount,
  IPositionState,
  IPositionCloseSummary,
  IPaperTradingStats,
} from '../types';
import {
  calculateTokensForSol,
  calculateSolForTokens,
  calculateTokenPriceSol,
} from './pumpfun';
import { logger } from './logger';
import { config } from '../config';
import { eventBus } from './eventBus';

interface PaperTokenMarket {
  token: ITokenData;
  curve: BondingCurveAccount;
  holdersCount: number;
  tickCount: number;
  initialPriceSol: number;
}

export class SimulatorEngine {
  private initialSolBalance: number;
  private solBalance: number;
  private tokenBalances: Map<string, bigint> = new Map(); // mint -> token balance
  private markets: Map<string, PaperTokenMarket> = new Map(); // mint -> market state
  private dummyKeypair: Keypair;
  private totalTrades = 0;
  private winningTrades = 0;
  private losingTrades = 0;
  private activeTrades: Map<string, IPositionState> = new Map(); // mint -> position

  constructor() {
    this.initialSolBalance = config.simulatedInitialSol || 1.0;
    this.solBalance = this.initialSolBalance;
    this.dummyKeypair = Keypair.generate();

    logger.info('================================================================');
    logger.info(`[PaperTrading] Initialized Solana Mainnet Paper Wallet:`);
    logger.info(`[PaperTrading] Paper Balance:   ${this.solBalance.toFixed(4)} SOL`);
    logger.info(`[PaperTrading] Paper Address:   ${this.dummyKeypair.publicKey.toBase58()}`);
    logger.info(`[PaperTrading] Est Gas Fee:     ${config.paperWalletGasFeeSol} SOL per trade`);
    logger.info(`[PaperTrading] Max Positions:   ${config.maxOpenPositions} concurrent`);
    logger.info('================================================================');
  }

  public getPublicKey(): string {
    return this.dummyKeypair.publicKey.toBase58();
  }

  public getSolBalance(): number {
    return this.solBalance;
  }

  public getInitialBalance(): number {
    return this.initialSolBalance;
  }

  public depositSol(amount: number): number {
    if (amount <= 0 || isNaN(amount)) return this.solBalance;
    this.solBalance += amount;
    this.initialSolBalance += amount;
    logger.info(`[PaperTrading] + Deposited ${amount.toFixed(4)} SOL. New Balance: ${this.solBalance.toFixed(4)} SOL`);
    eventBus.emit('PAPER_STATS_UPDATE', this.getPaperStats());
    return this.solBalance;
  }

  public resetEngine(initialBalance = config.simulatedInitialSol || 1.0): void {
    this.initialSolBalance = initialBalance;
    this.solBalance = initialBalance;
    this.tokenBalances.clear();
    this.markets.clear();
    this.activeTrades.clear();
    this.tradeCosts.clear();
    this.totalTrades = 0;
    this.winningTrades = 0;
    this.losingTrades = 0;
    logger.info(`[PaperTrading] 🔄 Paper Trading Engine reset. New Balance: ${this.solBalance.toFixed(4)} SOL`);
    this.emitStatsUpdate();
  }

  public getPaperStats(): IPaperTradingStats {
    const tradesList = Array.from(this.activeTrades.values());
    const openPositionsValueSol = tradesList.reduce((acc, pos) => {
      const tokenAmt = Number(pos.amountToken) / 1e6;
      const price = pos.currentPriceSol || pos.entryPriceSol || 0;
      const val = tokenAmt * price;
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const totalEquitySol = Math.max(0, this.solBalance + openPositionsValueSol);
    const totalPnlSol = totalEquitySol - this.initialSolBalance;
    const totalPnlPercent = this.initialSolBalance > 0 ? (totalPnlSol / this.initialSolBalance) * 100 : 0;
    const winRate =
      this.totalTrades > 0
        ? parseFloat(((this.winningTrades / this.totalTrades) * 100).toFixed(1))
        : 0;

    return {
      initialBalanceSol: this.initialSolBalance,
      currentBalanceSol: parseFloat(totalEquitySol.toFixed(4)),
      totalPaperPnlSol: parseFloat(totalPnlSol.toFixed(4)),
      totalPaperPnlPercent: parseFloat(totalPnlPercent.toFixed(2)),
      totalTrades: this.totalTrades,
      winningTrades: this.winningTrades,
      losingTrades: this.losingTrades,
      winRatePercent: winRate,
      status: totalEquitySol >= this.initialSolBalance ? 'GROW' : 'REKT',
      activeTrade: tradesList[0] || null,
      activeTrades: tradesList,
    };
  }

  public setActiveTrade(position: IPositionState | null): void {
    if (!position) {
      // If explicit null passed without token, ignore or keep existing
    } else if (position.status === 'CLOSED') {
      this.activeTrades.delete(position.tokenAddress);
    } else {
      this.activeTrades.set(position.tokenAddress, position);
    }
    this.emitStatsUpdate();
  }

  public removeActiveTrade(mint: string): void {
    this.activeTrades.delete(mint);
    this.emitStatsUpdate();
  }

  public updatePositionPrice(tokenAddress: string, newPriceSol: number): void {
    const pos = this.activeTrades.get(tokenAddress);
    if (!pos || newPriceSol <= 0) return;
    pos.currentPriceSol = newPriceSol;
    if (newPriceSol > (pos.peakPriceSol || 0)) {
      pos.peakPriceSol = newPriceSol;
    }
    const tokenAmt = Number(pos.amountToken) / 1e6;
    pos.pnlSol = Number(((newPriceSol - pos.entryPriceSol) * tokenAmt).toFixed(6));
    pos.pnlPercent = Number((((newPriceSol - pos.entryPriceSol) / pos.entryPriceSol) * 100).toFixed(2));
    this.emitStatsUpdate();
  }

  private emitStatsUpdate(): void {
    const stats = this.getPaperStats();
    eventBus.emit('PAPER_STATS_UPDATE', stats);
  }

  public registerMarket(token: ITokenData, customCurve?: BondingCurveAccount): PaperTokenMarket {
    const raw = (token.rawPayload || {}) as Record<string, any>;
    const vSol = customCurve
      ? customCurve.virtualSolReserves
      : BigInt(Math.floor(Number(raw.virtual_sol_reserves || 30000000000)));
    const vToken = customCurve
      ? customCurve.virtualTokenReserves
      : BigInt(Math.floor(Number(raw.virtual_token_reserves || 1073000000000000)));

    const curve: BondingCurveAccount = customCurve || {
      discriminator: 0n,
      virtualTokenReserves: vToken,
      virtualSolReserves: vSol,
      realTokenReserves: 793100000n * 1000000n,
      realSolReserves: 0n,
      tokenTotalSupply: 1000000000n * 1000000n,
      complete: false,
    };

    const initialPrice = calculateTokenPriceSol(curve);

    const market: PaperTokenMarket = {
      token,
      curve,
      holdersCount: 20,
      tickCount: 0,
      initialPriceSol: initialPrice,
    };

    this.markets.set(token.mint, market);
    return market;
  }

  public getMarket(mint: string): PaperTokenMarket | undefined {
    return this.markets.get(mint);
  }

  /**
   * Execute Virtual Buy against live market bonding curve or known market price
   */
  private tradeCosts: Map<string, number> = new Map(); // mint -> entry cost in SOL

  public executePaperBuy(
    mint: string,
    solAmount: number,
    priceOrCurve?: number | { virtualSolReserves: bigint; virtualTokenReserves: bigint },
    liveCurveParam?: { virtualSolReserves: bigint; virtualTokenReserves: bigint }
  ): {
    success: boolean;
    tokensBought: bigint;
    priceSol: number;
    signature: string;
    error?: string;
  } {
    const knownPriceSol = typeof priceOrCurve === 'number' ? priceOrCurve : undefined;
    const liveCurve = typeof priceOrCurve === 'object' ? priceOrCurve : liveCurveParam;
    const gasFee = config.paperWalletGasFeeSol;
    const totalRequired = solAmount + gasFee;

    if (this.solBalance < totalRequired) {
      return {
        success: false,
        tokensBought: 0n,
        priceSol: 0,
        signature: '',
        error: `Insufficient Paper Wallet SOL balance: have ${this.solBalance.toFixed(4)} SOL, need ${totalRequired.toFixed(4)} SOL (Entry + Gas)`,
      };
    }

    let tokensOut = 0n;
    let entryPrice = 0;

    if (knownPriceSol && knownPriceSol > 0) {
      entryPrice = knownPriceSol;
      const tokenCountUnits = (solAmount / knownPriceSol) * 1e6;
      tokensOut = BigInt(Math.max(1, Math.floor(tokenCountUnits)));
    } else {
      let market = this.markets.get(mint);
      if (!market) {
        const vSol = liveCurve?.virtualSolReserves || 30000000000n;
        const vToken = liveCurve?.virtualTokenReserves || 1073000000000000n;
        market = this.registerMarket(
          {
            mint,
            name: 'Live Token',
            symbol: 'TOKEN',
            description: '',
            image: '',
            bondingCurve: '',
            associatedBondingCurve: '',
            creator: '',
            timestamp: Date.now(),
            narrativeScore: 0.9,
            keywordsFound: [],
          },
          {
            discriminator: 0n,
            virtualSolReserves: vSol,
            virtualTokenReserves: vToken,
            realSolReserves: 0n,
            realTokenReserves: 793100000n * 1000000n,
            tokenTotalSupply: 1000000000n * 1000000n,
            complete: false,
          }
        );
      } else if (liveCurve) {
        market.curve.virtualSolReserves = liveCurve.virtualSolReserves;
        market.curve.virtualTokenReserves = liveCurve.virtualTokenReserves;
      }

      const solLamports = BigInt(Math.floor(solAmount * 1e9));
      tokensOut = calculateTokensForSol(solLamports, market.curve);
      entryPrice =
        Number(market.curve.virtualSolReserves) / 1e9 / (Number(market.curve.virtualTokenReserves) / 1e6);
    }

    if (tokensOut <= 0n) {
      return {
        success: false,
        tokensBought: 0n,
        priceSol: 0,
        signature: '',
        error: 'Zero token output calculation from market',
      };
    }

    // Deduct entry SOL + gas fee from paper wallet
    this.solBalance -= totalRequired;
    const currentBalance = this.tokenBalances.get(mint) || 0n;
    this.tokenBalances.set(mint, currentBalance + tokensOut);
    this.tradeCosts.set(mint, totalRequired);

    const signature = bs58.encode(Buffer.from(`paper_buy_${mint.slice(0, 6)}_${Date.now()}`));

    logger.info(
      `[PaperTrading] >>> PAPER BUY EXECUTED <<< | Mint: ${mint.slice(0, 8)}... | Price: ${entryPrice < 0.0001 ? entryPrice.toExponential(4) : entryPrice.toFixed(6)} SOL | Cost: ${totalRequired.toFixed(4)} SOL | Remaining Balance: ${this.solBalance.toFixed(4)} SOL`
    );

    this.emitStatsUpdate();

    return {
      success: true,
      tokensBought: tokensOut,
      priceSol: entryPrice,
      signature,
    };
  }

  /**
   * Execute Virtual Sell against live market bonding curve or known market price
   */
  public executePaperSell(
    mint: string,
    tokensToSell: bigint,
    priceOrCurve?: number | { virtualSolReserves: bigint; virtualTokenReserves: bigint },
    liveCurveParam?: { virtualSolReserves: bigint; virtualTokenReserves: bigint }
  ): {
    success: boolean;
    solReceived: number;
    priceSol: number;
    signature: string;
    netPnlSol: number;
    netPnlPercent: number;
    error?: string;
  } {
    const knownPriceSol = typeof priceOrCurve === 'number' ? priceOrCurve : undefined;
    const liveCurve = typeof priceOrCurve === 'object' ? priceOrCurve : liveCurveParam;
    const gasFee = config.paperWalletGasFeeSol;
    let grossSolReceived = 0;
    let exitPrice = 0;

    if (knownPriceSol && knownPriceSol > 0) {
      exitPrice = knownPriceSol;
      grossSolReceived = (Number(tokensToSell) / 1e6) * knownPriceSol;
    } else {
      let market = this.markets.get(mint);
      if (!market && !liveCurve) {
        return {
          success: false,
          solReceived: 0,
          priceSol: 0,
          signature: '',
          netPnlSol: 0,
          netPnlPercent: 0,
          error: `Market not registered for mint ${mint}`,
        };
      }

      const curve: BondingCurveAccount = market
        ? market.curve
        : {
            discriminator: 0n,
            virtualSolReserves: liveCurve!.virtualSolReserves,
            virtualTokenReserves: liveCurve!.virtualTokenReserves,
            realSolReserves: 0n,
            realTokenReserves: 793100000n * 1000000n,
            tokenTotalSupply: 1000000000n * 1000000n,
            complete: false,
          };

      if (liveCurve) {
        curve.virtualSolReserves = liveCurve.virtualSolReserves;
        curve.virtualTokenReserves = liveCurve.virtualTokenReserves;
      }

      const solLamportsOut = calculateSolForTokens(tokensToSell, curve);
      grossSolReceived = Number(solLamportsOut) / 1e9;
      exitPrice =
        Number(curve.virtualSolReserves) / 1e9 / (Number(curve.virtualTokenReserves) / 1e6);
    }

    const netSolReceived = Math.max(0, grossSolReceived - gasFee);

    // Credit paper wallet
    this.solBalance += netSolReceived;
    this.tokenBalances.delete(mint);

    const costSol = this.tradeCosts.get(mint) || (config.buyAmountSol + gasFee);
    this.tradeCosts.delete(mint);
    const tradePnlSol = netSolReceived - costSol;
    const tradePnlPercent = costSol > 0 ? (tradePnlSol / costSol) * 100 : 0;

    // Update cumulative paper trade stats
    this.totalTrades++;
    if (tradePnlSol > 0) {
      this.winningTrades++;
    } else {
      this.losingTrades++;
    }

    const signature = bs58.encode(Buffer.from(`paper_sell_${mint.slice(0, 6)}_${Date.now()}`));

    logger.info('================================================================');
    logger.info(`[PaperTrading] >>> PAPER SELL EXECUTED <<<`);
    logger.info(`[PaperTrading] Mint:            ${mint.slice(0, 8)}...`);
    logger.info(`[PaperTrading] Gross SOL:       ${grossSolReceived.toFixed(4)} SOL`);
    logger.info(`[PaperTrading] Gas Fee:         -${gasFee.toFixed(4)} SOL`);
    logger.info(`[PaperTrading] Net SOL Inflow:  +${netSolReceived.toFixed(4)} SOL`);
    logger.info(`[PaperTrading] Trade PnL:       ${tradePnlSol >= 0 ? '+' : ''}${tradePnlSol.toFixed(4)} SOL (${tradePnlPercent >= 0 ? '+' : ''}${tradePnlPercent.toFixed(2)}%)`);
    logger.info(`[PaperTrading] New Balance:     ${this.solBalance.toFixed(4)} SOL`);
    logger.info('================================================================');

    this.activeTrades.delete(mint);
    this.emitStatsUpdate();

    return {
      success: true,
      solReceived: netSolReceived,
      priceSol: exitPrice,
      signature,
      netPnlSol: tradePnlSol,
      netPnlPercent: tradePnlPercent,
    };
  }

  // Backward compatibility alias for executeSimulatedBuy
  public executeSimulatedBuy(mint: string, solAmount: number, slippageBps: number) {
    return this.executePaperBuy(mint, solAmount);
  }

  // Backward compatibility alias for executeSimulatedSell
  public executeSimulatedSell(mint: string, tokensToSell: bigint) {
    return this.executePaperSell(mint, tokensToSell);
  }
}

export const simulator = new SimulatorEngine();

