import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CyberRobotPatrolLaneProps {
  selectedAgent1Model?: string;
  selectedAgent2Model?: string;
  activeTokenSymbol?: string;
  activeNarrativeScore?: number;
  activeStatus?: string;
}

interface RobotDef {
  id: string;
  title: string;
  codeName: string;
  color: string;
  glowColor: string;
  textColor: string;
  bubbleBorder: string;
  bubbleBg: string;
  bubbleText: string;
  defaultMessage: string;
}

export const CyberRobotPatrolLane: React.FC<CyberRobotPatrolLaneProps> = ({
  activeTokenSymbol = 'MEME',
  activeNarrativeScore = 0.78,
  activeStatus = 'ON-DUTY PATROL',
}) => {
  const [activeSpeechIndex, setActiveSpeechIndex] = useState<number>(2); // Default on middle agent (Narrative/Security)

  // Rotate speech bubble across patrolling agents every 3.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSpeechIndex((prev) => (prev + 1) % 5);
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  const robots: RobotDef[] = [
    {
      id: 'scanner',
      title: 'SCANNER',
      codeName: 'A1 • SCANNER',
      color: '#06b6d4', // Cyan
      glowColor: 'rgba(6, 182, 212, 0.6)',
      textColor: 'text-cyan-400',
      bubbleBorder: 'border-cyan-500/80',
      bubbleBg: 'bg-cyan-950/90',
      bubbleText: 'text-cyan-300',
      defaultMessage: `HOLDERS ≥ 30 | AGE ≤ 5M | NARRATIVE ≥ 0.50`,
    },
    {
      id: 'auditor',
      title: 'AUDITOR',
      codeName: 'A2 • AUDITOR',
      color: '#ef4444', // Red / Rose
      glowColor: 'rgba(239, 68, 68, 0.6)',
      textColor: 'text-rose-400',
      bubbleBorder: 'border-rose-500/80',
      bubbleBg: 'bg-rose-950/90',
      bubbleText: 'text-rose-300',
      defaultMessage: `ZERO DEV: 0% | TOP10 ≤ 30% | MINT/FREEZE REVOKED ✓`,
    },
    {
      id: 'narrative',
      title: 'NARRATIVE',
      codeName: 'A1/A2 • CONSENSUS',
      color: '#10b981', // Green
      glowColor: 'rgba(16, 185, 129, 0.7)',
      textColor: 'text-emerald-400',
      bubbleBorder: 'border-emerald-500/90',
      bubbleBg: 'bg-emerald-950/95',
      bubbleText: 'text-emerald-300',
      defaultMessage: `NARRATIVE SCORE ${activeNarrativeScore.toFixed(2)} - VIRAL PATTERN ($${activeTokenSymbol})`,
    },
    {
      id: 'timing',
      title: 'TIMING',
      codeName: 'A3 • MEV GROK',
      color: '#eab308', // Yellow
      glowColor: 'rgba(234, 179, 8, 0.6)',
      textColor: 'text-amber-400',
      bubbleBorder: 'border-amber-500/80',
      bubbleBg: 'bg-amber-950/90',
      bubbleText: 'text-amber-300',
      defaultMessage: `JITO MEV WARP ROUTING • 10% SIZING (0.10 SOL)`,
    },
    {
      id: 'killvote',
      title: 'KILL-VOTE',
      codeName: 'A4/A5 • EXIT',
      color: '#f97316', // Orange / Coral
      glowColor: 'rgba(249, 115, 22, 0.6)',
      textColor: 'text-orange-400',
      bubbleBorder: 'border-orange-500/80',
      bubbleBg: 'bg-orange-950/90',
      bubbleText: 'text-orange-300',
      defaultMessage: `RISK 1:2 TARGET LOCK (TP: +20% | SL: -10%)`,
    },
  ];

  return (
    <div className="w-full relative rounded-xl border border-cyan-500/25 bg-[#050b16]/95 p-2 overflow-hidden shadow-2xl shadow-cyan-950/40 select-none font-mono">
      {/* Top Track Label Bar */}
      <div className="flex items-center justify-between text-[9px] font-bold tracking-widest text-slate-400 px-4 pb-1 border-b border-white/5 uppercase">
        <div className="flex items-center gap-1.5 text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>5-AGENT AUTONOMOUS PATROL GRID</span>
        </div>
        <div className="flex items-center gap-6 text-[8.5px] text-slate-400">
          {robots.map((r, i) => (
            <span
              key={r.id}
              className={`transition-colors duration-300 ${
                activeSpeechIndex === i ? r.textColor + ' font-black' : 'text-slate-500'
              }`}
            >
              {r.title}
            </span>
          ))}
        </div>
        <span className="text-emerald-400 text-[8.5px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/30">
          STATUS: {activeStatus || 'ON-DUTY PATROL'}
        </span>
      </div>

      {/* Main 3D Perspective Grid Runway */}
      <div className="relative w-full h-[95px] flex items-center justify-between px-6 sm:px-12 md:px-16 overflow-hidden">
        {/* Retro 3D Isometric / Perspective Grid Floor */}
        <div 
          className="absolute inset-x-0 bottom-0 h-full pointer-events-none opacity-40"
          style={{
            background: `
              linear-gradient(to bottom, transparent 0%, rgba(6, 182, 212, 0.05) 50%, rgba(6, 182, 212, 0.15) 100%),
              repeating-linear-gradient(to right, transparent, transparent 50px, rgba(6, 182, 212, 0.2) 50px, rgba(6, 182, 212, 0.2) 51px)
            `,
            transform: 'perspective(300px) rotateX(35deg)',
            transformOrigin: 'bottom center',
          }}
        />

        {/* Glowing Horizon Perspective Lines */}
        <div className="absolute inset-x-0 top-[60%] h-[1px] bg-cyan-500/20 shadow-[0_0_8px_#06b6d4]" />
        <div className="absolute inset-x-0 top-[72%] h-[1px] bg-cyan-500/30 shadow-[0_0_10px_#06b6d4]" />
        <div className="absolute inset-x-0 top-[84%] h-[1px] bg-cyan-500/40 shadow-[0_0_12px_#06b6d4]" />
        <div className="absolute inset-x-0 bottom-1 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee]" />

        {/* 5 Pixel-Art Patrol Robots */}
        {robots.map((robot, index) => {
          const isActive = activeSpeechIndex === index;
          return (
            <div
              key={robot.id}
              onClick={() => setActiveSpeechIndex(index)}
              className="relative z-10 flex flex-col items-center cursor-pointer group"
            >
              {/* Floating Glowing Cyber Speech Bubble */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.85 }}
                    transition={{ duration: 0.25 }}
                    className={`absolute -top-7 whitespace-nowrap px-2 py-0.5 rounded border ${robot.bubbleBorder} ${robot.bubbleBg} ${robot.bubbleText} font-bold text-[8.5px] flex items-center gap-1 z-30 pointer-events-none`}
                    style={{ boxShadow: `0 0 15px ${robot.glowColor}` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: robot.color }} />
                    <span>{robot.defaultMessage}</span>
                    {/* Small speech arrow pointing down */}
                    <div 
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px]"
                      style={{ borderTopColor: robot.color }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Pixel Robot Sprite Body (Walking / Patrolling Animation) */}
              <motion.div
                animate={{
                  y: [0, -3.5, 0, -2, 0],
                  x: [0, 1.5, 0, -1.5, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.1 + index * 0.1,
                  ease: 'easeInOut',
                }}
                className="relative flex flex-col items-center"
              >
                {/* 8-Bit Pixel Robot SVG */}
                <svg
                  width="28"
                  height="34"
                  viewBox="0 0 14 17"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    filter: `drop-shadow(0 0 8px ${robot.glowColor})`,
                  }}
                  className="transition-transform duration-200 group-hover:scale-110"
                >
                  {/* Antenna */}
                  <rect x="6" y="0" width="2" height="2" fill={robot.color} />
                  <rect x="5" y="1" width="4" height="1" fill="#ffffff" fillOpacity="0.8" />

                  {/* Head Unit */}
                  <rect x="2" y="2" width="10" height="6" fill={robot.color} rx="1" />
                  <rect x="3" y="3" width="8" height="4" fill="#040814" />
                  
                  {/* Eye Visor (Glowing Pixel Eyes) */}
                  <rect x="4" y="4" width="2" height="2" fill="#ffffff" />
                  <rect x="8" y="4" width="2" height="2" fill="#ffffff" />
                  <rect x="4" y="4" width="6" height="2" fill={robot.color} fillOpacity="0.4" />

                  {/* Neck */}
                  <rect x="5" y="8" width="4" height="1" fill="#030712" />

                  {/* Body / Chest */}
                  <rect x="1" y="9" width="12" height="5" fill={robot.color} rx="1" />
                  <rect x="3" y="10" width="8" height="3" fill="#040814" />
                  {/* Chest Reactor Light */}
                  <rect x="6" y="11" width="2" height="1" fill="#ffffff" />

                  {/* Left & Right Pixel Legs (Walking Movement) */}
                  <rect x="3" y="14" width="2" height="3" fill={robot.color} />
                  <rect x="9" y="14" width="2" height="3" fill={robot.color} />
                  <rect x="2" y="16" width="3" height="1" fill="#ffffff" fillOpacity="0.7" />
                  <rect x="9" y="16" width="3" height="1" fill="#ffffff" fillOpacity="0.7" />
                </svg>

                {/* Cyber Shadow & Grid Reflection below Robot */}
                <motion.div
                  animate={{
                    scaleX: [1, 0.75, 1],
                    opacity: [0.7, 0.3, 0.7],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.1 + index * 0.1,
                    ease: 'easeInOut',
                  }}
                  className="w-6 h-1 rounded-full blur-[1px] mt-0.5"
                  style={{ backgroundColor: robot.color }}
                />
              </motion.div>

              {/* Bottom Agent Label & Status */}
              <div className="mt-1 flex flex-col items-center">
                <span 
                  className={`text-[8.5px] font-mono font-black tracking-wider transition-colors ${
                    isActive ? robot.textColor : 'text-slate-400'
                  }`}
                >
                  {robot.title}
                </span>
                <span className="text-[7px] text-slate-500 font-mono">
                  {robot.codeName}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
