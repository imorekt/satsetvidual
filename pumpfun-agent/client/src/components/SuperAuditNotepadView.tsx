import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Copy, 
  Check, 
  ShieldAlert, 
  Zap, 
  Trash2, 
  Flame, 
  Sparkles, 
  Bug, 
  Send, 
  MessageSquare, 
  Cpu, 
  Bot, 
  User, 
  ShieldCheck, 
  RefreshCw, 
  Code, 
  Activity 
} from 'lucide-react';
import { IAuditNotepadEntry, ISystemBugNote, ILossAutopsyNote, IAgent6Stats } from '../types';

interface SuperAuditNotepadViewProps {
  entries: IAuditNotepadEntry[];
  stats: IAgent6Stats;
  onClearNotes?: () => void;
  onSimulateLossAutopsy?: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

export const SuperAuditNotepadView: React.FC<SuperAuditNotepadViewProps> = ({
  entries,
  stats,
  onClearNotes,
  onSimulateLossAutopsy,
}) => {
  const [activeTabMode, setActiveTabMode] = useState<'NOTEPAD' | 'CHAT'>('NOTEPAD');
  
  // Notepad state
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'LOSS_AUTOPSY' | 'SYSTEM_BUG'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [bugCategory, setBugCategory] = useState<ISystemBugNote['category']>('UI State');
  const [bugDesc, setBugDesc] = useState('');
  const [bugExpected, setBugExpected] = useState('');
  const [isSubmittingBug, setIsSubmittingBug] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('agent6_chat_history');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Halo! Saya **Super Agen 6 (The Creator & Master Sentinel)**.

Sebagai *Lead Architect* dari terminal **Pure Auto Copy Trade**, saya memiliki akses audit mendalam ke:
• **Real-Time On-Chain Pricing & PnL Engine (1s Ticks)**
• **Eksekusi 100% Mandiri Mirroring Whale & Influencer**
• **Forensic Loss Autopsy**: Analisis mendalam penyebab rugi (Wash Trading, Dev Micro-Dump, MEV/High Slippage, Dead Volume)
• **Audit Kode & Bug Kodingan**: Perbaikan UI state, RPC sync, dan perancangan strategi bot.

Silakan pilih topik di bawah atau ketik pertanyaan langsung!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'nex-agi/nex-n2.5-pro:free',
      },
    ];
  });
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('agent6_chat_history', JSON.stringify(chatMessages));
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredEntries = entries.filter((e) => {
    if (filterType !== 'ALL' && e.type !== filterType) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (e.type === 'LOSS_AUTOPSY') {
      return (
        e.tokenSymbol.toLowerCase().includes(q) ||
        e.primaryCause.toLowerCase().includes(q) ||
        e.recommendedStrategy.toLowerCase().includes(q) ||
        e.claudeFixPrompt.toLowerCase().includes(q)
      );
    } else {
      return (
        e.category.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.expectedVsActual.toLowerCase().includes(q)
      );
    }
  });

  const generateFullExportText = () => {
    const header = `================================================================================
📝 SUPER AUDIT & STRATEGY NOTEPAD - EXPORT
AI Chief Risk Officer & QA Sentinel: Master Agent 6
Generated At: ${new Date().toLocaleString()}
Total System Bugs: ${stats.systemBugsCount} | Total Loss Autopsies: ${stats.lossAutopsiesCount}
================================================================================\n\n`;

    const body = entries
      .map((entry) => {
        if (entry.type === 'SYSTEM_BUG') {
          return `--------------------------------------------------------------------------------
⚠️ [SYSTEM BUG / ANOMALY DETECTED] Timestamp: ${entry.timestamp}
• Category   : ${entry.category}
• Severity   : ${entry.severity}
• Description: ${entry.description}
• Expected vs Actual: ${entry.expectedVsActual}
--------------------------------------------------------------------------------\n`;
        } else {
          const adjustments = entry.parameterAdjustments
            .map((p) => `  * [${p.parameter}]: Ubah dari ${p.from} menjadi ${p.to}`)
            .join('\n');

          return `--------------------------------------------------------------------------------
🚨 [DEEP LOSS AUTOPSY - TRADE #${entry.tradeNumber}] Token: $${entry.tokenSymbol}
• Time Elapsed : ${entry.timeElapsedSeconds}s | Exit Trigger: ${entry.exitTrigger}
• PnL Result   : ${entry.pnlPercent.toFixed(2)}% (Net SOL: ${entry.pnlSol.toFixed(4)} SOL)

🔍 1. AKAR PENYEBAB KERUGIAN (WHY IT FAILED):
- Primary Cause   : ${entry.primaryCause}
- Technical Detail: ${entry.technicalDetail}
- Gas/Impact Cost : ${entry.gasImpactCost}

💡 2. DIAGNOSIS STRATEGI & PERBAIKAN:
- Parameter Adjustments : 
${adjustments}
- Recommended Strategy  : ${entry.recommendedStrategy}
- Actionable Tactic     : ${entry.actionableTactic}

🛠️ 3. PROMPT PERBAIKAN SIAP SALIN UNTUK CLAUDE:
${entry.claudeFixPrompt}
--------------------------------------------------------------------------------\n`;
        }
      })
      .join('\n');

    return header + body;
  };

  const handleCopyAll = () => {
    const fullText = generateFullExportText();
    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    showToast('📋 Berhasil menyalin seluruh Full Loss Autopsy & Fix Prompt ke Clipboard!');
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('✨ Claude Fix Prompt tersalin!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReportBugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugDesc.trim()) return;
    setIsSubmittingBug(true);
    try {
      await fetch('/api/agent6/bug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: bugCategory,
          description: bugDesc,
          expectedVsActual: bugExpected || 'Expected normal state operation',
          severity: 'HIGH',
        }),
      });
      setBugDesc('');
      setBugExpected('');
      setIsBugModalOpen(false);
      showToast('⚠️ System Bug berhasil dicatat oleh Agen 6!');
    } catch {
      showToast('Gagal mengirim bug report');
    } finally {
      setIsSubmittingBug(false);
    }
  };

  // ==========================================
  // Chat Handlers
  // ==========================================

  const handleSendChat = async (presetText?: string) => {
    const textToSend = (presetText || chatInput).trim();
    if (!textToSend || isSendingChat) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!presetText) setChatInput('');
    setIsSendingChat(true);

    try {
      const history = chatMessages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/agent6/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, history }),
      });

      const data = await res.json();
      if (data.success && data.reply) {
        const assistantMsg: ChatMessage = {
          id: `agent6-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: data.model || 'nex-agi/nex-n2.5-pro:free',
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(data.message || 'Gagal memproses respon');
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Maaf, terjadi kendala saat menghubungi AI service: ${err.message}. Silakan coba beberapa saat lagi.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'Agent 6 Error Guard',
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleClearChat = () => {
    setChatMessages([
      {
        id: 'welcome-cleared',
        role: 'assistant',
        content: `Riwayat obrolan telah dibersihkan. Saya siap menjawab pertanyaan audit dan strategi Copy Trade baru!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'nex-agi/nex-n2.5-pro:free',
      },
    ]);
    showToast('🧹 Obrolan dibersihkan.');
  };

  const quickPrompts = [
    '⚡ Kenapa tadi trade terakhir rugi?',
    '📊 Analisis performa Copy Trade hari ini',
    '👛 Audit performa wallet influencer aktif',
    '🛡️ Bagaimana mengatasi Micro-Dump & High Slippage?',
    '💻 Jelaskan arsitektur Pure Copy Trade & PnL realtime 1s',
  ];

  // Helper simple markdown renderer for chat bubbles
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-2 leading-relaxed text-slate-200">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />;

          // Headers
          if (line.startsWith('### ')) {
            return <h4 key={idx} className="text-base font-bold text-amber-300 mt-2">{line.replace('### ', '')}</h4>;
          }
          if (line.startsWith('## ')) {
            return <h3 key={idx} className="text-lg font-bold text-amber-400 mt-3">{line.replace('## ', '')}</h3>;
          }
          if (line.startsWith('# ')) {
            return <h2 key={idx} className="text-xl font-black text-amber-400 mt-3">{line.replace('# ', '')}</h2>;
          }

          // Bullet points
          if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
            const text = line.replace(/^[•\-\*]\s*/, '');
            return (
              <div key={idx} className="flex items-start space-x-2 pl-2">
                <span className="text-amber-400 font-bold mt-0.5">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatInline(text) }} />
              </div>
            );
          }

          return <p key={idx} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />;
        })}
      </div>
    );
  };

  const formatInline = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-amber-300 font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-slate-300">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-black/60 text-cyan-300 px-1.5 py-0.5 rounded font-mono text-xs border border-cyan-500/20">$1</code>');
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 text-slate-950 px-5 py-2.5 rounded-xl font-bold shadow-2xl backdrop-blur border border-amber-300/40 flex items-center space-x-2"
          >
            <Sparkles className="w-5 h-5" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header with Mode Switcher */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-400/40">
            <Cpu className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-black bg-gradient-to-r from-amber-400 via-orange-300 to-red-400 bg-clip-text text-transparent">
                SUPER AGENT 6: THE CREATOR & MASTER SENTINEL
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                nex-n2.5-pro:free
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Lead Architect & Chief Strategy Director | Pure Copy Trade & Real-Time Loss Forensic Engine
            </p>
          </div>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTabMode('NOTEPAD')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTabMode === 'NOTEPAD'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>📝 SYSTEM & LOSS AUDIT NOTEPAD</span>
            {entries.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTabMode === 'NOTEPAD' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
              }`}>
                {entries.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTabMode('CHAT')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTabMode === 'CHAT'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>💬 CHAT WITH MASTER AGENT 6</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: SYSTEM & LOSS AUDIT NOTEPAD */}
      {/* ========================================================================= */}
      {activeTabMode === 'NOTEPAD' && (
        <div className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
          {/* Top Status & Action Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status Sentinel</div>
                <div className="text-sm font-black text-emerald-400 flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{stats.status}</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Loss Autopsies</div>
                <div className="text-xl font-black text-rose-400 mt-0.5">
                  {stats.lossAutopsiesCount}
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <Flame className="w-5 h-5 text-rose-400" />
              </div>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">System Bug Notes</div>
                <div className="text-xl font-black text-yellow-400 mt-0.5">
                  {stats.systemBugsCount}
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                <Bug className="w-5 h-5 text-yellow-400" />
              </div>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col justify-center gap-2">
              <button
                onClick={handleCopyAll}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-lg text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-amber-500/20"
              >
                {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedAll ? 'TEREXPORT KE CLIPBOARD' : '📋 EXPORT FULL FIX PROMPTS'}</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsBugModalOpen(true)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-2 py-1 rounded-md text-[11px] flex items-center justify-center space-x-1 border border-slate-700 transition-all"
                >
                  <Bug className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Catat Bug</span>
                </button>
                {onClearNotes && (
                  <button
                    onClick={onClearNotes}
                    title="Bersihkan semua catatan di Notepad"
                    className="flex-1 bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 font-semibold px-2 py-1 rounded-md text-[11px] flex items-center justify-center space-x-1 border border-slate-700 hover:border-rose-500/40 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Bersihkan</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filter & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center space-x-2">
              {(['ALL', 'LOSS_AUTOPSY', 'SYSTEM_BUG'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterType(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterType === mode
                      ? 'bg-slate-800 text-amber-400 border border-amber-500/40 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode === 'ALL' ? 'Semua Catatan' : mode === 'LOSS_AUTOPSY' ? '🚨 Loss Autopsies' : '⚠️ System Bugs'}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2 flex-1 max-w-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari token, penyebab, atau prompt..."
                className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
              />
              {onClearNotes && entries.length > 0 && (
                <button
                  onClick={onClearNotes}
                  title="Bersihkan Semua Catatan"
                  className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* List of Notes */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {filteredEntries.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-800/80 rounded-2xl p-6 text-center text-slate-500">
                <ShieldCheck className="w-12 h-12 text-emerald-500/40 mb-3" />
                <div className="text-base font-bold text-slate-300">Belum Ada Catatan Kerugian atau Bug</div>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  Sistem Copy Trade berjalan optimal. Setiap trade yang rugi (PnL &lt; 0%) atau anomali sistem akan dianalisis otomatis di sini oleh Agen 6.
                </p>
                {onSimulateLossAutopsy && (
                  <button
                    onClick={onSimulateLossAutopsy}
                    className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center space-x-1.5"
                  >
                    <Flame className="w-4 h-4 text-rose-400" />
                    <span>Simulasikan Loss Autopsy Sekarang</span>
                  </button>
                )}
              </div>
            ) : (
              filteredEntries.map((entry) => {
                if (entry.type === 'SYSTEM_BUG') {
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-900/90 border border-yellow-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-500" />
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center space-x-2.5">
                          <span className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                            <Bug className="w-5 h-5" />
                          </span>
                          <div>
                            <div className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                              [SYSTEM BUG / ANOMALY DETECTED]
                            </div>
                            <h4 className="text-base font-bold text-slate-100">{entry.category}</h4>
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">{entry.timestamp}</span>
                      </div>
                      <div className="mt-3 text-xs text-slate-300 font-mono bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                        {entry.description}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        <strong className="text-slate-300">Expected vs Actual:</strong> {entry.expectedVsActual}
                      </div>
                    </motion.div>
                  );
                }

                const loss = entry as ILossAutopsyNote;
                return (
                  <motion.div
                    key={loss.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900/95 border border-rose-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden space-y-5"
                  >
                    <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-rose-500 via-orange-500 to-amber-500" />

                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div className="flex items-center space-x-3">
                        <span className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400">
                          <Flame className="w-6 h-6" />
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-black text-slate-100">${loss.tokenSymbol}</h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              TRADE #{loss.tradeNumber}
                            </span>
                            <span className="text-xs font-bold text-rose-400 font-mono">
                              {loss.pnlPercent.toFixed(2)}% ({loss.pnlSol.toFixed(4)} SOL)
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 font-mono">
                            Durasi: {loss.timeElapsedSeconds}s | Trigger: <span className="text-amber-400 font-semibold">{loss.exitTrigger}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500 font-mono">{loss.timestamp}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700">
                          {loss.aiModel || 'nex-agi/nex-n2.5-pro:free'}
                        </span>
                      </div>
                    </div>

                    {/* Forensic Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                        <div className="text-xs font-bold text-rose-400 flex items-center space-x-1.5 uppercase tracking-wider">
                          <ShieldAlert className="w-4 h-4" />
                          <span>1. Akar Penyebab Kerugian</span>
                        </div>
                        <div className="text-sm font-black text-slate-100">{loss.primaryCause}</div>
                        <p className="text-xs text-slate-400 leading-relaxed">{loss.technicalDetail}</p>
                        <div className="text-[11px] text-slate-500 font-mono mt-1">
                          Gas Impact: <span className="text-slate-300">{loss.gasImpactCost}</span>
                        </div>
                      </div>

                      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                        <div className="text-xs font-bold text-amber-400 flex items-center space-x-1.5 uppercase tracking-wider">
                          <Zap className="w-4 h-4" />
                          <span>2. Diagnosis Strategi & Taktik</span>
                        </div>
                        <div className="text-sm font-black text-amber-300">{loss.recommendedStrategy}</div>
                        <p className="text-xs text-slate-400 leading-relaxed">{loss.actionableTactic}</p>
                        
                        {loss.parameterAdjustments && loss.parameterAdjustments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Parameter Adjustments:</div>
                            {loss.parameterAdjustments.map((p, pIdx) => (
                              <div key={pIdx} className="text-[11px] font-mono text-cyan-300 flex items-center gap-1">
                                <span>[{p.parameter}]:</span>
                                <span className="text-rose-400 line-through">{p.from}</span>
                                <span>➔</span>
                                <span className="text-emerald-400 font-bold">{p.to}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Claude Ready-to-Copy Prompt */}
                    <div className="bg-gradient-to-br from-slate-950 to-slate-900 p-4 rounded-xl border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black text-amber-400 flex items-center space-x-1.5 uppercase tracking-wider">
                          <Code className="w-4 h-4 text-amber-400" />
                          <span>3. Prompt Perbaikan Siap Salin untuk Claude / Antigravity</span>
                        </div>
                        <button
                          onClick={() => handleCopyPrompt(loss.id, loss.claudeFixPrompt)}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs flex items-center space-x-1 transition-all shadow-md shadow-amber-500/20"
                        >
                          {copiedId === loss.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === loss.id ? 'TERSALIN!' : '📋 SALIN PROMPT CLAUDE'}</span>
                        </button>
                      </div>
                      <pre className="text-xs font-mono text-slate-200 bg-slate-950 p-3 rounded-lg border border-slate-800 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                        {loss.claudeFixPrompt}
                      </pre>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: INTERACTIVE CHAT WITH MASTER AGENT 6 */}
      {/* ========================================================================= */}
      {activeTabMode === 'CHAT' && (
        <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
          {/* Chat Assistant Info Bar */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                  <span>Chat Langsung dengan Lead Architect & Master Sentinel</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-[11px] text-slate-400">
                  Model: <span className="text-cyan-300 font-mono">nex-agi/nex-n2.5-pro:free</span> | Konteks Live: On-Chain Pricing 1s, Wallets & Portofolio
                </div>
              </div>
            </div>

            <button
              onClick={handleClearChat}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 flex items-center space-x-1 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Bersihkan Obrolan</span>
            </button>
          </div>

          {/* Chat Messages List */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            {chatMessages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isUser 
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                      : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20'
                  }`}>
                    {isUser ? <User className="w-4 h-4 font-bold" /> : <Bot className="w-4 h-4 font-bold" />}
                  </div>

                  <div className={`max-w-[80%] rounded-2xl p-4 text-xs ${
                    isUser
                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-100 rounded-tr-none'
                      : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none shadow-lg'
                  }`}>
                    <div className="flex items-center justify-between gap-4 mb-1.5 pb-1 border-b border-slate-800/60 text-[10px]">
                      <span className="font-bold text-slate-400">
                        {isUser ? 'Anda' : 'Super Agen 6 (Creator AI)'}
                      </span>
                      <span className="text-slate-500 font-mono">{msg.timestamp}</span>
                    </div>

                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      renderFormattedContent(msg.content)
                    )}

                    {!isUser && msg.model && (
                      <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                        <span>Model: {msg.model}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            showToast('📋 Jawaban Agen 6 tersalin!');
                          }}
                          className="hover:text-amber-400 flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Salin</span>
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {isSendingChat && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 flex items-center justify-center animate-pulse">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl rounded-tl-none p-4 text-xs text-cyan-300 flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Super Agen 6 sedang menganalisis audit & merancang strategi...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase flex-shrink-0">Rekomendasi:</span>
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSendChat(qp)}
                disabled={isSendingChat}
                className="whitespace-nowrap px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 rounded-full border border-slate-800 hover:border-amber-500/40 text-[11px] transition-all flex-shrink-0"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="flex items-center space-x-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              placeholder="Ketik pertanyaan untuk Master Agen 6 (misal: 'Kenapa trade terakhir rugi?' atau 'Audit wallet influencer')..."
              disabled={isSendingChat}
              className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <button
              onClick={() => handleSendChat()}
              disabled={!chatInput.trim() || isSendingChat}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-black rounded-lg text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-amber-500/20"
            >
              <Send className="w-4 h-4" />
              <span>Kirim</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MANUAL BUG REPORT MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isBugModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-yellow-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2 text-yellow-400 font-bold">
                  <Bug className="w-5 h-5" />
                  <span>Catat System Bug / UI Anomaly</span>
                </div>
                <button onClick={() => setIsBugModalOpen(false)} className="text-slate-500 hover:text-slate-300 text-sm">
                  ✕
                </button>
              </div>

              <form onSubmit={handleReportBugSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Kategori Bug:</label>
                  <select
                    value={bugCategory}
                    onChange={(e) => setBugCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="UI State">UI State (Reset Tab / Component Render)</option>
                    <option value="Execution Delay">Execution Delay (&gt;1000ms Delay)</option>
                    <option value="Network RPC">Network RPC (WebSocket / Blockhash)</option>
                    <option value="API Failure">API Failure (DexScreener / PumpFun API)</option>
                    <option value="Safety Anomaly">Safety Anomaly (SL/TP Trigger)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Deskripsi Anomali:</label>
                  <textarea
                    rows={3}
                    value={bugDesc}
                    onChange={(e) => setBugDesc(e.target.value)}
                    placeholder="Contoh: Saat berpindah tab, grafik PnL tidak sengaja ter-reset..."
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Expected vs Actual:</label>
                  <input
                    type="text"
                    value={bugExpected}
                    onChange={(e) => setBugExpected(e.target.value)}
                    placeholder="Expected: PnL berjalan di background. Actual: Ter-reset ke 0."
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBugModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingBug || !bugDesc.trim()}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black rounded-lg disabled:opacity-50"
                  >
                    {isSubmittingBug ? 'Menyimpan...' : 'Simpan Bug Report'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
