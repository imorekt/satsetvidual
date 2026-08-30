'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';

const NETWORKS = [
    { id: 'bsc', name: 'BSC Mainnet', rpc: 'https://bsc-dataseed.binance.org/', symbol: 'BNB' },
    { id: 'polygon', name: 'Polygon', rpc: 'https://polygon-rpc.com', symbol: 'MATIC' },
    { id: 'arbitrum', name: 'Arbitrum One', rpc: 'https://arb1.arbitrum.io/rpc', symbol: 'ETH' },
    { id: 'optimism', name: 'Optimism', rpc: 'https://mainnet.optimism.io', symbol: 'ETH' },
    { id: 'base', name: 'Base', rpc: 'https://mainnet.base.org', symbol: 'ETH' },
    { id: 'ethereum', name: 'Ethereum', rpc: 'https://eth.llamarpc.com', symbol: 'ETH' },
    { id: 'custom', name: 'Custom RPC', rpc: '', symbol: 'NATIVE' }
];

export default function BulkTransferPage() {
    const [network, setNetwork] = useState(NETWORKS[0]);
    const [customRpc, setCustomRpc] = useState('');
    const [mode, setMode] = useState('sweeper');
    
    const [sweeperKeys, setSweeperKeys] = useState('');
    const [sweeperTarget, setSweeperTarget] = useState('');
    
    const [multiSenderKey, setMultiSenderKey] = useState('');
    const [multiSenderList, setMultiSenderList] = useState('');
    const [multiSenderAmount, setMultiSenderAmount] = useState('');
    const [multiSenderBalance, setMultiSenderBalance] = useState(null);
    
    const [logs, setLogs] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    
    const logsEndRef = useRef(null);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    // Auto fetch balance for Multi-Sender when PK is pasted
    useEffect(() => {
        const fetchBalance = async () => {
            if (!multiSenderKey) {
                setMultiSenderBalance(null);
                return;
            }
            try {
                let pk = multiSenderKey.trim();
                if (pk.length === 64 || pk.length === 66) {
                    pk = formatPK(pk);
                    const provider = getProvider();
                    const wallet = new ethers.Wallet(pk, provider);
                    const bal = await provider.getBalance(wallet.address);
                    setMultiSenderBalance(ethers.formatEther(bal));
                }
            } catch (err) {
                // ignore invalid pk or network errors during typing
            }
        };
        fetchBalance();
    }, [multiSenderKey, network, customRpc]);

    const getProvider = () => {
        const rpc = network.id === 'custom' ? customRpc : network.rpc;
        if (!rpc) throw new Error("RPC URL is required");
        return new ethers.JsonRpcProvider(rpc);
    };

    const addLog = (msg, type = 'info', hash = null) => {
        setLogs(prev => [...prev, { id: Date.now() + Math.random(), msg, type, hash }]);
    };

    const formatPK = (pk) => pk.startsWith('0x') ? pk : '0x' + pk;

    const startSweeper = async () => {
        setIsRunning(true);
        setLogs([]);
        try {
            const keys = sweeperKeys.split('\n').map(k => k.trim()).filter(k => k);
            if (!keys.length) throw new Error("No private keys provided.");
            if (!ethers.isAddress(sweeperTarget)) throw new Error("Invalid target address.");
            
            setProgress({ current: 0, total: keys.length });
            const provider = getProvider();
            
            addLog(`🚀 Starting Sweeper for ${keys.length} wallets...`);
            
            for (let i = 0; i < keys.length; i++) {
                try {
                    const pk = formatPK(keys[i]);
                    const wallet = new ethers.Wallet(pk, provider);
                    addLog(`[Wallet ${i+1}] Checking balance for ${wallet.address}...`, 'info');
                    
                    const balance = await provider.getBalance(wallet.address);
                    if (balance === 0n) {
                        addLog(`[Wallet ${i+1}] Empty balance, skipping.`, 'warn');
                        setProgress(p => ({ ...p, current: i + 1 }));
                        continue;
                    }
                    
                    const feeData = await provider.getFeeData();
                    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
                    if (!gasPrice) throw new Error("Failed to get network gas price");
                    
                    const gasLimit = 21000n; // Standard ETH/EVM transfer
                    const fee = gasPrice * gasLimit;
                    
                    if (balance <= fee) {
                        addLog(`[Wallet ${i+1}] Balance too low to cover network fee. (Bal: ${ethers.formatEther(balance)}, Fee: ${ethers.formatEther(fee)})`, 'warn');
                        setProgress(p => ({ ...p, current: i + 1 }));
                        continue;
                    }
                    
                    const sweepAmount = balance - fee;
                    addLog(`[Wallet ${i+1}] Sweeping ${ethers.formatEther(sweepAmount)} ${network.symbol}...`, 'info');
                    
                    const tx = await wallet.sendTransaction({
                        to: sweeperTarget,
                        value: sweepAmount,
                        gasLimit: gasLimit,
                        gasPrice: gasPrice
                    });
                    
                    addLog(`[Wallet ${i+1}] TX Submitted! Hash: ${tx.hash}`, 'success', tx.hash);
                    
                    // Wait for 1 confirmation
                    await tx.wait(1);
                    addLog(`[Wallet ${i+1}] TX Confirmed! ✅`, 'success');
                } catch (err) {
                    addLog(`[Wallet ${i+1}] Error: ${err.message}`, 'error');
                }
                setProgress(p => ({ ...p, current: i + 1 }));
            }
            addLog("🎉 Sweeper finished successfully!", "success");
        } catch (err) {
            addLog(`Failed to start: ${err.message}`, 'error');
        } finally {
            setIsRunning(false);
        }
    };

    const startMultiSender = async () => {
        setIsRunning(true);
        setLogs([]);
        try {
            if (!multiSenderKey) throw new Error("Sender Private Key is required.");
            const provider = getProvider();
            const pk = formatPK(multiSenderKey.trim());
            const wallet = new ethers.Wallet(pk, provider);
            
            const lines = multiSenderList.split('\n').map(l => l.trim()).filter(l => l);
            if (!lines.length) throw new Error("Target list is empty.");
            
            setProgress({ current: 0, total: lines.length });
            addLog(`🚀 Starting Multi-Sender from Address: ${wallet.address}`);
            
            const balance = await provider.getBalance(wallet.address);
            addLog(`Sender Balance: ${ethers.formatEther(balance)} ${network.symbol}`);

            let maxAmountWeiPerWallet = 0n;
            if (multiSenderAmount === 'MAX') {
                const feeData = await provider.getFeeData();
                const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
                const totalGasLimit = BigInt(21000 * lines.length);
                const totalFee = gasPrice * totalGasLimit;
                
                if (balance <= totalFee) throw new Error("Balance too low to cover total gas fees for all targets.");
                maxAmountWeiPerWallet = (balance - totalFee) / BigInt(lines.length);
                addLog(`MAX Mode: Sending ${ethers.formatEther(maxAmountWeiPerWallet)} ${network.symbol} to each of ${lines.length} addresses.`);
            }
            
            for (let i = 0; i < lines.length; i++) {
                try {
                    const parts = lines[i].split(/[, \t]+/).filter(x => x);
                    const address = parts[0];
                    if (!ethers.isAddress(address)) throw new Error(`Invalid address: ${address}`);
                    
                    let amountWei;
                    let displayAmountStr;

                    if (multiSenderAmount === 'MAX') {
                        amountWei = maxAmountWeiPerWallet;
                        displayAmountStr = ethers.formatEther(amountWei);
                    } else if (multiSenderAmount) {
                        amountWei = ethers.parseEther(multiSenderAmount);
                        displayAmountStr = multiSenderAmount;
                    } else {
                        if (parts.length < 2) throw new Error("Invalid format. Use: address,amount or set Global Amount");
                        const amountStr = parts[1];
                        if (!amountStr || isNaN(Number(amountStr))) throw new Error(`Invalid amount: ${amountStr}`);
                        amountWei = ethers.parseEther(amountStr);
                        displayAmountStr = amountStr;
                    }
                    
                    addLog(`[${i+1}/${lines.length}] Sending ${displayAmountStr} ${network.symbol} to ${address}...`);
                    
                    const tx = await wallet.sendTransaction({
                        to: address,
                        value: amountWei
                    });
                    
                    addLog(`[${i+1}] TX Submitted! Hash: ${tx.hash}`, 'success', tx.hash);
                    await tx.wait(1);
                    addLog(`[${i+1}] TX Confirmed! ✅`, 'success');
                } catch (err) {
                    addLog(`[${i+1}] Error on line ${i+1}: ${err.message}`, 'error');
                }
                setProgress(p => ({ ...p, current: i + 1 }));
            }
            addLog("🎉 Multi-Sender finished successfully!", "success");
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
                    💸 Bulk Transfer (EVM)
                </h1>
                <p style={{ color: '#94a3b8' }}>Kirim coin massal atau sapu bersih saldo dari banyak wallet otomatis kalkulasi Fee jaringan.</p>
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
                    
                    {/* Network Selector */}
                    <div style={{ 
                        background: 'rgba(30, 41, 59, 0.7)', 
                        backdropFilter: 'blur(10px)', 
                        borderRadius: '12px', 
                        padding: '1.5rem 2rem', 
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: '2rem'
                    }}>
                        <div style={{ width: '200px', flexShrink: 0 }}>
                            <label style={{ fontSize: '1.1rem', color: '#cbd5e1', fontWeight: '600', display: 'block' }}>1. Pilih Jaringan (RPC)</label>
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.3rem' }}>Tentukan jaringan eksekusi.</div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <select 
                                value={network.id} 
                                onChange={(e) => setNetwork(NETWORKS.find(n => n.id === e.target.value))}
                                disabled={isRunning}
                                style={{
                                    width: '100%',
                                    background: '#0f172a',
                                    border: '1px solid #334155',
                                    color: 'white',
                                    padding: '0.8rem 1rem',
                                    borderRadius: '8px',
                                    outline: 'none',
                                    fontSize: '0.95rem',
                                    cursor: isRunning ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {NETWORKS.map(n => <option key={n.id} value={n.id}>{n.name} ({n.symbol})</option>)}
                            </select>
                            {network.id === 'custom' && (
                                <input 
                                    type="text" 
                                    placeholder="Masukkan URL RPC Custom..." 
                                    value={customRpc}
                                    onChange={(e) => setCustomRpc(e.target.value)}
                                    disabled={isRunning}
                                    style={{
                                        flex: 1, background: '#0f172a', border: '1px solid #334155',
                                        color: 'white', padding: '0.8rem 1rem', borderRadius: '8px', outline: 'none'
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', flex: 1 }}></div>
                        <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600', letterSpacing: '1px' }}>KONFIGURASI EKSEKUSI</div>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', flex: 1 }}></div>
                    </div>
                    
                    {/* Mode Selector */}
                    <div style={{ 
                        background: 'rgba(30, 41, 59, 0.7)', 
                        backdropFilter: 'blur(10px)', 
                        borderRadius: '12px', 
                        padding: '1rem 1.5rem', 
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: '1.5rem'
                    }}>
                        <div style={{ width: '200px', flexShrink: 0 }}>
                            <label style={{ fontSize: '1.1rem', color: '#cbd5e1', fontWeight: '600', display: 'block' }}>2. Mode Transfer</label>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.3rem' }}>Metode pengiriman.</div>
                        </div>
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                            <div 
                                onClick={() => !isRunning && setMode('sweeper')}
                                style={{
                                    background: mode === 'sweeper' ? 'rgba(59, 130, 246, 0.2)' : '#0f172a',
                                    border: `1px solid ${mode === 'sweeper' ? '#3b82f6' : '#334155'}`,
                                    padding: '0.6rem', borderRadius: '8px', cursor: isRunning ? 'not-allowed' : 'pointer',
                                    textAlign: 'center', transition: 'all 0.2s',
                                    boxShadow: mode === 'sweeper' ? '0 0 0 1px #3b82f6' : 'none',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                <div style={{ fontWeight: '600', color: 'white', fontSize: '0.85rem' }}>🧹 Sweeper</div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>Banyak PK ➔ 1 Target</div>
                            </div>
                            <div 
                                onClick={() => !isRunning && setMode('multi')}
                                style={{
                                    background: mode === 'multi' ? 'rgba(16, 185, 129, 0.2)' : '#0f172a',
                                    border: `1px solid ${mode === 'multi' ? '#10b981' : '#334155'}`,
                                    padding: '0.6rem', borderRadius: '8px', cursor: isRunning ? 'not-allowed' : 'pointer',
                                    textAlign: 'center', transition: 'all 0.2s',
                                    boxShadow: mode === 'multi' ? '0 0 0 1px #10b981' : 'none',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                <div style={{ fontWeight: '600', color: 'white', fontSize: '0.85rem' }}>📤 Multi-Sender</div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>1 PK ➔ Banyak</div>
                            </div>
                        </div>
                    </div>

                    {/* Inputs based on Mode */}
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
                            <label style={{ fontSize: '1.1rem', color: '#cbd5e1', fontWeight: '600', display: 'block' }}>3. Konfigurasi</label>
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.3rem' }}>Detail penerima dan jumlah yang akan dikirim.</div>
                        </div>
                        
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {mode === 'sweeper' ? (
                                <>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.3rem', display: 'block' }}>Address Tujuan (Target)</label>
                                        <input 
                                            type="text" 
                                            placeholder="0x..." 
                                            value={sweeperTarget}
                                            onChange={(e) => setSweeperTarget(e.target.value)}
                                            disabled={isRunning}
                                            style={{
                                                width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white',
                                                padding: '0.8rem', borderRadius: '8px', outline: 'none', fontFamily: 'monospace'
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 1, marginBottom: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.3rem', display: 'block' }}>List Private Key (Tuyul)</label>
                                        <textarea 
                                            className="transparent-scroll"
                                            placeholder="Masukkan Private Key, satu per baris..."
                                            value={sweeperKeys}
                                            onChange={(e) => setSweeperKeys(e.target.value)}
                                            disabled={isRunning}
                                            style={{
                                                flex: 1, width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white',
                                                padding: '0.8rem', borderRadius: '8px', outline: 'none', fontFamily: 'monospace', resize: 'none'
                                            }}
                                        />
                                    </div>
                                    <button 
                                        onClick={startSweeper}
                                        disabled={isRunning || !sweeperTarget || !sweeperKeys}
                                        style={{
                                            width: '100%', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white',
                                            border: 'none', padding: '1rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem',
                                            cursor: (isRunning || !sweeperTarget || !sweeperKeys) ? 'not-allowed' : 'pointer',
                                            opacity: (isRunning || !sweeperTarget || !sweeperKeys) ? 0.6 : 1, transition: 'all 0.2s'
                                        }}
                                    >
                                        {isRunning ? '⏳ Sweeping in progress...' : '🚀 Mulai Sweep Bersih'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Private Key Pengirim (Utama)</span>
                                            {multiSenderBalance !== null && (
                                                <span style={{ color: '#10b981', fontWeight: 'bold' }}>Saldo: {Number(multiSenderBalance).toFixed(4)} {network.symbol}</span>
                                            )}
                                        </label>
                                        <input 
                                            type="text" 
                                            autoComplete="off"
                                            spellCheck="false"
                                            placeholder="0x..." 
                                            value={multiSenderKey}
                                            onChange={(e) => setMultiSenderKey(e.target.value)}
                                            disabled={isRunning}
                                            style={{
                                                width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white',
                                                padding: '0.8rem', borderRadius: '8px', outline: 'none', fontFamily: 'monospace',
                                                WebkitTextSecurity: 'disc'
                                            }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.3rem', display: 'block' }}>Total Amount (Kirim per Address)</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input 
                                                type="text" 
                                                placeholder="Opsional (misal: 0.01)" 
                                                value={multiSenderAmount}
                                                onChange={(e) => setMultiSenderAmount(e.target.value)}
                                                disabled={isRunning}
                                                style={{
                                                    flex: 1, background: '#0f172a', border: '1px solid #334155', color: 'white',
                                                    padding: '0.8rem', borderRadius: '8px', outline: 'none', fontFamily: 'monospace'
                                                }}
                                            />
                                            <button
                                                onClick={() => setMultiSenderAmount(multiSenderAmount === 'MAX' ? '' : 'MAX')}
                                                disabled={isRunning}
                                                style={{
                                                    background: multiSenderAmount === 'MAX' ? '#10b981' : '#334155', 
                                                    color: 'white', border: 'none', padding: '0 1rem', borderRadius: '8px', 
                                                    cursor: isRunning ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'all 0.2s',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                MAX
                                            </button>
                                        </div>
                                        {multiSenderAmount === 'MAX' && (
                                            <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '0.4rem' }}>
                                                *MAX: Saldo bersih akan dibagi rata.
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, marginBottom: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.3rem', display: 'block' }}>Daftar Target</label>
                                        <textarea 
                                            className="transparent-scroll"
                                            placeholder={multiSenderAmount ? "0xABCD...\n0x1234..." : "0xABCD..., 0.01\n0x1234..., 0.05"}
                                            value={multiSenderList}
                                            onChange={(e) => setMultiSenderList(e.target.value)}
                                            disabled={isRunning}
                                            style={{
                                                flex: 1, width: '100%', background: '#0f172a', border: '1px solid #334155', color: 'white',
                                                padding: '0.8rem', borderRadius: '8px', outline: 'none', fontFamily: 'monospace', resize: 'none'
                                            }}
                                        />
                                    </div>
                                    <button 
                                        onClick={startMultiSender}
                                        disabled={isRunning || !multiSenderKey || !multiSenderList}
                                        style={{
                                            width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white',
                                            border: 'none', padding: '1rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem',
                                            cursor: (isRunning || !multiSenderKey || !multiSenderList) ? 'not-allowed' : 'pointer',
                                            opacity: (isRunning || !multiSenderKey || !multiSenderList) ? 0.6 : 1, transition: 'all 0.2s'
                                        }}
                                    >
                                        {isRunning ? '⏳ Sending in progress...' : '🚀 Mulai Multi-Send'}
                                    </button>
                                </>
                            )}
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
                        height: '100%', minHeight: 0, overflow: 'hidden'
                    }}>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                📡 Live Execution Logs
                            </div>
                            {progress.total > 0 && (
                                <div style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: 'bold' }}>
                                    Progress: {progress.current} / {progress.total}
                                </div>
                            )}
                        </div>
                        
                        <div style={{ padding: '1rem', overflowY: 'auto', flex: 1, fontFamily: "'Fira Code', monospace", fontSize: '0.85rem' }}>
                            {logs.length === 0 ? (
                                <div style={{ color: '#475569', textAlign: 'center', marginTop: '4rem' }}>
                                    Belum ada log transaksi. <br/> Tekan tombol mulai untuk mengeksekusi.
                                </div>
                            ) : (
                                logs.map((log) => (
                                    <div key={log.id} style={{ 
                                        marginBottom: '0.5rem', 
                                        padding: '0.5rem 0.8rem', 
                                        borderRadius: '6px',
                                        background: log.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : log.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : log.type === 'warn' ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                                        color: log.type === 'error' ? '#fca5a5' : log.type === 'success' ? '#6ee7b7' : log.type === 'warn' ? '#fcd34d' : '#cbd5e1',
                                        borderLeft: `2px solid ${log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#10b981' : log.type === 'warn' ? '#f59e0b' : 'transparent'}`
                                    }}>
                                        {log.msg}
                                        {log.hash && (
                                            <a href={`https://bscscan.com/tx/${log.hash}`} target="_blank" rel="noreferrer" style={{ marginLeft: '0.5rem', color: '#3b82f6', textDecoration: 'underline' }}>
                                                [View TX]
                                            </a>
                                        )}
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
            `}</style>
        </div>
    );
}
