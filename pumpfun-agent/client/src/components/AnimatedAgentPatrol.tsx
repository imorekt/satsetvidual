import React from 'react';
import { motion } from 'framer-motion';
import { 
  Radar, 
  ShieldCheck, 
  Zap, 
  Activity, 
  Target, 
  Lock, 
  Cpu, 
  Sparkles 
} from 'lucide-react';

export interface AnimatedAgentPatrolProps {
  selectedAgent1Model?: string;
  onSelectAgent1Model?: (id: string) => void;
  selectedAgent2Model?: string;
  onSelectAgent2Model?: (id: string) => void;
  agentStates?: {
    scanner?: string;
    auditor?: string;
    execution?: string;
    tracker?: string;
    exit?: string;
  };
}

export const AnimatedAgentPatrol: React.FC<AnimatedAgentPatrolProps> = ({
  selectedAgent1Model = 'openrouter-nex',
  onSelectAgent1Model,
  selectedAgent2Model = 'openrouter-nex',
  onSelectAgent2Model,
  agentStates = {},
}) => {
  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 font-mono select-none">
      {/* ========================================================================= */}
      {/* AGENT 1: RADAR CYBER-SCOUT DRONE */}
      {/* ========================================================================= */}
      <div className="relative group bg-[#070e1e]/90 border border-cyan-500/30 hover:border-cyan-400/70 rounded-xl p-2.5 flex flex-col justify-between overflow-hidden shadow-lg shadow-cyan-950/40 transition-all duration-300">
        {/* Ambient background grid & glow */}
        <div className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:12px_12px] opacity-10 pointer-events-none" />
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />

        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-cyan-500/20 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                A1 • Cyber Scout
              </span>
            </div>
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 animate-pulse">
              {agentStates.scanner || 'PATROL ACTIVE'}
            </span>
          </div>

          {/* Animated Robot Visual Container */}
          <div className="relative w-full h-20 bg-gradient-to-b from-[#040814] to-[#081329] rounded-lg border border-cyan-500/20 flex items-center justify-center overflow-hidden mb-2">
            {/* Animated Radar Scanning Sweeper */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3.5, ease: 'linear' }}
              className="absolute w-28 h-28 rounded-full border border-cyan-500/20 flex items-center justify-center pointer-events-none"
            >
              <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400/40 to-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            </motion.div>

            {/* Radar concentric pulse rings */}
            <motion.div
              animate={{ scale: [0.8, 1.4, 0.8], opacity: [0.6, 0.1, 0.6] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              className="absolute w-12 h-12 rounded-full border border-cyan-400/30 pointer-events-none"
            />

            {/* Drone Robot Body (Hovering) */}
            <motion.div
              animate={{ y: [-3, 3, -3], rotate: [-1, 1, -1] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-b from-cyan-400 to-blue-600 p-[1.5px] shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                <div className="w-full h-full bg-[#050b18] rounded-[9px] flex items-center justify-center relative overflow-hidden">
                  <Radar className="w-5 h-5 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
                  {/* Glowing Eye Visor */}
                  <div className="absolute top-1.5 w-4 h-1 bg-cyan-400 rounded-full shadow-[0_0_6px_#22d3ee]" />
                </div>
              </div>
              {/* Drone Thruster Beam */}
              <motion.div
                animate={{ height: [4, 9, 4], opacity: [0.8, 1, 0.8] }}
                transition={{ repeat: Infinity, duration: 0.4 }}
                className="w-1.5 bg-gradient-to-b from-cyan-400 to-transparent rounded-b shadow-[0_0_6px_#06b6d4]"
              />
            </motion.div>

            {/* Target Detection Particle Tag */}
            <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 border border-cyan-500/40 text-[7px] text-cyan-300">
              VIRAL &ge; 0.50
            </div>
          </div>

          {/* Model Selector */}
          <div className="mb-1.5">
            <select
              value={selectedAgent1Model}
              onChange={(e) => onSelectAgent1Model?.(e.target.value)}
              className="w-full bg-[#040814] text-cyan-300 border border-cyan-500/40 rounded px-1.5 py-1 text-[9px] font-mono focus:outline-none cursor-pointer hover:border-cyan-400"
            >
              <option value="openrouter-nex">⚡ NEX-AGI N2.5 Pro Free (OpenRouter)</option>
              <option value="anymodel-deepseek">🤖 DeepSeek V4 Flash (anymodel.org)</option>
              <option value="anymodel-glm">🔥 GLM 5.3 Flash (anymodel.org)</option>
            </select>
          </div>
        </div>

        {/* Task Footer */}
        <div className="pt-1.5 border-t border-cyan-500/20 text-[8.5px] text-slate-300 flex items-center justify-between">
          <span className="text-cyan-400 font-bold">Fast Scout</span>
          <span className="text-slate-400">Score &ge; 0.50 Sniping</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AGENT 2: SHIELD SENTINEL MECH (ANTI-RUG STRICT) */}
      {/* ========================================================================= */}
      <div className="relative group bg-[#071317]/90 border border-emerald-500/30 hover:border-emerald-400/70 rounded-xl p-2.5 flex flex-col justify-between overflow-hidden shadow-lg shadow-emerald-950/40 transition-all duration-300">
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:12px_12px] opacity-10 pointer-events-none" />
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />

        <div>
          <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/20 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                A2 • Shield Sentinel
              </span>
            </div>
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse">
              {agentStates.auditor || 'ANTI-RUG STRICT'}
            </span>
          </div>

          {/* Animated Sentinel Visual */}
          <div className="relative w-full h-20 bg-gradient-to-b from-[#03100f] to-[#06241b] rounded-lg border border-emerald-500/20 flex items-center justify-center overflow-hidden mb-2">
            {/* Hexagon Security Barrier */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
              className="absolute w-24 h-24 rounded-full border border-dashed border-emerald-500/30 pointer-events-none"
            />
            <motion.div
              animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.9, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              className="absolute w-14 h-14 rounded-xl border border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.3)] pointer-events-none"
            />

            {/* Mech Guardian Body */}
            <motion.div
              animate={{ y: [-2, 2, -2], scale: [0.98, 1.02, 0.98] }}
              transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-b from-emerald-400 to-teal-700 p-[1.5px] shadow-[0_0_15px_rgba(16,185,129,0.6)]">
                <div className="w-full h-full bg-[#041210] rounded-[9px] flex items-center justify-center relative">
                  <ShieldCheck className="w-5 h-5 text-emerald-300 animate-pulse" />
                  <Lock className="w-2.5 h-2.5 text-emerald-400 absolute bottom-1 right-1" />
                </div>
              </div>
            </motion.div>

            <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 border border-emerald-500/40 text-[7px] text-emerald-300">
              KILL-VOTE VETO
            </div>
          </div>

          {/* Model Selector */}
          <div className="mb-1.5">
            <select
              value={selectedAgent2Model}
              onChange={(e) => onSelectAgent2Model?.(e.target.value)}
              className="w-full bg-[#040f0c] text-emerald-300 border border-emerald-500/40 rounded px-1.5 py-1 text-[9px] font-mono focus:outline-none cursor-pointer hover:border-emerald-400"
            >
              <option value="openrouter-nex">⚡ NEX-AGI N2.5 Pro Free (OpenRouter)</option>
              <option value="anymodel-claude">🛡️ Claude Sonnet 4.6 (anymodel.org)</option>
              <option value="anymodel-glm">🔥 GLM 5.3 Flash (anymodel.org)</option>
            </select>
          </div>
        </div>

        <div className="pt-1.5 border-t border-emerald-500/20 text-[8.5px] text-slate-300 flex items-center justify-between">
          <span className="text-emerald-400 font-bold">Anti-Rug Guard</span>
          <span className="text-slate-400">Dev&lt;10% | Top10&lt;35%</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AGENT 3: MEV HYPERDRIVE WARP EXECUTOR */}
      {/* ========================================================================= */}
      <div className="relative group bg-[#160f06]/90 border border-amber-500/30 hover:border-amber-400/70 rounded-xl p-2.5 flex flex-col justify-between overflow-hidden shadow-lg shadow-amber-950/40 transition-all duration-300">
        <div className="absolute inset-0 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:12px_12px] opacity-10 pointer-events-none" />
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

        <div>
          <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/20 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                A3 • MEV Warp Core
              </span>
            </div>
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 animate-pulse">
              {agentStates.execution || 'JITO 10% SIZING'}
            </span>
          </div>

          {/* Animated MEV Core Visual */}
          <div className="relative w-full h-20 bg-gradient-to-b from-[#140b03] to-[#2b1704] rounded-lg border border-amber-500/20 flex items-center justify-center overflow-hidden mb-2">
            {/* Spinning Quantum Energy Ring */}
            <motion.div
              animate={{ rotate: 360, scale: [0.95, 1.05, 0.95] }}
              transition={{ repeat: Infinity, duration: 2.0, ease: 'linear' }}
              className="absolute w-20 h-20 rounded-full border border-amber-400/40 border-t-transparent shadow-[0_0_12px_#f59e0b] pointer-events-none"
            />
            {/* Warp Energy Sparks */}
            <motion.div
              animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.7, 1.3, 0.7] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
              className="absolute w-12 h-12 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/30 blur-sm pointer-events-none"
            />

            {/* Grok MEV Engine Unit */}
            <motion.div
              animate={{ y: [-2, 2, -2] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-b from-amber-400 via-orange-500 to-amber-700 p-[1.5px] shadow-[0_0_15px_rgba(245,158,11,0.6)]">
                <div className="w-full h-full bg-[#140902] rounded-[9px] flex items-center justify-center relative">
                  <Zap className="w-5 h-5 text-amber-300 animate-bounce" style={{ animationDuration: '1.4s' }} />
                </div>
              </div>
            </motion.div>

            <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 border border-amber-500/40 text-[7px] text-amber-300">
              MAX 10% BALANCE
            </div>
          </div>

          <div className="p-1 rounded bg-[#100902] border border-amber-500/30 text-[9.5px] text-amber-200 flex items-center justify-between mb-1.5">
            <span className="font-bold flex items-center gap-1">
              <Cpu className="w-3 h-3 text-amber-400" /> Grok 4.6 Engine
            </span>
            <span className="text-[8px] text-slate-400">Jito Bundle</span>
          </div>
        </div>

        <div className="pt-1.5 border-t border-amber-500/20 text-[8.5px] text-slate-300 flex items-center justify-between">
          <span className="text-amber-400 font-bold">Fast Sizing</span>
          <span className="text-slate-400">10% Sizing (0.10 SOL)</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AGENT 4: SONAR WHALE RADAR DRONE */}
      {/* ========================================================================= */}
      <div className="relative group bg-[#130718]/90 border border-fuchsia-500/30 hover:border-fuchsia-400/70 rounded-xl p-2.5 flex flex-col justify-between overflow-hidden shadow-lg shadow-fuchsia-950/40 transition-all duration-300">
        <div className="absolute inset-0 bg-[radial-gradient(#d946ef_1px,transparent_1px)] [background-size:12px_12px] opacity-10 pointer-events-none" />
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-fuchsia-500/10 rounded-full blur-xl pointer-events-none" />

        <div>
          <div className="flex items-center justify-between pb-1.5 border-b border-fuchsia-500/20 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-ping" />
              <span className="text-[10px] font-bold text-fuchsia-300 uppercase tracking-wider">
                A4 • Whale Sonar
              </span>
            </div>
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-950 text-fuchsia-400 border border-fuchsia-800 animate-pulse">
              {agentStates.tracker || '5s MOMENTUM GUARD'}
            </span>
          </div>

          {/* Animated Sonar Visual */}
          <div className="relative w-full h-20 bg-gradient-to-b from-[#100314] to-[#250830] rounded-lg border border-fuchsia-500/20 flex items-center justify-center overflow-hidden mb-2">
            {/* Expanding Concentric Sonar Pulses */}
            <motion.div
              animate={{ scale: [0.5, 2.2], opacity: [0.9, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeOut' }}
              className="absolute w-14 h-14 rounded-full border border-fuchsia-400 shadow-[0_0_10px_#d946ef] pointer-events-none"
            />
            <motion.div
              animate={{ scale: [0.5, 2.2], opacity: [0.9, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, delay: 0.9, ease: 'easeOut' }}
              className="absolute w-14 h-14 rounded-full border border-fuchsia-400 shadow-[0_0_10px_#d946ef] pointer-events-none"
            />

            {/* Kimi Sonar Unit */}
            <motion.div
              animate={{ y: [-2, 2, -2] }}
              transition={{ repeat: Infinity, duration: 2.0, ease: 'easeInOut' }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-b from-fuchsia-400 via-pink-500 to-purple-800 p-[1.5px] shadow-[0_0_15px_rgba(217,70,239,0.6)]">
                <div className="w-full h-full bg-[#120317] rounded-[9px] flex items-center justify-center relative">
                  <Activity className="w-5 h-5 text-fuchsia-300 animate-pulse" />
                </div>
              </div>
            </motion.div>

            <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 border border-fuchsia-500/40 text-[7px] text-fuchsia-300">
              5S MOMENTUM GUARD
            </div>
          </div>

          <div className="p-1 rounded bg-[#0f0313] border border-fuchsia-500/30 text-[9.5px] text-fuchsia-200 flex items-center justify-between mb-1.5">
            <span className="font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-fuchsia-400" /> Kimi K3 Radar
            </span>
            <span className="text-[8px] text-slate-400">1000ms Ticks</span>
          </div>
        </div>

        <div className="pt-1.5 border-t border-fuchsia-500/20 text-[8.5px] text-slate-300 flex items-center justify-between">
          <span className="text-fuchsia-400 font-bold">Quick Exit Guard</span>
          <span className="text-slate-400">5s No-Buy Exit</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AGENT 5: TACTICAL TARGET SNIPER (FAST SCALP HIT & RUN) */}
      {/* ========================================================================= */}
      <div className="relative group bg-[#16060c]/90 border border-rose-500/30 hover:border-rose-400/70 rounded-xl p-2.5 flex flex-col justify-between overflow-hidden shadow-lg shadow-rose-950/40 transition-all duration-300">
        <div className="absolute inset-0 bg-[radial-gradient(#f43f5e_1px,transparent_1px)] [background-size:12px_12px] opacity-10 pointer-events-none" />
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />

        <div>
          <div className="flex items-center justify-between pb-1.5 border-b border-rose-500/20 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                A5 • Scalp Sniper
              </span>
            </div>
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 animate-pulse">
              {agentStates.exit || 'TP: +8% | SL: -5%'}
            </span>
          </div>

          {/* Animated Crosshairs Visual */}
          <div className="relative w-full h-20 bg-gradient-to-b from-[#130308] to-[#290510] rounded-lg border border-rose-500/20 flex items-center justify-center overflow-hidden mb-2">
            {/* Rotating Sniper Crosshair Reticle */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
              className="absolute w-20 h-20 rounded-full border border-dashed border-rose-400/50 pointer-events-none"
            />
            {/* Targeting Laser Lines */}
            <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-rose-500/40 to-transparent pointer-events-none" />
            <div className="absolute h-full w-[1px] bg-gradient-to-b from-transparent via-rose-500/40 to-transparent pointer-events-none" />

            {/* Claude Opus Unit */}
            <motion.div
              animate={{ scale: [0.95, 1.05, 0.95] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-b from-rose-400 via-pink-600 to-rose-900 p-[1.5px] shadow-[0_0_15px_rgba(244,63,94,0.6)]">
                <div className="w-full h-full bg-[#120207] rounded-[9px] flex items-center justify-center relative">
                  <Target className="w-5 h-5 text-rose-300 animate-spin" style={{ animationDuration: '8s' }} />
                </div>
              </div>
            </motion.div>

            <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 border border-rose-500/40 text-[7px] text-rose-300">
              HIT & RUN (TP: +8%)
            </div>
          </div>

          <div className="p-1 rounded bg-[#0f0206] border border-rose-500/30 text-[9.5px] text-rose-200 flex items-center justify-between mb-1.5">
            <span className="font-bold flex items-center gap-1">
              <Target className="w-3 h-3 text-rose-400" /> Claude Opus 4.8
            </span>
            <span className="text-[8px] text-slate-400">Exit Engine</span>
          </div>
        </div>

        <div className="pt-1.5 border-t border-rose-500/20 text-[8.5px] text-slate-300 flex items-center justify-between">
          <span className="text-rose-400 font-bold">Hit & Run</span>
          <span className="text-slate-400">TP: +8% | SL: -5% | +1% Lock</span>
        </div>
      </div>
    </div>
  );
};
