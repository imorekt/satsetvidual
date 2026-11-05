"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useFormCache } from '@/lib/useFormCache';

const IconCheckFilled = () => (
  <svg viewBox="0 0 24 24" fill="#00be64" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#00be64" />
    <path d="M10 17l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#13131a" />
  </svg>
);
const IconChevronDown = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>;

export default function DeployTokenPage() {
  const [deployNetwork, setDeployNetwork] = useState('BASE');
  const [deployMode, setDeployMode] = useState('normal'); // 'normal' | 'thirdweb'
  const [privateKey, setPrivateKey] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenSupply, setTokenSupply] = useState('1000000000');
  const [autoRenounce, setAutoRenounce] = useState(true);
  const [tokenDesc, setTokenDesc] = useState('');
  const [tokenWeb, setTokenWeb] = useState('');
  const [tokenTg, setTokenTg] = useState('');
  const [tokenTw, setTokenTw] = useState('');
  const [tokenLogo, setTokenLogo] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const terminalRef = useRef(null);

  const states = useMemo(() => ({
    deployNetwork, deployMode, tokenName, tokenSymbol, tokenSupply, autoRenounce, tokenDesc, tokenWeb, tokenTg, tokenTw, tokenLogo
  }), [deployNetwork, deployMode, tokenName, tokenSymbol, tokenSupply, autoRenounce, tokenDesc, tokenWeb, tokenTg, tokenTw, tokenLogo]);

  const setStates = useMemo(() => ({
    deployNetwork: setDeployNetwork,
    deployMode: setDeployMode,
    tokenName: setTokenName,
    tokenSymbol: setTokenSymbol,
    tokenSupply: setTokenSupply,
    autoRenounce: setAutoRenounce,
    tokenDesc: setTokenDesc,
    tokenWeb: setTokenWeb,
    tokenTg: setTokenTg,
    tokenTw: setTokenTw,
    tokenLogo: setTokenLogo
  }), []);

  useFormCache('deploy', privateKey, states, setStates);

  useEffect(() => {
    const saved = sessionStorage.getItem('deployTerminalLog');
    if (saved) setDeployResult(saved);
  }, []);

  useEffect(() => {
    if (deployResult !== null) sessionStorage.setItem('deployTerminalLog', deployResult);
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [deployResult]);

  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [deployedHistory, setDeployedHistory] = useState([]);
  const [selectedInspectIndex, setSelectedInspectIndex] = useState(0);
  const [copiedKey, setCopiedKey] = useState('');
  const [userRole, setUserRole] = useState('Member');

  React.useEffect(() => {
    const role = localStorage.getItem('userRole') || 'Member';
    setUserRole(role);

    const pk = localStorage.getItem('deploy_private_key');
    if (pk) setPrivateKey(pk);

    try {
      const savedProfiles = JSON.parse(localStorage.getItem('deployed_tokens') || '[]');
      if (Array.isArray(savedProfiles)) {
        setDeployedHistory(savedProfiles);
      }
    } catch (e) {}

    const handleProfileUpdate = () => {
      setUserRole(localStorage.getItem('userRole') || 'Member');
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, []);

  const handleCopyText = (text, keyLabel = 'ca') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(keyLabel);
    showNotification('Berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopiedKey(''), 2000);
  };

  // Fallback parser jika user ingin inspect dari log terminal yang sudah ada
  const parsedFromTerminal = useMemo(() => {
    if (!deployResult || typeof deployResult !== 'string') return null;
    const caMatch = deployResult.match(/Contract Address(?:\s*\(CA\))?\s*:\s*(0x[a-fA-F0-9]{40})/i)
      || deployResult.match(/\/token\/(0x[a-fA-F0-9]{40})/i);
    if (!caMatch) return null;
    const ca = caMatch[1];
    const isRobin = deployResult.toLowerCase().includes('robin') || deployNetwork === 'ROBINHOOD';
    const isThirdweb = deployResult.toLowerCase().includes('thirdweb') || deployResult.toLowerCase().includes('droperc20');
    const txDeployMatch = deployResult.match(/tx deploy\s*:\s*https?:\/\/[^\s]+\/tx\/(0x[a-fA-F0-9]{64})/i)
      || deployResult.match(/\/tx\/(0x[a-fA-F0-9]{64})/i);
    const txClaimMatch = deployResult.match(/tx Set claim[^\n]*:\s*https?:\/\/[^\s]+\/tx\/(0x[a-fA-F0-9]{64})/i);
    const txMintMatch = deployResult.match(/tx Mint Token\s*:\s*https?:\/\/[^\s]+\/tx\/(0x[a-fA-F0-9]{64})/i);
    return {
      name: tokenName || 'Deployed Token',
      symbol: tokenSymbol || 'TOKEN',
      supply: tokenSupply || '1000000000',
      ca,
      network: isRobin ? 'ROBINHOOD' : 'BASE',
      mode: isThirdweb ? 'thirdweb' : 'normal',
      txHash: txDeployMatch ? txDeployMatch[1] : null,
      txSetClaimConditions: txClaimMatch ? txClaimMatch[1] : null,
      txMintToken: txMintMatch ? txMintMatch[1] : null,
      verified: true,
      renounced: isThirdweb ? false : autoRenounce,
      desc: tokenDesc || '',
      web: tokenWeb || '',
      tg: tokenTg || '',
      tw: tokenTw || '',
      logo: tokenLogo || '',
      timestamp: Date.now()
    };
  }, [deployResult, tokenName, tokenSymbol, tokenSupply, deployNetwork, autoRenounce, tokenDesc, tokenWeb, tokenTg, tokenTw, tokenLogo]);

  const inspectList = useMemo(() => {
    const list = Array.isArray(deployedHistory) ? [...deployedHistory] : [];
    if (parsedFromTerminal && !list.some((item) => item.ca?.toLowerCase() === parsedFromTerminal.ca?.toLowerCase())) {
      list.unshift(parsedFromTerminal);
    }
    return list;
  }, [deployedHistory, parsedFromTerminal]);

  const activeInspectToken = inspectList[selectedInspectIndex] || inspectList[0] || null;

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 5000);
  };

  const renderTerminalOutput = (text) => {
    if (!text) return ">_ Menunggu perintah deploy...";
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#00f0ff', textDecoration: 'underline' }}>{part}</a>;
      }
      return part;
    });
  };

  const handleDeploy = async () => {
    if (!tokenName || !tokenSymbol) {
      showNotification('Nama Token dan Simbol Token harus diisi!', 'error');
      return;
    }

    setIsDeploying(true);
    if (deployMode === 'thirdweb') {
      setDeployResult(
        `⏳ Memulai Launch Coin (Mode Thirdweb - DropERC20 Proxy) di ${deployNetwork}...\n` +
        `  [Step 1/3] Deploy Proxy Contract (TWCloneFactory -> DropERC20 0x3de12eC4...7C9dD15c5)\n` +
        `  [Step 2/3] Set Claim Conditions (100% Owner Allocation & Merkle Root)\n` +
        `  [Step 3/3] Mint Token (${Number(tokenSupply || 1000000000).toLocaleString()} ${tokenSymbol} -> Owner)\n` +
        `Mohon tunggu hingga seluruh 3 transaksi dikonfirmasi di blockchain...`
      );
    } else {
      setDeployResult("⏳ Sedang Mendeply Token (Mode Normal)... Menunggu proses selesai...");
    }
    showNotification(`Memulai proses deploy (${deployMode === 'thirdweb' ? 'Mode Thirdweb' : 'Mode Normal'}) ke ${deployNetwork}...`);

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: deployNetwork,
          deployMode: deployMode === 'thirdweb' ? 'thirdweb' : 'normal',
          privateKey,
          name: tokenName,
          symbol: tokenSymbol,
          supply: tokenSupply,
          renounce: autoRenounce,
          desc: tokenDesc,
          web: tokenWeb,
          tg: tokenTg,
          tw: tokenTw,
          logo: tokenLogo
        })
      });

      const data = await response.json();

      if (data.success) {
        showNotification('Deployment Berhasil!', 'success');
        setDeployResult(data.stdout);

        // Auto-save to profile for Add LP & Inspect Token
        if (data.contractAddress) {
          const caAddress = data.contractAddress;
          const newProfile = {
            name: tokenName,
            symbol: tokenSymbol,
            supply: tokenSupply || '1000000000',
            ca: caAddress,
            network: deployNetwork,
            mode: data.mode || (deployMode === 'thirdweb' ? 'thirdweb' : 'normal'),
            txHash: data.txHash || null,
            txSetClaimConditions: data.txSetClaimConditions || null,
            txMintToken: data.txMintToken || null,
            verified: data.verified !== undefined ? data.verified : true,
            renounced: data.renounced !== undefined ? data.renounced : (deployMode === 'thirdweb' ? false : autoRenounce),
            desc: tokenDesc || '',
            web: tokenWeb || '',
            tg: tokenTg || '',
            tw: tokenTw || '',
            logo: tokenLogo || '',
            privateKey: privateKey,
            timestamp: Date.now()
          };
          
          try {
            const existingProfiles = JSON.parse(localStorage.getItem('deployed_tokens') || '[]');
            const filtered = Array.isArray(existingProfiles)
              ? existingProfiles.filter((p) => p.ca?.toLowerCase() !== caAddress.toLowerCase())
              : [];
            filtered.unshift(newProfile); // Add to top
            localStorage.setItem('deployed_tokens', JSON.stringify(filtered));
            setDeployedHistory(filtered);
            setSelectedInspectIndex(0);
          } catch(e) {
            console.error('Failed to save profile', e);
          }
        }

      } else {
        showNotification(`Gagal: ${data.error}`, 'error');
        setDeployResult(data.stderr || data.details || data.error);
      }
    } catch (err) {
      showNotification(`Terjadi kesalahan jaringan: ${err.message}`, 'error');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 2rem', width: '100%', maxWidth: '1200px', margin: '0 auto', height: 'calc(100vh - 90px - 1.5rem)', maxHeight: 'calc(100vh - 90px - 1.5rem)', minHeight: 0 }}>

      {/* Toast Notification */}
      {notification.show && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: notification.type === 'error' ? '#ef4444' : '#00d180', color: 'white', padding: '0.6rem 1.2rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '500', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 9999 }}>
          {notification.message}
        </div>
      )}

      <div className="mev-panel" style={{ background: 'linear-gradient(135deg, rgba(13, 20, 36, 0.92) 0%, rgba(9, 14, 26, 0.85) 100%)', borderRadius: '12px', border: '1px solid rgba(0, 82, 255, 0.28)', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.55)', padding: '0.9rem 1.75rem', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
        {(userRole !== 'Premium' && userRole !== 'Developer') && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 8, 17, 0.82)', backdropFilter: 'blur(6px)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔒</div>
            <h3 style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>Fitur Premium</h3>
            <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '300px', fontSize: '0.85rem' }}>Fitur ini khusus untuk Member Premium. Masukkan kode premium di menu Profil untuk membuka kunci.</p>
          </div>
        )}

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.3px', marginBottom: '0.6rem', color: '#f8fafc', textAlign: 'center' }}>Auto Deploy Token</h2>

        {/* Pilihan Mode Deploy: Mode Normal vs Mode Thirdweb */}
        <div className="deploy-mode-selector" style={{ display: 'flex', gap: '0.65rem', marginBottom: '0.6rem', minHeight: '38px', height: 'auto' }}>
          <button
            type="button"
            onClick={() => setDeployMode('normal')}
            style={{
              flex: 1,
              padding: '0 0.9rem',
              background: deployMode === 'normal' ? 'linear-gradient(135deg, rgba(0, 82, 255, 0.28) 0%, rgba(0, 242, 254, 0.16) 100%)' : 'rgba(6, 10, 20, 0.85)',
              border: deployMode === 'normal' ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: deployMode === 'normal' ? '0 0 12px rgba(0, 242, 254, 0.22)' : 'none',
              borderRadius: '8px',
              color: deployMode === 'normal' ? '#f8fafc' : '#94a3b8',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              transition: 'all 0.25s'
            }}
          >
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: deployMode === 'normal' ? '#00f2fe' : 'transparent', border: deployMode === 'normal' ? 'none' : '2px solid rgba(255,255,255,0.2)', boxShadow: deployMode === 'normal' ? '0 0 8px #00f2fe' : 'none', display: 'inline-block' }}></span>
            <span>Mode Normal</span>
          </button>
          <button
            type="button"
            onClick={() => setDeployMode('thirdweb')}
            style={{
              flex: 1,
              padding: '0 0.9rem',
              background: deployMode === 'thirdweb' ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.28) 0%, rgba(236, 72, 153, 0.18) 100%)' : 'rgba(6, 10, 20, 0.85)',
              border: deployMode === 'thirdweb' ? '1px solid #c084fc' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: deployMode === 'thirdweb' ? '0 0 12px rgba(192, 132, 252, 0.28)' : 'none',
              borderRadius: '8px',
              color: deployMode === 'thirdweb' ? '#f8fafc' : '#94a3b8',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              transition: 'all 0.25s'
            }}
          >
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: deployMode === 'thirdweb' ? '#c084fc' : 'transparent', border: deployMode === 'thirdweb' ? 'none' : '2px solid rgba(255,255,255,0.2)', boxShadow: deployMode === 'thirdweb' ? '0 0 8px #c084fc' : 'none', display: 'inline-block' }}></span>
            <span>Mode Thirdweb (DropERC20 Proxy)</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '0.6rem', minHeight: 0 }}>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.28rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Wallet Private Key</label>
            <input
              type="text"
              autoComplete="off"
              spellCheck="false"
              value={privateKey}
              onChange={(e) => {
                setPrivateKey(e.target.value);
                localStorage.setItem('deploy_private_key', e.target.value);
              }}
              placeholder="0x..."
              className="mev-input"
              style={{ width: '100%', height: '42px', boxSizing: 'border-box', padding: '0 0.85rem', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', outline: 'none', minHeight: 0, textAlign: 'center', WebkitTextSecurity: 'disc' }}
            />
          </div>

          <div className="deploy-specs-row" style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.28rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Token Name</label>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g. My Awesome Token"
                className="mev-input"
                style={{ width: '100%', height: '42px', boxSizing: 'border-box', padding: '0 0.85rem', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', outline: 'none', minHeight: 0, textAlign: 'center' }}
              />
            </div>
            <div style={{ flex: 0.9, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.28rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Token Symbol</label>
              <input
                type="text"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value)}
                placeholder="e.g. MAT"
                className="mev-input"
                style={{ width: '100%', height: '42px', boxSizing: 'border-box', padding: '0 0.85rem', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', outline: 'none', minHeight: 0, textAlign: 'center' }}
              />
            </div>
            <div style={{ flex: 1.1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.28rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Initial Supply</label>
              <input
                type="number"
                value={tokenSupply}
                onChange={(e) => setTokenSupply(e.target.value)}
                placeholder="1000000000"
                className="mev-input"
                style={{ width: '100%', height: '42px', boxSizing: 'border-box', padding: '0 0.85rem', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', outline: 'none', minHeight: 0, textAlign: 'center' }}
              />
            </div>
          </div>

          {deployMode === 'normal' ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.28rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Auto-Renounce Ownership (Y/N)</label>
              <div className="deploy-renounce-row" style={{ display: 'flex', gap: '0.65rem', minHeight: '38px', height: 'auto' }}>
                <button
                  type="button"
                  onClick={() => setAutoRenounce(true)}
                  style={{ flex: 1, padding: '0 0.65rem', background: autoRenounce ? 'rgba(0, 200, 5, 0.2)' : 'rgba(6, 10, 20, 0.85)', border: autoRenounce ? '1px solid #00c805' : '1px solid rgba(255,255,255,0.08)', boxShadow: autoRenounce ? '0 0 10px rgba(0, 200, 5, 0.22)' : 'none', borderRadius: '8px', color: autoRenounce ? '#4ade80' : '#94a3b8', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.25s' }}>
                  ✓ [Y] YA (Renounce / 100% Ceklis Hijau)
                </button>
                <button
                  type="button"
                  onClick={() => setAutoRenounce(false)}
                  style={{ flex: 1, padding: '0 0.65rem', background: !autoRenounce ? 'rgba(239, 68, 68, 0.18)' : 'rgba(6, 10, 20, 0.85)', border: !autoRenounce ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)', boxShadow: !autoRenounce ? '0 0 10px rgba(239, 68, 68, 0.22)' : 'none', borderRadius: '8px', color: !autoRenounce ? '#f87171' : '#94a3b8', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.25s' }}>
                  ✕ [N] TIDAK (Tetap Milik Deployer)
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(10, 16, 30, 0.72)', border: '1px solid rgba(192, 132, 252, 0.28)', borderRadius: '8px', padding: '0.55rem 0.9rem', gap: '0.28rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                <span style={{ color: '#e2e8f0' }}>Coin Allocation (3-Step Thirdweb: Deploy → Claim Cond → Mint)</span>
                <span style={{ color: '#c084fc', fontFamily: 'var(--font-mono)' }}>Total: 100%</span>
              </div>
              <div style={{ width: '100%', height: '5px', background: '#2563eb', borderRadius: '999px' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                <div style={{ display: 'flex', gap: '0.85rem' }}>
                  <span><span style={{ color: '#3b82f6' }}>●</span> Owner: 100%</span>
                  <span><span style={{ color: '#f97316' }}>●</span> Airdrop: 0%</span>
                  <span><span style={{ color: '#a855f7' }}>●</span> Sale: 0%</span>
                </div>
                <span style={{ color: '#4ade80' }}>✓ Verified Minimal Proxy (DropERC20)</span>
              </div>
            </div>
          )}

          {/* Metadata Opsional di tengah di atas Select Network */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <label style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.28rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Metadata Opsional</label>
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              style={{ width: '100%', height: '38px', boxSizing: 'border-box', padding: '0 0.85rem', background: 'rgba(13, 22, 40, 0.65)', border: '1px dashed rgba(0, 242, 254, 0.3)', borderRadius: '8px', color: '#cbd5e1', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.25s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}
            >
              <span>⚙️ Konfigurasi Lanjutan (Opsional)</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.28rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Select Network</label>
            <div style={{ display: 'flex', gap: '0.65rem', height: '38px' }}>
              <button
                onClick={() => setDeployNetwork('BASE')}
                style={{ flex: 1, padding: '0 0.6rem', background: deployNetwork === 'BASE' ? 'rgba(0, 82, 255, 0.18)' : 'rgba(6, 10, 20, 0.85)', border: deployNetwork === 'BASE' ? '1px solid #0052ff' : '1px solid rgba(255,255,255,0.08)', boxShadow: deployNetwork === 'BASE' ? '0 0 10px rgba(0, 82, 255, 0.28)' : 'none', borderRadius: '8px', color: deployNetwork === 'BASE' ? '#f8fafc' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.25s' }}>
                <span style={{ width: '9px', height: '9px', background: deployNetwork === 'BASE' ? '#0052ff' : 'transparent', border: deployNetwork === 'BASE' ? 'none' : '2px solid rgba(255,255,255,0.2)', boxShadow: deployNetwork === 'BASE' ? '0 0 6px #0052ff' : 'none', borderRadius: '50%', display: 'inline-block' }}></span> BASE
              </button>
              <button
                onClick={() => setDeployNetwork('ROBINHOOD')}
                style={{ flex: 1, padding: '0 0.6rem', background: deployNetwork === 'ROBINHOOD' ? 'rgba(0, 200, 5, 0.16)' : 'rgba(6, 10, 20, 0.85)', border: deployNetwork === 'ROBINHOOD' ? '1px solid #00c805' : '1px solid rgba(255,255,255,0.08)', boxShadow: deployNetwork === 'ROBINHOOD' ? '0 0 10px rgba(0, 200, 5, 0.22)' : 'none', borderRadius: '8px', color: deployNetwork === 'ROBINHOOD' ? '#f8fafc' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.25s' }}>
                <span style={{ width: '9px', height: '9px', background: deployNetwork === 'ROBINHOOD' ? '#00c805' : 'transparent', border: deployNetwork === 'ROBINHOOD' ? 'none' : '2px solid rgba(255,255,255,0.2)', boxShadow: deployNetwork === 'ROBINHOOD' ? '0 0 6px #00c805' : 'none', borderRadius: '50%', display: 'inline-block' }}></span> ROBINHOOD
              </button>
            </div>
          </div>

          <div className="mev-terminal" style={{ flex: 1, minHeight: '90px', background: 'radial-gradient(circle at top right, rgba(0, 242, 254, 0.04), transparent 70%), #02040a', border: '1px solid rgba(0, 242, 254, 0.22)', boxShadow: 'inset 0 1px 18px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 242, 254, 0.04)', borderRadius: '8px', padding: '0.6rem 0.85rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.25rem', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.3px' }}>Terminal Output:</div>
            <pre ref={terminalRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', wordBreak: 'break-all', color: '#00f2fe', fontSize: '0.76rem', lineHeight: '1.45', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', margin: 0 }}>
              {renderTerminalOutput(deployResult)}
            </pre>
          </div>

          {/* Tombol Inspect Token di atas tombol Deploy Token */}
          <button
            type="button"
            onClick={() => {
              setSelectedInspectIndex(0);
              setShowInspectModal(true);
            }}
            style={{
              width: '100%',
              height: '40px',
              boxSizing: 'border-box',
              padding: '0 0.85rem',
              fontSize: '0.86rem',
              fontFamily: 'var(--font-display)',
              background: activeInspectToken
                ? 'linear-gradient(135deg, rgba(0, 200, 5, 0.22) 0%, rgba(0, 242, 254, 0.14) 100%)'
                : 'rgba(13, 22, 40, 0.72)',
              color: activeInspectToken ? '#4ade80' : '#cbd5e1',
              border: activeInspectToken
                ? '1px solid rgba(0, 200, 5, 0.5)'
                : '1px solid rgba(0, 242, 254, 0.28)',
              boxShadow: activeInspectToken ? '0 0 12px rgba(0, 200, 5, 0.16)' : 'none',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.25s'
            }}
          >
            <span>🔍 Inspect Token</span>
            {activeInspectToken?.ca && (
              <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: '#f8fafc', background: 'rgba(0,0,0,0.35)', padding: '0.1rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                {activeInspectToken.symbol || 'TOKEN'} • {activeInspectToken.ca.slice(0, 6)}...{activeInspectToken.ca.slice(-4)}
              </span>
            )}
          </button>

          <button
            onClick={handleDeploy}
            disabled={isDeploying}
            style={{ width: '100%', height: '44px', boxSizing: 'border-box', padding: '0 1rem', fontSize: '0.95rem', fontFamily: 'var(--font-display)', background: isDeploying ? 'rgba(13, 22, 40, 0.5)' : (deployMode === 'thirdweb' ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.35) 0%, rgba(59, 130, 246, 0.25) 100%)' : 'linear-gradient(135deg, rgba(0, 82, 255, 0.25) 0%, rgba(0, 242, 254, 0.15) 100%)'), color: isDeploying ? '#64748b' : '#f8fafc', border: isDeploying ? '1px solid rgba(255,255,255,0.05)' : (deployMode === 'thirdweb' ? '1px solid rgba(192, 132, 252, 0.5)' : '1px solid rgba(0, 242, 254, 0.4)'), boxShadow: isDeploying ? 'none' : '0 4px 16px rgba(0, 82, 255, 0.22)', borderRadius: '8px', fontWeight: 800, cursor: isDeploying ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.45rem', transition: 'all 0.25s' }}
          >
            <span style={{ fontSize: '1rem' }}>{isDeploying ? '⏳' : '🚀'}</span> {isDeploying ? (deployMode === 'thirdweb' ? 'Launching Coin (3 Steps On-Chain)...' : 'Deploying On-Chain...') : (deployMode === 'thirdweb' ? 'Launch Coin (Mode Thirdweb)' : 'Deploy Token (Mode Normal)')}
          </button>

          <style>{`
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .hide-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>

          {showConfigModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 8, 17, 0.85)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div className="mev-panel" style={{ background: 'linear-gradient(135deg, rgba(13, 20, 36, 0.96) 0%, rgba(9, 14, 26, 0.94) 100%)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(0, 82, 255, 0.3)', width: '90%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.65)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ color: '#f8fafc', fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: 0 }}>⚙️ Konfigurasi Lanjutan</h3>
                  <button onClick={() => setShowConfigModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: '500' }}>Description (Optional)</label>
                  <textarea
                    className="hide-scrollbar mev-input"
                    value={tokenDesc}
                    onChange={(e) => setTokenDesc(e.target.value)}
                    placeholder="e.g. This is a community token for..."
                    style={{ width: '100%', padding: '0.6rem 1rem', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', resize: 'none', height: '5rem', minHeight: '5rem', maxHeight: '5rem', overflowY: 'auto' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: '500' }}>Logo URL (Optional)</label>
                    <input type="text" className="mev-input" value={tokenLogo} onChange={(e) => setTokenLogo(e.target.value)} placeholder="https://example.com/logo.png" style={{ width: '100%', padding: '0.6rem 1rem', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', flex: 1, minHeight: 0 }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: '500' }}>Website URL (Optional)</label>
                    <input type="text" className="mev-input" value={tokenWeb} onChange={(e) => setTokenWeb(e.target.value)} placeholder="https://mytoken.com" style={{ width: '100%', padding: '0.6rem 1rem', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', flex: 1, minHeight: 0 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: '500' }}>Telegram URL (Optional)</label>
                    <input type="text" className="mev-input" value={tokenTg} onChange={(e) => setTokenTg(e.target.value)} placeholder="https://t.me/mytoken" style={{ width: '100%', padding: '0.6rem 1rem', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', flex: 1, minHeight: 0 }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: '500' }}>Twitter URL (Optional)</label>
                    <input type="text" className="mev-input" value={tokenTw} onChange={(e) => setTokenTw(e.target.value)} placeholder="https://x.com/mytoken" style={{ width: '100%', padding: '0.6rem 1rem', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', flex: 1, minHeight: 0 }} />
                  </div>
                </div>

                <button type="button" onClick={() => setShowConfigModal(false)} style={{ width: '100%', padding: '0.8rem', background: 'linear-gradient(135deg, #0052ff, #00c805)', color: 'white', border: 'none', borderRadius: '8px', fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem', transition: 'opacity 0.2s' }}>Simpan & Tutup</button>
              </div>
            </div>
          )}

          {/* Modal Popup Inspect Token */}
          {showInspectModal && (
            <div
              onClick={() => setShowInspectModal(false)}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 8, 17, 0.86)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="mev-panel"
                style={{ background: 'linear-gradient(135deg, rgba(13, 20, 36, 0.98) 0%, rgba(8, 12, 24, 0.96) 100%)', padding: '1.75rem', borderRadius: '14px', border: '1px solid rgba(0, 242, 254, 0.35)', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem', boxShadow: '0 15px 40px rgba(0,0,0,0.75)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.35rem' }}>🔍</span>
                    <div>
                      <h3 style={{ color: '#f8fafc', fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                        Inspect Token Hasil Deploy
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Detail lengkap Smart Contract & Transaksi On-Chain
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setShowInspectModal(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', cursor: 'pointer', fontSize: '1rem', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>

                {!activeInspectToken ? (
                  <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(6, 10, 20, 0.6)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>📭</div>
                    <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: '0.25rem' }}>Belum Ada Data Token Hasil Deploy</div>
                    <div style={{ fontSize: '0.82rem' }}>Silakan lakukan Deploy Token terlebih dahulu untuk melihat detail lengkap dan menyalin CA di sini.</div>
                  </div>
                ) : (() => {
                  const isRobin = activeInspectToken.network === 'ROBINHOOD' || activeInspectToken.network === 'RBNHD';
                  const explorerBase = isRobin ? 'https://robin.etherscan.io' : 'https://basescan.org';
                  const supplyFormatted = Number(activeInspectToken.supply || 1000000000).toLocaleString();
                  const isThirdwebMode = activeInspectToken.mode === 'thirdweb';

                  return (
                    <>
                      {/* Pilihan Riwayat Token jika lebih dari 1 */}
                      {inspectList.length > 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Pilih Riwayat Token ({inspectList.length} Tersimpan)
                          </label>
                          <select
                            value={selectedInspectIndex}
                            onChange={(e) => setSelectedInspectIndex(Number(e.target.value))}
                            style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'rgba(6, 10, 20, 0.9)', border: '1px solid rgba(0, 242, 254, 0.25)', borderRadius: '8px', color: '#f8fafc', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', outline: 'none' }}
                          >
                            {inspectList.map((item, idx) => (
                              <option key={item.ca + idx} value={idx}>
                                #{idx + 1} — {item.name} ({item.symbol}) [{item.network || 'BASE'}] — {item.ca?.slice(0, 8)}...{item.ca?.slice(-6)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Kotak Utama Contract Address (CA) + Tombol Copy CA */}
                      <div style={{ background: 'linear-gradient(135deg, rgba(0, 82, 255, 0.14) 0%, rgba(0, 200, 5, 0.1) 100%)', border: '1px solid rgba(0, 242, 254, 0.4)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.74rem', color: '#00f2fe', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                            Contract Address (CA)
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            ✓ Source Code Verified (Ceklis Hijau)
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            readOnly
                            value={activeInspectToken.ca || ''}
                            onClick={(e) => e.target.select()}
                            style={{ flex: 1, minWidth: 0, height: '42px', boxSizing: 'border-box', background: 'rgba(3, 6, 14, 0.9)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px', padding: '0 0.85rem', color: '#f8fafc', fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 700, outline: 'none' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleCopyText(activeInspectToken.ca, 'ca')}
                            style={{
                              height: '42px',
                              padding: '0 1.15rem',
                              background: copiedKey === 'ca' ? '#00c805' : 'linear-gradient(135deg, #0052ff, #00c6ff)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontFamily: 'var(--font-display)',
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              boxShadow: '0 4px 14px rgba(0, 82, 255, 0.35)'
                            }}
                          >
                            {copiedKey === 'ca' ? '✓ Tersalin!' : '📋 Copy CA'}
                          </button>
                        </div>
                      </div>

                      {/* Grid Informasi Detail Token */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                        <div style={{ background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Token Name</div>
                          <div style={{ fontSize: '0.95rem', color: '#f8fafc', fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {activeInspectToken.name || '-'}
                          </div>
                        </div>

                        <div style={{ background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Token Symbol</div>
                          <div style={{ fontSize: '0.95rem', color: '#00f2fe', fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                            {activeInspectToken.symbol || '-'}
                          </div>
                        </div>

                        <div style={{ background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Total Supply</div>
                          <div style={{ fontSize: '0.9rem', color: '#4ade80', fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                            {supplyFormatted} {activeInspectToken.symbol}
                          </div>
                        </div>

                        <div style={{ background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Network & Mode</div>
                          <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 700, fontFamily: 'var(--font-display)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ color: isRobin ? '#00c805' : '#3b82f6' }}>● {isRobin ? 'ROBINHOOD' : 'BASE'}</span>
                            <span style={{ color: '#64748b' }}>|</span>
                            <span style={{ color: isThirdwebMode ? '#c084fc' : '#00f2fe' }}>{isThirdwebMode ? 'Mode Thirdweb' : 'Mode Normal'}</span>
                          </div>
                        </div>

                        <div style={{ background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Contract Standard</div>
                          <div style={{ fontSize: '0.82rem', color: '#e2e8f0', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                            {isThirdwebMode ? 'DropERC20 (Minimal Proxy)' : 'ERC-20 Standard (0% Tax)'}
                          </div>
                        </div>

                        <div style={{ background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem 0.9rem' }}>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Status Ownership / Alokasi</div>
                          <div style={{ fontSize: '0.82rem', color: '#4ade80', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                            {isThirdwebMode ? 'Owner: 100% (Minted)' : (activeInspectToken.renounced ? 'Renounced (0x000...000)' : 'Active (Deployer)')}
                          </div>
                        </div>
                      </div>

                      {/* Daftar Hash Transaksi & Link Explorer */}
                      <div style={{ background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Riwayat Transaksi & Explorer
                        </div>

                        {activeInspectToken.txHash && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.7rem', borderRadius: '6px' }}>
                            <span style={{ color: '#cbd5e1' }}>1. Tx Deploy:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <a href={`${explorerBase}/tx/${activeInspectToken.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#00f2fe', textDecoration: 'underline' }}>
                                {activeInspectToken.txHash.slice(0, 10)}...{activeInspectToken.txHash.slice(-8)}
                              </a>
                              <button type="button" onClick={() => handleCopyText(activeInspectToken.txHash, 'tx1')} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#f8fafc', padding: '0.15rem 0.45rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem' }}>
                                {copiedKey === 'tx1' ? '✓' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}

                        {activeInspectToken.txSetClaimConditions && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.7rem', borderRadius: '6px' }}>
                            <span style={{ color: '#cbd5e1' }}>2. Tx Set Claim Cond:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <a href={`${explorerBase}/tx/${activeInspectToken.txSetClaimConditions}`} target="_blank" rel="noopener noreferrer" style={{ color: '#c084fc', textDecoration: 'underline' }}>
                                {activeInspectToken.txSetClaimConditions.slice(0, 10)}...{activeInspectToken.txSetClaimConditions.slice(-8)}
                              </a>
                              <button type="button" onClick={() => handleCopyText(activeInspectToken.txSetClaimConditions, 'tx2')} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#f8fafc', padding: '0.15rem 0.45rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem' }}>
                                {copiedKey === 'tx2' ? '✓' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}

                        {activeInspectToken.txMintToken && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.7rem', borderRadius: '6px' }}>
                            <span style={{ color: '#cbd5e1' }}>3. Tx Mint Token:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <a href={`${explorerBase}/tx/${activeInspectToken.txMintToken}`} target="_blank" rel="noopener noreferrer" style={{ color: '#4ade80', textDecoration: 'underline' }}>
                                {activeInspectToken.txMintToken.slice(0, 10)}...{activeInspectToken.txMintToken.slice(-8)}
                              </a>
                              <button type="button" onClick={() => handleCopyText(activeInspectToken.txMintToken, 'tx3')} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#f8fafc', padding: '0.15rem 0.45rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.72rem' }}>
                                {copiedKey === 'tx3' ? '✓' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
                          <a
                            href={`${explorerBase}/token/${activeInspectToken.ca}#code`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ flex: 1, padding: '0.6rem', background: 'rgba(0, 82, 255, 0.2)', border: '1px solid rgba(0, 242, 254, 0.35)', borderRadius: '8px', color: '#f8fafc', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', textDecoration: 'none' }}
                          >
                            🔗 Buka Contract di {isRobin ? 'RobinScan' : 'BaseScan'}
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              const summary = [
                                `Token Name : ${activeInspectToken.name}`,
                                `Symbol     : ${activeInspectToken.symbol}`,
                                `Supply     : ${supplyFormatted} ${activeInspectToken.symbol}`,
                                `Network    : ${isRobin ? 'ROBINHOOD' : 'BASE'} (${isThirdwebMode ? 'Mode Thirdweb' : 'Mode Normal'})`,
                                `CA         : ${activeInspectToken.ca}`,
                                activeInspectToken.txHash ? `Tx Deploy  : ${explorerBase}/tx/${activeInspectToken.txHash}` : null,
                                activeInspectToken.txSetClaimConditions ? `Tx Claim   : ${explorerBase}/tx/${activeInspectToken.txSetClaimConditions}` : null,
                                activeInspectToken.txMintToken ? `Tx Mint    : ${explorerBase}/tx/${activeInspectToken.txMintToken}` : null,
                                `Explorer   : ${explorerBase}/token/${activeInspectToken.ca}#code`
                              ].filter(Boolean).join('\n');
                              handleCopyText(summary, 'all');
                            }}
                            style={{ flex: 1, padding: '0.6rem', background: 'rgba(0, 200, 5, 0.18)', border: '1px solid rgba(0, 200, 5, 0.4)', borderRadius: '8px', color: '#4ade80', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                          >
                            {copiedKey === 'all' ? '✓ Semua Detail Tersalin!' : '📋 Copy Semua Detail'}
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => setShowInspectModal(false)}
                  style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.07)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer' }}
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
