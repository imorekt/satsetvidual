import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import axios from 'axios';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { config } from './config';
import { logger, logEmitter } from './utils/logger';
import { eventBus } from './utils/eventBus';
import { simulator } from './utils/simulator';
import { aiService } from './services/aiService';
import { sentinelAgent } from './agents/SentinelAgent';
import { copyTradeAgent } from './agents/CopyTradeAgent';
import {
  IPositionState,
  IPositionCloseSummary,
  ITokenData,
  IAuditResult,
  IWhaleAlert,
  ICopyTradeActivity,
} from './types';

// Support JSON serialization of BigInt for Socket.io and Express
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export class WebServer {
  private app: express.Express;
  private server: http.Server;
  private io: SocketIOServer;

  // In-memory dashboard state
  private activePositions: Map<string, IPositionState> = new Map();
  private isScanning = config.autoStartScanning;
  private recentTokens: Array<{ token: ITokenData; audit?: IAuditResult }> = [];
  private tradeHistory: IPositionCloseSummary[] = [];
  private whaleAlerts: IWhaleAlert[] = [];
  private copyTradeActivityLog: ICopyTradeActivity[] = [];
  private stats = {
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    netPnlSol: 0,
  };

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);

    // Initialize Socket.io with permissive CORS for development
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT'],
      },
    });

    this.configureExpress();
    this.configureSocketIO();
    this.subscribeEventBus();
    this.subscribeLogs();
  }

  private configureExpress(): void {
    this.app.use(cors());
    this.app.use(express.json());

    // Serve built React frontend from client/dist if present, otherwise fallback to public/
    const clientDistPath = path.resolve(process.cwd(), 'client', 'dist');
    const publicPath = path.resolve(process.cwd(), 'public');
    
    this.app.use(express.static(clientDistPath));
    this.app.use(express.static(publicPath));

    // =========================================================
    // REST API ENDPOINTS
    // =========================================================

    // GET /api/bot/status
    this.app.get('/api/bot/status', (_req: Request, res: Response) => {
      const activeList = Array.from(this.activePositions.values());
      res.json({
        success: true,
        isScanning: this.isScanning,
        dryRunMode: config.dryRunMode,
        walletBalanceSol: config.dryRunMode
          ? simulator.getSolBalance()
          : 'Live Wallet',
        walletAddress: config.dryRunMode ? simulator.getPublicKey() : 'Mainnet Wallet',
        activePosition: activeList[0] || null,
        activePositions: activeList,
        paperStats: simulator.getPaperStats(),
        stats: {
          ...this.stats,
          winRatePercent:
            this.stats.totalTrades > 0
              ? parseFloat(((this.stats.winningTrades / this.stats.totalTrades) * 100).toFixed(1))
              : 0,
        },
        config: {
          buyAmountSol: config.buyAmountSol,
          slippageBps: config.slippageBps,
          maxOpenPositions: config.maxOpenPositions,
          takeProfitMultiplier: config.takeProfitMultiplier,
          stopLossPercent: config.stopLossPercent,
          minNarrativeScore: config.minNarrativeScore,
          minHoldersCount: config.minHoldersCount,
          maxTokenAgeSeconds: config.maxTokenAgeSeconds,
          maxDevHoldingPercent: config.maxDevHoldingPercent,
          maxTop10HoldingPercent: config.maxTop10HoldingPercent,
          jitoTipSol: config.jitoTipSol,
          dryRunMode: config.dryRunMode,
          port: config.port,
        },
      });
    });

    // POST /api/bot/start
    this.app.post('/api/bot/start', (_req: Request, res: Response) => {
      this.isScanning = true;
      eventBus.emit('START_SCANNER_ENGINE');
      eventBus.emit('RESUME_SCAN');
      copyTradeAgent.updateCopyConfig({ isEnabled: true });
      this.io.emit('copytrade_config_updated', copyTradeAgent.getCopyConfig());
      logger.info('[WebServer] Bot Scanner & Copy Trade Engine started via API command.');

      this.io.emit('agent_status_change', {
        id: 'scanner',
        state: 'SCANNING',
        detail: 'Listening to pump.fun WebSocket stream...',
      });

      res.json({ success: true, isScanning: true, message: 'Bot engines started.' });
    });

    // POST /api/bot/stop
    this.app.post('/api/bot/stop', (_req: Request, res: Response) => {
      this.isScanning = false;
      eventBus.emit('STOP_SCANNER_ENGINE');
      eventBus.emit('PAUSE_SCAN');
      copyTradeAgent.updateCopyConfig({ isEnabled: false });
      this.io.emit('copytrade_config_updated', copyTradeAgent.getCopyConfig());
      logger.info('[WebServer] Bot Scanner & Copy Trade Engine paused via API command.');

      this.io.emit('agent_status_change', {
        id: 'scanner',
        state: 'PAUSED',
        detail: 'Bot paused by user.',
      });

      res.json({ success: true, isScanning: false, message: 'Bot engines paused.' });
    });

    // POST /api/wallet/deposit
    this.app.post('/api/wallet/deposit', (req: Request, res: Response) => {
      const { amount } = req.body || {};
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        res.status(400).json({ success: false, message: 'Valid positive deposit amount is required.' });
        return;
      }

      const newBalance = simulator.depositSol(numAmount);
      const paperStats = simulator.getPaperStats();

      this.io.emit('paper_stats_update', paperStats);
      this.io.emit('wallet_balance_updated', { balance: newBalance });

      res.json({
        success: true,
        message: `Successfully deposited ${numAmount.toFixed(4)} SOL.`,
        newBalance,
        paperStats,
      });
    });

    // POST /api/bot/emergency-sell
    this.app.post('/api/bot/emergency-sell', (req: Request, res: Response) => {
      const { tokenAddress } = req.body || {};
      const activeList = Array.from(this.activePositions.values());

      if (activeList.length === 0) {
        res.status(400).json({ success: false, message: 'No active position to sell.' });
        return;
      }

      logger.warn('[WebServer] !!! PANIC SELL / EMERGENCY EXIT TRIGGERED VIA API !!!');

      const targets = tokenAddress
        ? activeList.filter((p) => p.tokenAddress === tokenAddress)
        : activeList;

      if (targets.length === 0) {
        res.status(404).json({ success: false, message: `Position ${tokenAddress} not found.` });
        return;
      }

      for (const target of targets) {
        const panicAlert: IWhaleAlert = {
          tokenAddress: target.tokenAddress,
          symbol: target.symbol,
          whaleAddress: 'MANUAL_EMERGENCY_DUMP_TRIGGER',
          amountTokens: target.amountToken,
          percentOfSupply: 99.9,
          detectedAt: Date.now(),
        };

        eventBus.emit('WHALE_DUMP_WARNING', panicAlert);
        this.io.emit('agent_status_change', {
          id: 'exit',
          state: 'EXITING',
          detail: `Emergency Flash-Selling $${target.symbol}...`,
        });
      }

      res.json({
        success: true,
        message: `Emergency sell command dispatched for ${targets.length} position(s).`,
        targets: targets.map((t) => t.symbol),
      });
    });

    // POST /api/trade/buy (For external webhooks / n8n)
    this.app.post('/api/trade/buy', (req: Request, res: Response) => {
      try {
        const { tokenAddress, symbol, name, buyAmountSol, slippageBps } = req.body;
        if (!tokenAddress) {
          res.status(400).json({ success: false, error: 'tokenAddress is required' });
          return;
        }

        const tokenData: ITokenData = {
          mint: tokenAddress,
          name: name || symbol || 'Token',
          symbol: symbol || 'TOKEN',
          description: '',
          image: '',
          bondingCurve: '',
          associatedBondingCurve: '',
          creator: '',
          timestamp: Date.now(),
          narrativeScore: 0.9,
          keywordsFound: [],
        };

        if (buyAmountSol && Number(buyAmountSol) > 0) {
          config.buyAmountSol = parseFloat(buyAmountSol);
        }
        if (slippageBps && Number(slippageBps) >= 50) {
          config.slippageBps = parseInt(slippageBps, 10);
        }

        logger.info(`[WebServer] Trade BUY triggered via API/n8n for [${tokenData.symbol}] (${tokenAddress})`);
        
        eventBus.emit('AUDIT_PASSED', {
          token: tokenData,
          audit: {
            mint: tokenAddress,
            symbol: tokenData.symbol,
            passed: true,
            mintAuthorityDisabled: true,
            freezeAuthorityDisabled: true,
            devHoldingPercent: 0,
            top5HoldingPercent: 0,
            reasons: [],
            auditedAt: Date.now(),
          },
        });

        res.json({
          success: true,
          message: `Buy execution order queued via Jito MEV for ${tokenData.symbol}`,
          tokenAddress,
          buyAmountSol: config.buyAmountSol,
          slippageBps: config.slippageBps,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ success: false, error: errorMsg });
      }
    });

    // POST /api/trade/sell (For external webhooks / n8n)
    this.app.post('/api/trade/sell', (req: Request, res: Response) => {
      const { tokenAddress } = req.body || {};
      const activeList = Array.from(this.activePositions.values());
      const target = tokenAddress
        ? activeList.find((p) => p.tokenAddress === tokenAddress)
        : activeList[0];

      if (!target) {
        res.status(400).json({ success: false, message: 'No active position to sell.' });
        return;
      }
      logger.info(`[WebServer] Trade SELL triggered via API/n8n for [${target.symbol}]`);
      const panicAlert: IWhaleAlert = {
        tokenAddress: target.tokenAddress,
        symbol: target.symbol,
        whaleAddress: 'API_N8N_SELL_TRIGGER',
        amountTokens: target.amountToken,
        percentOfSupply: 100,
        detectedAt: Date.now(),
      };
      eventBus.emit('WHALE_DUMP_WARNING', panicAlert);
      res.json({ success: true, message: `Sell order dispatched via Jito MEV for ${target.symbol}` });
    });

    // GET /api/config
    this.app.get('/api/config', (_req: Request, res: Response) => {
      res.json({
        success: true,
        config: {
          buyAmountSol: config.buyAmountSol,
          slippageBps: config.slippageBps,
          maxOpenPositions: config.maxOpenPositions,
          takeProfitMultiplier: config.takeProfitMultiplier,
          stopLossPercent: config.stopLossPercent,
          minNarrativeScore: config.minNarrativeScore,
          minHoldersCount: config.minHoldersCount,
          maxTokenAgeSeconds: config.maxTokenAgeSeconds,
          maxDevHoldingPercent: config.maxDevHoldingPercent,
          maxTop10HoldingPercent: config.maxTop10HoldingPercent,
          jitoTipSol: config.jitoTipSol,
          dryRunMode: config.dryRunMode,
          port: config.port,
        },
      });
    });

    // PUT /api/config
    this.app.put('/api/config', (req: Request, res: Response) => {
      try {
        const {
          buyAmountSol,
          slippageBps,
          maxOpenPositions,
          takeProfitMultiplier,
          stopLossPercent,
          minNarrativeScore,
          minHoldersCount,
          maxTokenAgeSeconds,
          maxDevHoldingPercent,
          maxTop10HoldingPercent,
          jitoTipSol,
          dryRunMode,
        } = req.body;

        if (buyAmountSol !== undefined && Number(buyAmountSol) > 0) {
          config.buyAmountSol = parseFloat(buyAmountSol);
        }
        if (slippageBps !== undefined && Number(slippageBps) >= 50) {
          config.slippageBps = parseInt(slippageBps, 10);
        }
        if (maxOpenPositions !== undefined && Number(maxOpenPositions) >= 1) {
          config.maxOpenPositions = parseInt(maxOpenPositions, 10);
        }
        if (takeProfitMultiplier !== undefined && Number(takeProfitMultiplier) > 1) {
          config.takeProfitMultiplier = parseFloat(takeProfitMultiplier);
        }
        if (stopLossPercent !== undefined && Number(stopLossPercent) > 0) {
          config.stopLossPercent = parseFloat(stopLossPercent);
        }
        if (minNarrativeScore !== undefined && Number(minNarrativeScore) >= 0) {
          config.minNarrativeScore = parseFloat(minNarrativeScore);
        }
        if (minHoldersCount !== undefined && Number(minHoldersCount) >= 0) {
          config.minHoldersCount = parseInt(minHoldersCount, 10);
        }
        if (maxTokenAgeSeconds !== undefined && Number(maxTokenAgeSeconds) > 0) {
          config.maxTokenAgeSeconds = parseInt(maxTokenAgeSeconds, 10);
        }
        if (maxDevHoldingPercent !== undefined && Number(maxDevHoldingPercent) >= 0) {
          config.maxDevHoldingPercent = parseFloat(maxDevHoldingPercent);
        }
        if (maxTop10HoldingPercent !== undefined && Number(maxTop10HoldingPercent) > 0) {
          config.maxTop10HoldingPercent = parseFloat(maxTop10HoldingPercent);
        }
        if (jitoTipSol !== undefined && Number(jitoTipSol) >= 0) {
          config.jitoTipSol = parseFloat(jitoTipSol);
        }
        if (dryRunMode !== undefined) {
          config.dryRunMode = Boolean(dryRunMode);
        }

        logger.info(
          `[WebServer] Configuration updated: Buy=${config.buyAmountSol} SOL, Slippage=${config.slippageBps} bps, DevHolding=${config.maxDevHoldingPercent}%, MinHolders=${config.minHoldersCount}, MaxAge=${config.maxTokenAgeSeconds}s, Top10=${config.maxTop10HoldingPercent}%`
        );

        const configPayload = {
          buyAmountSol: config.buyAmountSol,
          slippageBps: config.slippageBps,
          maxOpenPositions: config.maxOpenPositions,
          takeProfitMultiplier: config.takeProfitMultiplier,
          stopLossPercent: config.stopLossPercent,
          minNarrativeScore: config.minNarrativeScore,
          minHoldersCount: config.minHoldersCount,
          maxTokenAgeSeconds: config.maxTokenAgeSeconds,
          maxDevHoldingPercent: config.maxDevHoldingPercent,
          maxTop10HoldingPercent: config.maxTop10HoldingPercent,
          jitoTipSol: config.jitoTipSol,
          dryRunMode: config.dryRunMode,
          port: config.port,
        };

        this.io.emit('config_updated', configPayload);

        res.json({
          success: true,
          config: configPayload,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ success: false, error: errorMsg });
      }
    });

    // GET /api/trades/history
    this.app.get('/api/trades/history', (_req: Request, res: Response) => {
      res.json({
        success: true,
        trades: this.tradeHistory,
        stats: {
          ...this.stats,
          winRatePercent:
            this.stats.totalTrades > 0
              ? parseFloat(((this.stats.winningTrades / this.stats.totalTrades) * 100).toFixed(1))
              : 0,
        },
      });
    });

    // GET /api/agent1/models
    this.app.get('/api/agent1/models', (_req: Request, res: Response) => {
      res.json({
        options: aiService.getAgent1Options(),
        selected: aiService.getSelectedAgent1ModelId(),
        activeOption: aiService.getSelectedAgent1Option(),
      });
    });

    // POST /api/agent1/model
    this.app.post('/api/agent1/model', (req: Request, res: Response) => {
      const { modelId } = req.body || {};
      if (!modelId) {
        res.status(400).json({ success: false, message: 'modelId is required' });
        return;
      }
      const updated = aiService.setSelectedAgent1ModelId(modelId);
      logger.info(`[WebServer] Agen 1 model switched by user to: ${updated.name}`);

      this.io.emit('agent1_model_changed', {
        selected: updated.id,
        activeOption: updated,
      });

      this.io.emit('agent_status_change', {
        id: 'scanner',
        state: 'SCANNING',
        detail: `Model: ${updated.shortName} (${updated.model}) active`,
      });

      res.json({
        success: true,
        selected: updated.id,
        activeOption: updated,
      });
    });

    // GET /api/agent2/models
    this.app.get('/api/agent2/models', (_req: Request, res: Response) => {
      res.json({
        options: aiService.getAgent2Options(),
        selected: aiService.getSelectedAgent2ModelId(),
        activeOption: aiService.getSelectedAgent2Option(),
      });
    });

    // POST /api/agent2/model
    this.app.post('/api/agent2/model', (req: Request, res: Response) => {
      const { modelId } = req.body || {};
      if (!modelId) {
        res.status(400).json({ success: false, message: 'modelId is required' });
        return;
      }
      const updated = aiService.setSelectedAgent2ModelId(modelId);
      logger.info(`[WebServer] Agen 2 model switched by user to: ${updated.name}`);

      this.io.emit('agent2_model_changed', {
        selected: updated.id,
        activeOption: updated,
      });

      this.io.emit('agent_status_change', {
        id: 'auditor',
        state: 'IDLE',
        detail: `Model: ${updated.shortName} (${updated.model}) active`,
      });

      res.json({
        success: true,
        selected: updated.id,
        activeOption: updated,
      });
    });

    // GET /api/agent6/notes
    this.app.get('/api/agent6/notes', (_req: Request, res: Response) => {
      res.json({
        success: true,
        notes: sentinelAgent.getNotes(),
        stats: sentinelAgent.getStats(),
      });
    });

    // POST /api/agent6/bug
    this.app.post('/api/agent6/bug', (req: Request, res: Response) => {
      const { category, description, expectedVsActual, severity } = req.body || {};
      if (!description) {
        res.status(400).json({ success: false, message: 'description is required' });
        return;
      }
      const note = sentinelAgent.recordSystemBug({
        category: category || 'UI State',
        description,
        expectedVsActual: expectedVsActual || '',
        severity: severity || 'HIGH',
      });
      res.json({ success: true, note });
    });

    // POST /api/agent6/autopsy/test - Only run if real loss trade exists
    this.app.post('/api/agent6/autopsy/test', async (_req: Request, res: Response) => {
      const lastLoss = this.tradeHistory.find((t) => t.pnlPercent < 0 || t.pnlSol < 0);
      if (!lastLoss) {
        res.status(400).json({
          success: false,
          message: 'Belum ada transaksi riil yang mengalami kerugian. Autopsy hanya berjalan otomatis saat terjadi trade loss on-chain nyata.',
        });
        return;
      }
      const note = await sentinelAgent.handleLossAutopsy(lastLoss);
      res.json({ success: true, note });
    });

    // DELETE /api/agent6/notes
    this.app.delete('/api/agent6/notes', (_req: Request, res: Response) => {
      sentinelAgent.clearNotes();
      this.io.emit('agent6_notes_cleared');
      res.json({ success: true, message: 'Notepad notes cleared.' });
    });

    // POST /api/agent6/chat - Interactive AI Chat with Agent 6 (The Creator & Master Sentinel)
    this.app.post('/api/agent6/chat', async (req: Request, res: Response) => {
      try {
        const { message, history } = req.body || {};
        if (!message || typeof message !== 'string' || !message.trim()) {
          res.status(400).json({ success: false, message: 'message is required' });
          return;
        }

        const allNotes = sentinelAgent.getNotes();
        const context = {
          paperStats: simulator.getPaperStats(),
          activePositions: copyTradeAgent.getActivePositions(),
          recentTrades: this.tradeHistory.slice(0, 8),
          monitoredWallets: copyTradeAgent.getWallets(),
          recentActivities: copyTradeAgent.getActivityLog().slice(0, 10),
          lossAutopsies: allNotes.filter((n) => n.type === 'LOSS_AUTOPSY').slice(0, 10),
          systemBugs: allNotes.filter((n) => n.type === 'SYSTEM_BUG').slice(0, 15),
          totalSystemBugs: allNotes.filter((n) => n.type === 'SYSTEM_BUG').length,
          totalLossAutopsies: allNotes.filter((n) => n.type === 'LOSS_AUTOPSY').length,
          agent6Stats: sentinelAgent.getStats(),
        };

        const result = await aiService.chatWithAgent6Master(message.trim(), history || [], context);
        res.json({ success: true, reply: result.reply, model: result.model });
      } catch (err: any) {
        logger.error(`[WebServer] Agent 6 chat endpoint error: ${err.message}`);
        res.status(500).json({ success: false, message: err.message || 'Chat failed' });
      }
    });

    // =========================================================
    // COPY TRADE API ENDPOINTS
    // =========================================================

    // GET /api/copytrade/wallets
    this.app.get('/api/copytrade/wallets', (_req: Request, res: Response) => {
      res.json({ success: true, wallets: copyTradeAgent.getWallets() });
    });

    // POST /api/copytrade/wallets
    this.app.post('/api/copytrade/wallets', (req: Request, res: Response) => {
      const { address, label } = req.body || {};
      if (!address) {
        res.status(400).json({ success: false, message: 'address is required' });
        return;
      }
      const wallet = copyTradeAgent.addWallet(address.trim(), label?.trim());
      if (!wallet) {
        res.status(400).json({ success: false, message: 'Invalid Solana wallet address' });
        return;
      }
      logger.info(`[WebServer] Copy Trade: Added wallet ${address} (${label || 'no label'})`);
      this.io.emit('copytrade_wallets_updated', copyTradeAgent.getWallets());
      res.json({ success: true, wallet, wallets: copyTradeAgent.getWallets() });
    });

    // POST /api/copytrade/wallets/bulk
    this.app.post('/api/copytrade/wallets/bulk', (req: Request, res: Response) => {
      const { wallets: rawWallets, text } = req.body || {};
      let items: Array<{ address: string; label?: string }> = [];

      if (Array.isArray(rawWallets)) {
        items = rawWallets.map((w: any) => ({
          address: typeof w === 'string' ? w : String(w.address || ''),
          label: typeof w === 'object' && w.label ? String(w.label) : undefined,
        }));
      } else if (typeof text === 'string') {
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

          let address = '';
          let label = '';

          if (trimmed.includes(',')) {
            const parts = trimmed.split(',');
            address = parts[0].trim();
            label = parts.slice(1).join(',').trim();
          } else if (trimmed.includes(';')) {
            const parts = trimmed.split(';');
            address = parts[0].trim();
            label = parts.slice(1).join(';').trim();
          } else if (trimmed.includes('|')) {
            const parts = trimmed.split('|');
            address = parts[0].trim();
            label = parts.slice(1).join('|').trim();
          } else if (trimmed.includes('\t')) {
            const parts = trimmed.split('\t');
            address = parts[0].trim();
            label = parts.slice(1).join('\t').trim();
          } else if (trimmed.includes(' ') && !trimmed.startsWith('http')) {
            const parts = trimmed.split(/\s+/);
            address = parts[0].trim();
            label = parts.slice(1).join(' ').trim();
          } else {
            address = trimmed;
          }

          if (address) {
            items.push({ address, label: label || undefined });
          }
        }
      }

      if (items.length === 0) {
        res.status(400).json({ success: false, message: 'Tidak ada wallet yang valid untuk diimport' });
        return;
      }

      const result = copyTradeAgent.addWalletsBulk(items);
      this.io.emit('copytrade_wallets_updated', copyTradeAgent.getWallets());
      res.json({
        success: true,
        addedCount: result.added.length,
        skippedCount: result.skipped.length,
        added: result.added,
        skipped: result.skipped,
        wallets: copyTradeAgent.getWallets(),
      });
    });

    // DELETE /api/copytrade/wallets/:address
    this.app.delete('/api/copytrade/wallets/:address', (req: Request, res: Response) => {
      const address = req.params.address as string;
      const removed = copyTradeAgent.removeWallet(address);
      if (!removed) {
        res.status(404).json({ success: false, message: 'Wallet not found' });
        return;
      }
      logger.info(`[WebServer] Copy Trade: Removed wallet ${address}`);
      this.io.emit('copytrade_wallets_updated', copyTradeAgent.getWallets());
      res.json({ success: true, wallets: copyTradeAgent.getWallets() });
    });

    // PUT /api/copytrade/wallets/:address/toggle
    this.app.put('/api/copytrade/wallets/:address/toggle', (req: Request, res: Response) => {
      const address = req.params.address as string;
      const { isActive } = req.body || {};
      const updated = copyTradeAgent.updateWalletStatus(address, Boolean(isActive));
      if (!updated) {
        res.status(404).json({ success: false, message: 'Wallet not found' });
        return;
      }
      this.io.emit('copytrade_wallets_updated', copyTradeAgent.getWallets());
      res.json({ success: true, wallets: copyTradeAgent.getWallets() });
    });

    // GET /api/copytrade/activity
    this.app.get('/api/copytrade/activity', (_req: Request, res: Response) => {
      res.json({
        success: true,
        activity: copyTradeAgent.getActivityLog(),
        recentActivity: this.copyTradeActivityLog.slice(0, 50),
      });
    });

    // GET /api/copytrade/config
    this.app.get('/api/copytrade/config', (_req: Request, res: Response) => {
      res.json({ success: true, config: copyTradeAgent.getCopyConfig() });
    });

    // PUT /api/copytrade/config
    this.app.put('/api/copytrade/config', (req: Request, res: Response) => {
      try {
        const updated = copyTradeAgent.updateCopyConfig(req.body || {});
        logger.info(`[WebServer] Copy Trade config updated: enabled=${updated.isEnabled}`);
        this.io.emit('copytrade_config_updated', updated);
        res.json({ success: true, config: updated });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ success: false, error: msg });
      }
    });

    // POST /api/copytrade/exit
    this.app.post('/api/copytrade/exit', async (req: Request, res: Response) => {
      try {
        const { tokenAddress } = req.body || {};
        if (!tokenAddress) {
          res.status(400).json({ success: false, message: 'tokenAddress is required' });
          return;
        }
        const success = await copyTradeAgent.manualExit(tokenAddress);
        res.json({ success, message: success ? 'Position closed successfully' : 'Position not found' });
      } catch (err: any) {
        res.status(500).json({ success: false, message: err.message || 'Exit failed' });
      }
    });

    // GET /api/copytrade/prices?mints=...
    this.app.get('/api/copytrade/prices', async (req: Request, res: Response) => {
      try {
        const rawMints = String(req.query.mints || '').trim();
        if (!rawMints) {
          res.json({ success: true, prices: {} });
          return;
        }
        const mintList = rawMints.split(',').map((m) => m.trim()).filter(Boolean).slice(0, 30);
        if (mintList.length === 0) {
          res.json({ success: true, prices: {} });
          return;
        }

        const dexRes = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${mintList.join(',')}`, {
          headers: { Accept: 'application/json' },
          timeout: 2500,
        });

        const pairs: any[] = dexRes.data?.pairs || [];
        const prices: Record<string, { priceSol: number; priceUsd: number; symbol: string }> = {};

        for (const mint of mintList) {
          const pair = pairs.find((p) => p.baseToken?.address?.toLowerCase() === mint.toLowerCase());
          if (pair) {
            prices[mint] = {
              priceSol: Number(pair.priceNative || 0),
              priceUsd: Number(pair.priceUsd || 0),
              symbol: pair.baseToken?.symbol || '',
            };
          }
        }

        res.json({ success: true, prices });
      } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // GET /api/copytrade/positions
    this.app.get('/api/copytrade/positions', (_req: Request, res: Response) => {
      res.json({ success: true, positions: copyTradeAgent.getActivePositions() });
    });

    // POST /api/copytrade/reset - Full Portfolio & Paper Stats Reset
    this.app.post('/api/copytrade/reset', (_req: Request, res: Response) => {
      copyTradeAgent.resetState();
      this.activePositions.clear();
      this.copyTradeActivityLog = [];
      const paperStats = simulator.getPaperStats();
      this.io.emit('paper_stats_update', paperStats);
      this.io.emit('wallet_balance_updated', { balance: simulator.getSolBalance() });
      this.io.emit('copytrade_activity', []);
      this.io.emit('copytrade_positions', []);
      res.json({ success: true, message: 'Copy Trade portfolio and PnL reset successfully.', paperStats });
    });

    // Fallback to React index.html for SPA routing
    this.app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  private configureSocketIO(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`[Socket.io] Client connected [ID: ${socket.id}]. Total: ${this.io.engine.clientsCount}`);

      // Send initial state snapshot to newly connected client
      const activeList = Array.from(this.activePositions.values());
      socket.emit('init_state', {
        isScanning: this.isScanning,
        dryRunMode: config.dryRunMode,
        walletBalanceSol: config.dryRunMode ? simulator.getSolBalance() : 'Live Wallet',
        walletAddress: config.dryRunMode ? simulator.getPublicKey() : '',
        activePosition: activeList[0] || null,
        activePositions: activeList,
        recentTokens: this.recentTokens.slice(0, 30),
        tradeHistory: this.tradeHistory.slice(0, 30),
        whaleAlerts: this.whaleAlerts.slice(0, 10),
        stats: this.stats,
        paperStats: simulator.getPaperStats(),
        agent6Notes: sentinelAgent.getNotes(),
        agent6Stats: sentinelAgent.getStats(),
        agent1Models: {
          options: aiService.getAgent1Options(),
          selected: aiService.getSelectedAgent1ModelId(),
          activeOption: aiService.getSelectedAgent1Option(),
        },
        agent2Models: {
          options: aiService.getAgent2Options(),
          selected: aiService.getSelectedAgent2ModelId(),
          activeOption: aiService.getSelectedAgent2Option(),
        },
        config: {
          buyAmountSol: config.buyAmountSol,
          slippageBps: config.slippageBps,
          maxOpenPositions: config.maxOpenPositions,
          takeProfitMultiplier: config.takeProfitMultiplier,
          stopLossPercent: config.stopLossPercent,
          minNarrativeScore: config.minNarrativeScore,
          minHoldersCount: config.minHoldersCount,
          maxTokenAgeSeconds: config.maxTokenAgeSeconds,
          maxDevHoldingPercent: config.maxDevHoldingPercent,
          maxTop10HoldingPercent: config.maxTop10HoldingPercent,
          jitoTipSol: config.jitoTipSol,
          dryRunMode: config.dryRunMode,
          port: config.port,
        },
        copyTradeWallets: copyTradeAgent.getWallets(),
        copyTradeConfig: copyTradeAgent.getCopyConfig(),
        copyTradeActivity: this.copyTradeActivityLog.slice(0, 50),
      });

      socket.on('set_agent1_model', (modelId: string) => {
        const updated = aiService.setSelectedAgent1ModelId(modelId);
        logger.info(`[Socket.io] Client set Agen 1 model to: ${updated.name}`);
        this.io.emit('agent1_model_changed', {
          selected: updated.id,
          activeOption: updated,
        });
        this.io.emit('agent_status_change', {
          id: 'scanner',
          state: this.isScanning ? 'SCANNING' : 'PAUSED',
          detail: `Model: ${updated.shortName} (${updated.model}) active`,
        });
      });

      socket.on('set_agent2_model', (modelId: string) => {
        const updated = aiService.setSelectedAgent2ModelId(modelId);
        logger.info(`[Socket.io] Client set Agen 2 model to: ${updated.name}`);
        this.io.emit('agent2_model_changed', {
          selected: updated.id,
          activeOption: updated,
        });
        this.io.emit('agent_status_change', {
          id: 'auditor',
          state: 'IDLE',
          detail: `Security Auditor Model: ${updated.shortName} (${updated.model}) active`,
        });
      });

      socket.on('disconnect', () => {
        logger.info(`[Socket.io] Client disconnected [ID: ${socket.id}]`);
      });
    });
  }

  private subscribeEventBus(): void {
    eventBus.on('TOKEN_SCANNED', (token: ITokenData) => {
      const existing = this.recentTokens.find((t) => t.token.mint === token.mint);
      if (!existing) {
        this.recentTokens.unshift({ token });
        if (this.recentTokens.length > 60) this.recentTokens.pop();
      }

      this.io.emit('token_scanned', token);
      this.io.emit('token_detected', token);
      this.io.emit('agent_status_change', {
        id: 'scanner',
        state: 'SCANNING',
        detail: `Scanned $${token.symbol} (Score: ${token.narrativeScore.toFixed(2)})`,
      });
    });

    eventBus.on('TOKEN_DETECTED', (token: ITokenData) => {
      this.io.emit('agent_status_change', {
        id: 'scanner',
        state: 'SCANNING',
        detail: `Viral Qualified $${token.symbol} (Score: ${token.narrativeScore.toFixed(2)})!`,
      });
      this.io.emit('agent_status_change', {
        id: 'auditor',
        state: 'AUDITING',
        detail: `Auditing $${token.symbol} authorities & dev supply...`,
      });
    });

    eventBus.on('AUDIT_PASSED', ({ token, audit }) => {
      const found = this.recentTokens.find((t) => t.token.mint === token.mint);
      if (found) found.audit = audit;

      this.io.emit('audit_result', { token, audit });
      this.io.emit('agent_status_change', {
        id: 'auditor',
        state: 'AUDITING',
        detail: `Audit PASSED for $${token.symbol}! Emitting to Execution.`,
      });
      this.io.emit('agent_status_change', {
        id: 'execution',
        state: 'BUYING',
        detail: `Routing Buy order for $${token.symbol} via Jito MEV...`,
      });
    });

    eventBus.on('AUDIT_FAILED', ({ token, audit }) => {
      const found = this.recentTokens.find((t) => t.token.mint === token.mint);
      if (found) found.audit = audit;

      this.io.emit('audit_result', { token, audit });
      this.io.emit('agent_status_change', {
        id: 'auditor',
        state: 'IDLE',
        detail: `Rejected $${token.symbol}: ${audit.reasons[0] || 'Kill-Vote Failed'}`,
      });
    });

    eventBus.on('POSITION_OPENED', (position: IPositionState) => {
      this.activePositions.set(position.tokenAddress, { ...position });
      const activeList = Array.from(this.activePositions.values());

      this.io.emit('trade_executed', position);
      this.io.emit('active_positions_updated', activeList);
      this.io.emit('agent_status_change', {
        id: 'scanner',
        state: this.activePositions.size >= config.maxOpenPositions ? 'PAUSED' : 'SCANNING',
        detail: `Active positions: ${this.activePositions.size}/${config.maxOpenPositions}`,
      });
      this.io.emit('agent_status_change', {
        id: 'tracker',
        state: 'TRACKING',
        detail: `Tracking ${this.activePositions.size} active positions`,
      });
      this.io.emit('agent_status_change', {
        id: 'exit',
        state: 'EXITING',
        detail: `Armed TP (${config.takeProfitMultiplier}x) / SL (-${config.stopLossPercent}%)`,
      });
    });

    eventBus.on('POSITION_UPDATE', (position: IPositionState) => {
      this.activePositions.set(position.tokenAddress, { ...position });
      this.io.emit('price_update', position);
      this.io.emit('active_positions_updated', Array.from(this.activePositions.values()));
    });

    eventBus.on('ACTIVE_POSITIONS_UPDATE', (positions: IPositionState[]) => {
      for (const pos of positions) {
        this.activePositions.set(pos.tokenAddress, { ...pos });
      }
      this.io.emit('active_positions_updated', positions);
    });

    eventBus.on('WHALE_DUMP_WARNING', (alert: IWhaleAlert) => {
      this.whaleAlerts.unshift(alert);
      if (this.whaleAlerts.length > 20) this.whaleAlerts.pop();

      this.io.emit('whale_dump_warning', alert);
      this.io.emit('agent_status_change', {
        id: 'exit',
        state: 'EXITING',
        detail: `EMERGENCY EXIT: Whale sold ${alert.percentOfSupply.toFixed(1)}% of $${alert.symbol}!`,
      });
    });

    eventBus.on('POSITION_CLOSED', (summary: IPositionCloseSummary) => {
      this.activePositions.delete(summary.tokenAddress);
      const activeList = Array.from(this.activePositions.values());

      this.tradeHistory.unshift(summary);
      if (this.tradeHistory.length > 60) this.tradeHistory.pop();

      this.stats.totalTrades++;
      if (summary.pnlSol > 0) {
        this.stats.winningTrades++;
      } else {
        this.stats.losingTrades++;
      }
      this.stats.netPnlSol += summary.pnlSol;

      this.io.emit('position_closed', {
        summary,
        activePositions: activeList,
        walletBalanceSol: config.dryRunMode ? simulator.getSolBalance() : 0,
        stats: {
          ...this.stats,
          winRatePercent: parseFloat(
            ((this.stats.winningTrades / this.stats.totalTrades) * 100).toFixed(1)
          ),
        },
      });
      this.io.emit('active_positions_updated', activeList);

      this.io.emit('agent_status_change', {
        id: 'scanner',
        state: 'SCANNING',
        detail: `Positions: ${this.activePositions.size}/${config.maxOpenPositions} (Scanning active)`,
      });
      this.io.emit('agent_status_change', {
        id: 'tracker',
        state: this.activePositions.size > 0 ? 'TRACKING' : 'IDLE',
        detail: this.activePositions.size > 0 ? `Tracking ${this.activePositions.size} positions` : 'Standby for next trade',
      });
      this.io.emit('agent_status_change', {
        id: 'exit',
        state: this.activePositions.size > 0 ? 'EXITING' : 'IDLE',
        detail: `Closed $${summary.symbol} (${summary.exitReason})`,
      });
      this.io.emit('paper_stats_update', simulator.getPaperStats());
    });

    eventBus.on('PAPER_STATS_UPDATE', (stats) => {
      this.io.emit('paper_stats_update', stats);
    });

    eventBus.on('PAUSE_SCAN', () => {
      this.io.emit('agent_status_change', {
        id: 'scanner',
        state: 'PAUSED',
        detail: this.isScanning ? 'Scanner paused (Position lock)' : 'Scanner paused by user',
      });
    });

    eventBus.on('RESUME_SCAN', () => {
      if (this.isScanning) {
        this.io.emit('agent_status_change', {
          id: 'scanner',
          state: 'SCANNING',
          detail: 'Listening to pump.fun WebSocket stream...',
        });
      }
    });

    eventBus.on('AGENT6_NOTE_CREATED', (note) => {
      this.io.emit('agent6_note_created', note);
      this.io.emit('agent6_stats', sentinelAgent.getStats());
    });

    eventBus.on('AGENT6_STATS_UPDATE', (stats) => {
      this.io.emit('agent6_stats', stats);
    });

    // Copy Trade Events
    eventBus.on('COPY_TRADE_ACTIVITY', (activity: ICopyTradeActivity) => {
      this.copyTradeActivityLog.unshift(activity);
      if (this.copyTradeActivityLog.length > 100) this.copyTradeActivityLog.pop();
      this.io.emit('copytrade_activity', activity);

      const actionLabel = activity.action === 'BUY' ? '🟢 BUY' : '🔴 SELL';
      if (activity.copyStatus === 'DETECTED') {
        this.io.emit('agent_status_change', {
          id: 'copytrade',
          state: 'DETECTING',
          detail: `${actionLabel} detected from ${activity.walletLabel || activity.walletAddress.slice(0, 6)} — $${activity.tokenSymbol}`,
        });
      } else if (activity.copyStatus === 'COPIED') {
        this.io.emit('agent_status_change', {
          id: 'copytrade',
          state: 'COPIED',
          detail: `Copied ${actionLabel} $${activity.tokenSymbol} from ${activity.walletLabel || activity.walletAddress.slice(0, 6)}`,
        });
      } else if (activity.copyStatus === 'SKIPPED') {
        this.io.emit('agent_status_change', {
          id: 'copytrade',
          state: 'IDLE',
          detail: `Skipped ${actionLabel} $${activity.tokenSymbol}: ${activity.skipReason}`,
        });
      }
    });

    eventBus.on('COPY_TRADE_WALLET_UPDATED', (wallets) => {
      this.io.emit('copytrade_wallets_updated', wallets);
    });

    eventBus.on('COPY_POSITIONS_TICK', (positions) => {
      this.io.emit('copy_positions_tick', positions);
      this.io.emit('active_positions_updated', positions);
    });
  }

  private subscribeLogs(): void {
    logEmitter.on('log', (logEntry: { timestamp: string; level: string; message: string }) => {
      this.io.emit('new_log', logEntry);
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(config.port, () => {
        logger.info(`================================================================`);
        logger.info(`[WebServer] Full-Stack Trading Terminal ONLINE!`);
        logger.info(`[WebServer] URL: http://localhost:${config.port}`);
        logger.info(`[WebServer] Socket.io Real-Time Bridge Activated`);
        logger.info(`================================================================`);
        resolve();
      });
    });
  }

  public stop(): void {
    this.io.close();
    this.server.close();
    logger.info('[WebServer] Full-Stack Server stopped.');
  }
}
