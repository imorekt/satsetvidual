import React from 'react';
import { 
  Radar, 
  ShieldAlert, 
  Zap, 
  Activity, 
  Target, 
  AlertTriangle, 
  Clock,
  Sparkles
} from 'lucide-react';
import { AgentStatus } from '../types';

interface AgentStatusGridProps {
  agents: Record<string, AgentStatus>;
  selectedAgent1Model?: string;
  onSelectAgent1Model?: (modelId: string) => void;
  selectedAgent2Model?: string;
  onSelectAgent2Model?: (modelId: string) => void;
}

export const AgentStatusGrid: React.FC<AgentStatusGridProps> = ({ 
  agents, 
  selectedAgent1Model = 'openrouter-nex',
  onSelectAgent1Model,
  selectedAgent2Model = 'openrouter-nex',
  onSelectAgent2Model,
}) => {
  const getModelLabel = () => {
    switch (selectedAgent1Model) {
      case 'openrouter-nex': return 'NEX-AGI Free';
      case 'anymodel-glm': return 'GLM 5.3 Flash';
      default: return 'DeepSeek V4';
    }
  };

  const getAgent2ModelLabel = () => {
    switch (selectedAgent2Model) {
      case 'openrouter-nex': return 'NEX-AGI Free';
      case 'anymodel-glm': return 'GLM 5.3 Flash';
      default: return 'Claude Sonnet 4.6';
    }
  };

  const agentList = [
    {
      id: 'scanner',
      title: 'A1 • SCANNER',
      name: 'Narrative Evaluator',
      modelName: getModelLabel(),
      role: 'Stream Filter & Narrative >= 0.70',
      icon: Radar,
      color: 'text-cyan-400',
      borderActive: 'border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.25)]',
      borderStandby: 'border-cyan-500/20',
      headerBg: 'bg-cyan-950/40',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      defaultState: 'SCANNING',
      defaultDetail: `${getModelLabel()} analyzing meme momentum (Threshold >= 0.70)...`,
    },
    {
      id: 'auditor',
      title: 'A2 • AUDITOR',
      name: 'Anti-Rug Strict',
      modelName: getAgent2ModelLabel(),
      role: 'Dev<5% | Top10<20% | LP>95%',
      icon: ShieldAlert,
      color: 'text-rose-400',
      borderActive: 'border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.25)]',
      borderStandby: 'border-rose-500/20',
      headerBg: 'bg-rose-950/40',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      defaultState: 'IDLE',
      defaultDetail: `${getAgent2ModelLabel()} armed for 5-Rule Strict Kill-Vote veto`,
    },
    {
      id: 'execution',
      title: 'A3 • MEV WARP',
      name: 'Execution Engine',
      modelName: 'Grok 4.6',
      role: 'Max 10% Sizing (0.10 SOL) Jito',
      icon: Zap,
      color: 'text-emerald-400',
      borderActive: 'border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.25)]',
      borderStandby: 'border-emerald-500/20',
      headerBg: 'bg-emerald-950/40',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      defaultState: 'IDLE',
      defaultDetail: 'Grok 4.6 calculating 10% sizing & Jito bundle routing',
    },
    {
      id: 'tracker',
      title: 'A4 • SONAR',
      name: 'Whale Outflow Radar',
      modelName: 'Kimi K3',
      role: '1s Ticks & Drop > 5% Alert',
      icon: Activity,
      color: 'text-amber-400',
      borderActive: 'border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.25)]',
      borderStandby: 'border-amber-500/20',
      headerBg: 'bg-amber-950/40',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      defaultState: 'IDLE',
      defaultDetail: 'Kimi K3 monitoring 1000ms bonding curve liquidity reserves',
    },
    {
      id: 'exit',
      title: 'A5 • EXIT SNIPER',
      name: 'Risk 1:2 R:R Engine',
      modelName: 'Claude Opus 4.8',
      role: 'TP: +20% | SL: -10% Lock',
      icon: Target,
      color: 'text-purple-400',
      borderActive: 'border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.25)]',
      borderStandby: 'border-purple-500/20',
      headerBg: 'bg-purple-950/40',
      badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      defaultState: 'IDLE',
      defaultDetail: 'Claude Opus 4.8 active 1:2 R:R profit lock & emergency triggers',
    },
  ];

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'SCANNING':
      case 'TRACKING':
      case 'BUYING':
      case 'AUDITING':
      case 'EXITING':
        return (
          <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            {state}
          </span>
        );
      case 'PAUSED':
        return (
          <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
            <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
            PAUSED
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700">
            <Clock className="w-2.5 h-2.5" />
            STANDBY
          </span>
        );
    }
  };

  return (
    <div className="w-full font-mono select-none">
      {/* 5-Agent Concurrency Pro Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 w-full">
        {agentList.map((meta) => {
          const liveAgent = agents[meta.id];
          const state = liveAgent ? liveAgent.state : meta.defaultState;
          const detail = liveAgent ? liveAgent.detail : meta.defaultDetail;
          const Icon = meta.icon;
          const isActive = state !== 'IDLE' && state !== 'STANDBY';

          return (
            <div
              key={meta.id}
              className={`bg-[#060b18]/90 backdrop-blur-md rounded-xl p-2 border transition-all duration-300 flex flex-col justify-between ${
                isActive ? meta.borderActive : meta.borderStandby
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-1 mb-1 border-b border-white/5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`p-1 rounded-md ${meta.headerBg} border border-white/5 ${meta.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] font-black text-slate-200 uppercase tracking-wider truncate">
                      {meta.title}
                    </span>
                  </div>
                  {getStateBadge(state)}
                </div>

                {/* Subtitle / Model Bar */}
                <div className="mb-1">
                  {meta.id === 'scanner' ? (
                    <div className="flex items-center gap-1 bg-black/50 border border-cyan-500/30 rounded px-1.5 py-0.5">
                      <span className="text-[7.5px] text-cyan-400 font-bold uppercase flex-shrink-0">A1:</span>
                      <select
                        value={selectedAgent1Model}
                        onChange={(e) => onSelectAgent1Model?.(e.target.value)}
                        className="w-full bg-transparent text-cyan-300 text-[8.5px] font-mono outline-none cursor-pointer"
                      >
                        <option value="openrouter-nex">NEX-AGI Free (OpenRouter)</option>
                        <option value="anymodel-deepseek">DeepSeek V4 (anymodel)</option>
                        <option value="anymodel-glm">GLM 5.3 (anymodel)</option>
                      </select>
                    </div>
                  ) : meta.id === 'auditor' ? (
                    <div className="flex items-center gap-1 bg-black/50 border border-rose-500/30 rounded px-1.5 py-0.5">
                      <span className="text-[7.5px] text-rose-400 font-bold uppercase flex-shrink-0">A2:</span>
                      <select
                        value={selectedAgent2Model}
                        onChange={(e) => onSelectAgent2Model?.(e.target.value)}
                        className="w-full bg-transparent text-rose-300 text-[8.5px] font-mono outline-none cursor-pointer"
                      >
                        <option value="openrouter-nex">NEX-AGI Free (OpenRouter)</option>
                        <option value="anymodel-claude">Claude Sonnet 4.6 (anymodel)</option>
                        <option value="anymodel-glm">GLM 5.3 (anymodel)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[8.5px] text-slate-400 bg-black/30 border border-white/5 rounded px-1.5 py-0.5">
                      <span className="text-slate-300 font-bold flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                        {meta.modelName}
                      </span>
                      <span className="text-[8px] text-slate-500">{meta.name}</span>
                    </div>
                  )}
                </div>

                {/* Role Description */}
                <p className="text-[8.5px] text-slate-400 truncate mb-1">
                  {meta.role}
                </p>
              </div>

              {/* Live Synchronized Telemetry Message */}
              <div className="p-1 rounded bg-black/40 border border-white/5 text-[8.5px] text-slate-300 leading-tight">
                <p className="line-clamp-1 truncate text-slate-300 font-mono">
                  {detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

