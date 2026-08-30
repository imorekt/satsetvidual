'use client';

import React, { useState } from 'react';
import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

export default function WalletGeneratorPage() {
    const [chain, setChain] = useState('evm');
    const [count, setCount] = useState(10);
    const [wallets, setWallets] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const generateWallets = async () => {
        setIsGenerating(true);
        // Small delay to allow UI to update to 'Generating...' state
        await new Promise(r => setTimeout(r, 50));
        
        try {
            const newWallets = [];
            for (let i = 0; i < count; i++) {
                if (chain === 'evm') {
                    const wallet = ethers.Wallet.createRandom();
                    newWallets.push({
                        id: i + 1,
                        address: wallet.address,
                        privateKey: wallet.privateKey,
                        mnemonic: wallet.mnemonic.phrase
                    });
                } else if (chain === 'solana') {
                    const keypair = Keypair.generate();
                    newWallets.push({
                        id: i + 1,
                        address: keypair.publicKey.toString(),
                        privateKey: bs58.encode(keypair.secretKey),
                        mnemonic: 'N/A'
                    });
                } else if (chain === 'sui') {
                    const keypair = new Ed25519Keypair();
                    const exportData = keypair.export();
                    newWallets.push({
                        id: i + 1,
                        address: keypair.getPublicKey().toSuiAddress(),
                        privateKey: exportData.privateKey,
                        mnemonic: 'N/A'
                    });
                } else if (chain === 'cosmos' || chain === 'sei') {
                    const prefix = chain === 'cosmos' ? 'cosmos' : 'sei';
                    const wallet = await DirectSecp256k1HdWallet.generate(12, { prefix: prefix });
                    const accounts = await wallet.getAccounts();
                    newWallets.push({
                        id: i + 1,
                        address: accounts[0].address,
                        privateKey: 'Use Mnemonic',
                        mnemonic: wallet.mnemonic
                    });
                }
            }
            setWallets(newWallets);
        } catch (error) {
            console.error("Error generating wallets", error);
            alert("Error generating wallets. Check console for details.");
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // Simple visual feedback could be added here
    };

    const downloadCSV = () => {
        if (wallets.length === 0) return;
        const header = "Address,PrivateKey,Mnemonic\n";
        const rows = wallets.map(w => `${w.address},${w.privateKey},${w.mnemonic}`).join("\n");
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wallets_${chain}_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadTXT = () => {
        if (wallets.length === 0) return;
        const rows = wallets.map(w => `${w.address}|${w.privateKey}|${w.mnemonic}`).join("\n");
        const blob = new Blob([rows], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wallets_${chain}_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{ padding: '2rem', color: '#f8fafc', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    👛 Multi-Chain Wallet Generator
                </h1>
                <p style={{ color: '#94a3b8' }}>Generate wallets for EVM, Solana, Cosmos, SUI, and SEI securely entirely in your browser.</p>
            </div>

            <div style={{ 
                background: 'rgba(30, 41, 59, 0.7)', 
                backdropFilter: 'blur(10px)', 
                borderRadius: '12px', 
                padding: '1.5rem', 
                border: '1px solid rgba(255, 255, 255, 0.05)',
                marginBottom: '2rem',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
                    <label style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: '500' }}>Pilih Network Chain</label>
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                        gap: '1rem',
                        width: '100%'
                    }}>
                        {[
                            { id: 'evm', name: 'EVM Chains', sub: 'ETH, BSC...', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png' },
                            { id: 'solana', name: 'Solana', sub: 'SOL', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png' },
                            { id: 'sui', name: 'SUI Network', sub: 'SUI', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/20947.png' },
                            { id: 'cosmos', name: 'Cosmos', sub: 'ATOM', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3794.png' },
                            { id: 'sei', name: 'SEI Network', sub: 'SEI', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/23149.png' }
                        ].map((c) => (
                            <div 
                                key={c.id}
                                onClick={() => { setChain(c.id); setWallets([]); }}
                                style={{
                                    background: chain === c.id ? 'rgba(59, 130, 246, 0.2)' : '#0f172a',
                                    border: `1px solid ${chain === c.id ? '#3b82f6' : '#334155'}`,
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s',
                                    boxShadow: chain === c.id ? '0 0 0 1px #3b82f6' : 'none'
                                }}
                                onMouseOver={(e) => { if(chain !== c.id) e.currentTarget.style.borderColor = '#475569'; }}
                                onMouseOut={(e) => { if(chain !== c.id) e.currentTarget.style.borderColor = '#334155'; }}
                            >
                                <img src={c.icon} alt={c.name} style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ color: 'white', fontWeight: '600', fontSize: '0.9rem' }}>{c.name}</div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{c.sub}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', width: '100%', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: '500' }}>Total Generate</label>
                    <input 
                        type="number" 
                        value={count} 
                        onChange={(e) => setCount(Math.max(1, Math.min(10000, Number(e.target.value))))}
                        min="1" max="10000"
                        style={{
                            background: '#0f172a',
                            border: '1px solid #334155',
                            color: 'white',
                            padding: '0.7rem 1rem',
                            borderRadius: '8px',
                            width: '130px',
                            outline: 'none',
                            fontSize: '0.95rem'
                        }}
                    />
                </div>

                <button 
                    onClick={generateWallets}
                    disabled={isGenerating}
                    style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        fontWeight: '600',
                        fontSize: '0.95rem',
                        cursor: isGenerating ? 'not-allowed' : 'pointer',
                        opacity: isGenerating ? 0.7 : 1,
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {isGenerating ? (
                        <>⏳ Generating...</>
                    ) : (
                        <>⚡ Generate Wallets</>
                    )}
                </button>

                {wallets.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
                        <button 
                            onClick={downloadTXT}
                            style={{
                                background: '#1e293b',
                                color: '#e2e8f0',
                                border: '1px solid #334155',
                                padding: '0.75rem 1rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontWeight: '500'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#334155'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#1e293b'}
                        >
                            📄 TXT
                        </button>
                        <button 
                            onClick={downloadCSV}
                            style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                padding: '0.75rem 1rem',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontWeight: '500'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = 'white'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; e.currentTarget.style.color = '#10b981'; }}
                        >
                            📊 CSV
                        </button>
                    </div>
                )}
            </div>
        </div>

        {wallets.length > 0 && (
                <div style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    overflow: 'hidden',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}>
                    <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#0f172a', zIndex: 1 }}>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <th style={{ padding: '1.2rem 1rem', color: '#94a3b8', fontWeight: '600', width: '50px' }}>#</th>
                                    <th style={{ padding: '1.2rem 1rem', color: '#94a3b8', fontWeight: '600' }}>Address</th>
                                    <th style={{ padding: '1.2rem 1rem', color: '#94a3b8', fontWeight: '600' }}>Private Key</th>
                                    {['evm', 'cosmos', 'sei'].includes(chain) && (
                                        <th style={{ padding: '1.2rem 1rem', color: '#94a3b8', fontWeight: '600' }}>Seed Phrase</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {wallets.slice(0, 100).map((wallet, idx) => (
                                    <tr key={idx} style={{ 
                                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                                        transition: 'background 0.2s',
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '1rem', color: '#64748b' }}>{wallet.id}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontFamily: "'Fira Code', monospace", color: '#e2e8f0', fontSize: '0.85rem' }}>{wallet.address}</span>
                                                <span onClick={() => copyToClipboard(wallet.address)} style={{ cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.2s' }} onMouseOver={(e) => e.target.style.opacity = 1} onMouseOut={(e) => e.target.style.opacity = 0.5} title="Copy">📋</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontFamily: "'Fira Code', monospace", color: '#f87171', filter: 'blur(4px)', transition: 'filter 0.2s', cursor: 'help', fontSize: '0.85rem' }} 
                                                      onMouseEnter={(e) => e.target.style.filter = 'none'}
                                                      onMouseLeave={(e) => e.target.style.filter = 'blur(4px)'}
                                                >
                                                    {wallet.privateKey.substring(0, 15)}...{wallet.privateKey.substring(wallet.privateKey.length - 8)}
                                                </span>
                                                <span onClick={() => copyToClipboard(wallet.privateKey)} style={{ cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.2s' }} onMouseOver={(e) => e.target.style.opacity = 1} onMouseOut={(e) => e.target.style.opacity = 0.5} title="Copy">📋</span>
                                            </div>
                                        </td>
                                        {['evm', 'cosmos', 'sei'].includes(chain) && (
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontFamily: "'Fira Code', monospace", color: '#a78bfa', filter: 'blur(4px)', transition: 'filter 0.2s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px', cursor: 'help', fontSize: '0.85rem' }}
                                                          onMouseEnter={(e) => { e.target.style.filter = 'none'; e.target.style.whiteSpace = 'normal'; }}
                                                          onMouseLeave={(e) => { e.target.style.filter = 'blur(4px)'; e.target.style.whiteSpace = 'nowrap'; }}
                                                    >
                                                        {wallet.mnemonic}
                                                    </span>
                                                    <span onClick={() => copyToClipboard(wallet.mnemonic)} style={{ cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.2s' }} onMouseOver={(e) => e.target.style.opacity = 1} onMouseOut={(e) => e.target.style.opacity = 0.5} title="Copy">📋</span>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {wallets.length > 100 && (
                            <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.9rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                Menampilkan 100 dari {wallets.length} wallet. Silakan klik tombol <b>Export CSV</b> di atas untuk mengunduh seluruh wallet.
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
