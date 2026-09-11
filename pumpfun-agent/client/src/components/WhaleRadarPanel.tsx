import React from 'react';
import { ShieldAlert, AlertTriangle, Radio } from 'lucide-react';
import { IWhaleAlert } from '../types';

interface WhaleRadarPanelProps {
  alerts: IWhaleAlert[];
}

export const WhaleRadarPanel: React.FC<WhaleRadarPanelProps> = ({ alerts }) => {
  if (alerts.length === 0) {
    return (
      <div className="glass-panel p-4 rounded-2xl border border-cyber-border mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyber-neonGreen animate-pulse" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Whale Radar & Front-Run Protection
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyber-neonGreen/10 text-cyber-neonGreen border border-cyber-neonGreen/30">
            NO DUMP ACTIVITY DETECTED
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel-danger p-4 rounded-2xl border mb-6 animate-pulse">
      <div className="flex items-center justify-between pb-3 border-b border-rose-500/20 mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-500" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-300">
            Whale Dump Alert! Emergency Exit Triggered
          </h3>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/40">
          FRONT-RUNNING CASCADE
        </span>
      </div>

      <div className="space-y-2">
        {alerts.map((alert, idx) => (
          <div
            key={idx}
            className="p-2.5 rounded-xl bg-black/40 border border-rose-500/30 flex items-center justify-between font-mono text-xs"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span className="font-bold text-white">${alert.symbol}</span>
              <span className="text-slate-400">
                Whale: {alert.whaleAddress.slice(0, 6)}...{alert.whaleAddress.slice(-4)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-rose-400 font-bold">
                -{alert.percentOfSupply.toFixed(1)}% Supply Dumped
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
