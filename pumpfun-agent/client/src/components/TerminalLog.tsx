import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Trash2, ArrowDown } from 'lucide-react';
import { LogEntry } from '../types';

interface TerminalLogProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const TerminalLog: React.FC<TerminalLogProps> = ({ logs, onClearLogs }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'warn':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'success':
        return 'text-cyber-neonGreen bg-cyber-neonGreen/10 border-cyber-neonGreen/30';
      default:
        return 'text-cyber-neonCyan bg-cyber-neonCyan/10 border-cyber-neonCyan/30';
    }
  };

  return (
    <div className="glass-panel p-4 rounded-2xl border border-cyber-border h-full flex flex-col font-mono">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/5 mb-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <TerminalIcon className="w-4 h-4 text-cyber-neonCyan" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Live Streaming Terminal Console
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
              autoScroll 
                ? 'bg-cyber-neonGreen/15 text-cyber-neonGreen border-cyber-neonGreen/30' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <ArrowDown className="w-2.5 h-2.5" />
            Auto-Scroll
          </button>

          <button
            onClick={onClearLogs}
            className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
            title="Clear Console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto max-h-[380px] bg-black/60 rounded-xl p-3 text-[11px] space-y-1.5 border border-white/5"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 text-center py-6">
            Connecting to agent log stream...
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 leading-relaxed break-all">
              <span className="text-slate-500 select-none flex-shrink-0 text-[10px]">
                {log.timestamp.slice(11, 23)}
              </span>
              <span className={`px-1 rounded text-[9px] font-bold border uppercase flex-shrink-0 ${getLevelColor(log.level)}`}>
                {log.level.padEnd(5)}
              </span>
              <span className="text-slate-200">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
