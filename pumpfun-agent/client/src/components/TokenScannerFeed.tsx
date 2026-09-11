import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radar, 
  Clock, 
  ExternalLink, 
  ShieldCheck, 
  ShieldX, 
  Flame, 
  Sparkles, 
  Copy, 
  Check, 
  Search, 
  Zap, 
  Radio, 
  Activity,
  Layers
} from 'lucide-react';
import { ITokenData, IAuditResult } from '../types';

interface TokenFeedItem {
  token: ITokenData;
  audit?: IAuditResult;
}

interface TokenScannerFeedProps {
  tokens: TokenFeedItem[];
}

export const TokenScannerFeed: React.FC<TokenScannerFeedProps> = ({ tokens }) => {
  const [filterMode, setFilterMode] = useState<'all' | 'viral' | 'passed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedMint, setCopiedMint] = useState<string | null>(null);

  const handleCopyMint = (mint: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(mint);
    setCopiedMint(mint);
    setTimeout(() => setCopiedMint(null), 1800);
  };

  const viralCount = tokens.filter((t) => t.token.narrativeScore >= 0.70).length;
  const passedCount = tokens.filter((t) => t.audit?.passed).length;

  const filteredTokens = tokens.filter((item) => {
    const { token, audit } = item;
    const matchesFilter = 
      filterMode === 'all' ? true :
      filterMode === 'viral' ? token.narrativeScore >= 0.70 :
      Boolean(audit?.passed);

    const matchesSearch = 
      !searchQuery.trim() ||
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.mint.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="glass-panel p-4 md:p-5 rounded-2xl border border-cyber-border h-full flex flex-col relative overflow-hidden bg-gradient-to-b from-slate-950/80 via-[#0a1020]/90 to-[#070b16]/95 backdrop-blur-xl shadow-2xl">
      {/* Top Cyber Ambient Glow */}
      <div className="absolute -top-16 -right-16 w-52 h-52 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-16 -left-16 w-52 h-52 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Section */}
      <div className="flex flex-col gap-3 pb-3.5 border-b border-white/10 mb-3.5 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Title & Live Status */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyber-neonCyan shadow-glow-cyan">
              <Radar className="w-4 h-4 animate-spin-slow" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs md:text-sm font-mono font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-emerald-300">
                  Live Mempool Stream & 3-Layer Audit
                </h3>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5 animate-pulse" />
                  ONLINE
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400">
                Solana pump.fun contract creations intercepted in real-time
              </p>
            </div>
          </div>

          {/* Scanned Counter Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-mono text-[11px]">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span>SCANNED:</span>
            <span className="font-bold text-cyan-300">{tokens.length}</span>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5 font-mono text-[10px]">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg transition-all font-semibold flex items-center gap-1 ${
                filterMode === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3 h-3" />
              ALL ({tokens.length})
            </button>

            <button
              onClick={() => setFilterMode('viral')}
              className={`px-2.5 py-1 rounded-lg transition-all font-semibold flex items-center gap-1 ${
                filterMode === 'viral'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              <Flame className="w-3 h-3 text-amber-400" />
              VIRAL &ge; 0.70 ({viralCount})
            </button>

            <button
              onClick={() => setFilterMode('passed')}
              className={`px-2.5 py-1 rounded-lg transition-all font-semibold flex items-center gap-1 ${
                filterMode === 'passed'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              AUDIT PASSED ({passedCount})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-slate-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search symbol, name, mint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-1 text-[10px] font-mono bg-black/50 border border-white/10 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-36 sm:w-44 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Body: Tokens List or Holographic Cyber Radar Empty State */}
      {filteredTokens.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center relative z-10">
          {/* Holographic Radar Animation */}
          <div className="relative w-36 h-36 flex items-center justify-center mb-5">
            {/* Outermost Pulsing Ring */}
            <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping opacity-30" />
            {/* Middle Grid Ring */}
            <div className="absolute inset-3 rounded-full border border-dashed border-cyan-400/30" />
            {/* Inner Ring */}
            <div className="absolute inset-7 rounded-full border border-cyan-400/40 bg-cyan-950/20 backdrop-blur-sm" />
            
            {/* Rotating Conic Radar Sweep Beam */}
            <div 
              className="absolute inset-0 rounded-full animate-spin-slow pointer-events-none"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0deg 300deg, rgba(0, 229, 255, 0.35) 360deg)',
              }}
            />

            {/* Radar Crosshairs */}
            <div className="absolute w-full h-[1px] bg-cyan-500/20" />
            <div className="absolute h-full w-[1px] bg-cyan-500/20" />

            {/* Center Core Glowing Reticle */}
            <div className="relative z-10 w-8 h-8 rounded-full bg-cyan-500/30 border border-cyan-300 flex items-center justify-center shadow-glow-cyan">
              <Zap className="w-4 h-4 text-cyber-neonCyan animate-pulse" />
            </div>
          </div>

          {/* Telemetry Readout */}
          <div className="space-y-1.5 max-w-sm">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300 flex items-center justify-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              Scanning Pump.fun Mempool Stream
            </h4>
            <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
              {searchQuery || filterMode !== 'all'
                ? 'No tokens match current filters. Try switching tabs to "ALL" or clearing search.'
                : 'Listening for new token creation events. Real-time contracts will stream here instantly with AI viral evaluations.'}
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 border border-white/5 text-[9px] font-mono text-slate-500 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              WSS://PUMPPORTAL.FUN/API/DATA • 200MS LATENCY
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 space-y-2.5 overflow-y-auto pr-1.5 relative z-10 scrollbar-thin">
          <AnimatePresence initial={false}>
            {filteredTokens.map((item, idx) => {
              const { token, audit } = item;
              const passed = audit?.passed;
              const isHighViral = token.narrativeScore >= 0.70;

              // AI Model Tag Formatter
              const aiLabel = token.aiModel?.includes('nex') 
                ? 'NEX-AGI Free' 
                : token.aiModel?.includes('glm') 
                ? 'GLM 5.3' 
                : token.aiModel?.includes('deepseek') 
                ? 'DeepSeek V4' 
                : 'AI Engine';

              return (
                <motion.div
                  key={`${token.mint}-${idx}`}
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`relative p-3.5 rounded-xl border transition-all duration-300 group overflow-hidden ${
                    isHighViral && passed
                      ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-[#081524]/90 border-emerald-500/40 shadow-glow-green/20'
                      : isHighViral
                      ? 'bg-gradient-to-r from-amber-950/30 via-slate-900/80 to-[#081524]/90 border-amber-500/40 shadow-glow-cyan/15'
                      : passed
                      ? 'bg-cyber-neonGreen/5 border-cyber-neonGreen/30'
                      : 'bg-slate-900/70 border-white/10 hover:border-cyan-500/40 hover:bg-slate-900/90'
                  }`}
                >
                  {/* Left Edge Glowing Indicator Bar */}
                  <div 
                    className={`absolute left-0 top-0 bottom-0 w-1 ${
                      isHighViral && passed
                        ? 'bg-gradient-to-b from-amber-400 via-emerald-400 to-teal-400 shadow-glow-green'
                        : isHighViral
                        ? 'bg-gradient-to-b from-amber-400 to-orange-500 shadow-glow-cyan'
                        : passed
                        ? 'bg-emerald-400 shadow-glow-green'
                        : 'bg-slate-700 group-hover:bg-cyan-400 transition-colors'
                    }`}
                  />

                  {/* Top Row: Token Thumbnail, Symbol, Name & Narrative Score */}
                  <div className="flex items-start justify-between gap-2.5 mb-2 pl-1.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Token Avatar / Image */}
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-950 border border-white/10 flex-shrink-0 flex items-center justify-center shadow-md">
                        {token.image ? (
                          <img
                            src={token.image}
                            alt={token.symbol}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : null}
                        {/* Fallback Letter Avatar */}
                        <span className="font-mono font-black text-sm text-cyan-400 uppercase select-none">
                          {token.symbol.slice(0, 2)}
                        </span>
                      </div>

                      {/* Symbol, Name & Contract Mint */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black font-mono text-sm md:text-base text-white tracking-wide truncate group-hover:text-cyan-300 transition-colors">
                            ${token.symbol}
                          </span>
                          {isHighViral && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-bold flex items-center gap-0.5 animate-pulse">
                              <Flame className="w-2.5 h-2.5 text-amber-400" />
                              VIRAL TARGET
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                          <span className="truncate max-w-[130px] sm:max-w-[180px]">
                            {token.name}
                          </span>
                          <span className="text-slate-600">•</span>
                          {/* Copy Mint Button */}
                          <button
                            onClick={(e) => handleCopyMint(token.mint, e)}
                            title="Copy Token Mint Address"
                            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-300 transition-colors bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded border border-white/5"
                          >
                            <span>{token.mint.slice(0, 4)}...{token.mint.slice(-4)}</span>
                            {copiedMint === token.mint ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Narrative Score Pill */}
                    <div className="flex flex-col items-end flex-shrink-0">
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-mono text-xs font-black transition-all ${
                          isHighViral
                            ? 'bg-gradient-to-r from-amber-500/20 to-emerald-500/20 text-amber-300 border border-amber-500/50 shadow-glow-cyan'
                            : token.narrativeScore >= 0.50
                            ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                            : 'bg-slate-800/80 text-slate-400 border border-white/5'
                        }`}
                      >
                        {isHighViral && <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />}
                        <span>{(token.narrativeScore * 100).toFixed(0)}%</span>
                        <span className="text-[10px] text-slate-400 font-normal">SCORE</span>
                      </div>

                      {/* Mini Score Bar */}
                      <div className="w-16 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isHighViral
                              ? 'bg-gradient-to-r from-amber-400 to-emerald-400'
                              : token.narrativeScore >= 0.5
                              ? 'bg-cyan-400'
                              : 'bg-slate-600'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, token.narrativeScore * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* AI Narrative Reasoning Box */}
                  {token.aiReasoning && (
                    <div className="ml-1.5 mb-2 p-2 rounded-lg bg-black/50 border border-cyan-950/50 text-[10px] font-mono text-cyan-200/90 flex items-start gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/60 text-cyan-400 font-bold text-[9px] flex items-center gap-1 flex-shrink-0">
                        <Sparkles className="w-2.5 h-2.5" />
                        {aiLabel}
                      </span>
                      <p className="leading-snug italic text-slate-300">
                        &ldquo;{token.aiReasoning}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Keywords Tags & Direct Link */}
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400 mb-2 pl-1.5">
                    <div className="flex flex-wrap gap-1">
                      {token.keywordsFound.length > 0 ? (
                        token.keywordsFound.map((kw, kIdx) => (
                          <span
                            key={kIdx}
                            className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/5 text-cyan-300/90 font-medium"
                          >
                            #{kw}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-600 text-[9px]">No viral keywords</span>
                      )}
                    </div>

                    <a
                      href={`https://pump.fun/${token.mint}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-200 transition-colors font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 flex-shrink-0"
                    >
                      <span>PUMP.FUN</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  {/* 3-Layer Security Audit Status Banner */}
                  <div className="ml-1.5 pt-2 border-t border-white/5">
                    {audit ? (
                      <div
                        className={`p-2 rounded-lg font-mono text-[10px] border flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 ${
                          passed
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          {passed ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>KILL-VOTE APPROVED (SAFE)</span>
                            </>
                          ) : (
                            <>
                              <ShieldX className="w-3.5 h-3.5 text-rose-400" />
                              <span>KILL-VOTE VETOED (SECURITY FAIL)</span>
                            </>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[9px] text-slate-400">
                          <span className={audit.devHoldingPercent === 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                            Dev: {audit.devHoldingPercent === 0 ? '0% ✓' : `${audit.devHoldingPercent.toFixed(1)}% ✗`}
                          </span>
                          <span>•</span>
                          <span>Top 10: {(audit.top10HoldingPercent ?? audit.top5HoldingPercent)?.toFixed(1)}%</span>
                          <span>•</span>
                          <span className={(token.holdersCount ?? audit.holdersCount ?? 0) >= 30 ? 'text-cyan-300' : 'text-amber-400'}>
                            Holders: {token.holdersCount ?? audit.holdersCount ?? 0} (Min: 30)
                          </span>
                          <span>•</span>
                          <span className={audit.mintAuthorityDisabled ? 'text-emerald-400' : 'text-rose-400'}>
                            Mint/Freeze: {audit.mintAuthorityDisabled && audit.freezeAuthorityDisabled ? 'REVOKED ✓' : 'ACTIVE ✗'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-amber-400 animate-spin" />
                          <span>Auditing authorities, mint/freeze & dev distribution...</span>
                        </div>
                        <span className="text-[9px] text-slate-600">3-LAYER RPC</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
