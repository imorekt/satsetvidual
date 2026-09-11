import React, { useState, useEffect } from 'react';
import { socket } from './services/socket';
import { 
  IPositionState, 
  ITokenData, 
  IAuditResult, 
  IWhaleAlert, 
  IPositionCloseSummary, 
  LogEntry, 
  AgentStatus, 
  BotConfig, 
  PricePoint,
  IAuditNotepadEntry,
  IAgent6Stats,
  ICopyTradeWallet,
  ICopyTradeActivity,
  CopyTradeConfig,
  IPaperTradingStats
} from './types';
import { Plus, Wallet } from 'lucide-react';
import { HeaderControls } from './components/HeaderControls';
import { AgentStatusGrid } from './components/AgentStatusGrid';
import { ActivePositionHero } from './components/ActivePositionHero';
import { TokenScannerFeed } from './components/TokenScannerFeed';
import { WhaleRadarPanel } from './components/WhaleRadarPanel';
import { TerminalLog } from './components/TerminalLog';
import { SettingsModal } from './components/SettingsModal';
import { MoonshotSimulationView } from './components/MoonshotSimulationView';
import { SuperAuditNotepadView } from './components/SuperAuditNotepadView';
import { CopyTradeView } from './components/CopyTradeView';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'moonshot' | 'live' | 'notepad' | 'copytrade'>('moonshot');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isScanning, setIsScanning] = useState(true);
  const [dryRunMode, setDryRunMode] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number | string>(() => {
    try {
      const saved = localStorage.getItem('paper_balance');
      if (saved && !isNaN(Number(saved))) return Number(saved);
    } catch {}
    return 5.0;
  });
  const [activePosition, setActivePosition] = useState<IPositionState | null>(null);
  const [activePositions, setActivePositions] = useState<IPositionState[]>([]);
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [tokens, setTokens] = useState<Array<{ token: ITokenData; audit?: IAuditResult }>>([]);
  const [whaleAlerts, setWhaleAlerts] = useState<IWhaleAlert[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tradeHistory, setTradeHistory] = useState<IPositionCloseSummary[]>(() => {
    try {
      const saved = localStorage.getItem('pumpfun_trade_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('1.0');
  const [selectedAgent1Model, setSelectedAgent1Model] = useState<string>('openrouter-nex');
  const [selectedAgent2Model, setSelectedAgent2Model] = useState<string>('openrouter-nex');

  // Agent 6 Notepad & Sentinel State
  const [agent6Notes, setAgent6Notes] = useState<IAuditNotepadEntry[]>(() => {
    try {
      const saved = localStorage.getItem('pumpfun_agent6_notes');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [agent6Stats, setAgent6Stats] = useState<IAgent6Stats>(() => {
    try {
      const saved = localStorage.getItem('pumpfun_agent6_stats');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      systemBugsCount: 0,
      lossAutopsiesCount: 0,
      status: 'ANALYZING & ADAPTING',
      lastActive: Date.now(),
    };
  });

  // Copy Trade State with dual-layer localStorage persistence
  const [copyTradeWallets, setCopyTradeWallets] = useState<ICopyTradeWallet[]>(() => {
    try {
      const saved = localStorage.getItem('copytrade_wallets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [copyTradeActivity, setCopyTradeActivity] = useState<ICopyTradeActivity[]>([]);
  const [paperStats, setPaperStats] = useState<IPaperTradingStats | null>(null);
  const [copyTradeConfig, setCopyTradeConfig] = useState<CopyTradeConfig>(() => {
    try {
      const saved = localStorage.getItem('copytrade_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      isEnabled: true,
      copyDelayMs: 0,
      maxCopyAmountSol: 0.5,
      copyMode: 'ALL',
      skipIfPositionExists: true,
      useCustomAmount: false,
      customAmountSol: 0.05,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('pumpfun_trade_history', JSON.stringify(tradeHistory));
    } catch (e) {}
  }, [tradeHistory]);

  useEffect(() => {
    try {
      localStorage.setItem('pumpfun_agent6_notes', JSON.stringify(agent6Notes));
      localStorage.setItem('pumpfun_agent6_stats', JSON.stringify(agent6Stats));
    } catch (e) {}
  }, [agent6Notes, agent6Stats]);

  useEffect(() => {
    try {
      if (copyTradeWallets.length > 0) {
        localStorage.setItem('copytrade_wallets', JSON.stringify(copyTradeWallets));
      }
    } catch (e) {}
  }, [copyTradeWallets]);

  useEffect(() => {
    try {
      localStorage.setItem('copytrade_config', JSON.stringify(copyTradeConfig));
    } catch (e) {}
  }, [copyTradeConfig]);

  useEffect(() => {
    // Initial direct REST fetch for copytrade wallets and config
    fetch('/api/copytrade/wallets')
      .then((r) => r.json())
      .then((d) => {
        if (d?.wallets && Array.isArray(d.wallets) && d.wallets.length > 0) {
          setCopyTradeWallets(d.wallets);
        }
      })
      .catch(() => {});

    fetch('/api/copytrade/config')
      .then((r) => r.json())
      .then((d) => {
        if (d?.config) {
          setCopyTradeConfig((prev) => ({ ...prev, ...d.config }));
        }
      })
      .catch(() => {});
  }, []);

  const [agents, setAgents] = useState<Record<string, AgentStatus>>({
    scanner: { name: 'Scanner', state: 'SCANNING', detail: 'Listening to pump.fun WebSocket stream...', lastActive: Date.now() },
    auditor: { name: 'Auditor', state: 'IDLE', detail: '3-Layer anti-rug verification ready', lastActive: Date.now() },
    execution: { name: 'Execution', state: 'IDLE', detail: 'Jito MEV fast routing standby', lastActive: Date.now() },
    tracker: { name: 'Tracker', state: 'IDLE', detail: '200ms precision tracking standby', lastActive: Date.now() },
    exit: { name: 'Exit', state: 'IDLE', detail: 'Risk triggers armed (TP/SL/Whale)', lastActive: Date.now() },
  });

  useEffect(() => {
    // Socket connection lifecycle
    const onConnect = () => {
      setIsConnected(true);
      addLog('info', 'WebSocket connected to Backend Server.');
    };

    const onDisconnect = () => {
      setIsConnected(false);
      addLog('warn', 'WebSocket disconnected from Backend Server.');
    };

    const onPaperStats = (stats: IPaperTradingStats) => {
      if (stats) {
        setPaperStats(stats);
        if (stats.currentBalanceSol !== undefined) {
          setWalletBalance(stats.currentBalanceSol);
        }
      }
    };

    const onInitState = (data: any) => {
      if (data.isScanning !== undefined) setIsScanning(data.isScanning);
      if (data.dryRunMode !== undefined) setDryRunMode(data.dryRunMode);
      if (data.walletBalanceSol !== undefined) setWalletBalance(data.walletBalanceSol);
      if (data.paperStats) setPaperStats(data.paperStats);
      if (data.activePositions && Array.isArray(data.activePositions)) {
        setActivePositions(data.activePositions);
        if (data.activePositions.length > 0) {
          setSelectedMint(data.activePositions[0].tokenAddress);
          setActivePosition(data.activePositions[0]);
        }
      } else if (data.activePosition) {
        setActivePosition(data.activePosition);
        setActivePositions([data.activePosition]);
        setSelectedMint(data.activePosition.tokenAddress);
      }
      if (data.config) setConfig(data.config);
      if (data.recentTokens) setTokens(data.recentTokens);
      if (data.tradeHistory) setTradeHistory(data.tradeHistory);
      if (data.whaleAlerts) setWhaleAlerts(data.whaleAlerts);
      if (data.agent1Models?.selected) setSelectedAgent1Model(data.agent1Models.selected);
      if (data.agent2Models?.selected) setSelectedAgent2Model(data.agent2Models.selected);
      if (data.agent6Notes) setAgent6Notes(data.agent6Notes);
      if (data.agent6Stats) setAgent6Stats(data.agent6Stats);
      if (data.copyTradeWallets) setCopyTradeWallets(data.copyTradeWallets);
      if (data.copyTradeConfig) setCopyTradeConfig(data.copyTradeConfig);
      if (data.copyTradeActivity) setCopyTradeActivity(data.copyTradeActivity);
    };

    const onAgentStatusChange = (status: { id: string; state: any; detail: string }) => {
      setAgents((prev) => ({
        ...prev,
        [status.id]: {
          name: prev[status.id]?.name || status.id,
          state: status.state,
          detail: status.detail,
          lastActive: Date.now(),
        },
      }));
    };

    const onTokenDetected = (token: ITokenData) => {
      setTokens((prev) => {
        if (prev.some((t) => t.token.mint === token.mint)) return prev;
        return [{ token }, ...prev.slice(0, 59)];
      });
      setAgents((prev) => ({
        ...prev,
        scanner: { ...prev.scanner, state: 'SCANNING', detail: `Scanned $${token.symbol} (Score: ${token.narrativeScore.toFixed(2)})` },
      }));
    };

    const onAuditResult = (data: { token: ITokenData; audit: IAuditResult }) => {
      setTokens((prev) =>
        prev.map((item) =>
          item.token.mint === data.token.mint ? { ...item, audit: data.audit } : item
        )
      );

      setAgents((prev) => ({
        ...prev,
        auditor: {
          ...prev.auditor,
          state: data.audit.passed ? 'AUDITING' : 'IDLE',
          detail: data.audit.passed
            ? `Audit PASSED for $${data.token.symbol}`
            : `Audit FAILED for $${data.token.symbol}`,
        },
      }));
    };

    const onTradeExecuted = (position: IPositionState) => {
      setActivePositions((prev) => [position, ...prev.filter((p) => p.tokenAddress !== position.tokenAddress)]);
      setSelectedMint(position.tokenAddress);
      setActivePosition(position);
      setPriceHistory([
        {
          time: new Date(position.entryTimestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          timestamp: position.entryTimestamp,
          price: position.entryPriceSol,
          pnlPercent: 0,
        },
      ]);

      setAgents((prev) => ({
        ...prev,
        scanner: { ...prev.scanner, state: 'SCANNING', detail: 'Monitoring token opportunities' },
        execution: { ...prev.execution, state: 'BUYING', detail: `Bought $${position.symbol} @ ${(Number(position.entryPriceSol) || 0) < 0.0001 ? (Number(position.entryPriceSol) || 0).toExponential(3) : (Number(position.entryPriceSol) || 0).toFixed(4)} SOL` },
        tracker: { ...prev.tracker, state: 'TRACKING', detail: `Tracking position for $${position.symbol}` },
        exit: { ...prev.exit, state: 'EXITING', detail: `Monitoring TP/SL for $${position.symbol}` },
      }));

      addLog('success', `POSITION OPENED: $${position.symbol} (${(Number(position.amountToken) / 1e6).toFixed(0)} tokens)`);
    };

    const onPriceUpdate = (position: IPositionState) => {
      setActivePositions((prev) =>
        prev.map((p) => (p.tokenAddress === position.tokenAddress ? position : p))
      );
      if (!selectedMint || selectedMint === position.tokenAddress) {
        setActivePosition(position);
        const now = new Date();
        const timeStr = `${now.getMinutes()}:${now.getSeconds().toString().padStart(2, '0')}.${Math.floor(now.getMilliseconds() / 100)}`;

        setPriceHistory((prev) => {
          const next = [...prev, {
            time: timeStr,
            timestamp: Date.now(),
            price: position.currentPriceSol,
            pnlPercent: position.pnlPercent,
          }];
          return next.slice(-60); // Keep last 60 ticks
        });
      }
    };

    const onActivePositionsUpdated = (positions: IPositionState[]) => {
      setActivePositions(positions);
      if (positions.length > 0) {
        if (!selectedMint || !positions.some((p) => p.tokenAddress === selectedMint)) {
          setSelectedMint(positions[0].tokenAddress);
          setActivePosition(positions[0]);
        } else {
          const curr = positions.find((p) => p.tokenAddress === selectedMint);
          if (curr) setActivePosition(curr);
        }
      } else {
        setActivePosition(null);
        setSelectedMint(null);
      }
    };

    const onWhaleDumpWarning = (alert: IWhaleAlert) => {
      setWhaleAlerts((prev) => [alert, ...prev.slice(0, 9)]);
      addLog('error', `WHALE DUMP ALERT: Whale dumped ${alert.percentOfSupply.toFixed(1)}% supply of $${alert.symbol}!`);
    };

    const onPositionClosed = (data: { summary: IPositionCloseSummary; activePositions?: IPositionState[]; walletBalanceSol?: number }) => {
      setActivePositions((prev) => {
        const remaining = prev.filter((p) => p.tokenAddress !== data.summary.tokenAddress);
        if (remaining.length > 0) {
          setSelectedMint(remaining[0].tokenAddress);
          setActivePosition(remaining[0]);
        } else {
          setSelectedMint(null);
          setActivePosition(null);
          setPriceHistory([]);
        }
        return remaining;
      });

      setTradeHistory((prev) => [data.summary, ...prev.slice(0, 49)]);
      if (data.walletBalanceSol !== undefined) setWalletBalance(data.walletBalanceSol);

      setAgents((prev) => ({
        ...prev,
        scanner: { ...prev.scanner, state: 'SCANNING', detail: 'Resumed scanning for tokens' },
        tracker: { ...prev.tracker, state: 'IDLE', detail: 'Standby for next trade' },
        exit: { ...prev.exit, state: 'IDLE', detail: `Closed $${data.summary.symbol} (${data.summary.exitReason})` },
      }));

      addLog(
        data.summary.pnlPercent >= 0 ? 'success' : 'warn',
        `POSITION CLOSED: $${data.summary.symbol} | PnL: ${data.summary.pnlPercent >= 0 ? '+' : ''}${data.summary.pnlPercent.toFixed(2)}% (${data.summary.pnlSol >= 0 ? '+' : ''}${data.summary.pnlSol.toFixed(4)} SOL)`
      );
    };

    const onNewLog = (logEntry: { timestamp: string; level: string; message: string }) => {
      addLog(logEntry.level as any, logEntry.message, logEntry.timestamp);
    };

    const onConfigUpdated = (newConfig: BotConfig) => {
      setConfig(newConfig);
      setDryRunMode(newConfig.dryRunMode);
      addLog('info', 'Trading configuration updated.');
    };

    const onAgent1ModelChanged = (data: { selected: string }) => {
      if (data.selected) {
        setSelectedAgent1Model(data.selected);
      }
    };

    const onAgent2ModelChanged = (data: { selected: string }) => {
      if (data.selected) {
        setSelectedAgent2Model(data.selected);
      }
    };

    const onAgent6NoteCreated = (note: IAuditNotepadEntry) => {
      setAgent6Notes((prev) => [note, ...prev.filter((n) => n.id !== note.id).slice(0, 99)]);
      if (note.type === 'LOSS_AUTOPSY') {
        addLog('warn', `A6 LOSS AUTOPSY: Completed autopsy for $${note.tokenSymbol} (${note.pnlPercent.toFixed(2)}%)`);
      } else {
        addLog('error', `A6 BUG SENTINEL: [${note.category}] ${note.description}`);
      }
    };

    const onAgent6Stats = (stats: IAgent6Stats) => {
      setAgent6Stats(stats);
    };

    const onAgent6NotesCleared = () => {
      setAgent6Notes([]);
    };

    // Copy Trade socket listeners
    const onCopyTradeActivity = (activity: ICopyTradeActivity) => {
      setCopyTradeActivity((prev) => {
        // update existing if same id, else prepend
        const exists = prev.find((a) => a.id === activity.id);
        if (exists) {
          return prev.map((a) => a.id === activity.id ? activity : a);
        }
        return [activity, ...prev.slice(0, 99)];
      });
      const walletIdentifier = activity.walletLabel || (activity.walletAddress ? activity.walletAddress.slice(0, 6) : 'Wallet');
      if (activity.copyStatus === 'COPIED') {
        addLog('success', `[COPY TRADE] ${activity.action} $${activity.tokenSymbol} dari ${walletIdentifier} — COPIED!`);
      } else if (activity.copyStatus === 'DETECTED') {
        addLog('info', `[COPY TRADE] Detected ${activity.action} $${activity.tokenSymbol} dari ${walletIdentifier}`);
      } else if (activity.copyStatus === 'SKIPPED') {
        addLog('warn', `[COPY TRADE] Skipped ${activity.action} $${activity.tokenSymbol}: ${activity.skipReason}`);
      }
    };

    const onCopyTradeWalletsUpdated = (wallets: ICopyTradeWallet[]) => {
      setCopyTradeWallets(wallets);
    };

    const onCopyTradeConfigUpdated = (cfg: CopyTradeConfig) => {
      setCopyTradeConfig(cfg);
    };

    const onWalletBalanceUpdated = (data: { balanceSol: number }) => {
      if (data?.balanceSol !== undefined) {
        setWalletBalance(data.balanceSol);
        try {
          localStorage.setItem('paper_balance', String(data.balanceSol));
        } catch {}
      }
    };

    // Attach listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('init_state', onInitState);
    socket.on('agent_status_change', onAgentStatusChange);
    socket.on('token_detected', onTokenDetected);
    socket.on('token_scanned', onTokenDetected);
    socket.on('audit_result', onAuditResult);
    socket.on('trade_executed', onTradeExecuted);
    socket.on('price_update', onPriceUpdate);
    socket.on('active_positions_updated', onActivePositionsUpdated);
    socket.on('copy_positions_tick', onActivePositionsUpdated);
    socket.on('whale_dump_warning', onWhaleDumpWarning);
    socket.on('position_closed', onPositionClosed);
    socket.on('new_log', onNewLog);
    socket.on('config_updated', onConfigUpdated);
    socket.on('agent1_model_changed', onAgent1ModelChanged);
    socket.on('agent2_model_changed', onAgent2ModelChanged);
    socket.on('agent6_note_created', onAgent6NoteCreated);
    socket.on('agent6_stats', onAgent6Stats);
    socket.on('agent6_notes_cleared', onAgent6NotesCleared);
    socket.on('wallet_balance_updated', onWalletBalanceUpdated);
    socket.on('paper_stats_update', onPaperStats);
    socket.on('copytrade_activity', onCopyTradeActivity);
    socket.on('copytrade_wallets_updated', onCopyTradeWalletsUpdated);
    socket.on('copytrade_config_updated', onCopyTradeConfigUpdated);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('init_state', onInitState);
      socket.off('agent_status_change', onAgentStatusChange);
      socket.off('token_detected', onTokenDetected);
      socket.off('token_scanned', onTokenDetected);
      socket.off('audit_result', onAuditResult);
      socket.off('trade_executed', onTradeExecuted);
      socket.off('price_update', onPriceUpdate);
      socket.off('active_positions_updated', onActivePositionsUpdated);
      socket.off('copy_positions_tick', onActivePositionsUpdated);
      socket.off('whale_dump_warning', onWhaleDumpWarning);
      socket.off('position_closed', onPositionClosed);
      socket.off('new_log', onNewLog);
      socket.off('config_updated', onConfigUpdated);
      socket.off('agent1_model_changed', onAgent1ModelChanged);
      socket.off('agent2_model_changed', onAgent2ModelChanged);
      socket.off('agent6_note_created', onAgent6NoteCreated);
      socket.off('agent6_stats', onAgent6Stats);
      socket.off('agent6_notes_cleared', onAgent6NotesCleared);
      socket.off('wallet_balance_updated', onWalletBalanceUpdated);
      socket.off('paper_stats_update', onPaperStats);
      socket.off('copytrade_activity', onCopyTradeActivity);
      socket.off('copytrade_wallets_updated', onCopyTradeWalletsUpdated);
      socket.off('copytrade_config_updated', onCopyTradeConfigUpdated);
    };
  }, []);

  const handleDepositSubmit = async () => {
    const num = parseFloat(depositAmount);
    if (isNaN(num) || num <= 0) return;
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: num }),
      });
      const data = await res.json();
      if (data.success && data.newBalance !== undefined) {
        setWalletBalance(data.newBalance);
        try {
          localStorage.setItem('paper_balance', String(data.newBalance));
        } catch {}
        addLog('success', `DEPOSIT SUCCESS: +${num.toFixed(4)} SOL added to balance.`);
      }
      setIsDepositModalOpen(false);
    } catch (err) {
      console.error('Failed to deposit:', err);
    }
  };

  const addLog = (level: LogEntry['level'], message: string, timestamp?: string) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: timestamp || new Date().toISOString(),
      level: level || 'info',
      message,
    };
    setLogs((prev) => [...prev.slice(-150), entry]);
  };

  // Action Handlers
  const handleToggleScan = async () => {
    try {
      const endpoint = isScanning ? '/api/bot/stop' : '/api/bot/start';
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsScanning(!isScanning);
      }
    } catch (err) {
      console.error('Failed to toggle scan:', err);
    }
  };

  const handleToggleDryRun = async () => {
    try {
      const newMode = !dryRunMode;
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRunMode: newMode }),
      });
      const data = await res.json();
      if (data.success) {
        setDryRunMode(newMode);
      }
    } catch (err) {
      console.error('Failed to toggle dry-run mode:', err);
    }
  };

  const handleEmergencySell = async (tokenAddress?: string) => {
    try {
      const res = await fetch('/api/bot/emergency-sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress }),
      });
      const data = await res.json();
      if (data.success) {
        addLog('warn', `Emergency Sell Command dispatched for ${tokenAddress || 'ALL positions'}.`);
      }
    } catch (err) {
      console.error('Failed to execute emergency sell:', err);
    }
  };

  const handleClearNotepad = async () => {
    try {
      await fetch('/api/agent6/notes', { method: 'DELETE' });
      setAgent6Notes([]);
      addLog('info', 'Agent 6 Notepad logs cleared.');
    } catch (err) {
      console.error('Failed to clear notepad:', err);
    }
  };

  const handleSimulateLossAutopsy = async () => {
    try {
      addLog('info', 'Triggering Agent 6 Loss Autopsy test via Claude Opus 4.8...');
      const res = await fetch('/api/agent6/autopsy/test', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.note) {
        setAgent6Notes((prev) => [data.note, ...prev.slice(0, 99)]);
        addLog('success', `A6 Autopsy generated for $${data.note.tokenSymbol}!`);
      }
    } catch (err) {
      console.error('Failed to run test autopsy:', err);
    }
  };

  const handleSaveSettings = async (updated: Partial<BotConfig>) => {
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  return (
    <div className="h-screen max-h-screen w-full overflow-hidden flex flex-col bg-[#060a12] text-slate-100 font-sans select-none">
      {/* Unified Top Header Controls */}
      <HeaderControls
        isScanning={isScanning}
        onToggleScan={handleToggleScan}
        dryRunMode={dryRunMode}
        onToggleDryRun={handleToggleDryRun}
        onEmergencySell={() => handleEmergencySell()}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDeposit={() => setIsDepositModalOpen(true)}
        walletBalance={walletBalance}
        isConnected={isConnected}
        config={config}
        hasActivePosition={activePositions.length > 0 || !!activePosition}
        currentView={currentView}
        onSelectView={setCurrentView}
      />

      {/* Main Full-Screen Command Center Workspace (100% width, zero page scroll) */}
      <main className="flex-1 min-h-0 w-full px-2.5 py-2 flex flex-col overflow-hidden relative">
        {/* Tab 1: 60s Moonshot Sequence View */}
        <div className={`h-full w-full flex flex-col overflow-hidden ${currentView === 'moonshot' ? 'flex' : 'hidden'}`}>
          <MoonshotSimulationView />
        </div>

        {/* Tab 2: 5-Agent On-Chain Feed */}
        <div className={`flex-1 min-h-0 w-full flex flex-col gap-2 overflow-hidden ${currentView === 'live' ? 'flex' : 'hidden'}`}>
          {/* 1. TOP FULL-WIDTH 5-AGENT SPECIALIST MATRIX */}
          <div className="w-full flex-shrink-0">
            <AgentStatusGrid 
              agents={agents} 
              selectedAgent1Model={selectedAgent1Model}
              onSelectAgent1Model={(m) => {
                setSelectedAgent1Model(m);
                socket.emit('set_agent1_model', m);
                fetch('/api/agent1/model', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ modelId: m }),
                }).catch(() => {});
              }}
              selectedAgent2Model={selectedAgent2Model}
              onSelectAgent2Model={(m) => {
                setSelectedAgent2Model(m);
                socket.emit('set_agent2_model', m);
                fetch('/api/agent2/model', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ modelId: m }),
                }).catch(() => {});
              }}
            />
          </div>

          {/* 2. MAIN BALANCED WORKSPACE (Zero-Scroll 2-Column Layout) */}
          <div className="flex-1 min-h-0 w-full grid grid-cols-12 gap-2.5 overflow-hidden">
            {/* Left Column (col-span-12 lg:col-span-7): Token Scanner Feed with Holographic Radar */}
            <div className="col-span-12 lg:col-span-7 h-full flex flex-col overflow-hidden">
              <TokenScannerFeed tokens={tokens} />
            </div>

            {/* Right Column (col-span-12 lg:col-span-5): Active Position Hero + Live Terminal Console */}
            <div className="col-span-12 lg:col-span-5 h-full flex flex-col gap-2 overflow-hidden">
              <div className="flex-shrink-0">
                <ActivePositionHero
                  position={activePosition}
                  positions={activePositions}
                  selectedMint={selectedMint}
                  onSelectPosition={(mint) => {
                    setSelectedMint(mint);
                    const pos = activePositions.find((p) => p.tokenAddress === mint);
                    if (pos) setActivePosition(pos);
                  }}
                  priceHistory={priceHistory}
                  config={config}
                  onEmergencySell={(tokenAddress) => handleEmergencySell(tokenAddress)}
                />
              </div>

              {whaleAlerts.length > 0 && (
                <div className="flex-shrink-0">
                  <WhaleRadarPanel alerts={whaleAlerts} />
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-hidden">
                <TerminalLog logs={logs} onClearLogs={() => setLogs([])} />
              </div>

              {tradeHistory.length > 0 && (
                <div className="h-24 flex-shrink-0 overflow-y-auto glass-panel p-2 rounded-xl border border-cyber-border text-xs font-mono scrollbar-thin">
                  <div className="flex items-center justify-between pb-1 border-b border-white/5 mb-1 text-[10px] text-slate-400">
                    <span className="font-bold">Trade History ({tradeHistory.length})</span>
                    <span>Exit Engine</span>
                  </div>
                  <div className="space-y-1">
                    {tradeHistory.slice(0, 6).map((trade, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-white">${trade.symbol}</span>
                        <span className={trade.pnlPercent >= 0 ? 'text-cyber-neonGreen' : 'text-rose-400'}>
                          {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(1)}% ({trade.exitReason})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab 3: Agent 6 Super Audit & Strategy Notepad View */}
        <div className={`h-full w-full flex flex-col overflow-hidden ${currentView === 'notepad' ? 'flex' : 'hidden'}`}>
          <SuperAuditNotepadView
            entries={agent6Notes}
            stats={agent6Stats}
            onClearNotes={handleClearNotepad}
            onSimulateLossAutopsy={handleSimulateLossAutopsy}
          />
        </div>

        {/* Tab 4: Auto Copy Trade Axiom */}
        <div className={`h-full w-full flex flex-col overflow-hidden ${currentView === 'copytrade' ? 'flex' : 'hidden'}`}>
          <CopyTradeView
            wallets={copyTradeWallets}
            activity={copyTradeActivity}
            copyConfig={copyTradeConfig}
            walletBalance={walletBalance}
            paperStats={paperStats}
            activePositions={activePositions}
            priceHistory={priceHistory}
            tradeHistory={tradeHistory}
            onOpenDeposit={() => setIsDepositModalOpen(true)}
            onAddWallet={(address, label) => {
              // Optimistic update — server response will confirm via socket
              const newWallet: ICopyTradeWallet = {
                address,
                label: label || undefined,
                addedAt: Date.now(),
                isActive: true,
                totalCopied: 0,
                winCount: 0,
                lossCount: 0,
              };
              setCopyTradeWallets((prev) => [...prev, newWallet]);
            }}
            onRemoveWallet={(address) => {
              setCopyTradeWallets((prev) => prev.filter((w) => w.address !== address));
            }}
            onToggleWallet={(address, isActive) => {
              setCopyTradeWallets((prev) =>
                prev.map((w) => w.address === address ? { ...w, isActive } : w)
              );
            }}
            onUpdateConfig={(updates) => {
              setCopyTradeConfig((prev) => ({ ...prev, ...updates }));
            }}
            onManualExit={async (tokenAddress) => {
              try {
                await fetch('/api/copytrade/exit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tokenAddress }),
                });
              } catch {
                // ignore
              }
            }}
          />
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSave={handleSaveSettings}
      />

      {/* Global Deposit SOL Modal */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in font-mono">
          <div className="w-full max-w-sm rounded-2xl bg-[#0a1020] border border-cyan-500/40 p-5 shadow-2xl shadow-cyan-950/60 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Deposit / Tambah Saldo SOL</span>
              </div>
              <button
                onClick={() => setIsDepositModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px] mb-1.5 font-bold">Pilih Nominal Cepat:</span>
                <div className="grid grid-cols-4 gap-2 font-bold">
                  {['0.5', '1.0', '5.0', '10.0'].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setDepositAmount(amt)}
                      className={`py-2 rounded-xl border transition-all ${
                        depositAmount === amt
                          ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 shadow-sm'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      +{amt} SOL
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1.5">Nominal Deposit (SOL):</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full px-3 py-2 pl-9 rounded-xl bg-[#060a14] border border-slate-700 text-white focus:outline-none focus:border-emerald-500 font-mono font-bold text-sm"
                    placeholder="Contoh: 1.0"
                  />
                  <Wallet className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-[11px] text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span>Saldo saat ini:</span>
                  <strong className="text-white">
                    {typeof walletBalance === 'number' ? walletBalance.toFixed(4) : walletBalance} SOL
                  </strong>
                </div>
                <div className="flex justify-between text-emerald-300 font-bold">
                  <span>Setelah deposit:</span>
                  <span>
                    {((typeof walletBalance === 'number' ? walletBalance : parseFloat(walletBalance) || 0) + (parseFloat(depositAmount) || 0)).toFixed(4)} SOL
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDepositSubmit}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-black hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Konfirmasi Deposit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
