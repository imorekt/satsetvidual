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

export interface IPositionState {
  tokenAddress: string;
  symbol: string;
  name?: string;
  entryPriceSol: number;
  currentPriceSol: number;
  amountToken: string | bigint;
  entryTimestamp: number;
  pnlPercent: number;
  pnlSol: number;
  peakPriceSol: number;
  status: 'OPEN' | 'CLOSING' | 'CLOSED';
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
  exitReason?: 'NONE' | 'WHALE_DUMP_EMERGENCY' | 'TAKE_PROFIT_60X' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | string;
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
  amountTokens: string | bigint;
  percentOfSupply: number;
  detectedAt: number;
}

export interface IPositionCloseSummary {
  tokenAddress: string;
  symbol: string;
  entryPriceSol: number;
  exitPriceSol: number;
  amountToken: string | bigint;
  pnlSol: number;
  pnlPercent: number;
  gainMultiplier?: number;
  solDeltaPercent?: number;
  durationMs: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'WHALE_DUMP' | 'MANUAL' | 'TAKE_PROFIT_60X' | 'WHALE_DUMP_EMERGENCY';
  txSignature: string;
  closedAt?: string;
  aiExitReport?: string;
  aiPostMortem?: string;
  aiModel?: string;
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
  activeTrade: IPositionState | null;
  activeTrades: IPositionState[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
  message: string;
}

export interface AgentStatus {
  name: string;
  state: 'IDLE' | 'SCANNING' | 'AUDITING' | 'BUYING' | 'TRACKING' | 'EXITING' | 'PAUSED' | 'DETECTING' | 'COPIED';
  detail: string;
  lastActive: number;
}

export interface BotConfig {
  buyAmountSol: number;
  slippageBps: number;
  maxOpenPositions: number;
  takeProfitMultiplier: number;
  stopLossPercent: number;
  minNarrativeScore: number;
  minHoldersCount?: number;
  maxTokenAgeSeconds?: number;
  maxDevHoldingPercent?: number;
  maxTop10HoldingPercent?: number;
  jitoTipSol: number;
  dryRunMode: boolean;
  port: number;
}

export interface PricePoint {
  time: string;
  timestamp: number;
  price: number;
  pnlPercent: number;
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
  label?: string;
  addedAt: number;
  isActive: boolean;
  totalCopied: number;
  winCount: number;
  lossCount: number;
  lastSeenAt?: number;
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

export interface CopyTradeConfig {
  isEnabled: boolean;
  copyDelayMs: number;
  maxCopyAmountSol: number;
  copyMode: 'ALL' | 'BUY_ONLY' | 'SELL_ONLY';
  skipIfPositionExists: boolean;
  useCustomAmount: boolean;
  customAmountSol: number;
}
