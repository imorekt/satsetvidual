import React from 'react';
import { 
  Play, 
  Pause, 
  Flame, 
  Settings as SettingsIcon, 
  Zap, 
  ShieldCheck, 
  Wallet,
  Radio,
  FileText,
  Plus,
  Copy
} from 'lucide-react';
import { BotConfig } from '../types';

interface HeaderControlsProps {
  isScanning: boolean;
  onToggleScan: () => void;
  dryRunMode: boolean;
  onToggleDryRun: () => void;
  onEmergencySell: () => void;
  onOpenSettings: () => void;
  onOpenDeposit?: () => void;
  walletBalance: number | string;
  isConnected: boolean;
  config: BotConfig | null;
  hasActivePosition: boolean;
  currentView: 'moonshot' | 'live' | 'notepad' | 'copytrade';
  onSelectView: (view: 'moonshot' | 'live' | 'notepad' | 'copytrade') => void;
}

export const HeaderControls: React.FC<HeaderControlsProps> = ({
  isScanning,
  onToggleScan,
  dryRunMode,
  onToggleDryRun,
  onEmergencySell,
  onOpenSettings,
  onOpenDeposit,
  walletBalance,
  isConnected,
  hasActivePosition,
  currentView,
  onSelectView,
}) => {
  return (
    <header className="w-full px-2.5 sm:px-3 py-1.5 border-b border-white/10 bg-[#070c18]/95 backdrop-blur-xl z-50 flex-shrink-0 overflow-x-auto scrollbar-none">
      <div className="w-full min-w-max flex items-center justify-between gap-2.5">
        {/* Left: Brand & Connection Status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 via-emerald-500 to-cyan-500 p-[1.5px] shadow-glow-cyan">
            <div className="w-full h-full bg-[#060913] rounded-[7px] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <h1 className="text-xs sm:text-sm font-black tracking-tight text-white font-mono">
              PUMP.FUN <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400">MULTI-AGENT AI</span>
            </h1>
            <span className="text-[8.5px] uppercase font-bold px-1 py-0.5 rounded border border-slate-700 bg-slate-800/80 text-slate-300 font-mono">
              v2.5
            </span>
          </div>

          <div className="hidden 2xl:flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-slate-800 bg-[#070d1a] text-[9.5px] font-mono text-slate-300">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span>{isConnected ? 'LIVE FEED: ON' : 'DISCONNECTED'}</span>
          </div>
        </div>

        {/* Center: Unified Tab Switcher */}
        <div className="flex items-center p-0.5 rounded-xl bg-black/60 border border-cyan-500/30 font-mono text-[10.5px] shadow-lg shadow-cyan-950/40 flex-shrink-0">
          <button
            onClick={() => onSelectView('moonshot')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold tracking-wide whitespace-nowrap transition-all ${
              currentView === 'moonshot'
                ? 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3 h-3 flex-shrink-0" />
            <span>60s MOONSHOT</span>
          </button>
          <button
            onClick={() => onSelectView('live')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold tracking-wide whitespace-nowrap transition-all ${
              currentView === 'live'
                ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3 h-3 flex-shrink-0" />
            <span>5-AGENT FEED</span>
          </button>
          <button
            id="copytrade-tab-btn"
            onClick={() => onSelectView('copytrade')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold tracking-wide whitespace-nowrap transition-all ${
              currentView === 'copytrade'
                ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.45)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Copy className="w-3 h-3 flex-shrink-0" />
            <span>COPY TRADE</span>
          </button>
          <button
            onClick={() => onSelectView('notepad')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold tracking-wide whitespace-nowrap transition-all ${
              currentView === 'notepad'
                ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 text-white shadow-[0_0_12px_rgba(236,72,153,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3 h-3 flex-shrink-0" />
            <span>AUDIT NOTEPAD</span>
          </button>
        </div>

        {/* Right: Action Controls & Status */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Mode Badge (Real vs Paper Trading) */}
          <button
            id="mode-toggle-btn"
            onClick={onToggleDryRun}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[10px] font-bold border transition-all ${
              dryRunMode
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                : 'border-rose-500/60 bg-rose-500/20 text-rose-300 shadow-glow-pink animate-pulse'
            }`}
            title="Toggle between Dry-Run Simulation and Real Mainnet Trading"
          >
            <ShieldCheck className="w-3 h-3" />
            <span>{dryRunMode ? 'PAPER (DRY-RUN)' : 'LIVE SOL REAL'}</span>
          </button>

          {/* Bot Start / Pause Toggle Switch */}
          <button
            id="bot-toggle-btn"
            onClick={onToggleScan}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-all border ${
              isScanning
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-amber-500/20 border-amber-500/60 text-amber-300 hover:bg-amber-500/30 ring-1 ring-amber-500/40'
            }`}
          >
            {isScanning ? (
              <>
                <Pause className="w-2.5 h-2.5 fill-current" />
                <span>ACTIVE</span>
              </>
            ) : (
              <>
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>START</span>
              </>
            )}
          </button>

          {/* Emergency Sell All */}
          <button
            id="emergency-sell-btn"
            onClick={onEmergencySell}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[10px] font-bold transition-all border ${
              hasActivePosition
                ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white border-red-400 shadow-glow-pink hover:from-red-500 hover:to-rose-600 cursor-pointer animate-pulse'
                : 'bg-rose-950/30 text-rose-400/80 border-rose-900/50 hover:bg-rose-900/40'
            }`}
            title="Liquidate 100% of open positions immediately"
          >
            <Flame className="w-2.5 h-2.5" />
            <span>SELL ALL</span>
          </button>

          {/* Wallet Balance with + Button */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-cyan-300 font-mono text-[10px]">
            <Wallet className="w-3 h-3 text-cyan-400 flex-shrink-0" />
            <span>{typeof walletBalance === 'number' ? `${walletBalance.toFixed(3)} SOL` : walletBalance}</span>
            {onOpenDeposit && (
              <button
                onClick={onOpenDeposit}
                className="flex items-center justify-center w-3.5 h-3.5 rounded bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/50 ml-0.5 transition-all"
                title="Deposit / Tambah SOL"
              >
                <Plus className="w-2 h-2" />
              </button>
            )}
          </div>

          {/* Settings */}
          <button
            id="open-settings-btn"
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-cyan-300 transition-all"
            title="Open Config Settings"
          >
            <SettingsIcon className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
};
