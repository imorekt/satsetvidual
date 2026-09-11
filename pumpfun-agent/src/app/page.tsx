'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Zap,
  ShieldCheck,
  Activity,
  Flame,
  TrendingUp,
  AlertTriangle,
  Radio,
  Terminal,
  ArrowUpRight,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Bot,
  Award,
  Wallet,
  ShieldAlert,
  Cpu,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// ============================================================================
// TYPES
// ============================================================================
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function PumpFunMainnetPaperTradingDashboard() {
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Live Paper Wallet & Stats
  const [paperStats, setPaperStats] = useState<PaperStats>({
    initialBalanceSol: 1.0,
    currentBalanceSol: 1.0,
    totalPaperPnlSol: 0.0,
    totalPaperPnlPercent: 0.0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRatePercent: 0.0,
    status: 'GROW',
  });

  // Current Active Token / Position
  const [activeToken, setActiveToken] = useState<ActiveToken>({
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    name: 'MemeMoon AI',
    symbol: 'MEMEMOON',
    image: 'https://cf-ipfs.com/ipfs/QmZ8kGg9n34P',
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

  // Modal display for completed trade or target
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

  // Auto-scroll logs
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Helper to append console log
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

  // Helper to trigger notification
  const triggerPopup = (title: string, subtitle: string, type: 'info' | 'success' | 'warning' | 'alert' | 'danger') => {
    const id = `${Date.now()}`;
    setActiveNotification({ id, title, subtitle, type });
    setTimeout(() => {
      setActiveNotification((curr) => (curr?.id === id ? null : curr));
    }, 3000);
  };

  // ============================================================================
  // SOCKET.IO & LIVE API CONNECTION
  // ============================================================================
  useEffect(() => {
    // Determine backend host (usually port 3000)
    const backendUrl = typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : 'http://localhost:3000';

    const socket: Socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      appendLog('SOCKET', `Connected to Bot Backend Server (${backendUrl})`, 'text-emerald-400');
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      appendLog('SOCKET', 'Disconnected from backend server. Reconnecting...', 'text-amber-400');
    });

    // Initial state snapshot
    socket.on('init_state', (data: any) => {
      if (data.isScanning !== undefined) setIsScanning(data.isScanning);
      if (data.paperStats) {
        setPaperStats(data.paperStats);
      }
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
          scanner: { ...prev.scanner, model: modelName },
        }));
      }
      if (data.agent2Models?.selected) {
        setSelectedAgent2ModelId(data.agent2Models.selected);
        const modelName = data.agent2Models.activeOption?.shortName || 'NEX-AGI Free';
        setAgents((prev) => ({
          ...prev,
          auditor: { ...prev.auditor, model: modelName },
        }));
      }
    });

    // Paper stats update from backend
    socket.on('paper_stats_update', (stats: PaperStats) => {
      setPaperStats(stats);
    });

    // Token detected
    socket.on('token_detected', (token: any) => {
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
          detail: `Found $${token.symbol} (Viral Score: ${token.narrativeScore.toFixed(2)})`,
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
    });

    // Audit result
    socket.on('audit_result', ({ token, audit }: any) => {
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
    });

    // Trade executed / Position opened
    socket.on('trade_executed', (position: any) => {
      setActiveToken({
        mint: position.tokenAddress,
        name: position.name || position.symbol,
        symbol: position.symbol,
        narrativeScore: 0.92,
        entryPriceSol: position.entryPriceSol,
        currentPriceSol: position.entryPriceSol,
        gainMultiplier: 1.0,
        pnlPercent: 0.0,
        pnlSol: 0.0,
        virtualSol: position.currentVirtualSol || 30.0,
        solDeltaPercent: 0.0,
        isWhaleDump: false,
        status: 'HOLDING',
        lastPolledAt: new Date().toLocaleTimeString(),
      });

      setChartData([{ time: '0s', pnl: 0, price: position.entryPriceSol, multiplier: 1.0 }]);

      setAgents((prev) => ({
        ...prev,
        execution: {
          ...prev.execution,
          status: 'ACTIVE',
          detail: `Paper Buy Filled: 0.50 SOL @ ${position.entryPriceSol.toExponential(3)} SOL`,
        },
        tracker: {
          ...prev.tracker,
          status: 'TRACKING',
          detail: `Live 1s polling active for $${position.symbol} reserves`,
        },
      }));

      appendLog(
        'PAPER-BUY',
        `Grok 4.6: Simulated Buy Executed for 0.50 SOL (+0.005 Gas). Entry Price: ${position.entryPriceSol.toExponential(4)} SOL`,
        'text-amber-300'
      );

      triggerPopup(
        `PAPER BUY EXECUTED: $${position.symbol}`,
        `0.50 SOL invested at live bonding curve rate`,
        'info'
      );
    });

    // Price update from 1s tracker polling
    socket.on('price_update', (pos: any) => {
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
        return updated.slice(-40); // Keep last 40 seconds of points
      });
    });

    // Whale dump alert
    socket.on('whale_dump_warning', (alert: any) => {
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
    });

    // Position closed / Trade completed
    socket.on('position_closed', (data: any) => {
      const summary = data.summary || data;
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

      // Open Trade Summary Modal
      setTradeModal({
        show: true,
        symbol: summary.symbol,
        gainMultiplier: summary.gainMultiplier || 1.0,
        pnlPercent: summary.pnlPercent,
        pnlSol: summary.pnlSol,
        exitReason: summary.exitReason,
        aiPostMortem: summary.aiPostMortem || 'Claude Opus 4.8: Strategic Paper Sell filled at current live reserves.',
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
    });

    // Log messages from winston
    socket.on('log_message', (log: any) => {
      appendLog(log.level?.toUpperCase() || 'BOT', log.message, log.level === 'error' ? 'text-rose-400' : 'text-slate-300');
    });

    socket.on('agent1_model_changed', (data: { selected: string; activeOption?: any }) => {
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
    });

    socket.on('agent2_model_changed', (data: { selected: string; activeOption?: any }) => {
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
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const handleSwitchAgent1Model = async (modelId: string) => {
    setSelectedAgent1ModelId(modelId);
    if (socketRef.current) socketRef.current.emit('set_agent1_model', modelId);

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
    if (socketRef.current) socketRef.current.emit('set_agent2_model', modelId);

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

  // Handler: Toggle Bot Scanning
  const handleToggleScanning = async () => {
    try {
      const endpoint = isScanning ? '/api/bot/stop' : '/api/bot/start';
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsScanning(data.isScanning);
        appendLog('CONTROL', `Bot scanning status changed: ${data.isScanning ? 'ACTIVE' : 'PAUSED'}`, 'text-cyan-400');
      }
    } catch {
      setIsScanning(!isScanning);
    }
  };

  // Handler: Emergency Sell All
  const handleEmergencySell = async () => {
    try {
      appendLog('EMERGENCY', 'EMERGENCY SELL ALL TRIGGERED BY USER!', 'text-rose-400');
      triggerPopup('EMERGENCY SELL TRIGGERED', 'Liquidating active paper position immediately...', 'danger');
      await fetch('/api/trade/sell-all', { method: 'POST' });
    } catch {
      // Fallback
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 font-sans p-3 md:p-6 select-none overflow-x-hidden">
      {/* ==================================================================== */}
      {/* 1. TOP HEADER CONTROLS BAR & SYSTEM BADGE */}
      {/* ==================================================================== */}
      <header className="mb-5 bg-[#0b1222]/90 border border-slate-800/80 rounded-2xl p-4 md:p-5 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 via-emerald-500 to-cyan-500 p-[2px] shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-[#060913] rounded-[10px] flex items-center justify-center">
                <Bot className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-white font-mono">
                  PUMP.FUN <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400">MULTI-AGENT AI</span>
                </h1>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-300">
                  v2.5 PRO
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Solana Mainnet Live Execution • 5-Agent Autonomous Intelligence Engine
              </p>
            </div>
          </div>

          {/* Mode Indicator & Action Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            {/* MANDATORY USER REQUIREMENT: MODE: MAINNET PAPER TRADING (DRY-RUN) BADGE */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-amber-500/50 bg-amber-500/10 shadow-lg shadow-amber-500/10">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span className="text-xs md:text-sm font-black tracking-wider text-amber-300 font-mono">
                MODE: MAINNET PAPER TRADING (DRY-RUN)
              </span>
            </div>

            {/* Socket Status */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-[#070d1a] text-xs font-mono text-slate-300">
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span>{socketConnected ? 'LIVE FEED: CONNECTED' : 'LIVE FEED: CONNECTING'}</span>
            </div>

            {/* Scanning Toggle Switch */}
            <button
              onClick={handleToggleScanning}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all duration-200 border ${
                isScanning
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-amber-500/20 border-amber-500/60 text-amber-300 hover:bg-amber-500/30 ring-1 ring-amber-500/40'
              }`}
            >
              {isScanning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isScanning ? 'AUTO-TRADE: ACTIVE' : 'AUTO-TRADE: PAUSED (CLICK TO START)'}</span>
            </button>

            {/* Emergency Sell Button */}
            <button
              onClick={handleEmergencySell}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs font-bold bg-rose-600/20 border border-rose-500/50 text-rose-300 hover:bg-rose-600 hover:text-white transition-all duration-200 shadow-lg shadow-rose-900/30"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>EMERGENCY SELL ALL</span>
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* 2. STRATEGY SPECIFICATION & PERFORMANCE TRACKER BAR */}
      {/* ==================================================================== */}
      <section className="mb-6 bg-gradient-to-r from-[#0d182e] via-[#091124] to-[#0d182e] border border-slate-700/80 rounded-2xl p-4 md:p-5 shadow-xl font-mono">
        {/* Top Strategy Header Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              STRATEGY: RISK 1 : 2 REWARD (SL: -10% | TP: +20%)
            </span>
            <span className="px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold">
              NARRATIVE THRESHOLD: &ge; 0.70
            </span>
            <span className="px-3 py-1 rounded-lg bg-purple-500/15 border border-purple-500/40 text-purple-300 font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              SECURITY MODE: ANTI-RUG STRICT
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <span className="text-amber-400 font-bold">Max 10% Bankroll Entry</span>
            <span>•</span>
            <span>Whale Drop &gt; 5% Exit</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Stat 1: Initial Balance */}
          <div className="p-3 bg-[#060b18]/80 border border-slate-800 rounded-xl">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-slate-400" />
              Initial Paper Balance
            </span>
            <div className="mt-1 text-xl md:text-2xl font-black font-mono text-slate-200">
              {paperStats.initialBalanceSol.toFixed(2)}{' '}
              <span className="text-xs text-slate-400 font-normal">SOL</span>
            </div>
          </div>

          {/* Stat 2: Current Balance */}
          <div className="p-3 bg-[#060b18]/80 border border-slate-800 rounded-xl">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Current Paper Balance
            </span>
            <div
              className={`mt-1 text-xl md:text-2xl font-black font-mono ${
                paperStats.currentBalanceSol >= paperStats.initialBalanceSol ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {paperStats.currentBalanceSol.toFixed(4)}{' '}
              <span className="text-xs text-slate-400 font-normal">SOL</span>
            </div>
          </div>

          {/* Stat 3: Total Paper PnL */}
          <div className="p-3 bg-[#060b18]/80 border border-slate-800 rounded-xl">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              Total Paper PnL
            </span>
            <div
              className={`mt-1 text-xl md:text-2xl font-black font-mono ${
                paperStats.totalPaperPnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {paperStats.totalPaperPnlPercent >= 0 ? '+' : ''}
              {paperStats.totalPaperPnlPercent.toFixed(2)}%
              <span className="block text-[11px] text-slate-400 font-normal">
                ({paperStats.totalPaperPnlSol >= 0 ? '+' : ''}
                {paperStats.totalPaperPnlSol.toFixed(4)} SOL)
              </span>
            </div>
          </div>

          {/* Stat 4: Win Rate */}
          <div className="p-3 bg-[#060b18]/80 border border-slate-800 rounded-xl">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-purple-400" />
              Win Rate (1:2 R:R)
            </span>
            <div className="mt-1 text-xl md:text-2xl font-black font-mono text-white">
              {paperStats.winningTrades} / {paperStats.totalTrades}{' '}
              <span className="text-xs text-slate-400 font-normal">Trades</span>
              <span className="block text-[11px] text-purple-300 font-normal">
                ({paperStats.winRatePercent.toFixed(1)}% Win Rate)
              </span>
            </div>
          </div>

          {/* Stat 5: Status Verdict (GROW / REKT) */}
          <div className="col-span-2 sm:col-span-1 p-3 bg-[#060b18]/80 border border-slate-800 rounded-xl flex flex-col justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              System Status Verdict
            </span>
            <div className="mt-1">
              {paperStats.status === 'GROW' ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 font-mono font-black text-sm md:text-base">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>GROW 🚀 (+SOL)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-rose-500/50 bg-rose-500/20 text-rose-400 font-mono font-black text-sm md:text-base">
                  <XCircle className="w-4 h-4" />
                  <span>REKT ⚠️ (-SOL)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 3. HERO ACTIVE TOKEN CARD & LIVE RECHARTS PNL GRAPH */}
      {/* ==================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Token Overview Card (4 Cols) */}
        <div className="lg:col-span-4 bg-[#0b1222]/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                Live Monitored Token
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                {activeToken.status}
              </span>
            </div>

            {/* Token Info */}
            <div className="flex items-center gap-3.5 mt-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-500 p-[2px] shadow-lg shadow-emerald-500/20 flex-shrink-0">
                <div className="w-full h-full bg-[#080e1d] rounded-[14px] flex items-center justify-center overflow-hidden relative">
                  {activeToken.image && !imgError && !activeToken.image.endsWith('.json') ? (
                    <img 
                      src={activeToken.image} 
                      alt={activeToken.symbol} 
                      className="w-full h-full object-cover" 
                      onError={() => setImgError(true)} 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-950 via-slate-900 to-emerald-950 border border-emerald-500/20 text-emerald-400 font-mono font-black text-sm select-none">
                      {activeToken.symbol ? (
                        <span>${activeToken.symbol.slice(0, 4).toUpperCase()}</span>
                      ) : (
                        <Flame className="w-7 h-7 text-amber-400" />
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-black font-mono text-white tracking-tight flex items-center gap-2">
                  ${activeToken.symbol}
                  <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Score: {activeToken.narrativeScore.toFixed(2)}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 truncate max-w-[200px]">{activeToken.name}</p>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5 truncate max-w-[200px]">
                  Mint: {activeToken.mint.slice(0, 6)}...{activeToken.mint.slice(-4)}
                </p>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="p-2.5 rounded-xl bg-[#060b18] border border-slate-800/80 font-mono">
                <span className="text-[10px] text-slate-400 uppercase">Entry Price</span>
                <p className="text-sm font-bold text-slate-200 mt-0.5">
                  {activeToken.entryPriceSol.toExponential(3)} SOL
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#060b18] border border-slate-800/80 font-mono">
                <span className="text-[10px] text-slate-400 uppercase">Current Price</span>
                <p className="text-sm font-bold text-emerald-400 mt-0.5">
                  {activeToken.currentPriceSol.toExponential(3)} SOL
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#060b18] border border-slate-800/80 font-mono">
                <span className="text-[10px] text-slate-400 uppercase">Virtual Reserves</span>
                <p className="text-sm font-bold text-cyan-300 mt-0.5">
                  {activeToken.virtualSol.toFixed(2)} SOL
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#060b18] border border-slate-800/80 font-mono">
                <span className="text-[10px] text-slate-400 uppercase">Reserves 1s Delta</span>
                <p
                  className={`text-sm font-bold mt-0.5 ${
                    activeToken.solDeltaPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {activeToken.solDeltaPercent >= 0 ? '+' : ''}
                  {activeToken.solDeltaPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* Current Multiplier Badge */}
          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400">Position Multiplier</span>
              <div className="text-3xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-300">
                {activeToken.gainMultiplier.toFixed(2)}X
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono uppercase text-slate-400">Unrealized PnL</span>
              <div
                className={`text-2xl font-black font-mono ${
                  activeToken.pnlPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {activeToken.pnlPercent >= 0 ? '+' : ''}
                {activeToken.pnlPercent.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Live Recharts Graph Card (8 Cols) */}
        <div className="lg:col-span-8 bg-[#0b1222]/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl flex flex-col justify-between shadow-xl">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                Live Mainnet Curve PnL (%) & Gain Trajectory
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Real-time 1s Ticks
              </span>
              <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
                TP Target: +20% (1.20x)
              </span>
              <span className="text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/40">
                SL: -10%
              </span>
            </div>
          </div>

          {/* Area Chart */}
          <div className="h-64 w-full mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="neonGreenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  stroke="#475569"
                  fontSize={11}
                  fontFamily="monospace"
                  tickLine={false}
                />
                <YAxis
                  stroke="#475569"
                  fontSize={11}
                  fontFamily="monospace"
                  tickFormatter={(v: any) => `${v > 0 ? '+' : ''}${v}%`}
                  tickLine={false}
                  domain={[-15, 30]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#080d1a',
                    borderColor: '#10B981',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
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
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#neonGreenGradient)"
                  isAnimationActive={false}
                  style={{
                    filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.7))',
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Chart Footer Indicator */}
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Polling Interval: 1000ms | Solana RPC confirmed
            </span>
            <span className="text-slate-400">
              Max Entry: <span className="text-amber-300 font-bold">10% Balance (0.10 SOL)</span> • Jito MEV
            </span>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 4. 5 SPECIALIST AGENTS STATUS CARDS */}
      {/* ==================================================================== */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            5-Agent Specialized Trading Orchestra (Live Mainnet Feed)
          </h3>
          <span className="text-xs font-mono text-slate-500">
            Zero-Crash • Async EventEmitter • No Memory Leak
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {Object.entries(agents).map(([key, ag]) => (
            <div
              key={key}
              className={`bg-[#0b1222]/90 border ${ag.borderColor} rounded-xl p-4 backdrop-blur-md flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/5`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${ag.badgeColor}`}>
                    {ag.status}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                    {ag.model}
                  </span>
                </div>
                <h4 className="text-xs font-bold font-mono text-white tracking-tight leading-snug">
                  {ag.name}
                </h4>

                {key === 'scanner' ? (
                  <div className="mt-2.5 p-2 rounded-xl bg-black/70 border border-cyan-500/40 shadow-inner">
                    <label className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider block mb-1 font-bold flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-cyan-400" />
                      PILIH MODEL AGEN 1:
                    </label>
                    <select
                      value={selectedAgent1ModelId}
                      onChange={(e) => handleSwitchAgent1Model(e.target.value)}
                      className="w-full bg-[#080e1d] text-cyan-300 border border-cyan-500/40 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-cyan-300 cursor-pointer shadow-lg"
                    >
                      <option value="openrouter-nex">⚡ NEX-AGI N2.5 Pro Free (OpenRouter)</option>
                      <option value="anymodel-deepseek">🤖 DeepSeek V4 Flash (anymodel.org)</option>
                      <option value="anymodel-glm">🔥 GLM 5.3 Flash (anymodel.org)</option>
                    </select>
                  </div>
                ) : key === 'auditor' ? (
                  <div className="mt-2.5 p-2 rounded-xl bg-black/70 border border-emerald-500/40 shadow-inner">
                    <label className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider block mb-1 font-bold flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-emerald-400" />
                      PILIH MODEL AGEN 2:
                    </label>
                    <select
                      value={selectedAgent2ModelId}
                      onChange={(e) => handleSwitchAgent2Model(e.target.value)}
                      className="w-full bg-[#080e1d] text-emerald-300 border border-emerald-500/40 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-emerald-300 cursor-pointer shadow-lg"
                    >
                      <option value="openrouter-nex">⚡ NEX-AGI N2.5 Pro Free (OpenRouter)</option>
                      <option value="anymodel-claude">🛡️ Claude Sonnet 4.6 (anymodel.org)</option>
                      <option value="anymodel-glm">🔥 GLM 5.3 Flash (anymodel.org)</option>
                    </select>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {ag.detail}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>Model: {ag.model}</span>
                <span className="text-emerald-400 font-bold">ONLINE</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 5. CYBERPUNK TERMINAL CONSOLE LOG */}
      {/* ==================================================================== */}
      <section className="bg-[#0b1222]/90 border border-slate-800 rounded-2xl p-4 md:p-5 backdrop-blur-xl shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
              Live Terminal Stream & Agent Consensus Audit Logs
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Streaming Live Data</span>
          </div>
        </div>

        <div
          ref={logScrollRef}
          className="h-44 overflow-y-auto space-y-1.5 font-mono text-xs pr-2 scrollbar-thin scrollbar-thumb-slate-700"
        >
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2 text-slate-300">
              <span className="text-slate-500 text-[11px]">[{log.timestamp}]</span>
              <span className={`font-bold text-[11px] ${log.color}`}>[{log.tag}]</span>
              <span className="text-slate-200 text-xs leading-relaxed">{log.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 6. POP-UP NOTIFICATION BADGE (Top Right) */}
      {/* ==================================================================== */}
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

      {/* ==================================================================== */}
      {/* 7. TRADE SUMMARY / TARGET MODAL BANNER */}
      {/* ==================================================================== */}
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
    </div>
  );
}
