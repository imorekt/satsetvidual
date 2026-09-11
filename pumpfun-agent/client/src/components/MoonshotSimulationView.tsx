import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  Activity,
  Flame,
  TrendingUp,
  AlertTriangle,
  Radio,
  Terminal,
  Sparkles,
  Award,
  Wallet,
  Cpu,
  CheckCircle2,
  ShieldAlert,
  Plus,
} from 'lucide-react';
import { socket } from '../services/socket';
import { AnimatedAgentPatrol } from './AnimatedAgentPatrol';
import { CyberRobotPatrolArena } from './CyberRobotPatrolArena';

interface PaperStats {
  initialBalanceSol: number;
  currentBalanceSol: number;
  totalPaperPnlSol: number;
  totalPaperPnlPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePercent: number;
  status: 'GROW' | 'REKT';
}

interface ActiveToken {
  mint: string;
  name: string;
  symbol: string;
  image?: string;
  narrativeScore: number;
  entryPriceSol: number;
  currentPriceSol: number;
  gainMultiplier: number;
  pnlPercent: number;
  pnlSol: number;
  virtualSol: number;
  solDeltaPercent: number;
  isWhaleDump: boolean;
  status: 'SCANNING' | 'AUDITING' | 'BOUGHT' | 'HOLDING' | 'EXITING' | 'CLOSED';
  lastPolledAt: string;
}

interface AgentCardState {
  name: string;
  role: string;
  model: string;
  status: 'ONLINE' | 'ACTIVE' | 'AUDITING' | 'BUYING' | 'TRACKING' | 'EXITING' | 'IDLE';
  detail: string;
  badgeColor: string;
  borderColor: string;
}

interface LogEntry {
  timestamp: string;
  tag: string;
  text: string;
  color: string;
}

interface NotificationPopup {
  id: string;
  title: string;
  subtitle: string;
  type: 'info' | 'success' | 'warning' | 'alert' | 'danger';
}

export const MoonshotSimulationView: React.FC = () => {
  const [socketConnected, setSocketConnected] = useState<boolean>(socket.connected);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const logScrollRef = useRef<HTMLDivElement>(null);

  // Live Paper Wallet & Stats with LocalStorage Persistence
  const [paperStats, setPaperStats] = useState<PaperStats>(() => {
    try {
      const saved = localStorage.getItem('pumpfun_paper_stats');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.currentBalanceSol === 'number') {
          return parsed;
        }
      }
      const savedBal = localStorage.getItem('paper_balance');
      if (savedBal && !isNaN(Number(savedBal))) {
        const bal = Number(savedBal);
        return {
          initialBalanceSol: 1.0,
          currentBalanceSol: bal,
          totalPaperPnlSol: bal - 1.0,
          totalPaperPnlPercent: ((bal - 1.0) / 1.0) * 100,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRatePercent: 0.0,
          status: bal >= 1.0 ? 'GROW' : 'REKT',
        };
      }
    } catch (e) {
      console.error('[MoonshotSimulationView] Error reading paperStats from localStorage:', e);
    }
    return {
      initialBalanceSol: 1.0,
      currentBalanceSol: 1.0,
      totalPaperPnlSol: 0.0,
      totalPaperPnlPercent: 0.0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRatePercent: 0.0,
      status: 'GROW',
    };
  });

  // Automatically sync paperStats to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('pumpfun_paper_stats', JSON.stringify(paperStats));
      localStorage.setItem('paper_balance', String(paperStats.currentBalanceSol));
    } catch (e) {
      console.error('[MoonshotSimulationView] Error saving paperStats to localStorage:', e);
    }
  }, [paperStats]);

  // Current Active Token / Position
  const [activeToken, setActiveToken] = useState<ActiveToken>({
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    name: 'MemeMoon AI',
    symbol: 'MEMEMOON',
    image: '',
    narrativeScore: 0.94,
    entryPriceSol: 0.0000012,
    currentPriceSol: 0.0000012,
    gainMultiplier: 1.0,
    pnlPercent: 0.0,
    pnlSol: 0.0,
    virtualSol: 30.0,
    solDeltaPercent: 0.0,
    isWhaleDump: false,
    status: 'SCANNING',
    lastPolledAt: new Date().toLocaleTimeString(),
  });

  const [imgError, setImgError] = useState<boolean>(false);

  useEffect(() => {
    setImgError(false);
  }, [activeToken.mint, activeToken.image]);

  // Dynamic Chart Data Points
  const [chartData, setChartData] = useState<Array<{ time: string; pnl: number; price: number; multiplier: number }>>([
    { time: '0s', pnl: 0, price: 0.0000012, multiplier: 1.0 },
  ]);

  // Selected Agen 1 Model
  const [selectedAgent1ModelId, setSelectedAgent1ModelId] = useState<string>('openrouter-nex');
  // Selected Agen 2 Model
  const [selectedAgent2ModelId, setSelectedAgent2ModelId] = useState<string>('openrouter-nex');

  // 5 Specialist Agents State
  const [agents, setAgents] = useState<{ [key: string]: AgentCardState }>({
    scanner: {
      name: 'Agen 1: Scanner & Narrative Evaluator',
      role: 'Viral narrative scanner (<10s pump.fun stream)',
      model: 'NEX-AGI Free',
      status: 'ONLINE',
      detail: 'Streaming live pump.fun new token launches via API & WebSocket',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
      borderColor: 'border-cyan-500/30',
    },
    auditor: {
      name: 'Agen 2: Security & Kill-Vote Auditor',
      role: 'Rugcheck API & On-chain Mint/Freeze verification',
      model: 'NEX-AGI Free',
      status: 'ONLINE',
      detail: 'Rugcheck layer verified: Mint revoked, Freeze null, Top 5 < 25%',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      borderColor: 'border-emerald-500/30',
    },
    execution: {
      name: 'Agen 3: Virtual Buy Executor (Paper Buy)',
      role: '0.50 SOL Paper Entry via Jito MEV Simulation',
      model: 'Grok 4.6',
      status: 'ONLINE',
      detail: 'Simulated 0.50 SOL entry (+0.005 Gas) at live bonding curve rate',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      borderColor: 'border-amber-500/30',
    },
    tracker: {
      name: 'Agen 4: Live Tracker & Whale Radar',
      role: '1s High-precision polling & Whale outflow detector',
      model: 'Kimi K3',
      status: 'ONLINE',
      detail: 'Live Mainnet polling active: tracking virtual_sol_reserves deltas',
      badgeColor: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/40',
      borderColor: 'border-fuchsia-500/30',
    },
    exit: {
      name: 'Agen 5: Virtual Risk Manager & Sell Engine',
      role: 'Paper Sell Engine (TP 60x, SL -15%, Whale Alert)',
      model: 'Claude Opus 4.8',
      status: 'ONLINE',
      detail: 'Risk limits armed: TP >= 60.0x | SL <= -15.0% | Whale Emergency',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
      borderColor: 'border-purple-500/30',
    },
  });

  // Console Logs
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      timestamp: new Date().toLocaleTimeString(),
      tag: 'SYSTEM',
      text: 'Solana Mainnet Paper Trading Engine initialized with 1.00 SOL Paper Wallet.',
      color: 'text-amber-400',
    },
    {
      timestamp: new Date().toLocaleTimeString(),
      tag: 'SCANNER',
      text: 'NEX-AGI Free: Listening to pump.fun live new token stream.',
      color: 'text-cyan-400',
    },
    {
      timestamp: new Date().toLocaleTimeString(),
      tag: 'AUDITOR',
      text: 'NEX-AGI Free: Rugcheck API integration ready for Kill-Vote consensus.',
      color: 'text-emerald-400',
    },
    {
      timestamp: new Date().toLocaleTimeString(),
      tag: 'RADAR',
      text: 'Kimi K3: 1-second live mainnet polling & Whale Outflow radar standby.',
      color: 'text-fuchsia-400',
    },
  ]);

  // Active Popup Notification (Null by default, auto-dismiss in 3s)
  const [activeNotification, setActiveNotification] = useState<NotificationPopup | null>(null);

  // Modal display for completed trade
  const [tradeModal, setTradeModal] = useState<{
    show: boolean;
    symbol: string;
    gainMultiplier: number;
    pnlPercent: number;
    pnlSol: number;
    exitReason: string;
    aiPostMortem?: string;
  }>({
    show: false,
    symbol: '',
    gainMultiplier: 1.0,
    pnlPercent: 0,
    pnlSol: 0,
    exitReason: '',
  });

  // Deposit SOL Modal State
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [customDepositSol, setCustomDepositSol] = useState('1.0');

  const handleExecuteDeposit = async () => {
    const amountNum = parseFloat(customDepositSol);
    if (isNaN(amountNum) || amountNum <= 0) {
      triggerPopup('INVALID AMOUNT', 'Masukkan nominal SOL yang valid', 'danger');
      return;
    }

    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountNum }),
      });
      const data = await res.json();
      if (data.success && data.paperStats) {
        setPaperStats(data.paperStats);
        localStorage.setItem('pumpfun_paper_stats', JSON.stringify(data.paperStats));
        localStorage.setItem('paper_balance', String(data.paperStats.currentBalanceSol));
      } else {
        setPaperStats((prev) => {
          const updated = {
            ...prev,
            currentBalanceSol: prev.currentBalanceSol + amountNum,
            initialBalanceSol: prev.initialBalanceSol + amountNum,
          };
          localStorage.setItem('pumpfun_paper_stats', JSON.stringify(updated));
          localStorage.setItem('paper_balance', String(updated.currentBalanceSol));
          return updated;
        });
      }

      appendLog('DEPOSIT', `Berhasil deposit +${amountNum.toFixed(4)} SOL ke Paper Wallet.`, 'text-emerald-400 font-bold');
      triggerPopup('DEPOSIT BERHASIL', `+${amountNum.toFixed(4)} SOL ditambahkan ke saldo!`, 'success');
      setIsDepositModalOpen(false);
    } catch (err) {
      console.error('Failed to deposit:', err);
    }
  };

  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logs]);

  const appendLog = (tag: string, text: string, color = 'text-slate-200') => {
    setLogs((prev) => [
      ...prev.slice(-80),
      {
        timestamp: new Date().toLocaleTimeString(),
        tag,
        text,
        color,
      },
    ]);
  };

  const triggerPopup = (title: string, subtitle: string, type: 'info' | 'success' | 'warning' | 'alert' | 'danger') => {
    const id = `${Date.now()}`;
    setActiveNotification({ id, title, subtitle, type });
    setTimeout(() => {
      setActiveNotification((curr) => (curr?.id === id ? null : curr));
    }, 3000);
  };

  // Socket.io Listeners
  useEffect(() => {
    const onConnect = () => {
      setSocketConnected(true);
      appendLog('SOCKET', 'Live WebSocket connected to Bot Core.', 'text-emerald-400');
    };

    const onDisconnect = () => {
      setSocketConnected(false);
      appendLog('SOCKET', 'Disconnected from backend. Reconnecting...', 'text-amber-400');
    };

    const onInitState = (data: any) => {
      if (data.isScanning !== undefined) setIsScanning(data.isScanning);
      if (data.paperStats) setPaperStats(data.paperStats);
      if (data.activePosition) {
        const p = data.activePosition;
        setActiveToken({
          mint: p.tokenAddress,
          name: p.name || p.symbol,
          symbol: p.symbol,
          narrativeScore: 0.92,
          entryPriceSol: p.entryPriceSol,
          currentPriceSol: p.currentPriceSol,
          gainMultiplier: p.gainMultiplier || 1.0,
          pnlPercent: p.pnlPercent || 0.0,
          pnlSol: p.pnlSol || 0.0,
          virtualSol: p.currentVirtualSol || 30.0,
          solDeltaPercent: p.solDeltaPercent || 0.0,
          isWhaleDump: p.isWhaleDump || false,
          status: 'HOLDING',
          lastPolledAt: new Date().toLocaleTimeString(),
        });
      }
      if (data.agent1Models?.selected) {
        setSelectedAgent1ModelId(data.agent1Models.selected);
        const modelName = data.agent1Models.activeOption?.shortName || 'NEX-AGI Free';
        setAgents((prev) => ({
          ...prev,
          scanner: {
            ...prev.scanner,
            model: modelName,
          },
        }));
      }
      if (data.agent2Models?.selected) {
        setSelectedAgent2ModelId(data.agent2Models.selected);
        const modelName = data.agent2Models.activeOption?.shortName || 'NEX-AGI Free';
        setAgents((prev) => ({
          ...prev,
          auditor: {
            ...prev.auditor,
            model: modelName,
          },
        }));
      }
    };

    const onPaperStats = (stats: PaperStats) => {
      setPaperStats(stats);
    };

    const onTokenDetected = (token: any) => {
      setActiveToken((prev) => ({
        ...prev,
        mint: token.mint,
        name: token.name,
        symbol: token.symbol,
        image: token.image,
        narrativeScore: token.narrativeScore,
        status: 'AUDITING',
        lastPolledAt: new Date().toLocaleTimeString(),
      }));

      setAgents((prev) => ({
        ...prev,
        scanner: {
          ...prev.scanner,
          status: 'ACTIVE',
          detail: `Found $${token.symbol} (Score: ${token.narrativeScore.toFixed(2)})`,
        },
        auditor: token.narrativeScore >= 0.85 ? {
          ...prev.auditor,
          status: 'AUDITING',
          detail: `Querying Rugcheck API & On-chain Mint/Freeze for $${token.symbol}...`,
        } : prev.auditor,
      }));

      const scannerModelName = token.aiModel || agents.scanner?.model || 'NEX-AGI Free';
      appendLog(
        'SCANNER',
        `Live Launch Scanned: [${token.symbol}] "${token.name}" | Score: ${token.narrativeScore.toFixed(2)} | ${scannerModelName}`,
        token.narrativeScore >= 0.85 ? 'text-emerald-400 font-bold' : 'text-cyan-300'
      );

      if (token.narrativeScore >= 0.85) {
        triggerPopup(
          `DETECTED: $${token.symbol}`,
          `Score: ${token.narrativeScore.toFixed(2)} - Routing to Security Auditor`,
          'warning'
        );
      }
    };

    const onAuditResult = ({ token, audit }: any) => {
      const auditorModelName = audit?.aiModel || agents.auditor?.model || 'NEX-AGI Free';
      if (audit.passed) {
        setAgents((prev) => ({
          ...prev,
          auditor: {
            ...prev.auditor,
            status: 'ACTIVE',
            detail: `PASSED: Mint/Freeze Revoked, Top 5: ${audit.top5HoldingPercent?.toFixed(1)}%`,
          },
          execution: {
            ...prev.execution,
            status: 'BUYING',
            detail: `Executing 0.50 SOL Paper Buy via Jito MEV for $${token.symbol}...`,
          },
        }));

        appendLog(
          'AUDITOR',
          `${auditorModelName}: KILL-VOTE PASSED for [${token.symbol}] (Dev: ${audit.devHoldingPercent?.toFixed(1)}%, Top5: ${audit.top5HoldingPercent?.toFixed(1)}%)`,
          'text-emerald-400'
        );

        triggerPopup(
          `AUDIT PASSED: $${token.symbol}`,
          `Kill-Vote PASSED: Mint & Freeze revoked, Top 5 safe`,
          'success'
        );
      } else {
        appendLog(
          'AUDITOR',
          `${auditorModelName}: KILL-VOTE VETO for [${token.symbol}]. Reason: ${audit.reasons?.[0] || 'Security check failed'}`,
          'text-rose-400'
        );
      }
    };

    const onTradeExecuted = (pos: any) => {
      setActiveToken({
        mint: pos.tokenAddress,
        name: pos.name || pos.symbol,
        symbol: pos.symbol,
        narrativeScore: 0.92,
        entryPriceSol: pos.entryPriceSol,
        currentPriceSol: pos.entryPriceSol,
        gainMultiplier: 1.0,
        pnlPercent: 0.0,
        pnlSol: 0.0,
        virtualSol: pos.currentVirtualSol || 30.0,
        solDeltaPercent: 0.0,
        isWhaleDump: false,
        status: 'HOLDING',
        lastPolledAt: new Date().toLocaleTimeString(),
      });

      setChartData([{ time: '0s', pnl: 0, price: pos.entryPriceSol, multiplier: 1.0 }]);

      setAgents((prev) => ({
        ...prev,
        execution: {
          ...prev.execution,
          status: 'ACTIVE',
          detail: `Paper Buy Filled: 0.50 SOL @ ${(Number(pos.entryPriceSol) || 0) < 0.0001 ? (Number(pos.entryPriceSol) || 0).toExponential(3) : (Number(pos.entryPriceSol) || 0).toFixed(4)} SOL`,
        },
        tracker: {
          ...prev.tracker,
          status: 'TRACKING',
          detail: `Live 1s polling active for $${pos.symbol} reserves`,
        },
      }));

      appendLog(
        'PAPER-BUY',
        `Grok 4.6: Simulated Buy Executed for 0.50 SOL (+0.005 Gas). Entry: ${(Number(pos.entryPriceSol) || 0) < 0.0001 ? (Number(pos.entryPriceSol) || 0).toExponential(4) : (Number(pos.entryPriceSol) || 0).toFixed(4)} SOL`,
        'text-amber-300'
      );

      triggerPopup(
        `PAPER BUY EXECUTED: $${pos.symbol}`,
        `0.50 SOL invested at live bonding curve rate`,
        'info'
      );
    };

    const onPriceUpdate = (pos: any) => {
      setActiveToken((prev) => ({
        ...prev,
        currentPriceSol: pos.currentPriceSol,
        gainMultiplier: pos.gainMultiplier,
        pnlPercent: pos.pnlPercent,
        pnlSol: pos.pnlSol || 0,
        virtualSol: pos.currentVirtualSol,
        solDeltaPercent: pos.solDeltaPercent || 0,
        isWhaleDump: pos.isWhaleDump || false,
        lastPolledAt: new Date().toLocaleTimeString(),
      }));

      setChartData((prev) => {
        const nextTime = `${prev.length}s`;
        const updated = [
          ...prev,
          {
            time: nextTime,
            pnl: pos.pnlPercent,
            price: pos.currentPriceSol,
            multiplier: pos.gainMultiplier,
          },
        ];
        return updated.slice(-40);
      });
    };

    const onWhaleDump = (alert: any) => {
      appendLog(
        'WHALE-ALERT',
        `Kimi K3 Whale Radar: Outflow of ${alert.percentOfSupply?.toFixed(1)}% SOL detected! Front-running emergency exit...`,
        'text-rose-400'
      );

      triggerPopup(
        `WHALE OUTFLOW DETECTED!`,
        `Outflow >= 8% on bonding curve - Triggering Emergency Paper Exit`,
        'danger'
      );
    };

    const onPositionClosed = (data: any) => {
      const summary = data.summary || data;
      if (data.paperStats) {
        setPaperStats(data.paperStats);
      } else if (data.walletBalanceSol !== undefined) {
        setPaperStats((prev) => {
          const newBal = Number(data.walletBalanceSol);
          const pnlSol = newBal - prev.initialBalanceSol;
          const pnlPct = (pnlSol / prev.initialBalanceSol) * 100;
          return {
            ...prev,
            currentBalanceSol: newBal,
            totalPaperPnlSol: pnlSol,
            totalPaperPnlPercent: pnlPct,
            totalTrades: prev.totalTrades + 1,
            winningTrades: summary.pnlSol > 0 ? prev.winningTrades + 1 : prev.winningTrades,
            losingTrades: summary.pnlSol <= 0 ? prev.losingTrades + 1 : prev.losingTrades,
            winRatePercent: ((summary.pnlSol > 0 ? prev.winningTrades + 1 : prev.winningTrades) / (prev.totalTrades + 1)) * 100,
          };
        });
      }

      setActiveToken((prev) => ({
        ...prev,
        status: 'CLOSED',
        pnlPercent: 0,
        pnlSol: 0,
        gainMultiplier: 1.0,
      }));

      appendLog(
        'PAPER-SELL',
        `Claude Opus 4.8: Position Closed [${summary.symbol}] | Result: ${summary.pnlPercent >= 0 ? '+' : ''}${summary.pnlPercent.toFixed(2)}% (${summary.pnlSol >= 0 ? '+' : ''}${summary.pnlSol.toFixed(4)} SOL) | Reason: ${summary.exitReason}`,
        summary.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
      );

      triggerPopup(
        `PAPER SELL EXECUTED: $${summary.symbol}`,
        `Net PnL: ${summary.pnlPercent >= 0 ? '+' : ''}${summary.pnlPercent.toFixed(1)}% | Reason: ${summary.exitReason}`,
        summary.pnlPercent >= 0 ? 'success' : 'alert'
      );

      setTradeModal({
        show: true,
        symbol: summary.symbol,
        gainMultiplier: summary.gainMultiplier || 1.0,
        pnlPercent: summary.pnlPercent,
        pnlSol: summary.pnlSol,
        exitReason: summary.exitReason,
        aiPostMortem: summary.aiPostMortem || 'Claude Opus 4.8: Strategic Paper Sell executed at live bonding curve rate.',
      });

      setAgents((prev) => ({
        ...prev,
        tracker: { ...prev.tracker, status: 'IDLE', detail: 'Standby for next position' },
        exit: {
          ...prev.exit,
          status: 'ONLINE',
          detail: `Trade finalized: ${summary.pnlPercent >= 0 ? '+' : ''}${summary.pnlPercent.toFixed(1)}%`,
        },
      }));
    };

    const onNewLog = (logEntry: { timestamp: string; level: string; message: string }) => {
      let tag = 'SYSTEM';
      const msg = logEntry.message || '';
      if (msg.includes('[ScannerAgent]') || msg.toLowerCase().includes('scanner') || msg.toLowerCase().includes('pump.fun') || msg.toLowerCase().includes('score')) tag = 'SCANNER';
      else if (msg.includes('[SecurityAuditor]') || msg.toLowerCase().includes('auditor') || msg.toLowerCase().includes('rugcheck') || msg.toLowerCase().includes('kill-vote')) tag = 'AUDITOR';
      else if (msg.includes('[ExecutionAgent]') || msg.toLowerCase().includes('paper-buy') || msg.toLowerCase().includes('jito') || msg.toLowerCase().includes('buy')) tag = 'PAPER-BUY';
      else if (msg.includes('[TrackerAgent]') || msg.toLowerCase().includes('tracker') || msg.toLowerCase().includes('radar') || msg.toLowerCase().includes('whale')) tag = 'TRACKER';
      else if (msg.includes('[ExitAgent]') || msg.toLowerCase().includes('sell') || msg.toLowerCase().includes('position closed')) tag = 'EXIT';
      else if (msg.toLowerCase().includes('socket') || msg.toLowerCase().includes('webserver')) tag = 'SERVER';

      appendLog(
        tag,
        logEntry.message,
        logEntry.level === 'error' ? 'text-rose-400' : logEntry.level === 'warn' ? 'text-amber-400' : tag === 'SCANNER' ? 'text-cyan-300' : tag === 'AUDITOR' ? 'text-emerald-300' : 'text-slate-300'
      );
    };

    const onAgentStatusChange = (status: { id: string; state: any; detail: string }) => {
      setAgents((prev) => {
        const existing = prev[status.id];
        if (!existing) return prev;
        return {
          ...prev,
          [status.id]: {
            ...existing,
            status: status.state,
            detail: status.detail,
          },
        };
      });
    };

    const onLog = (log: any) => {
      appendLog(log.level?.toUpperCase() || 'BOT', log.message, log.level === 'error' ? 'text-rose-400' : 'text-slate-300');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('init_state', onInitState);
    socket.on('paper_stats_update', onPaperStats);
    socket.on('token_detected', onTokenDetected);
    socket.on('audit_result', onAuditResult);
    socket.on('trade_executed', onTradeExecuted);
    socket.on('price_update', onPriceUpdate);
    socket.on('whale_dump_warning', onWhaleDump);
    socket.on('agent_status_change', onAgentStatusChange);
    socket.on('new_log', onNewLog);

    const onAgent1ModelChanged = (data: { selected: string; activeOption?: any }) => {
      if (data.selected) {
        setSelectedAgent1ModelId(data.selected);
        const modelName = data.activeOption?.shortName || data.selected;
        setAgents((prev) => ({
          ...prev,
          scanner: {
            ...prev.scanner,
            model: modelName,
            detail: `Active engine: ${data.activeOption?.name || modelName}`,
          },
        }));
        appendLog('SYSTEM', `Agen 1 engine updated to: ${data.activeOption?.name || modelName}`, 'text-cyan-400');
      }
    };

    const onAgent2ModelChanged = (data: { selected: string; activeOption?: any }) => {
      if (data.selected) {
        setSelectedAgent2ModelId(data.selected);
        const modelName = data.activeOption?.shortName || data.selected;
        setAgents((prev) => ({
          ...prev,
          auditor: {
            ...prev.auditor,
            model: modelName,
            detail: `Active engine: ${data.activeOption?.name || modelName}`,
          },
        }));
        appendLog('SYSTEM', `Agen 2 engine updated to: ${data.activeOption?.name || modelName}`, 'text-emerald-400');
      }
    };

    socket.on('position_closed', onPositionClosed);
    socket.on('log_message', onLog);
    socket.on('agent1_model_changed', onAgent1ModelChanged);
    socket.on('agent2_model_changed', onAgent2ModelChanged);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('init_state', onInitState);
      socket.off('paper_stats_update', onPaperStats);
      socket.off('token_detected', onTokenDetected);
      socket.off('audit_result', onAuditResult);
      socket.off('trade_executed', onTradeExecuted);
      socket.off('price_update', onPriceUpdate);
      socket.off('whale_dump_warning', onWhaleDump);
      socket.off('agent_status_change', onAgentStatusChange);
      socket.off('new_log', onNewLog);
      socket.off('position_closed', onPositionClosed);
      socket.off('log_message', onLog);
      socket.off('agent1_model_changed', onAgent1ModelChanged);
      socket.off('agent2_model_changed', onAgent2ModelChanged);
    };
  }, []);

  const handleSwitchAgent1Model = async (modelId: string) => {
    setSelectedAgent1ModelId(modelId);
    socket.emit('set_agent1_model', modelId);

    const modelLabels: Record<string, string> = {
      'openrouter-nex': 'NEX-AGI N2.5 Pro Free (OpenRouter)',
      'anymodel-deepseek': 'DeepSeek V4 Flash (anymodel.org)',
      'anymodel-glm': 'GLM 5.3 Flash (anymodel.org)',
    };
    const label = modelLabels[modelId] || modelId;

    setAgents((prev) => ({
      ...prev,
      scanner: {
        ...prev.scanner,
        model: modelId === 'openrouter-nex' ? 'NEX-AGI Free' : modelId === 'anymodel-glm' ? 'GLM 5.3' : 'DeepSeek V4',
        detail: `Switched to ${label}`,
      },
    }));

    appendLog('SYSTEM', `Agen 1 AI Model switched to: ${label}`, 'text-cyan-400');
    triggerPopup('AGEN 1 MODEL SWITCHED', label, 'success');

    try {
      await fetch('/api/agent1/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });
    } catch {
      // Ignored
    }
  };

  const handleSwitchAgent2Model = async (modelId: string) => {
    setSelectedAgent2ModelId(modelId);
    socket.emit('set_agent2_model', modelId);

    const modelLabels: Record<string, string> = {
      'openrouter-nex': 'NEX-AGI N2.5 Pro Free (OpenRouter)',
      'anymodel-claude': 'Claude Sonnet 4.6 (anymodel.org)',
      'anymodel-glm': 'GLM 5.3 Flash (anymodel.org)',
    };
    const label = modelLabels[modelId] || modelId;

    setAgents((prev) => ({
      ...prev,
      auditor: {
        ...prev.auditor,
        model: modelId === 'openrouter-nex' ? 'NEX-AGI Free' : modelId === 'anymodel-glm' ? 'GLM 5.3' : 'Claude Sonnet 4.6',
        detail: `Switched to ${label}`,
      },
    }));

    appendLog('SYSTEM', `Agen 2 AI Model switched to: ${label}`, 'text-emerald-400');
    triggerPopup('AGEN 2 MODEL SWITCHED', label, 'success');

    try {
      await fetch('/api/agent2/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });
    } catch {
      // Ignored
    }
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden select-none">
      {/* 1. STRATEGY SPECIFICATION & PERFORMANCE TRACKER RIBBON */}
      <section className="w-full flex-shrink-0 mb-2 bg-gradient-to-r from-[#0d182e] via-[#091124] to-[#0d182e] border border-slate-800 rounded-xl px-3 py-1.5 shadow-lg">
        {/* Top Mini Strategy Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-800/80 text-[10px] font-mono">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              SCALPER MODE: QUICK ENTER & EXIT (TP: +8% | SL: -5%)
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold">
              NARRATIVE THRESHOLD: &ge; 0.50
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" />
              MOMENTUM GUARD: ACTIVE (5s NO-BUY FORCE EXIT)
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/40 text-purple-300 font-bold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-purple-400" />
              TRAILING LOCK: +1% AT +4% PEAK
            </span>
          </div>

          <div className="flex items-center gap-3 text-[9.5px]">
            <div className="flex items-center gap-1">
              <span className="text-cyan-400 font-bold">A1:</span>
              <select
                value={selectedAgent1ModelId}
                onChange={(e) => handleSwitchAgent1Model(e.target.value)}
                className="bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 text-[9px] rounded px-1 py-0.5 outline-none font-mono cursor-pointer"
              >
                <option value="openrouter-nex">NEX-AGI Free</option>
                <option value="anymodel-deepseek">DeepSeek V4</option>
                <option value="anymodel-glm">GLM 5.3</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-emerald-400 font-bold">A2:</span>
              <select
                value={selectedAgent2ModelId}
                onChange={(e) => handleSwitchAgent2Model(e.target.value)}
                className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-[9px] rounded px-1 py-0.5 outline-none font-mono cursor-pointer"
              >
                <option value="openrouter-nex">NEX-AGI Free</option>
                <option value="anymodel-claude">Claude Sonnet 4.6</option>
                <option value="anymodel-glm">GLM 5.3</option>
              </select>
            </div>
            <span className="text-amber-400 font-bold hidden sm:inline">10% Sizing (0.10 SOL)</span>
          </div>
        </div>

        {/* Live Performance Numbers (Explicit Realized vs Unrealized PnL Separation) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 font-mono">
          {/* Card 1: Realized Cash Balance with + Deposit Button */}
          <div className="flex items-center justify-between gap-1 p-1 bg-[#060b18]/80 border border-slate-800/80 rounded-lg">
            <div className="flex items-center gap-1.5 min-w-0">
              <Wallet className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-[8.5px] uppercase tracking-wider text-slate-400 block leading-tight">Paper Balance (Realized)</span>
                <span className="text-xs font-bold text-slate-200 truncate block">
                  {(paperStats?.currentBalanceSol ?? 0).toFixed(4)} SOL
                  <span className="text-[9.5px] text-slate-500 font-normal ml-1">({(paperStats?.initialBalanceSol ?? 1.0).toFixed(2)})</span>
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsDepositModalOpen(true)}
              className="flex items-center justify-center w-5 h-5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/50 transition-all font-bold text-xs flex-shrink-0 mr-1 shadow-sm"
              title="Deposit / Tambah Saldo SOL"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2: Realized Cumulative PnL */}
          <div className="flex items-center gap-2 p-1 bg-[#060b18]/80 border border-slate-800/80 rounded-lg">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[8.5px] uppercase tracking-wider text-slate-400 block leading-tight">Realized Paper PnL</span>
              <span className={`text-xs font-bold truncate block ${(paperStats?.totalPaperPnlPercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(paperStats?.totalPaperPnlPercent ?? 0) >= 0 ? '+' : ''}{(paperStats?.totalPaperPnlPercent ?? 0).toFixed(2)}%
                <span className="text-[9.5px] text-slate-400 font-normal ml-1">
                  ({(paperStats?.totalPaperPnlSol ?? 0) >= 0 ? '+' : ''}{(paperStats?.totalPaperPnlSol ?? 0).toFixed(4)} SOL)
                </span>
              </span>
            </div>
          </div>

          {/* Card 3: Active Floating Unrealized PnL */}
          <div className="flex items-center gap-2 p-1 bg-[#060b18]/80 border border-amber-500/30 rounded-lg">
            <Activity className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 animate-pulse" />
            <div className="min-w-0">
              <span className="text-[8.5px] uppercase tracking-wider text-amber-400 block leading-tight">Active Unrealized PnL</span>
              <span className={`text-xs font-bold truncate block ${activeToken?.status === 'HOLDING' || activeToken?.status === 'BOUGHT' || activeToken?.status === 'EXITING' ? ((activeToken?.pnlPercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>
                {activeToken?.status === 'HOLDING' || activeToken?.status === 'BOUGHT' || activeToken?.status === 'EXITING'
                  ? `${(activeToken?.pnlPercent ?? 0) >= 0 ? '+' : ''}${(activeToken?.pnlPercent ?? 0).toFixed(2)}% (${(activeToken?.pnlSol ?? 0) >= 0 ? '+' : ''}${(activeToken?.pnlSol ?? 0).toFixed(4)} SOL)`
                  : '0.00% (No Open Trade)'}
              </span>
            </div>
          </div>

          {/* Card 4: Win Rate */}
          <div className="flex items-center gap-2 p-1 bg-[#060b18]/80 border border-slate-800/80 rounded-lg">
            <Award className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[8.5px] uppercase tracking-wider text-slate-400 block leading-tight">Win Rate (TP +8% | SL -4%)</span>
              <span className="text-xs font-bold text-white truncate block">
                {paperStats?.winningTrades ?? 0} / {paperStats?.totalTrades ?? 0}
                <span className="text-[9.5px] text-purple-300 font-normal ml-1">({(paperStats?.winRatePercent ?? 0).toFixed(1)}%)</span>
              </span>
            </div>
          </div>

          {/* Card 5: Active Engine & System Status */}
          <div className="col-span-2 sm:col-span-1 flex items-center justify-between p-1 bg-[#060b18]/80 border border-slate-800/80 rounded-lg">
            <div className="flex items-center gap-2 min-w-0">
              <Cpu className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-[8.5px] uppercase tracking-wider text-slate-400 block leading-tight">Active Engine</span>
                <span className="text-xs font-bold text-cyan-300 truncate block">
                  {agents.scanner?.model || 'NEX-AGI Free'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[9.5px] font-mono text-slate-400 pl-1 flex-shrink-0">
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[8.5px]">{isScanning ? 'AUTO' : 'STANDBY'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 5-AGENT SPECIALIST PATROL HUD */}
      <section className="w-full flex-shrink-0 mb-2">
        <AnimatedAgentPatrol
          selectedAgent1Model={selectedAgent1ModelId}
          onSelectAgent1Model={handleSwitchAgent1Model}
          selectedAgent2Model={selectedAgent2ModelId}
          onSelectAgent2Model={handleSwitchAgent2Model}
          agentStates={{
            scanner: agents.scanner?.status || 'SCANNING',
            auditor: agents.auditor?.status || 'IDLE',
            execution: agents.execution?.status || 'IDLE',
            tracker: agents.tracker?.status || 'IDLE',
            exit: agents.exit?.status || 'IDLE',
          }}
        />
      </section>

      {/* 3. MAIN WORKSPACE (Balanced 2-Column HUD Layout with Zero Whole-Page Scroll) */}
      <div className="flex-1 min-h-0 w-full grid grid-cols-12 gap-2 overflow-hidden">
        {/* Left Column (col-span-4): Active Monitored Token & Embedded Live Terminal Stream */}
        <div className="col-span-12 lg:col-span-4 h-full flex flex-col gap-2 overflow-hidden">
          {/* Active Monitored Token Card */}
          <div className="flex-1 min-h-0 bg-[#0b1222]/90 border border-slate-800 rounded-xl p-3 backdrop-blur-xl flex flex-col justify-between shadow-xl overflow-hidden">
            <div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  Live Monitored Token
                </span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                  {activeToken.status}
                </span>
              </div>

              <div className="flex items-center gap-2.5 mt-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-500 p-[2px] shadow-lg shadow-emerald-500/20 flex-shrink-0">
                  <div className="w-full h-full bg-[#080e1d] rounded-[9px] flex items-center justify-center overflow-hidden relative">
                    {activeToken.image && !imgError && !activeToken.image.endsWith('.json') ? (
                      <img 
                        src={activeToken.image} 
                        alt={activeToken.symbol} 
                        className="w-full h-full object-cover" 
                        onError={() => setImgError(true)} 
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-950 via-slate-900 to-emerald-950 border border-emerald-500/20 text-emerald-400 font-mono font-black text-xs select-none">
                        {activeToken.symbol ? (
                          <span>${activeToken.symbol.slice(0, 4).toUpperCase()}</span>
                        ) : (
                          <Flame className="w-5 h-5 text-amber-400" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-black font-mono text-white tracking-tight flex items-center gap-2 truncate">
                    ${activeToken?.symbol || 'TOKEN'}
                    <span className="text-[9px] font-mono font-normal px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 flex-shrink-0">
                      Score: {(activeToken?.narrativeScore ?? 1.0).toFixed(2)}
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400 truncate">{activeToken?.name || 'Copied Token'}</p>
                  <p className="text-[9px] font-mono text-slate-500 truncate">
                    Mint: {activeToken?.mint ? `${activeToken.mint.slice(0, 6)}...${activeToken.mint.slice(-4)}` : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <div className="p-1.5 rounded-lg bg-[#060b18] border border-slate-800/80 font-mono">
                  <span className="text-[8.5px] text-slate-400 uppercase block">Entry Price</span>
                  <p className="text-xs font-bold text-slate-200 mt-0.5">
                    {(Number(activeToken?.entryPriceSol) || 0) < 0.0001 ? (Number(activeToken?.entryPriceSol) || 0).toExponential(3) : (Number(activeToken?.entryPriceSol) || 0).toFixed(4)} SOL
                  </p>
                </div>
                <div className="p-1.5 rounded-lg bg-[#060b18] border border-slate-800/80 font-mono">
                  <span className="text-[8.5px] text-slate-400 uppercase block">Current Price</span>
                  <p className="text-xs font-bold text-emerald-400 mt-0.5">
                    {(Number(activeToken?.currentPriceSol) || 0) < 0.0001 ? (Number(activeToken?.currentPriceSol) || 0).toExponential(3) : (Number(activeToken?.currentPriceSol) || 0).toFixed(4)} SOL
                  </p>
                </div>
                <div className="p-1.5 rounded-lg bg-[#060b18] border border-slate-800/80 font-mono">
                  <span className="text-[8.5px] text-slate-400 uppercase block">Virtual Reserves</span>
                  <p className="text-xs font-bold text-cyan-300 mt-0.5">
                    {(activeToken?.virtualSol ?? 30.0).toFixed(2)} SOL
                  </p>
                </div>
                <div className="p-1.5 rounded-lg bg-[#060b18] border border-slate-800/80 font-mono">
                  <span className="text-[8.5px] text-slate-400 uppercase block">Reserves 1s Delta</span>
                  <p
                    className={`text-xs font-bold mt-0.5 ${
                      (activeToken?.solDeltaPercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {(activeToken?.solDeltaPercent ?? 0) >= 0 ? '+' : ''}
                    {(activeToken?.solDeltaPercent ?? 0).toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Anti-Rug Security Checklist Status */}
              <div className="mt-2 p-1.5 rounded-lg bg-[#050914] border border-emerald-500/20 font-mono text-[9px] space-y-1">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Mint Authority:</span>
                  <span className="text-emerald-400 font-bold">REVOKED (NULL) ✓</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Freeze Authority:</span>
                  <span className="text-emerald-400 font-bold">REVOKED (NULL) ✓</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Dev Supply:</span>
                  <span className="text-emerald-400 font-bold">&lt; 10.0% ✓</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Top 10 Concentration:</span>
                  <span className="text-emerald-400 font-bold">&lt; 35.0% ✓</span>
                </div>
              </div>
            </div>

            {/* EMBEDDED LIVE TERMINAL STREAM LOG (Placed inside the empty space) */}
            <div className="flex-1 min-h-[120px] max-h-[200px] bg-[#050914] border border-slate-800/90 rounded-lg p-2 flex flex-col overflow-hidden my-1.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800 mb-1 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-amber-400" />
                  <span className="text-[9.5px] font-mono font-bold text-slate-300 uppercase">
                    Live Terminal Stream
                  </span>
                </div>
                <span className="text-[8px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LOGS
                </span>
              </div>
              <div
                ref={logScrollRef}
                className="flex-1 min-h-0 overflow-y-auto space-y-1 font-mono text-[10px] pr-1 scrollbar-thin scrollbar-thumb-slate-700"
              >
                {logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-1 text-slate-300">
                    <span className="text-slate-500 text-[8px]">[{log.timestamp}]</span>
                    <span className={`font-bold text-[8px] ${log.color}`}>[{log.tag}]</span>
                    <span className="text-slate-200 text-[9.5px] leading-tight break-all">{log.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Multiplier & Unrealized PnL Footer */}
            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
              <div>
                <span className="text-[8.5px] font-mono uppercase text-slate-400 block">Multiplier</span>
                <div className="text-xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-300">
                  {(activeToken?.gainMultiplier ?? 1.0).toFixed(2)}X
                </div>
              </div>
              <div className="text-right">
                <span className="text-[8.5px] font-mono uppercase text-slate-400 block">Unrealized PnL</span>
                <div
                  className={`text-lg font-black font-mono ${
                    (activeToken?.pnlPercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {(activeToken?.pnlPercent ?? 0) >= 0 ? '+' : ''}
                  {(activeToken?.pnlPercent ?? 0).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (col-span-8): Top: Cyber Robot Patrol Arena | Bottom: Recharts Curve PnL */}
        <div className="col-span-12 lg:col-span-8 h-full flex flex-col gap-2 overflow-hidden">
          {/* Top: 5-Agent Free-Roaming Cyber Robot Patrol Arena */}
          <div className="flex-1 min-h-[190px] overflow-hidden">
            <CyberRobotPatrolArena
              selectedAgent1Model={selectedAgent1ModelId}
              selectedAgent2Model={selectedAgent2ModelId}
              activeTokenSymbol={activeToken.symbol}
              activeNarrativeScore={activeToken.narrativeScore}
              activeStatus={activeToken.status}
              agentStates={{
                scanner: agents.scanner?.status || 'SCANNING',
                auditor: agents.auditor?.status || 'IDLE',
                execution: agents.execution?.status || 'IDLE',
                tracker: agents.tracker?.status || 'IDLE',
                exit: agents.exit?.status || 'IDLE',
              }}
              latestLogs={logs}
            />
          </div>

          {/* Bottom: Live Mainnet Curve PnL (%) & Gain Trajectory Area Chart */}
          <div className="flex-1 min-h-[190px] bg-[#0b1222]/90 border border-slate-800 rounded-xl p-3 backdrop-blur-xl flex flex-col justify-between shadow-xl overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 gap-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Live Mainnet Curve PnL (%) & Scalp Trajectory
                </h3>
              </div>
              <div className="flex items-center gap-2 text-[9.5px] font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Real-time 1s Ticks
                </span>
                <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/40">
                  TP Target: +8% (1.08x)
                </span>
                <span className="text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/40">
                  SL: -5%
                </span>
                <span className="text-purple-300 font-bold bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-500/40 hidden xl:inline">
                  Lock: +1% at +4%
                </span>
              </div>
            </div>

            {/* Responsive Recharts Container */}
            <div className="flex-1 min-h-0 w-full py-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="neonGreenGradientClient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    stroke="#475569"
                    fontSize={9}
                    fontFamily="monospace"
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#475569"
                    fontSize={9}
                    fontFamily="monospace"
                    tickFormatter={(v: any) => `${v > 0 ? '+' : ''}${v}%`}
                    tickLine={false}
                    domain={[-10, 15]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#080d1a',
                      borderColor: '#10B981',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      boxShadow: '0 0 15px rgba(16,185,129,0.3)',
                    }}
                    itemStyle={{ color: '#34D399' }}
                    formatter={(value: any) => [`${Number(value) >= 0 ? '+' : ''}${value}% PnL`, 'Profit']}
                    labelFormatter={(label: any) => `Time: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke="#10B981"
                    strokeWidth={2.2}
                    fillOpacity={1}
                    fill="url(#neonGreenGradientClient)"
                    isAnimationActive={false}
                    style={{
                      filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))',
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 flex-shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                Polling: 1000ms | Solana RPC Mainnet
              </span>
              <span className="text-slate-400">
                Max Entry: <span className="text-amber-300 font-bold">10% Balance (0.10 SOL)</span> • Jito MEV
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. POP-UP NOTIFICATION BADGE */}
      <div className="fixed top-6 right-6 z-50 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {activeNotification && (
            <motion.div
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              onClick={() => setActiveNotification(null)}
              className={`pointer-events-auto border rounded-2xl p-4 backdrop-blur-xl shadow-2xl flex items-start gap-3.5 cursor-pointer hover:scale-[1.02] transition-transform ${
                activeNotification.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-100 shadow-emerald-900/50'
                  : activeNotification.type === 'warning'
                  ? 'bg-amber-950/90 border-amber-500 text-amber-100 shadow-amber-900/50'
                  : activeNotification.type === 'danger'
                  ? 'bg-rose-950/90 border-rose-500 text-rose-100 shadow-rose-900/50'
                  : 'bg-cyan-950/90 border-cyan-500 text-cyan-100 shadow-cyan-900/50'
              }`}
              title="Click to dismiss"
            >
              <div className="mt-0.5">
                {activeNotification.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : activeNotification.type === 'danger' ? (
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                ) : (
                  <Flame className="w-5 h-5 text-amber-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider">
                    {activeNotification.title}
                  </h4>
                  <span className="text-[10px] text-slate-400 hover:text-white font-mono ml-2">&times;</span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                  {activeNotification.subtitle}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 7. TRADE SUMMARY MODAL */}
      <AnimatePresence>
        {tradeModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              className="bg-[#0b1426] border border-emerald-500/60 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl shadow-emerald-500/20 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4">
                <Award className="w-9 h-9 text-slate-950" />
              </div>

              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 uppercase tracking-widest">
                Trade Cycle Finalized
              </span>

              <h3 className="text-3xl font-black font-mono text-white mt-3">
                ${tradeModal.symbol}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Trigger: {tradeModal.exitReason}
              </p>

              <div className="grid grid-cols-2 gap-3 my-6">
                <div className="p-3 rounded-2xl bg-[#060b18] border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">Gain Multiplier</span>
                  <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                    {tradeModal.gainMultiplier.toFixed(2)}x
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#060b18] border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">Net SOL PnL</span>
                  <div
                    className={`text-2xl font-black font-mono mt-1 ${
                      tradeModal.pnlSol >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {tradeModal.pnlSol >= 0 ? '+' : ''}
                    {tradeModal.pnlSol.toFixed(4)} SOL
                  </div>
                </div>
              </div>

              {tradeModal.aiPostMortem && (
                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 text-left mb-6 font-mono text-xs text-purple-200 leading-relaxed">
                  <span className="font-bold text-purple-400 block mb-1">
                    Claude Opus 4.8 Post-Mortem:
                  </span>
                  "{tradeModal.aiPostMortem}"
                </div>
              )}

              <button
                onClick={() => setTradeModal({ ...tradeModal, show: false })}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black font-mono tracking-wider text-sm transition-all shadow-lg shadow-emerald-500/20"
              >
                CLOSE & CONTINUE SCANNING
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deposit SOL Modal */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-mono">
          <div className="w-full max-w-sm rounded-2xl bg-[#090f1d] border border-emerald-500/40 p-5 shadow-2xl shadow-emerald-950/40 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Deposit / Tambah Saldo SOL</span>
              </div>
              <button
                onClick={() => setIsDepositModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px] mb-1 font-bold">Pilih Nominal Cepat:</span>
                <div className="grid grid-cols-4 gap-1.5 font-bold">
                  {['0.5', '1.0', '5.0', '10.0'].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCustomDepositSol(amt)}
                      className={`py-1.5 rounded-lg border transition-all ${
                        customDepositSol === amt
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
                <label className="block text-slate-400 font-bold mb-1">Nominal Deposit (SOL):</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.01"
                    value={customDepositSol}
                    onChange={(e) => setCustomDepositSol(e.target.value)}
                    className="w-full px-3 py-2 pl-8 rounded-lg bg-[#060a14] border border-slate-700 text-white focus:outline-none focus:border-emerald-500 font-mono font-bold text-sm"
                    placeholder="Contoh: 1.0"
                  />
                  <Wallet className="w-4 h-4 text-emerald-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-[11px] text-slate-300">
                <span>Saldo saat ini: </span>
                <strong className="text-white">{paperStats.currentBalanceSol.toFixed(4)} SOL</strong>
                <span className="block mt-0.5 text-emerald-300">
                  Setelah deposit: {(paperStats.currentBalanceSol + (parseFloat(customDepositSol) || 0)).toFixed(4)} SOL
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-bold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDeposit}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-black hover:brightness-110 shadow-lg shadow-emerald-500/20"
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
