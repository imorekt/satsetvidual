import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, Copy, Eye, EyeOff, Zap, Users, Activity,
  TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock,
  SkipForward, XCircle, ToggleLeft, Sliders,
  Upload, Layers, Check, Wallet, RotateCcw,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  ICopyTradeWallet,
  ICopyTradeActivity,
  CopyTradeConfig,
  IPaperTradingStats,
  IPositionState,
  PricePoint,
  IPositionCloseSummary,
} from '../types';

interface CopyTradeViewProps {
  wallets: ICopyTradeWallet[];
  activity: ICopyTradeActivity[];
  copyConfig: CopyTradeConfig;
  walletBalance: number | string;
  paperStats?: IPaperTradingStats | null;
  activePositions?: IPositionState[];
  priceHistory?: PricePoint[];
  tradeHistory?: IPositionCloseSummary[];
  onOpenDeposit?: () => void;
  onManualExit?: (tokenAddress: string) => void;
  onAddWallet: (address: string, label: string) => void;
  onRemoveWallet: (address: string) => void;
  onToggleWallet: (address: string, isActive: boolean) => void;
  onUpdateConfig: (updates: Partial<CopyTradeConfig>) => void;
}

const shortAddr = (addr?: string | null) => {
  if (!addr || typeof addr !== 'string') return '';
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const statusConfig: Record<string, { label: string; color: string; bg: string; Icon: React.FC<any> }> = {
  DETECTED: { label: 'DETECTED', color: 'text-yellow-300', bg: 'bg-yellow-500/15 border-yellow-500/40', Icon: Eye },
  COPYING: { label: 'COPYING…', color: 'text-cyan-300', bg: 'bg-cyan-500/15 border-cyan-500/40', Icon: Clock },
  COPIED: { label: 'COPIED', color: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/40', Icon: CheckCircle },
  SKIPPED: { label: 'SKIPPED', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30', Icon: SkipForward },
  FAILED: { label: 'FAILED', color: 'text-rose-400', bg: 'bg-rose-500/15 border-rose-500/40', Icon: XCircle },
};

export const CopyTradeView: React.FC<CopyTradeViewProps> = ({
  wallets,
  activity,
  copyConfig,
  walletBalance,
  paperStats,
  activePositions = [],
  priceHistory = [],
  tradeHistory = [],
  onOpenDeposit,
  onManualExit,
  onAddWallet,
  onRemoveWallet,
  onToggleWallet,
  onUpdateConfig,
}) => {
  const [walletInputMode, setWalletInputMode] = useState<'SINGLE' | 'BULK'>('SINGLE');
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Bulk Import state
  const [bulkText, setBulkText] = useState('');
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkResult, setBulkResult] = useState<{
    addedCount: number;
    skippedCount: number;
    added: any[];
    skipped: any[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showConfig, setShowConfig] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const activityEndRef = useRef<HTMLDivElement>(null);

  // Filter activity feed: ONLY show executed/bought copies
  const visibleActivity = useMemo(() => {
    return activity.filter((item) => item.copyStatus === 'COPIED' || item.copyStatus === 'COPYING');
  }, [activity]);

  // Auto-scroll activity feed
  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleActivity.length]);

  const handleResetPortfolio = async () => {
    if (!window.confirm('Reset semua saldo, posisi copy trade & PnL kembali normal ke 1.0 SOL?')) return;
    setIsResetting(true);
    try {
      await fetch('/api/copytrade/reset', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setIsResetting(false);
    }
  };

  const handleAddWallet = async () => {
    if (!newAddress.trim()) { setAddError('Masukkan wallet address'); return; }
    if (newAddress.trim().length < 32 || newAddress.trim().length > 44) {
      setAddError('Bukan Solana address yang valid'); return;
    }
    setIsAdding(true);
    setAddError('');
    try {
      const res = await fetch('/api/copytrade/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: newAddress.trim(), label: newLabel.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAddError(data.message || 'Gagal menambahkan wallet');
        return;
      }
      onAddWallet(newAddress.trim(), newLabel.trim());
      setNewAddress('');
      setNewLabel('');
    } catch {
      setAddError('Gagal menambahkan wallet');
    } finally {
      setIsAdding(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      setBulkError('Masukkan daftar wallet terlebih dahulu');
      return;
    }
    setIsBulkImporting(true);
    setBulkError('');
    setBulkResult(null);

    try {
      const res = await fetch('/api/copytrade/wallets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bulkText }),
      });

      const rawText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        setBulkError('Backend belum restart. Silakan restart backend bot di terminal.');
        return;
      }

      if (!res.ok || !data.success) {
        setBulkError(data.message || 'Gagal import bulk wallet');
        return;
      }
      setBulkResult({
        addedCount: data.addedCount || 0,
        skippedCount: data.skippedCount || 0,
        added: data.added || [],
        skipped: data.skipped || [],
      });
      if (data.addedCount > 0) {
        setBulkText('');
      }
    } catch (err: any) {
      setBulkError(err.message || 'Gagal terhubung ke server. Pastikan server backend aktif.');
    } finally {
      setIsBulkImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setBulkText((prev) => (prev ? `${prev}\n${content}` : content));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper count valid non-empty lines in bulkText
  const detectedLineCount = bulkText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//')).length;

  const handleRemoveWallet = async (address: string) => {
    await fetch(`/api/copytrade/wallets/${address}`, { method: 'DELETE' }).catch(() => { });
    onRemoveWallet(address);
  };

  const handleToggleWallet = async (address: string, current: boolean) => {
    await fetch(`/api/copytrade/wallets/${address}/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    }).catch(() => { });
    onToggleWallet(address, !current);
  };

  const handleToggleCopyTrade = async () => {
    const newVal = !copyConfig.isEnabled;
    await fetch('/api/copytrade/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: newVal }),
    }).catch(() => { });
    onUpdateConfig({ isEnabled: newVal });
  };

  const handleConfigChange = async (updates: Partial<CopyTradeConfig>) => {
    await fetch('/api/copytrade/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => { });
    onUpdateConfig(updates);
  };

  const totalCopied = wallets.reduce((s, w) => s + w.totalCopied, 0);
  const activeCount = wallets.filter((w) => w.isActive).length;

  // ═══ REAL-TIME 1-SECOND PRICE TICKER & UNREALIZED PNL RECALCULATOR ═══
  const [livePrices, setLivePrices] = useState<
    Record<string, { currentPriceSol: number; pnlPercent: number; pnlSol: number; lastUpdated: number }>
  >({});
  const [liveStreamTicks, setLiveStreamTicks] = useState<
    Array<{ time: string; pnlPercent: number; priceSol: number; pnlSol: number }>
  >(() => {
    try {
      const saved = localStorage.getItem('copytrade_live_ticks');
      if (saved) return JSON.parse(saved);
    } catch { }
    return [];
  });

  useEffect(() => {
    try {
      if (liveStreamTicks.length > 0) {
        localStorage.setItem('copytrade_live_ticks', JSON.stringify(liveStreamTicks.slice(-50)));
      }
    } catch { }
  }, [liveStreamTicks]);

  // Sub-Loop Ticker Real-Time (1-Second Interval)
  useEffect(() => {
    let isMounted = true;

    const priceTickInterval = setInterval(async () => {
      const nowStr = new Date().toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      if (activePositions.length === 0) {
        // When no active open positions, keep pushing real-time baseline tick
        const basePnlPercent = paperStats?.totalPaperPnlPercent ?? 0;
        const basePnlSol = paperStats?.totalPaperPnlSol ?? 0;
        if (isMounted) {
          setLiveStreamTicks((prev) => {
            const next = [
              ...prev,
              { time: nowStr, pnlPercent: Number(basePnlPercent.toFixed(2)), priceSol: 0, pnlSol: basePnlSol },
            ];
            return next.slice(-50); // Keep last 50 ticks
          });
        }
        return;
      }

      // Collect all active mint addresses for single batch query
      const mints = activePositions.map((p) => p.tokenAddress).filter(Boolean);
      const mintsParam = mints.slice(0, 30).join(',');

      try {
        let fetchedPrices: Record<string, number> = {};

        try {
          // 1. Try internal backend batch proxy
          const res = await fetch(`/api/copytrade/prices?mints=${mintsParam}`);
          const data = await res.json();
          if (data.success && data.prices) {
            for (const [m, info] of Object.entries<any>(data.prices)) {
              if (info.priceSol && info.priceSol > 0) {
                fetchedPrices[m] = Number(info.priceSol);
              }
            }
          }
        } catch {
          // 2. Direct DexScreener batch fallback
          try {
            const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintsParam}`);
            const dexData = await dexRes.json();
            if (dexData.pairs) {
              for (const pair of dexData.pairs) {
                const baseAddr = pair.baseToken?.address;
                const natPrice = Number(pair.priceNative || 0);
                if (baseAddr && natPrice > 0 && !fetchedPrices[baseAddr]) {
                  fetchedPrices[baseAddr] = natPrice;
                }
              }
            }
          } catch {
            // ignore network glitch
          }
        }

        if (!isMounted) return;

        // Recalculate Unrealized PnL per token
        const newLivePriceMap: Record<
          string,
          { currentPriceSol: number; pnlPercent: number; pnlSol: number; lastUpdated: number }
        > = { ...livePrices };

        let totalOpenUnrealizedSol = 0;

        for (const pos of activePositions) {
          const currentPriceSol = fetchedPrices[pos.tokenAddress] || pos.currentPriceSol || pos.entryPriceSol || 0;
          const entryPriceSol = pos.entryPriceSol || currentPriceSol || 0.0001;
          const tokenAmt = Number(pos.amountToken) / 1e6;

          // Unrealized PnL calculation
          const pnlSol = Number(((currentPriceSol - entryPriceSol) * tokenAmt).toFixed(6));
          const pnlPercent = entryPriceSol > 0 ? Number((((currentPriceSol - entryPriceSol) / entryPriceSol) * 100).toFixed(2)) : 0;

          newLivePriceMap[pos.tokenAddress] = {
            currentPriceSol,
            pnlPercent,
            pnlSol,
            lastUpdated: Date.now(),
          };

          totalOpenUnrealizedSol += pnlSol;
        }

        setLivePrices(newLivePriceMap);

        // Aggregate entire active token PnL into Realtime PnL and Balance
        const initialBal = paperStats?.initialBalanceSol ?? 1.0;
        const baseRealizedSol = paperStats?.totalPaperPnlSol ?? 0;
        const currentAggregatedPnlSol = Number((baseRealizedSol + totalOpenUnrealizedSol).toFixed(4));
        const currentAggregatedPnlPercent = initialBal > 0 ? Number(((currentAggregatedPnlSol / initialBal) * 100).toFixed(2)) : 0;
        const leadPrice = newLivePriceMap[activePositions[0]?.tokenAddress]?.currentPriceSol || activePositions[0]?.currentPriceSol || 0;

        setLiveStreamTicks((prev) => {
          const next = [
            ...prev,
            {
              time: nowStr,
              pnlPercent: currentAggregatedPnlPercent,
              priceSol: leadPrice,
              pnlSol: currentAggregatedPnlSol,
            },
          ];
          return next.slice(-50); // Keep last 50 points
        });
      } catch {
        // ignore
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(priceTickInterval);
    };
  }, [activePositions, paperStats]);

  // Realtime Financial Stats Synced directly with Paper/Live Wallet & Live Unrealized PnL
  const initialBalance = paperStats?.initialBalanceSol ?? 1.0;

  const activeUnrealizedPnlSol = useMemo(() => {
    return activePositions.reduce((sum, pos) => {
      const lp = livePrices[pos.tokenAddress];
      return sum + (lp ? lp.pnlSol : (pos.pnlSol || 0));
    }, 0);
  }, [activePositions, livePrices]);

  const totalPnlSol = Number(((paperStats?.totalPaperPnlSol ?? 0) + (activePositions.length > 0 ? activeUnrealizedPnlSol : 0)).toFixed(4));
  const totalPnlPercent = initialBalance > 0 ? Number(((totalPnlSol / initialBalance) * 100).toFixed(2)) : 0;
  const fallbackBalance = typeof walletBalance === 'number' ? walletBalance : parseFloat(walletBalance) || 1.0;
  const balanceNum = Math.max(0, initialBalance > 0 ? (initialBalance + totalPnlSol) : fallbackBalance);
  const totalTrades = paperStats?.totalTrades ?? tradeHistory.length;
  const winRate = paperStats?.winRatePercent ?? 0;
  const isProfit = totalPnlSol >= 0;

  // Realtime PnL Chart Data (Combines price history / live stream / equity curve)
  const chartData = useMemo(() => {
    if (liveStreamTicks.length >= 3) {
      return liveStreamTicks;
    }
    if (priceHistory && priceHistory.length > 0) {
      return priceHistory;
    }
    // Fallback: build equity curve from trade history
    if (tradeHistory && tradeHistory.length > 0) {
      let accumPnl = 0;
      return [...tradeHistory].reverse().map((t, idx) => {
        accumPnl += t.pnlPercent || 0;
        return {
          time: t.closedAt ? new Date(t.closedAt).toLocaleTimeString() : `#${idx + 1}`,
          priceSol: t.exitPriceSol || 0,
          pnlPercent: Number(accumPnl.toFixed(2)),
          virtualSol: 30,
        };
      });
    }
    return [
      { time: '00:00', priceSol: 0, pnlPercent: 0 },
      { time: 'Now', priceSol: 0, pnlPercent: totalPnlPercent },
    ];
  }, [liveStreamTicks, priceHistory, tradeHistory, totalPnlPercent]);

  const latestPnlPercent = chartData[chartData.length - 1]?.pnlPercent ?? totalPnlPercent;
  const isChartProfit = latestPnlPercent >= 0;
  const strokeColor = isChartProfit ? '#10b981' : '#f43f5e';
  const gradientId = isChartProfit ? 'copyPnlGreenGrad' : 'copyPnlRedGrad';

  return (
    <div className="h-full w-full flex flex-col gap-2.5 overflow-hidden font-mono p-1">

      {/* ═══ TOP HEADER & STATS HERO PANEL ════════════════════════════ */}
      <div className="flex-shrink-0 w-full rounded-2xl bg-gradient-to-r from-[#070c18] via-[#0b1022] to-[#070c18] border border-purple-500/30 p-3 shadow-xl shadow-purple-950/40">
        <div className="flex items-center justify-between gap-3 flex-wrap">

          {/* Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 shadow-glow flex-shrink-0">
              <Copy className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white tracking-tight">AUTO COPY TRADE <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">PUMP.FUN</span></h2>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-bold text-emerald-300">PUMP.FUN ONLY</span>
              </div>
              <p className="text-[10px] text-slate-400">Strict On-Chain Protocol Filter (Program ID: 6EF8...BEwF6P & .pump suffix only)</p>
            </div>
          </div>

          {/* REALTIME PNL & BALANCE SYNC WIDGETS */}
          <div className="flex items-center gap-2 flex-wrap text-[11px]">

            {/* Live Balance Card */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-950/40 to-[#07121c] border border-emerald-500/30 shadow-inner">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[9px] text-slate-400 block font-bold">SALDO REALTIME</span>
                <span className="text-sm font-black text-emerald-300 tracking-tight">{balanceNum.toFixed(4)} <span className="text-[10px] text-emerald-500 font-bold">SOL</span></span>
              </div>
              {onOpenDeposit && (
                <button
                  onClick={onOpenDeposit}
                  title="Tambah / Deposit Saldo SOL"
                  className="ml-1 px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold transition-all"
                >
                  + Deposit
                </button>
              )}
            </div>

            {/* Total Realtime PnL Card */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${isProfit
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 shadow-emerald-950/30'
                : 'bg-rose-950/30 border-rose-500/40 text-rose-300 shadow-rose-950/30'
              } shadow-inner`}>
              <div className={`p-1.5 rounded-lg ${isProfit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              </div>
              <div>
                <span className="text-[9px] text-slate-400 block font-bold">TOTAL PNL (SYNC)</span>
                <span className="text-sm font-black tracking-tight">
                  {isProfit ? '+' : ''}{totalPnlSol.toFixed(4)} SOL <span className="text-[10px]">({isProfit ? '+' : ''}{totalPnlPercent.toFixed(1)}%)</span>
                </span>
              </div>
            </div>

            {/* Winrate & Total Copied & Active */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
              <div className="flex flex-col items-center pr-2 border-r border-white/10">
                <span className="text-purple-300 font-black text-xs">{wallets.length}</span>
                <span className="text-slate-500 text-[8.5px]">{activeCount} on</span>
              </div>
              <div className="flex flex-col items-center pr-2 border-r border-white/10">
                <span className="text-cyan-300 font-black text-xs">{totalCopied}</span>
                <span className="text-slate-500 text-[8.5px]">Copied</span>
              </div>
              <div className="flex flex-col items-center pr-2 border-r border-white/10">
                <span className="text-amber-300 font-black text-xs">{totalTrades}</span>
                <span className="text-slate-500 text-[8.5px]">Trades</span>
              </div>
              <div className="flex flex-col items-center">
                <span className={`font-black text-xs ${winRate >= 50 ? 'text-emerald-400' : 'text-slate-300'}`}>{winRate}%</span>
                <span className="text-slate-500 text-[8.5px]">WinRate</span>
              </div>
            </div>
          </div>

          {/* Master Toggle + Config + Chart Toggle + Reset Button */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleResetPortfolio}
              disabled={isResetting}
              title="Reset saldo paper trading & posisi ke 1.0 SOL"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-[10.5px] font-bold transition-all disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>Reset</span>
            </button>

            <button
              onClick={() => setShowChart((v) => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10.5px] font-bold transition-all ${showChart
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Grafik PnL</span>
            </button>

            <button
              onClick={() => setShowConfig((v) => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10.5px] font-bold transition-all ${showConfig
                  ? 'bg-purple-500/20 border-purple-400/60 text-purple-200'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Config</span>
            </button>

            <button
              id="copytrade-master-toggle"
              onClick={handleToggleCopyTrade}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-[11px] border transition-all ${copyConfig.isEnabled
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400 text-white shadow-lg shadow-emerald-950/60'
                  : 'bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
            >
              {copyConfig.isEnabled ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300 animate-pulse" />
                  <span>COPY ACTIVE</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-3.5 h-3.5" />
                  <span>PAUSED</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ═══ REALTIME PNL GRAPH ACCORDION / CONTAINER ═════════════════ */}
        {showChart && (
          <div className="mt-3 pt-3 border-t border-white/10 animate-fade-in">
            <div className="flex items-center justify-between mb-1.5 text-[10px]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white flex items-center gap-1">
                  <Activity className="w-3 h-3 text-cyan-400" />
                  GRAFIK PNL REALTIME ({chartData.length} TICKS)
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">Live Synchronized PnL</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-400">
                  Current PnL: <strong className={isChartProfit ? 'text-emerald-400' : 'text-rose-400'}>{isChartProfit ? '+' : ''}{latestPnlPercent.toFixed(2)}%</strong>
                </span>
                <span className="text-slate-400">
                  Open Positions: <strong className="text-cyan-300">{activePositions.length}</strong>
                </span>
              </div>
            </div>

            <div className="w-full h-36 bg-[#040812]/80 rounded-xl border border-white/5 p-1 relative overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="copyPnlGreenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="copyPnlRedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    stroke="#334155"
                    tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    stroke="#334155"
                    tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                    tickLine={false}
                    tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(7, 12, 24, 0.96)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      fontFamily: 'JetBrains Mono',
                      fontSize: '10px',
                      color: '#fff',
                    }}
                    formatter={(val: number) => [`${val >= 0 ? '+' : ''}${val.toFixed(2)}%`, 'PnL %']}
                    labelFormatter={(label) => `Waktu: ${label}`}
                  />
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="pnlPercent"
                    stroke={strokeColor}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#${gradientId})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ═══ ACTIVE POSITIONS BAR (IF ANY) ══════════════════════════ */}
        {activePositions.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-white/10">
            <div className="flex items-center justify-between mb-1.5 text-[10px]">
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                POSISI COPY TRADE AKTIF ({activePositions.length})
              </span>
              <span className="text-slate-500 text-[9px]">Live price & exit trigger active</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {activePositions.map((pos) => {
                const liveInfo = livePrices[pos.tokenAddress];
                const currentPrice = liveInfo?.currentPriceSol ?? pos.currentPriceSol ?? pos.entryPriceSol ?? 0;
                const pnlPercent = liveInfo?.pnlPercent ?? pos.pnlPercent ?? 0;
                const pnlSol = liveInfo?.pnlSol ?? pos.pnlSol ?? 0;
                const posProfit = pnlPercent >= 0;

                return (
                  <div
                    key={pos.tokenAddress}
                    className="p-2.5 rounded-xl bg-[#060a14] border border-emerald-500/30 flex items-center justify-between gap-2 shadow-sm transition-all hover:border-emerald-400/60"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white">${pos.symbol}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{shortAddr(pos.tokenAddress)}</span>
                      </div>
                      <div className="text-[9.5px] text-slate-400 mt-0.5 font-mono">
                        Entry: {pos.entryPriceSol && pos.entryPriceSol < 0.0001 ? pos.entryPriceSol.toExponential(2) : (pos.entryPriceSol || 0).toFixed(4)} SOL
                      </div>
                      <div className="text-[9.5px] text-cyan-300 font-mono font-bold flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        Now: {currentPrice < 0.0001 ? currentPrice.toExponential(2) : currentPrice.toFixed(4)} SOL
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-0.5">
                      <span className={`text-xs font-black px-1.5 py-0.5 rounded ${posProfit ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`}>
                        {posProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {posProfit ? '+' : ''}{pnlSol.toFixed(4)} SOL
                      </span>
                      {onManualExit && (
                        <button
                          onClick={() => onManualExit(pos.tokenAddress)}
                          className="mt-0.5 px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[8.5px] font-bold transition-all"
                        >
                          Sell / Exit
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ CONFIG DRAWER ════════════════════════════════════════════ */}
        {showConfig && (
          <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-[11px] animate-fade-in">
            {/* Copy Amount Mode */}
            <div className="space-y-1">
              <label className="text-slate-400 font-bold block">Fixed SOL Amount per Trade</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="10"
                  value={copyConfig.customAmountSol}
                  onChange={(e) => handleConfigChange({ customAmountSol: parseFloat(e.target.value) || 0.05, useCustomAmount: true })}
                  className="w-full bg-[#070d1a] border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                />
                <span className="text-slate-400 text-xs font-bold">SOL</span>
              </div>
            </div>

            {/* Copy Delay */}
            <div className="space-y-1">
              <label className="text-slate-400 font-bold block">Execution Delay (ms)</label>
              <input
                type="number"
                step="100"
                min="0"
                max="10000"
                value={copyConfig.copyDelayMs}
                onChange={(e) => handleConfigChange({ copyDelayMs: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#070d1a] border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Copy Mode */}
            <div className="space-y-1">
              <label className="text-slate-400 font-bold block">Mode Transaksi</label>
              <select
                value={copyConfig.copyMode}
                onChange={(e) => handleConfigChange({ copyMode: e.target.value as any })}
                className="w-full bg-[#070d1a] border border-slate-700 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-purple-500 text-xs"
              >
                <option value="ALL">ALL (BUY + SELL)</option>
                <option value="BUY_ONLY">BUY Only</option>
                <option value="SELL_ONLY">SELL Only</option>
              </select>
            </div>

            {/* Skip Options */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold block">Opsi Proteksi</label>
              <button
                onClick={() => handleConfigChange({ skipIfPositionExists: !copyConfig.skipIfPositionExists })}
                className={`flex items-center gap-1.5 w-full px-2 py-1 rounded-lg border text-[10px] font-bold transition-all ${copyConfig.skipIfPositionExists
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
              >
                {copyConfig.skipIfPositionExists ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <AlertCircle className="w-3 h-3 text-slate-500" />}
                <span>Skip jika token sudah punya posisi</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ MAIN GRID (MONITOR WALLET + ACTIVITY FEED) ═══════════════ */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5 overflow-hidden">

        {/* LEFT: Add Wallet + Wallet List */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-2.5 overflow-hidden">

          {/* Add Wallet / Bulk Import Form */}
          <div className="flex-shrink-0 rounded-2xl bg-[#070d1a] border border-purple-500/20 p-3">
            {/* Header with Mode Tabs */}
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span className="text-[11px] font-bold text-white tracking-wide">MONITOR WALLET</span>
              </div>
              <div className="flex items-center gap-1 bg-[#060a14] p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => { setWalletInputMode('SINGLE'); setBulkResult(null); setBulkError(''); }}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${walletInputMode === 'SINGLE'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Single
                </button>
                <button
                  onClick={() => { setWalletInputMode('BULK'); setAddError(''); }}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${walletInputMode === 'BULK'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <Layers className="w-3 h-3" />
                  Bulk Import
                </button>
              </div>
            </div>

            {walletInputMode === 'SINGLE' ? (
              /* SINGLE WALLET INPUT */
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Wallet Address (Solana)</label>
                  <input
                    id="copytrade-wallet-address"
                    type="text"
                    placeholder="cth: 7xKXtg...abc123"
                    value={newAddress}
                    onChange={(e) => { setNewAddress(e.target.value); setAddError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddWallet()}
                    className="w-full px-3 py-2 rounded-xl bg-[#060a14] border border-slate-700 text-white text-[11px] focus:outline-none focus:border-purple-500 font-mono placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Label / Nama Influencer (opsional)</label>
                  <input
                    id="copytrade-wallet-label"
                    type="text"
                    placeholder="cth: @murad, KOL_Alpha, etc"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddWallet()}
                    className="w-full px-3 py-2 rounded-xl bg-[#060a14] border border-slate-700 text-white text-[11px] focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
                  />
                </div>
                {addError && (
                  <p className="text-rose-400 text-[10px] flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {addError}
                  </p>
                )}
                <button
                  id="copytrade-add-wallet-btn"
                  onClick={handleAddWallet}
                  disabled={isAdding || !newAddress.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-[11px] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-950/40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isAdding ? 'Menambahkan…' : 'Monitor Wallet Ini'}
                </button>
              </div>
            ) : (
              /* BULK WALLET IMPORT */
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold">Paste Banyak Wallet atau Upload File</span>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/50 hover:border-cyan-700"
                    >
                      <Upload className="w-3 h-3" />
                      Upload .txt / .csv
                    </button>
                    {bulkText && (
                      <button
                        type="button"
                        onClick={() => { setBulkText(''); setBulkResult(null); setBulkError(''); }}
                        className="text-[10px] text-slate-500 hover:text-slate-300"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={4}
                    value={bulkText}
                    onChange={(e) => { setBulkText(e.target.value); setBulkError(''); }}
                    placeholder={"Format per baris:\nAddress, Label\nAddress | Label\natau hanya Address per baris\n\nContoh:\n7xKXtg...abc123, Murad\n9wLqQ...4zP9, Axiom Alpha"}
                    className="w-full px-3 py-2 rounded-xl bg-[#060a14] border border-slate-700 text-white text-[10.5px] font-mono focus:outline-none focus:border-purple-500 placeholder:text-slate-600 resize-none scrollbar-thin"
                  />
                  {detectedLineCount > 0 && (
                    <div className="absolute right-2 bottom-2 px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-500/40 text-[9px] font-bold text-purple-300 pointer-events-none">
                      {detectedLineCount} baris
                    </div>
                  )}
                </div>

                {bulkError && (
                  <p className="text-rose-400 text-[10px] flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {bulkError}
                  </p>
                )}

                {bulkResult && (
                  <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-500/30 text-[10px] space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> +{bulkResult.addedCount} wallet ditambahkan
                      </span>
                      {bulkResult.skippedCount > 0 && (
                        <span className="text-amber-400">
                          {bulkResult.skippedCount} dilewati
                        </span>
                      )}
                    </div>
                    {bulkResult.skipped.length > 0 && (
                      <div className="text-slate-400 text-[9px] max-h-16 overflow-y-auto scrollbar-thin space-y-0.5 mt-1 border-t border-purple-500/20 pt-1">
                        {bulkResult.skipped.map((s: any, idx: number) => {
                          const address = typeof s === 'string' ? s : (s?.address || '');
                          const reason = typeof s === 'object' && s?.reason ? s.reason : 'Sudah ada / Invalid';
                          return (
                            <div key={idx} className="flex items-center justify-between text-slate-500">
                              <span className="font-mono">{shortAddr(address)}</span>
                              <span className="text-amber-400/80">{reason}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <button
                  id="copytrade-bulk-import-btn"
                  onClick={handleBulkImport}
                  disabled={isBulkImporting || detectedLineCount === 0}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 text-white font-bold text-[11px] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-950/40"
                >
                  <Layers className="w-3.5 h-3.5" />
                  {isBulkImporting ? 'Mengimport…' : `Import Bulk (${detectedLineCount} Wallet)`}
                </button>
              </div>
            )}
          </div>

          {/* Wallet List */}
          <div className="flex-1 min-h-0 rounded-2xl bg-[#070d1a] border border-purple-500/20 p-3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <span className="text-[11px] font-bold text-white">DAFTAR WALLET INFLUENCER</span>
              </div>
              <span className="text-[10px] text-purple-400 font-bold">{wallets.length} wallet</span>
            </div>

            {wallets.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <Users className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-slate-500 text-[11px] font-bold">Belum ada wallet yang dimonitor</p>
                <p className="text-slate-600 text-[10px] mt-1">Tambahkan wallet influencer di atas</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin pr-1">
                {wallets.map((wallet) => {
                  const winRate = wallet.totalCopied > 0
                    ? Math.round((wallet.winCount / wallet.totalCopied) * 100)
                    : 0;
                  return (
                    <div
                      key={wallet.address}
                      className={`rounded-xl border p-2.5 transition-all ${wallet.isActive
                          ? 'bg-[#060a14] border-slate-700/60 hover:border-purple-500/50'
                          : 'bg-[#04070e] border-slate-800/40 opacity-50'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${wallet.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-white truncate">{wallet.label}</p>
                            <p className="text-[9.5px] text-slate-500 font-mono">{shortAddr(wallet.address)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Toggle Active */}
                          <button
                            onClick={() => handleToggleWallet(wallet.address, wallet.isActive)}
                            title={wallet.isActive ? 'Pause monitoring' : 'Resume monitoring'}
                            className={`p-1.5 rounded-lg border text-xs transition-all ${wallet.isActive
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                : 'bg-slate-800 border-slate-700 text-slate-500'
                              }`}
                          >
                            {wallet.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => handleRemoveWallet(wallet.address)}
                            title="Hapus wallet"
                            className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Mini stats */}
                      <div className="mt-2 grid grid-cols-4 gap-1 text-[9px] bg-white/[0.02] rounded-lg p-1 text-center border border-white/5">
                        <div>
                          <span className="text-slate-500 block">Copied</span>
                          <span className="text-cyan-300 font-bold">{wallet.totalCopied}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Win</span>
                          <span className="text-emerald-400 font-bold">{wallet.winCount}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Loss</span>
                          <span className="text-rose-400 font-bold">{wallet.lossCount}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Win%</span>
                          <span className="text-purple-300 font-bold">{winRate}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Live Copy Trade Activity Feed */}
        <div className="col-span-12 lg:col-span-7 rounded-2xl bg-[#070d1a] border border-purple-500/20 p-3 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-[11px] font-bold text-white tracking-wide">LIVE COPY TRADE ACTIVITY</span>
              <span className="px-1.5 py-0.5 rounded-full bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 text-[9px] font-bold">
                MONITORING
              </span>
            </div>
            <span className="text-[10px] text-slate-500">{visibleActivity.length} events</span>
          </div>

          {/* Sub-header info */}
          <div className="flex-shrink-0 text-[9.5px] text-slate-500 mb-2 px-1 flex items-center justify-between">
            <span>● ACTIVE | Delay: {copyConfig.copyDelayMs}ms | Max: {copyConfig.maxCopyAmountSol} SOL | Mode: {copyConfig.copyMode} | Skip dup: {copyConfig.skipIfPositionExists ? 'YES' : 'NO'}</span>
          </div>

          {visibleActivity.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <Clock className="w-10 h-10 text-slate-700 mb-3 animate-spin" style={{ animationDuration: '10s' }} />
              <p className="text-slate-500 text-[11px] font-bold">Menunggu transaksi yang di-copy…</p>
              <p className="text-slate-600 text-[10px] mt-1">Bot mengeksekusi otomatis ketika wallet influencer melakukan BUY</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin pr-1">
              {visibleActivity.map((item) => {
                const sc = statusConfig[item.copyStatus] || statusConfig.DETECTED;
                const StatusIcon = sc.Icon;
                const isBuy = item.action === 'BUY';

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-2.5 transition-all text-[11px] ${item.copyStatus === 'COPIED'
                        ? 'bg-emerald-950/20 border-emerald-500/30 shadow-sm'
                        : item.copyStatus === 'FAILED'
                          ? 'bg-rose-950/20 border-rose-500/30'
                          : item.copyStatus === 'COPYING'
                            ? 'bg-cyan-950/20 border-cyan-500/30 animate-pulse'
                            : 'bg-[#060a14] border-slate-800'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">

                      {/* Action + Token + Influencer */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${isBuy
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                            }`}
                        >
                          {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {item.action}
                        </span>

                        <div className="min-w-0">
                          <span className="font-black text-white text-[12px] tracking-tight">
                            ${item.tokenSymbol || 'TOKEN'}
                          </span>
                          {item.tokenName && item.tokenName !== 'Unknown' && (
                            <span className="text-slate-500 text-[10px] ml-1 truncate">
                              {item.tokenName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Badge + Time */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-bold border ${sc.bg} ${sc.color}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {item.copyStatus}
                        </span>

                        <span className="text-slate-500 text-[9.5px] font-mono">
                          {new Date(item.detectedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {/* Second Row: Influencer Wallet, Mint, SOL amount, Explorer Link */}
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 flex-wrap gap-1 pt-1 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-purple-400 font-bold">{item.walletLabel || shortAddr(item.walletAddress)}</span>
                        <span className="text-slate-600">→</span>
                        <span className="font-mono text-slate-400">{shortAddr(item.tokenMint)}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-cyan-300 font-mono font-bold">{item.solAmount.toFixed(3)} SOL</span>
                      </div>

                      {item.skipReason && (
                        <span className="text-slate-500 text-[9px] italic">
                          ({item.skipReason})
                        </span>
                      )}

                      {item.txSignature && (
                        <a
                          href={`https://solscan.io/tx/${item.txSignature}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-500 hover:text-purple-400 text-[9px] font-mono transition-colors"
                        >
                          Solscan ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={activityEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
