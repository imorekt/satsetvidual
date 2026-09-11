import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ExternalLink, 
  Copy, 
  Target, 
  ShieldAlert,
  Flame,
  Sparkles,
  Zap,
  Layers
} from 'lucide-react';
import { IPositionState, PricePoint, BotConfig } from '../types';
import { PnLChart } from './PnLChart';

interface ActivePositionHeroProps {
  position: IPositionState | null;
  positions?: IPositionState[];
  selectedMint?: string | null;
  onSelectPosition?: (mint: string) => void;
  priceHistory: PricePoint[];
  config: BotConfig | null;
  onEmergencySell: (tokenAddress?: string) => void;
}

export const ActivePositionHero: React.FC<ActivePositionHeroProps> = ({
  position,
  positions = [],
  selectedMint,
  onSelectPosition,
  priceHistory,
  config,
  onEmergencySell,
}) => {
  const [copied, setCopied] = useState(false);

  // If positions array provided and has items, pick the selected one or position or first
  const activeList = positions.length > 0 ? positions : (position ? [position] : []);
  const activePos = (selectedMint ? activeList.find((p) => p.tokenAddress === selectedMint) : null) || position || activeList[0] || null;

  const handleCopyMint = (mint: string) => {
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!activePos) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-cyber-border mb-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
        <div className="w-16 h-16 rounded-2xl bg-cyber-neonCyan/5 border border-cyber-neonCyan/20 flex items-center justify-center mb-3">
          <div className="w-6 h-6 rounded-full border-2 border-cyber-neonCyan border-t-transparent animate-spin" />
        </div>
        <h3 className="text-base font-bold font-mono text-white mb-1">
          NO ACTIVE TRADING POSITIONS (0/{config?.maxOpenPositions || 5})
        </h3>
        <p className="text-xs text-slate-400 max-w-md mb-3">
          Agen 1: Scanner is polling live pump.fun feed. Multi-Position Engine is armed for up to {config?.maxOpenPositions || 5} concurrent trades. Once viral tokens pass Agen 2 audit, Agen 3 opens positions here.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-slate-500">
          <span>Max Concurrent: {config?.maxOpenPositions || 5}</span>
          <span>•</span>
          <span>Buy Size: {config?.buyAmountSol || 0.10} SOL</span>
          <span>•</span>
          <span>TP Target: {config?.takeProfitMultiplier || 1.08}x (+8%)</span>
          <span>•</span>
          <span>SL Limit: -{config?.stopLossPercent || 4.0}%</span>
        </div>
      </div>
    );
  }

  const isProfit = (activePos.pnlPercent || 0) >= 0;
  const gainMultiplier = (activePos.gainMultiplier || (activePos.entryPriceSol > 0 ? activePos.currentPriceSol / activePos.entryPriceSol : 1.0)).toFixed(2);
  const formattedTokenAmount = (Number(activePos.amountToken || 0) / 1e6).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

  const entryPrice = activePos.entryPriceSol || 0.000001;
  const currentPrice = activePos.currentPriceSol || entryPrice;
  const peakPrice = activePos.peakPriceSol || currentPrice;
  const tpTargetPrice = entryPrice * (config?.takeProfitMultiplier || 1.08);
  const slTargetPrice = entryPrice * (1 - (config?.stopLossPercent || 4.0) / 100);

  const formatSolPrice = (val: number | undefined | null, digits = 4): string => {
    if (val === undefined || val === null || isNaN(val) || val <= 0) return '0.0000 SOL';
    if (val < 0.0001) {
      try { return `${val.toExponential(digits)} SOL`; } catch { return `${val} SOL`; }
    }
    return `${val.toFixed(digits)} SOL`;
  };

  return (
    <div className={`glass-panel p-5 rounded-2xl border mb-6 relative overflow-hidden transition-all duration-300 ${
      activePos.isWhaleDump
        ? 'border-rose-500/80 shadow-glow-pink animate-pulse bg-rose-950/20'
        : isProfit
        ? 'border-cyber-neonGreen/40 shadow-glow-green'
        : 'border-cyber-neonPink/40 shadow-glow-pink'
    }`}>
      {/* Multi-Position Tab Bar (Up to 5 concurrent positions) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyber-neonCyan/10 border border-cyber-neonCyan/30 text-cyber-neonCyan font-mono text-xs font-bold">
            <Layers className="w-3.5 h-3.5" />
            <span>POSITIONS: {activeList.length}/{config?.maxOpenPositions || 5}</span>
          </div>

          {/* Position Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {activeList.map((pos) => {
              const isSelected = pos.tokenAddress === activePos.tokenAddress;
              const posGain = (pos.pnlPercent || 0) >= 0;
              return (
                <button
                  key={pos.tokenAddress}
                  onClick={() => onSelectPosition && onSelectPosition(pos.tokenAddress)}
                  className={`px-3 py-1 rounded-lg font-mono text-xs flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-cyber-neonCyan/20 text-white border border-cyber-neonCyan shadow-glow-cyan font-bold'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'
                  }`}
                >
                  <span>${pos.symbol}</span>
                  <span className={posGain ? 'text-cyber-neonGreen text-[10px]' : 'text-cyber-neonPink text-[10px]'}>
                    {posGain ? '+' : ''}{(pos.pnlPercent || 0).toFixed(1)}%
                  </span>
                  {pos.isTrailingLockActive && <span title="Trailing Lock Active" className="text-[10px]">🔒</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Button: Emergency Sell */}
        <button
          onClick={() => onEmergencySell(activePos.tokenAddress)}
          className="btn-danger flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg"
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Jito Emergency Dump</span>
        </button>
      </div>

      {/* Main Token Info Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyber-neonPink to-cyber-neonCyan p-0.5 flex-shrink-0">
            <div className="w-full h-full bg-cyber-darker rounded-[10px] flex items-center justify-center font-bold text-white text-lg">
              ${activePos.symbol.slice(0, 2)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono text-white tracking-wider">${activePos.symbol}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/5 text-slate-400 border border-white/10">
                Pump.fun Live
              </span>
              {activePos.isCopyTrade && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                  AUTO COPY TRADE
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-1">
              <span>{activePos.tokenAddress.slice(0, 8)}...{activePos.tokenAddress.slice(-6)}</span>
              <button 
                onClick={() => handleCopyMint(activePos.tokenAddress)}
                className="hover:text-cyber-neonCyan transition-colors"
                title="Copy Mint Address"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <a
                href={`https://pump.fun/${activePos.tokenAddress}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-cyber-neonCyan transition-colors"
                title="View on pump.fun"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              {copied && <span className="text-[10px] text-cyber-neonGreen">Copied!</span>}
            </div>
          </div>
        </div>

        {/* Live PnL Pill */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-mono block">UNREALIZED PnL</span>
            <div className="flex items-center justify-end gap-1.5 font-mono">
              {isProfit ? (
                <TrendingUp className="w-5 h-5 text-cyber-neonGreen" />
              ) : (
                <TrendingDown className="w-5 h-5 text-cyber-neonPink" />
              )}
              <span className={`text-2xl font-bold ${
                isProfit ? 'text-cyber-neonGreen text-glow-green' : 'text-cyber-neonPink text-glow-pink'
              }`}>
                {isProfit ? '+' : ''}{(activePos.pnlPercent || 0).toFixed(2)}%
              </span>
            </div>
            <span className={`text-xs font-mono block ${isProfit ? 'text-cyber-neonGreen' : 'text-cyber-neonPink'}`}>
              {isProfit ? '+' : ''}{(activePos.pnlSol || 0).toFixed(4)} SOL ({gainMultiplier}x)
            </span>
          </div>
        </div>
      </div>

      {/* Grid Stats & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        {/* Metric Cards */}
        <div className="flex flex-col justify-between gap-3">
          <div className="grid grid-cols-2 gap-3 font-mono">
            <div className="p-3 rounded-xl bg-cyber-bg/70 border border-white/5">
              <span className="text-[10px] text-slate-400 block mb-1">ENTRY PRICE</span>
              <span className="text-xs font-bold text-white block truncate">
                {formatSolPrice(entryPrice, 4)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-cyber-bg/70 border border-white/5">
              <span className="text-[10px] text-slate-400 block mb-1">CURRENT PRICE</span>
              <span className="text-xs font-bold text-cyber-neonCyan block truncate">
                {formatSolPrice(currentPrice, 4)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-cyber-bg/70 border border-white/5">
              <span className="text-[10px] text-slate-400 block mb-1">HOLDINGS</span>
              <span className="text-xs font-bold text-white block truncate">
                {formattedTokenAmount} tokens
              </span>
            </div>

            <div className="p-3 rounded-xl bg-cyber-bg/70 border border-white/5">
              <span className="text-[10px] text-slate-400 block mb-1">ΔSOL CURVE RADAR</span>
              <span className={`text-xs font-bold block truncate ${
                (activePos.solDeltaPercent || 0) <= -5.0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
              }`}>
                {(activePos.solDeltaPercent || 0) >= 0 ? '+' : ''}{(activePos.solDeltaPercent || 0).toFixed(2)}%
              </span>
            </div>

            <div className="p-3 rounded-xl bg-cyber-bg/70 border border-white/5">
              <span className="text-[10px] text-slate-400 block mb-1">PEAK PRICE</span>
              <span className="text-xs font-bold text-amber-400 block truncate">
                {formatSolPrice(peakPrice, 4)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-cyber-bg/70 border border-white/5">
              <span className="text-[10px] text-slate-400 block mb-1">EXIT STATUS</span>
              <span className="text-xs font-bold text-cyber-neonCyan block truncate">
                {activePos.exitReason || 'NONE'}
              </span>
            </div>
          </div>

          {/* Trigger Targets */}
          <div className="p-3 rounded-xl bg-cyber-bg/80 border border-white/5 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 text-cyber-neonGreen">
                <Target className="w-3.5 h-3.5" />
                Take Profit Target (+8% / {config?.takeProfitMultiplier || 1.08}x):
              </span>
              <span className="font-bold">{formatSolPrice(tpTargetPrice, 3)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 text-rose-400">
                <ShieldAlert className="w-3.5 h-3.5" />
                Stop Loss Barrier (-{config?.stopLossPercent || 4.0}%):
              </span>
              <span className="font-bold">{formatSolPrice(slTargetPrice, 3)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-white/5">
              <span>3s Momentum Guard:</span>
              <span className={activePos.hasExternalBuyerVolume ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {activePos.hasExternalBuyerVolume ? 'Buyer Confirmed ✓' : `${activePos.momentumTimerSeconds || 0}s Countdown`}
              </span>
            </div>

            {activePos.aiTrackerSentiment && (
              <div className="p-2 rounded-lg bg-cyber-neonCyan/10 border border-cyber-neonCyan/30 text-[10px] text-cyber-neonCyan flex items-center gap-1.5 font-mono">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-cyber-neonCyan" />
                <span className="truncate">Kimi K3: {activePos.aiTrackerSentiment}</span>
              </div>
            )}

            {activePos.aiExecutionPlan && (
              <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/30 text-[10px] text-purple-300 flex items-center gap-1.5 font-mono">
                <Zap className="w-3.5 h-3.5 flex-shrink-0 text-purple-400" />
                <span className="truncate">Grok 4.6: {activePos.aiExecutionPlan}</span>
              </div>
            )}
          </div>

          {/* Instant Panic Dump Button for this token */}
          <button
            onClick={() => onEmergencySell(activePos.tokenAddress)}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-glow-pink transition-all"
          >
            <Flame className="w-4 h-4 fill-current" />
            <span>FLASH EXIT ${activePos.symbol} NOW</span>
          </button>
        </div>

        {/* Live Recharts PnL Graph */}
        <div className="lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono font-bold uppercase text-slate-400">
              Live PnL Sparkline (${activePos.symbol})
            </span>
            <span className="text-[10px] font-mono text-cyber-neonGreen flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-neonGreen animate-pulse" />
              LIVE TICK
            </span>
          </div>

          <PnLChart data={priceHistory} />
        </div>
      </div>
    </div>
  );
};
