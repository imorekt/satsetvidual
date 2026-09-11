import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Terminal } from 'lucide-react';

export interface CyberRobotPatrolArenaProps {
  selectedAgent1Model?: string;
  selectedAgent2Model?: string;
  activeTokenSymbol?: string;
  activeNarrativeScore?: number;
  activeStatus?: string;
  agentStates?: {
    scanner?: string;
    auditor?: string;
    execution?: string;
    tracker?: string;
    exit?: string;
  };
  latestLogs?: Array<{
    timestamp: string;
    tag: string;
    text: string;
    color: string;
  }>;
}

interface RobotEntity {
  id: string;
  title: string;
  codeName: string;
  color: string;
  glowColor: string;
  textColor: string;
  bubbleBorder: string;
  bubbleBg: string;
  bubbleText: string;
  liveAction: string;
  stateBadge: string;
  isActiveDuty: boolean;
  // Non-overlapping distinct patrolling zones
  xPath: number[];
  yPath: number[];
  duration: number;
}

export const CyberRobotPatrolArena: React.FC<CyberRobotPatrolArenaProps> = ({
  activeTokenSymbol = 'MEME',
  activeNarrativeScore = 0.94,
  activeStatus = 'SCANNING',
  agentStates = {},
  latestLogs = [],
}) => {
  const [activeSpeechIndex, setActiveSpeechIndex] = useState<number>(0);
  const [manualSelect, setManualSelect] = useState<boolean>(false);
  const prevLogsLengthRef = useRef<number>(0);

  const cleanLogText = (rawText: string): string => {
    if (!rawText) return '';
    let clean = rawText.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
    clean = clean.replace(/^\[\d{4}-\d{2}-\d{2}[^\]]+\]\s*/, '');
    clean = clean.replace(/^\[(INFO|WARN|ERROR|DEBUG|SYSTEM|BOT|SCANNER|AUDITOR|TRACKER|EXIT|EXECUTION|PAPER-BUY)\]\s*/i, '');
    clean = clean.replace(/^\[(ScannerAgent|SecurityAuditor|ExecutionAgent|TrackerAgent|ExitAgent|WebServer|Socket\.io)\]\s*/i, '');
    return clean.trim() || rawText;
  };

  // Extract latest dynamic log for each agent role
  const getLatestLogForAgent = (tagPatterns: string[], fallback: string): { text: string; isRecent: boolean } => {
    const matchingLog = latestLogs.slice().reverse().find((l) =>
      tagPatterns.some((pattern) => (l.tag || '').toUpperCase().includes(pattern.toUpperCase()) || (l.text || '').toUpperCase().includes(pattern.toUpperCase()))
    );
    if (matchingLog) {
      return { text: cleanLogText(matchingLog.text), isRecent: true };
    }
    return { text: fallback, isRecent: false };
  };

  const isScannerActive = agentStates.scanner === 'SCANNING' || agentStates.scanner === 'ACTIVE' || activeStatus === 'SCANNING' || !activeStatus;
  const isAuditorActive = agentStates.auditor === 'AUDITING' || agentStates.auditor === 'ACTIVE' || activeStatus === 'AUDITING' || activeStatus === 'SCANNING' || !activeStatus;
  const isExecutionActive = agentStates.execution === 'BUYING' || agentStates.execution === 'ACTIVE' || activeStatus === 'BOUGHT';
  const isTrackerActive = agentStates.tracker === 'TRACKING' || agentStates.tracker === 'ACTIVE' || activeStatus === 'HOLDING';
  const isExitActive = agentStates.exit === 'EXITING' || activeStatus === 'EXITING' || activeStatus === 'CLOSED';

  const scannerLog = getLatestLogForAgent(
    ['SCANNER', 'TOKEN', 'LAUNCH'],
    `SCANNER: HOLDERS ≥ 30 | AGE ≤ 5M | NARRATIVE ≥ 0.50 ($${activeTokenSymbol} Score: ${activeNarrativeScore.toFixed(2)})`
  );

  const auditorLog = getLatestLogForAgent(
    ['AUDITOR', 'SECURITY', 'RUGCHECK', 'KILL-VOTE'],
    `ANTI-RUG: DEV = 0% | TOP10 ≤ 30% | MINT & FREEZE REVOKED ✓`
  );

  const executionLog = getLatestLogForAgent(
    ['EXECUTION', 'PAPER-BUY', 'BUY', 'JITO'],
    isExecutionActive
      ? `JITO MEV ROUTING • 10% SIZING (0.10 SOL)`
      : `[STANDBY] Menunggu konsensus audit lolos...`
  );

  const trackerLog = getLatestLogForAgent(
    ['TRACKER', 'RADAR', 'WHALE', 'PRICE'],
    isTrackerActive
      ? `1000MS TICKS & 5S MOMENTUM GUARD`
      : `[STANDBY] Siaga monitor 5s momentum & tick 1000ms...`
  );

  const exitLog = getLatestLogForAgent(
    ['EXIT', 'POSITION', 'SELL'],
    isExitActive
      ? `FAST SCALP HIT & RUN (TP: +8% | SL: -5% | 5S GUARD)`
      : `[STANDBY] Target TP +8% / SL -5% siap dieksekusi...`
  );

  // 100% REAL-TIME LOG SYNC: Whenever a new log arrives, focus immediately on the robot responsible!
  useEffect(() => {
    if (latestLogs.length > prevLogsLengthRef.current) {
      prevLogsLengthRef.current = latestLogs.length;
      const lastLog = latestLogs[latestLogs.length - 1];
      if (lastLog) {
        const tag = (lastLog.tag || '').toUpperCase();
        const text = (lastLog.text || '').toUpperCase();
        if (tag.includes('SCANNER') || tag.includes('TOKEN') || text.includes('SCAN') || text.includes('LAUNCH')) {
          setActiveSpeechIndex(0); // Scanner
        } else if (tag.includes('AUDITOR') || tag.includes('SECURITY') || tag.includes('RUGCHECK') || text.includes('AUDIT') || text.includes('KILL-VOTE')) {
          setActiveSpeechIndex(1); // Auditor
        } else if (tag.includes('EXECUTION') || tag.includes('PAPER-BUY') || tag.includes('BUY') || tag.includes('JITO')) {
          setActiveSpeechIndex(2); // Execution
        } else if (tag.includes('TRACKER') || tag.includes('RADAR') || tag.includes('PRICE') || tag.includes('WHALE')) {
          setActiveSpeechIndex(3); // Tracker
        } else if (tag.includes('EXIT') || tag.includes('SELL') || tag.includes('POSITION CLOSED')) {
          setActiveSpeechIndex(4); // Exit
        }
      }
    }
  }, [latestLogs]);

  const robots: RobotEntity[] = useMemo(() => [
    {
      id: 'scanner',
      title: 'SCANNER',
      codeName: 'A1 • SCOUT',
      color: '#06b6d4',
      glowColor: 'rgba(6, 182, 212, 0.7)',
      textColor: 'text-cyan-400',
      bubbleBorder: 'border-cyan-500/90',
      bubbleBg: 'bg-cyan-950/95',
      bubbleText: 'text-cyan-200',
      liveAction: scannerLog.text,
      stateBadge: isScannerActive ? 'SCANNING' : 'STANDBY',
      isActiveDuty: isScannerActive,
      xPath: [6, 18, 10, 20, 6],
      yPath: [25, 60, 35, 70, 25],
      duration: 7.5,
    },
    {
      id: 'auditor',
      title: 'AUDITOR',
      codeName: 'A2 • ANTI-RUG',
      color: '#ef4444',
      glowColor: 'rgba(239, 68, 68, 0.7)',
      textColor: 'text-rose-400',
      bubbleBorder: 'border-rose-500/90',
      bubbleBg: 'bg-rose-950/95',
      bubbleText: 'text-rose-200',
      liveAction: auditorLog.text,
      stateBadge: isAuditorActive ? 'AUDITING' : 'STANDBY',
      isActiveDuty: isAuditorActive,
      xPath: [25, 38, 28, 40, 25],
      yPath: [65, 30, 68, 42, 65],
      duration: 8.2,
    },
    {
      id: 'execution',
      title: 'EXECUTION',
      codeName: 'A3 • MEV',
      color: '#eab308',
      glowColor: 'rgba(234, 179, 8, 0.7)',
      textColor: 'text-amber-400',
      bubbleBorder: 'border-amber-500/90',
      bubbleBg: 'bg-amber-950/95',
      bubbleText: 'text-amber-200',
      liveAction: executionLog.text,
      stateBadge: isExecutionActive ? 'BUYING' : 'STANDBY',
      isActiveDuty: isExecutionActive,
      xPath: [45, 58, 48, 60, 45],
      yPath: [30, 65, 25, 55, 30],
      duration: 7.0,
    },
    {
      id: 'tracker',
      title: 'TRACKER',
      codeName: 'A4 • SONAR',
      color: '#10b981',
      glowColor: 'rgba(16, 185, 129, 0.8)',
      textColor: 'text-emerald-400',
      bubbleBorder: 'border-emerald-500/90',
      bubbleBg: 'bg-emerald-950/95',
      bubbleText: 'text-emerald-200',
      liveAction: trackerLog.text,
      stateBadge: isTrackerActive ? 'TRACKING' : 'STANDBY',
      isActiveDuty: isTrackerActive,
      xPath: [65, 78, 68, 80, 65],
      yPath: [65, 25, 58, 36, 65],
      duration: 7.8,
    },
    {
      id: 'exit',
      title: 'KILL-VOTE',
      codeName: 'A5 • EXIT',
      color: '#f97316',
      glowColor: 'rgba(249, 115, 22, 0.7)',
      textColor: 'text-orange-400',
      bubbleBorder: 'border-orange-500/90',
      bubbleBg: 'bg-orange-950/95',
      bubbleText: 'text-orange-200',
      liveAction: exitLog.text,
      stateBadge: isExitActive ? 'EXITING' : 'STANDBY',
      isActiveDuty: isExitActive,
      xPath: [84, 94, 86, 95, 84],
      yPath: [30, 65, 42, 70, 30],
      duration: 8.5,
    },
  ], [scannerLog.text, auditorLog.text, executionLog.text, trackerLog.text, exitLog.text, isScannerActive, isAuditorActive, isExecutionActive, isTrackerActive, isExitActive]);

  // Active duty indices: strictly alternate speech bubble among agents currently doing work!
  const activeDutyIndices = useMemo(() => {
    const indices: number[] = [];
    robots.forEach((r, i) => {
      if (r.isActiveDuty) indices.push(i);
    });
    return indices.length > 0 ? indices : [0];
  }, [robots]);

  // If no new log arrives, gently alternate ONLY between active agents (e.g. Scanner & Auditor)
  useEffect(() => {
    if (manualSelect) return;
    if (activeDutyIndices.length <= 1) return;

    const interval = setInterval(() => {
      setActiveSpeechIndex((prev) => {
        const currentPos = activeDutyIndices.indexOf(prev);
        const nextPos = (currentPos + 1) % activeDutyIndices.length;
        return activeDutyIndices[nextPos];
      });
    }, 4200);

    return () => clearInterval(interval);
  }, [activeDutyIndices, manualSelect]);

  return (
    <div className="w-full h-full bg-[#0b1222]/90 border border-slate-800 rounded-xl p-3 backdrop-blur-xl flex flex-col justify-between shadow-xl overflow-hidden font-mono select-none relative">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 gap-2 flex-shrink-0 z-20 relative">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping absolute" />
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
          </div>
          <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <span>5-AGENT REAL-TIME PATROL ARENA</span>
            <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              LOG SYNCED
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-3 text-[9.5px]">
          <div className="hidden sm:flex items-center gap-2 text-slate-400">
            {robots.map((r, i) => {
              const isSelected = activeSpeechIndex === i;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setActiveSpeechIndex(i);
                    setManualSelect(true);
                  }}
                  className={`transition-all duration-200 text-[8.5px] uppercase px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                    isSelected
                      ? `${r.bubbleBg} ${r.bubbleBorder} ${r.textColor} font-black`
                      : r.isActiveDuty
                      ? 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                      : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400'
                  }`}
                  style={isSelected ? { boxShadow: `0 0 10px ${r.glowColor}` } : {}}
                >
                  {r.isActiveDuty && (
                    <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: r.color }} />
                  )}
                  <span>{r.title}</span>
                </button>
              );
            })}
          </div>
          <span className="text-emerald-400 text-[9px] px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 font-bold flex items-center gap-1">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            PIPELINE: {activeStatus || 'SCANNING'}
          </span>
        </div>
      </div>

      {/* Cyber Patrol Arena (3D Perspective Grid with Real-Time Free-Roaming Robots) */}
      <div className="flex-1 min-h-0 w-full relative overflow-hidden rounded-lg bg-[#040814] my-1 border border-cyan-500/20">
        {/* 3D Perspective Grid Runway Floor */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            background: `
              linear-gradient(to bottom, transparent 0%, rgba(6, 182, 212, 0.08) 40%, rgba(6, 182, 212, 0.22) 100%),
              repeating-linear-gradient(to right, transparent, transparent 40px, rgba(6, 182, 212, 0.25) 40px, rgba(6, 182, 212, 0.25) 41px),
              repeating-linear-gradient(to bottom, transparent, transparent 30px, rgba(6, 182, 212, 0.2) 30px, rgba(6, 182, 212, 0.2) 31px)
            `,
            transform: 'perspective(400px) rotateX(25deg)',
            transformOrigin: 'bottom center',
          }}
        />

        {/* Ambient Radar Lines & Horizon Glow */}
        <div className="absolute inset-x-0 top-[38%] h-[1px] bg-cyan-500/20 shadow-[0_0_8px_#06b6d4]" />
        <div className="absolute inset-x-0 top-[65%] h-[1px] bg-cyan-500/30 shadow-[0_0_10px_#06b6d4]" />
        <div className="absolute inset-x-0 bottom-2 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee]" />

        {/* 5 Truly-Synchronized Freely-Patrolling Pixel Robots */}
        {robots.map((robot, index) => {
          // Strictly show speech bubble ONLY if robot is currently on active duty or manually selected
          const showBubble = (activeSpeechIndex === index && (robot.isActiveDuty || manualSelect));

          return (
            <motion.div
              key={robot.id}
              onClick={() => {
                setActiveSpeechIndex(index);
                setManualSelect(true);
              }}
              animate={{
                left: robot.xPath.map((x) => `${x}%`),
                top: robot.yPath.map((y) => `${y}%`),
              }}
              transition={{
                repeat: Infinity,
                duration: robot.duration,
                ease: 'easeInOut',
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 flex flex-col items-center group"
            >
              {/* Floating Live Telemetry Speech Bubble (Synchronized strictly with Real Live Logs) */}
              <AnimatePresence>
                {showBubble && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.8 }}
                    transition={{ duration: 0.25 }}
                    className={`absolute -top-10 max-w-[280px] sm:max-w-[340px] px-2 py-1 rounded border ${robot.bubbleBorder} ${robot.bubbleBg} ${robot.bubbleText} font-bold text-[8.5px] flex items-center gap-1.5 z-30 pointer-events-none shadow-2xl`}
                    style={{ boxShadow: `0 0 18px ${robot.glowColor}` }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-ping flex-shrink-0"
                      style={{ backgroundColor: robot.color }}
                    />
                    <span className="truncate leading-tight">{robot.liveAction}</span>
                    <div
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px]"
                      style={{ borderTopColor: robot.color }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 8-Bit Pixel Robot Walking Sprite with Active Glow Aura */}
              <motion.div
                animate={{
                  y: [0, -3.5, 0, -2, 0],
                  x: [0, 1.5, 0, -1.5, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.85 + index * 0.1,
                  ease: 'easeInOut',
                }}
                className="relative flex flex-col items-center"
              >
                {/* Active Task Aura only when Robot is actively on duty */}
                {robot.isActiveDuty && (
                  <div
                    className="absolute -inset-1.5 rounded-full animate-pulse blur-[3px] opacity-70 pointer-events-none"
                    style={{ backgroundColor: robot.color }}
                  />
                )}

                <svg
                  width="28"
                  height="34"
                  viewBox="0 0 14 17"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    filter: `drop-shadow(0 0 10px ${robot.glowColor})`,
                  }}
                  className={`transition-transform duration-200 group-hover:scale-125 ${
                    !robot.isActiveDuty ? 'opacity-70 group-hover:opacity-100' : 'opacity-100'
                  }`}
                >
                  {/* Antenna */}
                  <rect x="6" y="0" width="2" height="2" fill={robot.color} />
                  <rect x="5" y="1" width="4" height="1" fill="#ffffff" fillOpacity="0.9" />

                  {/* Head Unit */}
                  <rect x="2" y="2" width="10" height="6" fill={robot.color} rx="1" />
                  <rect x="3" y="3" width="8" height="4" fill="#040814" />

                  {/* Glowing Eye Visor (Active scanning blink) */}
                  <rect x="4" y="4" width="2" height="2" fill="#ffffff" />
                  <rect x="8" y="4" width="2" height="2" fill="#ffffff" />
                  <rect x="4" y="4" width="6" height="2" fill={robot.color} fillOpacity="0.4" />

                  {/* Neck */}
                  <rect x="5" y="8" width="4" height="1" fill="#030712" />

                  {/* Body / Chest */}
                  <rect x="1" y="9" width="12" height="5" fill={robot.color} rx="1" />
                  <rect x="3" y="10" width="8" height="3" fill="#040814" />
                  <rect x="6" y="11" width="2" height="1" fill="#ffffff" />

                  {/* Legs */}
                  <rect x="3" y="14" width="2" height="3" fill={robot.color} />
                  <rect x="9" y="14" width="2" height="3" fill={robot.color} />
                  <rect x="2" y="16" width="3" height="1" fill="#ffffff" fillOpacity="0.8" />
                  <rect x="9" y="16" width="3" height="1" fill="#ffffff" fillOpacity="0.8" />
                </svg>

                {/* Ground Neon Shadow Reflection */}
                <motion.div
                  animate={{
                    scaleX: [1, 0.7, 1],
                    opacity: [0.8, 0.3, 0.8],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.85 + index * 0.1,
                    ease: 'easeInOut',
                  }}
                  className="w-6 h-1 rounded-full blur-[1px] mt-0.5"
                  style={{ backgroundColor: robot.color }}
                />
              </motion.div>

              {/* Status Tag */}
              <div className="flex items-center gap-0.5 mt-0.5">
                <span
                  className={`text-[7.5px] font-black tracking-wider transition-colors ${
                    showBubble ? robot.textColor : 'text-slate-400'
                  }`}
                >
                  {robot.title}
                </span>
                <span className="text-[6.5px] text-slate-500 font-mono">
                  [{robot.stateBadge}]
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom Live Action Ticker (Connected strictly to Active Working Agent) */}
      <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 flex-shrink-0 z-20 relative">
        <div className="flex items-center gap-1.5 text-slate-300 min-w-0 flex-1 truncate mr-2">
          <Terminal className="w-3 h-3 text-cyan-400 flex-shrink-0" />
          <span className="text-cyan-400 font-bold flex-shrink-0">
            [{robots[activeSpeechIndex]?.title}]:
          </span>
          <span className="text-slate-200 truncate text-[9.5px]">
            {robots[activeSpeechIndex]?.liveAction}
          </span>
        </div>
        <span className="text-slate-400 flex-shrink-0 text-[9px]">
          Duty: <span className="text-emerald-400 font-bold">{robots[activeSpeechIndex]?.stateBadge}</span>
        </span>
      </div>
    </div>
  );
};
