"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from "react-dom";
import "../monitoring.css"; 
import "../screenerv2/screenerv2.css"; // Reuse modal styling

const knownRpcs = [
    { value: "https://mainnet.base.org", label: "Base Mainnet" },
    { value: "https://developer-access-mainnet.base.org", label: "Base Developer" },
    { value: "https://base.llamarpc.com", label: "Llama RPC" },
    { value: "https://base.meowrpc.com", label: "Meow RPC" },
    { value: "https://base-mainnet.public.blastapi.io", label: "Blast API" }
];
const randomRpcString = "RANDOM_RPC_" + Math.random().toString(36).substring(7);

export default function BulkSellPage() {
    // --- Global Execution States ---
    const [logs, setLogs] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const terminalBodyRef = useRef(null);

    // --- Config Modal States ---
    const [profiles, setProfiles] = useState([]);
    const [selectedProfile, setSelectedProfile] = useState("");
    const [privateKey, setPrivateKey] = useState("");
    const [inputCa, setInputCa] = useState("");
    const [lpPool, setLpPool] = useState("");
    const [rpc, setRpc] = useState("https://");
    const [slippage, setSlippage] = useState("30");
    const [sellRatio, setSellRatio] = useState("100");
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [profileName, setProfileName] = useState("");
    
    // Unused in bulk-sell but needed for form matching
    const [tokenName, setTokenName] = useState("");
    const [tokenSymbol, setTokenSymbol] = useState("");
    
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [profileToDelete, setProfileToDelete] = useState("");
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const isRandom = rpc === randomRpcString;
    const isKnown = knownRpcs.some(r => r.value === rpc);

    const showToastMsg = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const fetchStatus = async () => {
        const telegramUser = localStorage.getItem('userName') || 'default_user';
        try {
            const res = await fetch(`/api/autosell/logs-all?userName=${telegramUser}`);
            if (res.ok) {
                const data = await res.json();
                const cleanLogs = (data.logs || "").replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
                const processedLogs = cleanLogs.split('\n').map(line => line.split('\r').pop()).filter(line => line.trim() !== '').join('\n');
                
                setLogs(prev => prev !== processedLogs ? processedLogs : prev);
                setIsRunning(data.isRunning);
            }
        } catch (e) { }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    // Auto scroll to bottom
    useEffect(() => {
        if (terminalBodyRef.current) {
            terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
        }
    }, [logs]);

    // --- Profile Logic ---
    const fetchProfiles = async () => {
        const telegramUser = localStorage.getItem('userName') || 'default_user';
        try {
            const response = await fetch(`/api/autosell/profiles?userName=${telegramUser}`, { cache: 'no-store' });
            const data = await response.json();
            if (response.ok && data.profiles) {
                setProfiles(data.profiles);
                const savedProfile = localStorage.getItem('activeProfile_bulk') || localStorage.getItem('activeProfile');
                if (savedProfile && data.profiles.includes(savedProfile)) {
                    setSelectedProfile(savedProfile);
                } else if (!selectedProfile) {
                    setSelectedProfile("");
                }
            }
        } catch (err) { }
    };

    useEffect(() => {
        fetchProfiles();
        const interval = setInterval(fetchProfiles, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchConfig = async () => {
            if (!selectedProfile) {
                setInputCa("");
                setLpPool("");
                setRpc("");
                setSlippage("");
                setSellRatio("");
                return;
            }
            const telegramUser = localStorage.getItem('userName') || 'default_user';
            const savedPk = localStorage.getItem(`pk_${telegramUser}_${selectedProfile}`);
            setPrivateKey(savedPk || "");

            try {
                const response = await fetch(`/api/autosell/config?userName=${telegramUser}&profileName=${selectedProfile}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.ca) setInputCa(data.ca);
                    if (data.lp) setLpPool(data.lp);
                    else setLpPool("");
                }
            } catch (err) { }
        };
        fetchConfig();
    }, [selectedProfile]);

    const filteredProfiles = profiles.filter(p => {
        if (!privateKey) return false;
        const telegramUser = localStorage.getItem('userName') || 'default_user';
        return localStorage.getItem(`pk_${telegramUser}_${p}`) === privateKey;
    });

    // Effect removed to prevent auto-switching profile when pasting privateKey, keeping CA and LP blank
    // useEffect(() => { ... });

    const handlePasteInput = async (setter) => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setter(text);
                setHasUnsavedChanges(true);
            }
        } catch (err) {
            showToastMsg("✕ Gagal membaca clipboard", "error");
        }
    };

    useEffect(() => {
        if (!inputCa || inputCa.length < 30) {
            setTokenName("");
            setTokenSymbol("");
            return;
        }
        const fetchTokenInfo = async () => {
            try {
                const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${inputCa}`);
                const data = await res.json();
                const pair = data.pairs?.find(p => p.baseToken.address.toLowerCase() === inputCa.toLowerCase()) || data.pairs?.[0];
                if (pair) {
                    setTokenName(pair.baseToken?.name || "");
                    setTokenSymbol(pair.baseToken?.symbol || "");
                }
            } catch (e) {}
        };
        const timer = setTimeout(fetchTokenInfo, 500);
        return () => clearTimeout(timer);
    }, [inputCa]);

    const handleSave = async () => {
        const telegramUser = localStorage.getItem('userName') || 'default_user';
        let finalProfileName = profileName.trim();
        if (!finalProfileName) {
            if (tokenSymbol) {
                finalProfileName = tokenSymbol.replace('$', '');
            } else {
                let counter = 1;
                while (profiles.includes(`Profil${counter}`)) counter++;
                finalProfileName = `Profil${counter}`;
            }
        }

        setIsSaving(true);
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const response = await fetch('/api/autosell/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userName: telegramUser, profileName: finalProfileName,
                    privateKey, inputCa, lpPool, rpc, gasMultiplier: "1.2", slippage, sellRatio
                }),
            });

            if (response.ok) {
                if (privateKey) localStorage.setItem(`pk_${telegramUser}_${finalProfileName}`, privateKey);
                else localStorage.removeItem(`pk_${telegramUser}_${finalProfileName}`);

                setHasUnsavedChanges(false);
                setProfileName("");
                localStorage.setItem('activeProfile_bulk', finalProfileName);
                setSelectedProfile(finalProfileName);
                await fetchProfiles();
                showToastMsg("✓ Sukses tersimpan");
                setShowSettingsModal(false);
            } else {
                showToastMsg("✕ Gagal menyimpan konfigurasi", "error");
            }
        } catch (err) {
            showToastMsg("✕ Kesalahan koneksi saat menyimpan", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async () => {
        if (!profileToDelete) return;
        const telegramUser = localStorage.getItem('userName') || 'default_user';

        setIsDeleting(true);
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const response = await fetch('/api/autosell/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: telegramUser, profileName: profileToDelete }),
            });

            if (response.ok) {
                const pkKey = `pk_${telegramUser}_${profileToDelete}`;
                localStorage.removeItem(pkKey);

                showToastMsg(`🗑️ Profil ${profileToDelete} berhasil dihapus!`, "success");
                setShowDeleteModal(false);
                if (selectedProfile === profileToDelete) {
                    setSelectedProfile("");
                    setPrivateKey("");
                    setInputCa("");
                    setLpPool("");
                }
                await fetchProfiles();
            } else {
                showToastMsg("✕ Gagal menghapus profil", "error");
            }
        } catch (err) {
            showToastMsg("✕ Kesalahan koneksi", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    // --- Global Execution Controls ---
    const handleStart = async () => {
        if (isRunning) return;
        setIsStarting(true);
        const telegramUser = localStorage.getItem('userName') || 'default_user';

        // Kumpulkan semua private key dari localStorage untuk dikirim ke API
        const pks = {};
        profiles.forEach(p => {
            const key = localStorage.getItem(`pk_${telegramUser}_${p}`);
            if (key) pks[p] = key;
        });

        try {
            const response = await fetch('/api/autosell/start-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: telegramUser, pks }),
            });

            const data = await response.json();
            if (response.ok) {
                showToastMsg(`✓ ${data.message}`, "success");
                setIsRunning(true);
            } else {
                showToastMsg("✕ " + (data.error || "Gagal memulai bot"), "error");
            }
        } catch (err) {
            showToastMsg("✕ Kesalahan koneksi", "error");
        }
        setIsStarting(false);
    };

    const handleStop = async () => {
        if (!isRunning) return;
        const telegramUser = localStorage.getItem('userName') || 'default_user';

        try {
            const response = await fetch('/api/autosell/stop-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: telegramUser }),
            });

            const data = await response.json();
            if (response.ok) {
                showToastMsg(`✓ ${data.message}`, "success");
                setIsRunning(false);
            } else {
                showToastMsg("✕ Gagal mematikan bot", "error");
            }
        } catch (err) {
            showToastMsg("✕ Kesalahan koneksi", "error");
        }
    };

    const handleClearLog = async () => {
        const telegramUser = localStorage.getItem('userName') || 'default_user';
        try {
            await fetch('/api/autosell/clearlog-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: telegramUser }),
            });
            setLogs("");
            showToastMsg("✓ Terminal dibersihkan", "success");
        } catch (e) {
            showToastMsg("✕ Gagal membersihkan log", "error");
        }
    };

    const renderLogs = () => {
        const rawLines = logs.split('\n');
        
        let maxBlock = 0;
        let totalSellSum = 0;
        let latestTimestamp = "";
        let latestDots = "...";
        
        const lastMemantauIndexes = {};
        
        // Loop mundur untuk menemukan "Memantau Blok" terakhir per profil
        for (let i = rawLines.length - 1; i >= 0; i--) {
            const line = rawLines[i];
            const match = line.match(/^(\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\])\s\[(.*?)\]\s.*?Memantau Blok:\s([\d,]+)\s\|\sTotal sell:\s(\d+)\s*(.*)/);
            if (match) {
                const ts = match[1];
                const profile = match[2];
                const blockStr = match[3];
                const totalSell = parseInt(match[4], 10);
                const currentDots = match[5];
                
                if (lastMemantauIndexes[profile] === undefined) {
                    lastMemantauIndexes[profile] = i;
                    
                    const blockNum = parseInt(blockStr.replace(/,/g, ''), 10);
                    if (blockNum > maxBlock) {
                        maxBlock = blockNum;
                        latestTimestamp = ts;
                        latestDots = currentDots;
                    }
                    totalSellSum += totalSell;
                }
            }
        }

        // Hapus semua baris "Memantau Blok" individu
        const filteredLines = [];
        let hasMemantau = false;
        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            if (line.includes("Memantau Blok:")) {
                hasMemantau = true;
                continue; 
            }
            filteredLines.push(line);
        }

        // Tambahkan satu baris [GLOBAL] di akhir
        if (hasMemantau && maxBlock > 0) {
            filteredLines.push(`${latestTimestamp} [GLOBAL] 📡 Memantau Blok: ${maxBlock.toLocaleString('en-US')} | Total sell: ${totalSellSum} ${latestDots}`);
        }

        return filteredLines.map((line, i) => {
            if (!line.trim()) return <span key={i} style={{ minHeight: '1.2em' }}></span>;
            let htmlLine = line.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            let profileTagMatch = htmlLine.match(/^(\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\])\s(\[.*?\])/);
            if (profileTagMatch) {
                const timestamp = profileTagMatch[1];
                const profile = profileTagMatch[2];
                const content = htmlLine.substring(timestamp.length + profile.length + 1);
                
                const colors = ['#f472b6', '#38bdf8', '#a3e635', '#fbbf24', '#c084fc', '#2dd4bf'];
                let profileColor;
                if (profile === 'GLOBAL') {
                    profileColor = '#10b981'; // Green for GLOBAL
                } else {
                    const colorIdx = profile.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
                    profileColor = colors[colorIdx];
                }

                let formattedContent = content;
                if (content.includes('ERROR') || content.includes('❌') || content.includes('Gagal')) {
                    formattedContent = `<span style="color: #ef4444;">${content}</span>`;
                } else if (content.includes('BUY TERDETEKSI') || content.includes('SUKSES') || content.includes('✅')) {
                    formattedContent = `<span style="color: #4ade80;">${content}</span>`;
                } else if (content.includes('Jual    :') || content.includes('Estimasi Pembelian')) {
                    formattedContent = `<span style="color: #facc15; font-weight: bold;">${content}</span>`;
                } else if (content.includes('dikirim! Hash:')) {
                    formattedContent = `<span style="color: #94a3b8;">${content}</span>`;
                } else {
                    formattedContent = `<span style="color: #e2e8f0;">${content}</span>`;
                }

                htmlLine = `<span style="color: #64748b;">${timestamp}</span> <span style="color: ${profileColor}; font-weight: bold;">${profile}</span> ${formattedContent}`;
            }

            return <span key={i} style={{ fontFamily: '"Fira Code", monospace', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} dangerouslySetInnerHTML={{ __html: htmlLine }}></span>;
        });
    };

    return (
        <div style={{ height: 'calc(100vh - 120px)', width: '100%', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
            {/* Header / Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '16px 24px', borderRadius: '12px', border: '1px solid #1e293b', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.8rem' }}>🚀</span> BULK SELL GLOBAL
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>Eksekusi semua profil bot secara bersamaan dalam satu terminal</p>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px', borderRight: '1px solid #334155', paddingRight: '24px' }}>
                        <div className="select-wrapper" style={{ minWidth: '150px' }}>
                            <select className="setup-select" style={{ height: '40px', padding: '0 12px', width: '100%', borderRadius: '8px', background: '#1e293b', color: 'white', border: '1px solid #334155' }} value={selectedProfile} onChange={(e) => { setSelectedProfile(e.target.value); localStorage.setItem('activeProfile_bulk', e.target.value); }}>
                                {filteredProfiles.length > 0 ? filteredProfiles.map(p => <option key={p} value={p} style={{ color: 'black' }}>{p}</option>) : <option value="" style={{ color: 'black' }}>(Kosong)</option>}
                            </select>
                        </div>
                        <button 
                            onClick={() => setShowSettingsModal(true)}
                            style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0 16px', height: '40px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            ⚙️ KONFIGURASI
                        </button>
                        <button 
                            onClick={() => { setProfileToDelete(selectedProfile || (profiles.length > 0 ? profiles[0] : "")); setShowDeleteModal(true); }}
                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0 12px', height: '40px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}
                            title="Hapus Profil"
                        >
                            🗑️
                        </button>
                    </div>

                    <button 
                        onClick={handleClearLog}
                        style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: '10px 16px', height: '40px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
                        onMouseOver={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#f8fafc'; }}
                        onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                    >
                        🗑️ Clear
                    </button>
                    
                    {isRunning ? (
                        <button 
                            onClick={handleStop}
                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 32px', height: '40px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
                            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            ⏹️ STOP GLOBAL
                        </button>
                    ) : (
                        <button 
                            onClick={handleStart}
                            disabled={isStarting}
                            style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 32px', height: '40px', borderRadius: '8px', cursor: isStarting ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '1.1rem', opacity: isStarting ? 0.7 : 1, boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
                            onMouseOver={e => { if(!isStarting) e.currentTarget.style.transform = 'scale(1.05)'; }}
                            onMouseOut={e => { if(!isStarting) e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                            {isStarting ? '⏳ MEMULAI...' : '▷ START GLOBAL'}
                        </button>
                    )}
                </div>
            </div>

            {/* Terminal */}
            <div style={{ flex: 1, background: '#020617', borderRadius: '12px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}>
                <div style={{ background: '#0f172a', padding: '8px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></div>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }}></div>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }}></div>
                    <span style={{ marginLeft: '12px', color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace' }}>bash - global_bot.log</span>
                </div>
                
                <div 
                    ref={terminalBodyRef}
                    style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}
                >
                    {logs === "" ? (
                        <div style={{ color: '#475569', fontStyle: 'italic', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: '16px' }}>
                            <span style={{ fontSize: '3rem', opacity: 0.2 }}>💻</span>
                            Terminal siap. Tekan START GLOBAL untuk memulai.
                        </div>
                    ) : (
                        renderLogs()
                    )}
                </div>
            </div>

            {/* Modals */}
            {showSettingsModal && (
                <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
                    <div className="settings-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>⚙️ Pengaturan Bot & Auto Sell</h3>
                            <button className="close-btn" onClick={() => setShowSettingsModal(false)}>✕</button>
                        </div>

                        <div className="settings-grid">
                            {/* KIRI: AUTO SELL */}
                            <div className="settings-section">
                                <div className="settings-section-title">AUTO SELL SETUP</div>
                                <div className="form-group">
                                    <label>1. PRIVATE KEY</label>
                                    <div className="input-with-icon">
                                        <input type="text" autoComplete="off" spellCheck="false" placeholder="Paste Private Key" value={privateKey} onChange={(e) => { setPrivateKey(e.target.value); setHasUnsavedChanges(true); }} style={{ WebkitTextSecurity: 'disc' }} />
                                        <span className="input-icon" style={{ cursor: 'pointer' }} onClick={() => handlePasteInput(setPrivateKey)}>📋</span>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label>2. INPUT CA</label>
                                    <div className="input-with-icon">
                                        <input type="text" placeholder="Paste Contract Address (CA)" value={inputCa} onChange={(e) => { setInputCa(e.target.value); setHasUnsavedChanges(true); }} />
                                        <span className="input-icon" style={{ cursor: 'pointer' }} onClick={() => handlePasteInput(setInputCa)}>📋</span>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label>3. LP POOL ADDRESS</label>
                                    <div className="input-with-icon">
                                        <input type="text" placeholder="Paste LP Pool Address" value={lpPool} onChange={(e) => { setLpPool(e.target.value); setHasUnsavedChanges(true); }} />
                                        <span className="input-icon" style={{ cursor: 'pointer' }} onClick={() => handlePasteInput(setLpPool)}>📋</span>
                                    </div>
                                </div>
                            </div>

                            {/* KANAN: PROFIL & LANJUTAN */}
                            <div className="settings-section">
                                <div className="settings-section-title">PROFIL & JARINGAN</div>
                                <div className="form-group">
                                    <label>NAMA AKUN PROFIL</label>
                                    <div className="input-with-suffix" style={{ display: 'flex' }}>
                                        <input type="text" placeholder={`Default: ${tokenSymbol ? tokenSymbol.replace('$', '') : 'ANIMO'}`} value={profileName} onChange={(e) => { setProfileName(e.target.value); setHasUnsavedChanges(true); }} style={{ paddingRight: '1rem', width: '100%' }} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label>INFO TOKEN</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input type="text" readOnly placeholder="Nama Token" value={tokenName} style={{ cursor: 'not-allowed', flex: 2, background: 'rgba(0,0,0,0.2)' }} />
                                        <input type="text" readOnly placeholder="Simbol" value={tokenSymbol} style={{ cursor: 'not-allowed', flex: 1, background: 'rgba(0,0,0,0.2)' }} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label>RPC NODE</label>
                                    <select value={isRandom ? "random" : isKnown ? rpc : "manual"} onChange={(e) => { const val = e.target.value; if (val === "random") setRpc(randomRpcString); else if (val === "manual") setRpc("https://"); else setRpc(val); setHasUnsavedChanges(true); }} className="setup-select">
                                        <option value="random" style={{ color: 'black' }}>Default (Random)</option>
                                        {knownRpcs.map((r, i) => <option key={i} value={r.value} style={{ color: 'black' }}>{r.label}</option>)}
                                        <option value="manual" style={{ color: 'black' }}>Tambahkan manual</option>
                                    </select>
                                    {(!isRandom && !isKnown) && (
                                        <input type="text" placeholder="Masukkan URL RPC Custom" value={rpc} onChange={(e) => { setRpc(e.target.value); setHasUnsavedChanges(true); }} style={{ width: '100%', marginTop: '8px' }} />
                                    )}
                                </div>
                                
                                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>SLIPPAGE (%)</label>
                                        <div className="input-with-suffix">
                                            <input type="number" step="0.1" placeholder="2.5" value={slippage} onChange={(e) => { setSlippage(e.target.value); setHasUnsavedChanges(true); }} style={{ width: '100%' }} />
                                            <span className="suffix">%</span>
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>SELL RATIO (%)</label>
                                        <div className="input-with-suffix">
                                            <input type="number" step="1" placeholder="98" value={sellRatio} onChange={(e) => { setSellRatio(e.target.value); setHasUnsavedChanges(true); }} style={{ width: '100%' }} />
                                            <span className="suffix">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <button className="btn-setup btn-save" style={{ marginTop: '25px', width: '100%', height: '44px', fontSize: '1rem', fontWeight: 'bold', opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }} onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "⏳ MENYIMPAN PENGATURAN..." : "💾 SIMPAN PENGATURAN"}
                        </button>
                    </div>
                </div>
            )}
            
            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Hapus Profil</h3>
                            <button className="close-btn" onClick={() => setShowDeleteModal(false)}>✕</button>
                        </div>
                        <button className="btn-setup btn-reset" style={{ marginTop: '25px', width: '100%', height: '48px', color: 'white', background: '#ef4444', fontSize: '1rem' }} onClick={handleReset} disabled={!profileToDelete || isDeleting}>{isDeleting ? "MENGHAPUS..." : "HAPUS PROFIL"}</button>
                    </div>
                </div>
            )}

            {/* Toast Notifications */}
            {toast.show && createPortal(
                <div className={`toast-notification ${toast.type}`}>
                    {toast.message}
                </div>,
                document.body
            )}
        </div>
    );
}
