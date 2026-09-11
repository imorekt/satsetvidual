import { eventBus } from '../utils/eventBus';
import { logger } from '../utils/logger';
import { aiService } from '../services/aiService';
import { config } from '../config';
import { 
  IAuditNotepadEntry, 
  ISystemBugNote, 
  ILossAutopsyNote, 
  IAgent6Stats, 
  IPositionState, 
  IPositionCloseSummary 
} from '../types';

export class SentinelAgent {
  private notes: IAuditNotepadEntry[] = [];
  private tradeCount = 0;
  private recentBugSignatures: Map<string, number> = new Map();
  private pendingExecutionSellCheck: {
    tokenAddress: string;
    triggerTimestamp: number;
    triggerReason: string;
    pnlPercent: number;
    timeoutTimer?: NodeJS.Timeout;
  } | null = null;

  constructor() {
    this.notes = [];
    this.subscribeEvents();
    logger.info('[SentinelAgent:A6] Super Strategy & QA Sentinel Initialized (Claude Opus 4.8 Active).');
  }

  private subscribeEvents(): void {
    // 1. Monitor Position Updates for Agent 5 Execution Delay Bug (>1000ms delay on TP +8% or SL -5%)
    // Completely isolated from Copy Trade Engine (Copy Trade is 100% independent)
    eventBus.on('POSITION_UPDATE', (pos: IPositionState) => {
      if (pos.isCopyTrade) return; // Pure Copy Trade has zero linkage with Agent 5 / AI Agents

      const isTargetHit = pos.pnlPercent >= (config.takeProfitMultiplier - 1) * 100 || pos.pnlPercent <= -config.stopLossPercent;

      if (isTargetHit && !pos.isExitTriggered) {
        if (!this.pendingExecutionSellCheck) {
          const triggerReason = pos.pnlPercent >= 8 ? 'TAKE_PROFIT_TRIGGER' : 'STOP_LOSS_TRIGGER';
          const triggerTimestamp = Date.now();

          const timer = setTimeout(() => {
            if (this.pendingExecutionSellCheck && this.pendingExecutionSellCheck.tokenAddress === pos.tokenAddress) {
              const elapsed = Date.now() - triggerTimestamp;
              this.recordSystemBug({
                category: 'Execution Delay',
                description: `Agen 5 Execution Sell delay on token $${pos.symbol} (${pos.pnlPercent.toFixed(1)}%). Expected sell within 1000ms, elapsed: ${elapsed}ms.`,
                expectedVsActual: `Expected: Instant SELL ALL <= 1000ms. Actual: Pending after ${elapsed}ms.`,
                severity: 'CRITICAL',
              });
              this.pendingExecutionSellCheck = null;
            }
          }, 1200);

          this.pendingExecutionSellCheck = {
            tokenAddress: pos.tokenAddress,
            triggerTimestamp,
            triggerReason,
            pnlPercent: pos.pnlPercent,
            timeoutTimer: timer,
          };
        }
      }
    });

    // 2. Monitor Position Closed -> Conduct Loss Autopsy if Loss (PnL < 0)
    eventBus.on('POSITION_CLOSED', async (summary: IPositionCloseSummary) => {
      this.tradeCount++;
      if (this.pendingExecutionSellCheck && this.pendingExecutionSellCheck.timeoutTimer) {
        clearTimeout(this.pendingExecutionSellCheck.timeoutTimer);
        this.pendingExecutionSellCheck = null;
      }

      if (summary.pnlPercent < 0 || summary.pnlSol < 0) {
        logger.warn(`[SentinelAgent:A6] Loss detected on $${summary.symbol} (${summary.pnlPercent.toFixed(2)}%). Initiating Super Loss Autopsy...`);
        await this.handleLossAutopsy(summary);
      }
    });

    // 3. Monitor Network and API Errors from EventBus (Only FATAL system crashes)
    eventBus.on('ERROR_ENCOUNTERED', (err: { agent: string; message: string; fatal: boolean }) => {
      if (!err.fatal) return; // Ignore non-fatal routine network retries
      let category: ISystemBugNote['category'] = 'API Failure';
      const lower = err.message.toLowerCase();
      if (lower.includes('solana') || lower.includes('rpc') || lower.includes('websocket')) {
        category = 'Network RPC';
      }
      this.recordSystemBug({
        category,
        description: `[${err.agent}] ${err.message}`,
        expectedVsActual: `Expected: Clean 200 OK execution. Actual: Fatal error encountered: ${err.message}`,
        severity: 'CRITICAL',
      });
    });
  }

  public async handleLossAutopsy(summary: IPositionCloseSummary): Promise<ILossAutopsyNote> {
    const analysis = await aiService.conductLossAutopsyWithAI({
      tradeNumber: this.tradeCount,
      symbol: summary.symbol,
      mint: summary.tokenAddress,
      entryPriceSol: summary.entryPriceSol,
      exitPriceSol: summary.exitPriceSol,
      pnlPercent: summary.pnlPercent,
      pnlSol: summary.pnlSol,
      durationMs: summary.durationMs,
      exitReason: summary.exitReason,
      gasFeeSol: config.paperWalletGasFeeSol,
      solDeltaPercent: summary.solDeltaPercent,
    });

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const autopsyNote: ILossAutopsyNote = {
      id: `autopsy-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'LOSS_AUTOPSY',
      timestamp: timeStr,
      tradeNumber: this.tradeCount,
      tokenSymbol: summary.symbol,
      tokenMint: summary.tokenAddress,
      timeElapsedSeconds: parseFloat((summary.durationMs / 1000).toFixed(1)),
      exitTrigger: summary.exitReason,
      pnlPercent: summary.pnlPercent,
      pnlSol: summary.pnlSol,
      primaryCause: analysis.primaryCause,
      technicalDetail: analysis.technicalDetail,
      gasImpactCost: analysis.gasImpactCost,
      parameterAdjustments: analysis.parameterAdjustments,
      recommendedStrategy: analysis.recommendedStrategy,
      actionableTactic: analysis.actionableTactic,
      claudeFixPrompt: analysis.claudeFixPrompt,
      aiModel: analysis.aiModel,
      createdAt: Date.now(),
      rawSummary: summary,
    };

    this.notes.unshift(autopsyNote);
    if (this.notes.length > 100) this.notes.pop();

    eventBus.emit('AGENT6_NOTE_CREATED', autopsyNote);
    eventBus.emit('AGENT6_STATS_UPDATE', this.getStats());

    logger.info(`[SentinelAgent:A6] Loss Autopsy recorded for $${summary.symbol}. Strategy recommendation: ${analysis.recommendedStrategy}`);
    return autopsyNote;
  }

  public recordSystemBug(bugData: {
    category: ISystemBugNote['category'];
    description: string;
    expectedVsActual: string;
    severity?: ISystemBugNote['severity'];
  }): ISystemBugNote {
    // Normalise signature to prevent duplicate spam within 20 seconds
    const sig = `${bugData.category}:${bugData.description.replace(/[0-9a-fA-F]{10,}/g, '').slice(0, 50)}`;
    const lastSeen = this.recentBugSignatures.get(sig);
    if (lastSeen && Date.now() - lastSeen < 20000 && this.notes.length > 0) {
      return this.notes[0] as ISystemBugNote;
    }
    this.recentBugSignatures.set(sig, Date.now());

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const bugNote: ISystemBugNote = {
      id: `bug-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'SYSTEM_BUG',
      timestamp: timeStr,
      category: bugData.category,
      description: bugData.description,
      expectedVsActual: bugData.expectedVsActual,
      severity: bugData.severity || 'HIGH',
      createdAt: Date.now(),
    };

    this.notes.unshift(bugNote);
    if (this.notes.length > 100) this.notes.pop();

    eventBus.emit('AGENT6_NOTE_CREATED', bugNote);
    eventBus.emit('AGENT6_STATS_UPDATE', this.getStats());

    logger.warn(`[SentinelAgent:A6] System Bug recorded [${bugData.category}]: ${bugData.description}`);
    return bugNote;
  }

  public getNotes(): IAuditNotepadEntry[] {
    return this.notes;
  }

  public getStats(): IAgent6Stats {
    const systemBugsCount = this.notes.filter((n) => n.type === 'SYSTEM_BUG').length;
    const lossAutopsiesCount = this.notes.filter((n) => n.type === 'LOSS_AUTOPSY').length;

    return {
      systemBugsCount,
      lossAutopsiesCount,
      status: 'ANALYZING & ADAPTING',
      lastActive: Date.now(),
    };
  }

  public clearNotes(): void {
    this.notes = [];
    eventBus.emit('AGENT6_STATS_UPDATE', this.getStats());
  }
}

export const sentinelAgent = new SentinelAgent();
