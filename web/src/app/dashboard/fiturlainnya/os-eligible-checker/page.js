'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function OsEligibleCheckerPage() {
    const [slug, setSlug] = useState('');
    const [privateKeys, setPrivateKeys] = useState('');
    const [logs, setLogs] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const logsEndRef = useRef(null);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const addLog = (msg, type = 'info') => {
        setLogs(prev => [...prev, { id: Date.now() + Math.random(), msg, type }]);
    };

    const startChecking = async () => {
        setIsRunning(true);
        setLogs([]);
        try {
            if (!slug.trim()) throw new Error("Collection Slug is required.");
            const keys = privateKeys.split('\n').map(k => k.trim()).filter(k => k);
            if (!keys.length) throw new Error("No private keys provided.");

            setProgress({ current: 0, total: keys.length });
            addLog(`🚀 Starting OpenSea Eligibility Check for slug: ${slug}`);
            addLog(`Found ${keys.length} wallet(s) to check.`, 'info');

            for (let i = 0; i < keys.length; i++) {
                try {
                    let pk = keys[i];
                    // Clean PK same as python script (remove | GUARANTEED etc)
                    pk = pk.split('|')[0].trim().split(' ')[0].trim();
                    if (!pk) continue;

                    addLog(`[Wallet ${i + 1}/${keys.length}] Checking eligibility...`, 'info');

                    const response = await fetch('/api/os-checker', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pk, slug: slug.trim() })
                    });

                    const data = await response.json();

                    if (!data.success) {
                        addLog(`[Wallet ${i + 1}] Error: ${data.error || 'Unknown error'}\n${data.stderr || ''}`, 'error');
                    } else {
                        // Parse output and display nicely
                        const lines = data.output.split('\n').map(l => l.trim()).filter(l => l);
                        let hasResult = false;
                        for (const line of lines) {
                            if (line.includes('Stage')) {
                                hasResult = true;
                                if (line.includes('✅')) {
                                    addLog(`[Wallet ${i + 1}] ${line}`, 'success');
                                } else if (line.includes('❌')) {
                                    addLog(`[Wallet ${i + 1}] ${line}`, 'error');
                                } else {
                                    addLog(`[Wallet ${i + 1}] ${line}`, 'info');
                                }
                            }
                        }
                        if (!hasResult) {
                            addLog(`[Wallet ${i + 1}] Finished (No specific stage results found)`, 'warn');
                        }
                    }
                } catch (err) {
                    addLog(`[Wallet ${i + 1}] Error: ${err.message}`, 'error');
                }
                setProgress(p => ({ ...p, current: i + 1 }));
            }
            addLog("🎉 Checking finished successfully!", "success");
        } catch (err) {
            addLog(`Failed to start: ${err.message}`, 'error');
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div style={{ padding: '1.5rem', color: '#f8fafc', animation: 'fadeIn 0.5s ease-out', height: 'calc(100vh - 130px)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg viewBox="0 0 280 280" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '32px', height: '32px', display: 'inline-block' }}>
                        <path d="M140 280C217.32 280 280 217.32 280 140C280 62.6801 217.32 0 140 0C62.6801 0 0 62.6801 0 140C0 217.32 62.6801 280 140 280Z" fill="#2081E2" />
                        <path d="M211.597 121.735L178.697 101.99L170.81 97.4729L143.197 114.733L115.549 132.062L107.59 127.476L74.654 108.577C72.3394 107.249 69.4124 108.972 69.4124 111.724V149.658C69.4124 150.722 69.9678 151.725 70.892 152.261L103.791 172.043L111.678 176.56L139.292 159.299L166.939 141.97L174.899 146.556L207.834 165.454C210.149 166.782 213.076 165.059 213.076 162.308V124.374C213.111 123.31 212.556 122.271 211.597 121.735Z" fill="white" />
                        <path d="M211.597 185.088L178.697 204.832L170.81 209.35L143.197 192.089L115.549 174.76L107.59 179.346L74.654 198.244C72.3394 199.573 69.4124 197.849 69.4124 195.097V174.502L103.791 193.364L111.678 197.881L139.292 180.62L166.939 163.291L174.899 167.877L207.834 186.776C210.149 188.104 213.076 186.381 213.076 183.629V164.555C213.111 165.584 212.556 166.623 211.597 185.088Z" fill="white" />
                        <path d="M211.597 91.9568L178.697 72.2127L170.81 67.6957L143.197 84.9567L115.549 102.285L107.59 97.6994L74.654 78.8009C72.3394 77.4727 69.4124 79.1955 69.4124 81.9472V102.542L103.791 83.6807L111.678 79.1637L139.292 96.4247L166.939 113.754L174.899 109.168L207.834 90.2694C210.149 88.9412 213.076 90.664 213.076 93.4157V72.4897C213.111 71.4608 212.556 70.4213 211.597 91.9568Z" fill="white" />
                    </svg>
                    OS Eligible Checker
                </h1>
                <p style={{ color: '#94a3b8' }}>Cek status kelayakan (Eligibility) wallet untuk OpenSea Drops secara massal.</p>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '650px 1fr',
                gap: '2.5rem',
                alignItems: 'stretch',
                flex: 1,
                minHeight: 0
            }}>

                {/* LEFT PANEL - CONFIGURATION */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', minHeight: 0 }}>

                    <div style={{
                        background: 'rgba(30, 41, 59, 0.7)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        padding: '1.5rem 2rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '2rem'
                    }}>
                        <div style={{ width: '200px', flexShrink: 0 }}>
                            <label style={{ fontSize: '1.1rem', color: '#cbd5e1', fontWeight: '600', display: 'block' }}>1. Collection Slug</label>
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.3rem' }}>(contoh: blnkonrobinhood).</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <input
                                type="text"
                                placeholder="nama-koleksi-opensea"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                disabled={isRunning}
                                style={{
                                    width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white',
                                    padding: '0.8rem', borderRadius: '8px', outline: 'none', fontFamily: 'monospace'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', flex: 1 }}></div>
                        <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600', letterSpacing: '1px' }}>DATA WALLET</div>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', flex: 1 }}></div>
                    </div>

                    <div style={{
                        background: 'rgba(30, 41, 59, 0.7)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        padding: '1.5rem 2rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '2rem',
                        flex: 1,
                        minHeight: 0
                    }}>
                        <div style={{ width: '200px', flexShrink: 0 }}>
                            <label style={{ fontSize: '1.1rem', color: '#cbd5e1', fontWeight: '600', display: 'block' }}>2. Private Keys</label>
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.3rem' }}>Masukkan daftar Private Key (satu per baris).</div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ flex: 1, marginBottom: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                                <textarea
                                    className="transparent-scroll"
                                    placeholder="0x...\n0x..."
                                    value={privateKeys}
                                    onChange={(e) => setPrivateKeys(e.target.value)}
                                    disabled={isRunning}
                                    style={{
                                        flex: 1, width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white',
                                        padding: '0.8rem', borderRadius: '8px', outline: 'none', fontFamily: 'monospace', resize: 'none'
                                    }}
                                />
                            </div>
                            <button
                                onClick={startChecking}
                                disabled={isRunning || !slug || !privateKeys}
                                style={{
                                    width: '100%', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', color: 'white',
                                    border: 'none', padding: '1rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem',
                                    cursor: (isRunning || !slug || !privateKeys) ? 'not-allowed' : 'pointer',
                                    opacity: (isRunning || !slug || !privateKeys) ? 0.6 : 1, transition: 'all 0.2s'
                                }}
                            >
                                {isRunning ? '⏳ Checking in progress...' : '🚀 Mulai Pengecekan'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL - LOGS & PROGRESS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', minHeight: 0 }}>
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.9)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                        display: 'flex', flexDirection: 'column',
                        flex: 1, minHeight: 0, overflow: 'hidden'
                    }}>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                📡 Check Results
                            </div>
                            {progress.total > 0 && (
                                <div style={{ fontSize: '0.85rem', color: '#8b5cf6', fontWeight: 'bold' }}>
                                    Progress: {progress.current} / {progress.total}
                                </div>
                            )}
                        </div>

                        <div className="transparent-scroll" style={{ padding: '1rem', overflowY: 'auto', flex: 1, fontFamily: "'Fira Code', monospace", fontSize: '0.85rem' }}>
                            {logs.length === 0 ? (
                                <div style={{ color: '#475569', textAlign: 'center', marginTop: '4rem' }}>
                                    Belum ada hasil pengecekan. <br /> Masukkan data dan tekan tombol mulai.
                                </div>
                            ) : (
                                logs.map((log) => (
                                    <div key={log.id} style={{
                                        marginBottom: '0.5rem',
                                        padding: '0.5rem 0.8rem',
                                        borderRadius: '6px',
                                        background: log.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : log.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : log.type === 'warn' ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                                        color: log.type === 'error' ? '#fca5a5' : log.type === 'success' ? '#6ee7b7' : log.type === 'warn' ? '#fcd34d' : '#cbd5e1',
                                        borderLeft: `2px solid ${log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#10b981' : log.type === 'warn' ? '#f59e0b' : 'transparent'}`,
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {log.msg}
                                    </div>
                                ))
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .transparent-scroll::-webkit-scrollbar {
                    width: 6px;
                }
                .transparent-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }
                .transparent-scroll::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                }
                .transparent-scroll::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    );
}
