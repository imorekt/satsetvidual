import React, { useState } from 'react';
import { X, Save, Sliders } from 'lucide-react';
import { BotConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig | null;
  onSave: (updated: Partial<BotConfig>) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  if (!isOpen || !config) return null;

  const [buyAmountSol, setBuyAmountSol] = useState(config.buyAmountSol);
  const [slippageBps, setSlippageBps] = useState(config.slippageBps);
  const [maxOpenPositions, setMaxOpenPositions] = useState(config.maxOpenPositions || 5);
  const [takeProfitMultiplier, setTakeProfitMultiplier] = useState(config.takeProfitMultiplier);
  const [stopLossPercent, setStopLossPercent] = useState(config.stopLossPercent);
  const [minNarrativeScore, setMinNarrativeScore] = useState(config.minNarrativeScore);
  const [minHoldersCount, setMinHoldersCount] = useState(config.minHoldersCount ?? 30);
  const [maxTokenAgeSeconds, setMaxTokenAgeSeconds] = useState(config.maxTokenAgeSeconds ?? 300);
  const [maxDevHoldingPercent, setMaxDevHoldingPercent] = useState(config.maxDevHoldingPercent ?? 0.0);
  const [maxTop10HoldingPercent, setMaxTop10HoldingPercent] = useState(config.maxTop10HoldingPercent ?? 30.0);
  const [jitoTipSol, setJitoTipSol] = useState(config.jitoTipSol || 0.001);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
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
      });
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="glass-panel p-6 rounded-2xl border border-cyber-border max-w-lg w-full relative shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyber-neonCyan" />
            <h3 className="text-base font-bold font-mono text-white uppercase">
              Trading Bot Parameters Config
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-2 gap-4">
            {/* Buy Amount SOL */}
            <div>
              <label className="block text-slate-300 mb-1">
                BUY_AMOUNT_SOL (per trade)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={buyAmountSol}
                onChange={(e) => setBuyAmountSol(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-cyber-bg border border-white/10 text-white focus:border-cyber-neonCyan focus:outline-none"
                required
              />
            </div>

            {/* Max Open Positions */}
            <div>
              <label className="block text-slate-300 mb-1">
                MAX_OPEN_POSITIONS (1-10)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="10"
                value={maxOpenPositions}
                onChange={(e) => setMaxOpenPositions(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl bg-cyber-bg border border-white/10 text-white focus:border-cyber-neonCyan focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Min Narrative Score */}
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>MIN_NARRATIVE_SCORE:</span>
              <span className="text-cyber-neonCyan font-bold">{minNarrativeScore.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="1.00"
              step="0.05"
              value={minNarrativeScore}
              onChange={(e) => setMinNarrativeScore(parseFloat(e.target.value))}
              className="w-full accent-cyber-neonCyan cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>0.10 (Aggressive)</span>
              <span>0.50 (Axiom Standard)</span>
              <span>1.00 (Ultra Viral)</span>
            </div>
          </div>

          {/* Axiom Pulse Audit Filters */}
          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 space-y-3">
            <div className="text-[11px] font-bold text-cyan-300 uppercase flex items-center gap-1.5">
              <span>🛡️ Axiom Pulse Audit & Traffic Filters</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Min Holders Count */}
              <div>
                <label className="block text-slate-300 mb-1">
                  MIN_HOLDERS_COUNT
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={minHoldersCount}
                  onChange={(e) => setMinHoldersCount(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-1.5 rounded-xl bg-cyber-bg border border-white/10 text-white focus:border-cyan-400 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Min 30 unique holders</span>
              </div>

              {/* Max Token Age Seconds */}
              <div>
                <label className="block text-slate-300 mb-1">
                  MAX_TOKEN_AGE (Sec)
                </label>
                <input
                  type="number"
                  step="10"
                  min="30"
                  value={maxTokenAgeSeconds}
                  onChange={(e) => setMaxTokenAgeSeconds(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-1.5 rounded-xl bg-cyber-bg border border-white/10 text-white focus:border-cyan-400 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">300s = Max 5 minutes</span>
              </div>

              {/* Zero Dev Holding Percent */}
              <div>
                <label className="block text-slate-300 mb-1">
                  MAX_DEV_HOLDING (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.0"
                  value={maxDevHoldingPercent}
                  onChange={(e) => setMaxDevHoldingPercent(parseFloat(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-xl bg-cyber-bg border border-white/10 text-white focus:border-cyan-400 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-emerald-400 mt-0.5 block">0.0% = Zero Dev Holding</span>
              </div>

              {/* Top 10 Holding Percent */}
              <div>
                <label className="block text-slate-300 mb-1">
                  MAX_TOP10_HOLDING (%)
                </label>
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="100"
                  value={maxTop10HoldingPercent}
                  onChange={(e) => setMaxTop10HoldingPercent(parseFloat(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-xl bg-cyber-bg border border-white/10 text-white focus:border-cyan-400 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Max 30% top 10 supply</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Take Profit Multiplier */}
            <div>
              <label className="block text-slate-300 mb-1">
                TAKE_PROFIT_MULTIPLIER
              </label>
              <input
                type="number"
                step="0.01"
                min="1.01"
                value={takeProfitMultiplier}
                onChange={(e) => setTakeProfitMultiplier(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-cyber-bg border border-white/10 text-white focus:border-cyber-neonCyan focus:outline-none"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">e.g. 1.08 = +8% (Scalp TP), 60.0 = +5900%</span>
            </div>

            {/* Stop Loss Percent */}
            <div>
              <label className="block text-slate-300 mb-1">
                STOP_LOSS_PERCENT (%)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="90"
                value={stopLossPercent}
                onChange={(e) => setStopLossPercent(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-cyber-bg border border-white/10 text-white focus:border-cyber-neonCyan focus:outline-none"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">e.g. 15 = exit at -15% loss</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Slippage BPS */}
            <div>
              <label className="block text-slate-300 mb-1">
                SLIPPAGE_BPS (Basis points)
              </label>
              <input
                type="number"
                step="50"
                min="50"
                max="5000"
                value={slippageBps}
                onChange={(e) => setSlippageBps(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl bg-cyber-bg border border-white/10 text-white focus:border-cyber-neonCyan focus:outline-none"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">500 bps = 5% slippage</span>
            </div>

            {/* Jito MEV Tip */}
            <div>
              <label className="block text-slate-300 mb-1">
                JITO_TIP_SOL (Validator Tip)
              </label>
              <input
                type="number"
                step="0.0005"
                min="0.0001"
                value={jitoTipSol}
                onChange={(e) => setJitoTipSol(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-cyber-bg border border-white/10 text-white focus:border-cyber-neonCyan focus:outline-none"
                required
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Anti-MEV sandwich protection</span>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-cyber-neonGreen text-black font-bold flex items-center gap-1.5 hover:bg-cyber-neonGreen/90 transition-all shadow-glow-green"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Apply Live Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
