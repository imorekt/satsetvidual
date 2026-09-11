/**
 * System-Wide Type Definitions for Multi-Agent pump.fun Trading Bot
 */

export interface ITokenData {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  bondingCurve: string;
  associatedBondingCurve: string;
  creator: string;
  timestamp: number;
  narrativeScore: number;
  keywordsFound: string[];
  rawPayload?: Record<string, unknown>;
  aiReasoning?: string;
  aiViralHooks?: string[];
  aiModel?: string;
  holdersCount?: number;
  ageSeconds?: number;
}

export interface IAuditResult {
  mint: string;
  symbol: string;
  passed: boolean;
  mintAuthorityDisabled: boolean;
  freezeAuthorityDisabled: boolean;
  devHoldingPercent: number;
  top5HoldingPercent: number;
  top10HoldingPercent?: number;
  lpLockedPercent?: number;
  holdersCount?: number;
  reasons: string[];
  auditedAt: number;
  aiReasoning?: string;
  aiRiskScore?: number;
  aiModel?: string;
}

export type TradeAction = 'BUY' | 'SELL';

export interface ITradeSignal {
  tokenAddress: string;
  symbol: string;
  action: TradeAction;
  reason: string;
  targetAmountSol: number;
  slippageBps: number;
  timestamp: number;
}

export type PositionStatus = 'OPEN' | 'CLOSING' | 'CLOSED';

export interface IPositionState {
  tokenAddress: string;
  symbol: string;
  name?: string;
  entryPriceSol: number;
  currentPriceSol: number;
  amountToken: bigint;
  entryTimestamp: number;
  pnlPercent: number;
  pnlSol: number;
  peakPriceSol: number;
  status: PositionStatus;
  entryTxSignature?: string;
  exitTxSignature?: string;
  isCopyTrade?: boolean;
  previousVirtualSol?: number;
  currentVirtualSol?: number;
  entryVirtualSol?: number;
  solDeltaPercent?: number;
  gainMultiplier?: number;
  isWhaleDump?: boolean;
  isExitTriggered?: boolean;
  exitReason?: string;
  tickCount?: number;
  lastPolledAt?: string;
  hasExternalBuyerVolume?: boolean;
  isTrailingLockActive?: boolean;
  momentumTimerSeconds?: number;
  aiExecutionPlan?: string;
  aiTrackerSentiment?: string;
  aiModel?: string;
}

export interface IWhaleAlert {
  tokenAddress: string;
  symbol: string;
  whaleAddress: string;
  amountTokens: bigint;
  percentOfSupply: number;
  detectedAt: number;
}

export interface IPositionCloseSummary {
  tokenAddress: string;
  symbol: string;
  entryPriceSol: number;
  exitPriceSol: number;
  amountToken: bigint;
  pnlSol: number;
  pnlPercent: number;
  gainMultiplier?: number;
  solDeltaPercent?: number;
  durationMs: number;
  exitReason: string;
  txSignature: string;
  closedAt?: string;
  aiExitReport?: string;
  aiPostMortem?: string;
  aiModel?: string;
}

export interface BondingCurveAccount {
  discriminator: bigint;
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
}

export interface TokenHolderInfo {
  address: string;
  amount: bigint;
  percentage: number;
}

export interface IPaperTradingStats {
  initialBalanceSol: number;
  currentBalanceSol: number;
  totalPaperPnlSol: number;
  totalPaperPnlPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePercent: number;
  status: 'GROW' | 'REKT';
  activeTrade?: IPositionState | null;
  activeTrades?: IPositionState[];
}

export interface ISystemBugNote {
  id: string;
  type: 'SYSTEM_BUG';
  timestamp: string;
  category: 'UI State' | 'Execution Delay' | 'API Failure' | 'Network RPC' | 'Safety Anomaly' | 'Protocol Misalignment';
  description: string;
  expectedVsActual: string;
  severity: 'HIGH' | 'MEDIUM' | 'CRITICAL';
  createdAt: number;
}

export interface ILossAutopsyParameterAdjustment {
  parameter: string;
  from: string;
  to: string;
}

export interface ILossAutopsyNote {
  id: string;
  type: 'LOSS_AUTOPSY';
  timestamp: string;
  tradeNumber: number;
  tokenSymbol: string;
  tokenMint: string;
  timeElapsedSeconds: number;
  exitTrigger: string;
  pnlPercent: number;
  pnlSol: number;
  primaryCause: string;
  technicalDetail: string;
  gasImpactCost: string;
  parameterAdjustments: ILossAutopsyParameterAdjustment[];
  recommendedStrategy: string;
  actionableTactic: string;
  claudeFixPrompt: string;
  aiModel?: string;
  createdAt: number;
  rawSummary?: IPositionCloseSummary;
}

export type IAuditNotepadEntry = ISystemBugNote | ILossAutopsyNote;

export interface IAgent6Stats {
  systemBugsCount: number;
  lossAutopsiesCount: number;
  status: 'ANALYZING & ADAPTING' | 'MONITORING' | 'IDLE';
  lastActive: number;
}

// =====================================================================
// COPY TRADE TYPES
// =====================================================================

export interface ICopyTradeWallet {
  address: string;
  label?: string;       // alias/nama influencer
  addedAt: number;
  isActive: boolean;
  totalCopied: number;  // jumlah trade yang berhasil dicopy
  winCount: number;
  lossCount: number;
  lastSeenAt?: number;
  winRate?: string;
  avgProfit?: string;
  avatarColor?: string;
}

export type CopyTradeStatus = 'DETECTED' | 'COPYING' | 'COPIED' | 'SKIPPED' | 'FAILED';

export interface ICopyTradeActivity {
  id: string;
  walletAddress: string;
  walletLabel?: string;
  action: 'BUY' | 'SELL';
  tokenMint: string;
  tokenSymbol: string;
  tokenName?: string;
  solAmount: number;
  txSignature: string;
  detectedAt: number;
  copiedAt?: number;
  copyStatus: CopyTradeStatus;
  skipReason?: string;
  copyTxSignature?: string;
}

export interface ICopyTradeConfig {
  isEnabled: boolean;
  copyDelayMs: number;      // delay sebelum copy (0-5000ms)
  maxCopyAmountSol: number; // max SOL per copy trade
  copyMode: 'ALL' | 'BUY_ONLY' | 'SELL_ONLY';
  skipIfPositionExists: boolean;
  useCustomAmount: boolean;
  customAmountSol: number;
}

/**
 * Event map for internal typed EventEmitter
 */
export interface AgentEventMap {
  TOKEN_SCANNED: (data: ITokenData) => void;
  TOKEN_DETECTED: (data: ITokenData) => void;
  AUDIT_PASSED: (data: { token: ITokenData; audit: IAuditResult }) => void;
  AUDIT_FAILED: (data: { token: ITokenData; audit: IAuditResult }) => void;
  POSITION_OPENED: (position: IPositionState) => void;
  POSITION_UPDATE: (position: IPositionState) => void;
  ACTIVE_POSITIONS_UPDATE: (positions: IPositionState[]) => void;
  WHALE_DUMP_WARNING: (alert: IWhaleAlert) => void;
  POSITION_CLOSED: (summary: IPositionCloseSummary) => void;
  PAPER_STATS_UPDATE: (stats: IPaperTradingStats) => void;
  AGENT6_NOTE_CREATED: (note: IAuditNotepadEntry) => void;
  AGENT6_STATS_UPDATE: (stats: IAgent6Stats) => void;
  START_SCANNER_ENGINE: () => void;
  STOP_SCANNER_ENGINE: () => void;
  RESUME_SCAN: () => void;
  PAUSE_SCAN: () => void;
  ERROR_ENCOUNTERED: (error: { agent: string; message: string; fatal: boolean }) => void;
  COPY_TRADE_BUY: (data: { activity: ICopyTradeActivity; token: ITokenData }) => void;
  COPY_TRADE_SELL: (data: { activity: ICopyTradeActivity }) => void;
  COPY_TRADE_WALLET_UPDATED: (wallets: ICopyTradeWallet[]) => void;
  COPY_TRADE_ACTIVITY: (activity: ICopyTradeActivity) => void;
  COPY_POSITIONS_TICK: (positions: IPositionState[]) => void;
}

