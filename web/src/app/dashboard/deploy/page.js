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
  const [privateKey, setPrivateKey] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenSupply, setTokenSupply] = useState('1000000000');
  const [tokenDesc, setTokenDesc] = useState('');
  const [tokenWeb, setTokenWeb] = useState('');
  const [tokenTg, setTokenTg] = useState('');
  const [tokenTw, setTokenTw] = useState('');
  const [tokenLogo, setTokenLogo] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const terminalRef = useRef(null);

  const states = useMemo(() => ({
    deployNetwork, tokenName, tokenSymbol, tokenSupply, tokenDesc, tokenWeb, tokenTg, tokenTw, tokenLogo
  }), [deployNetwork, tokenName, tokenSymbol, tokenSupply, tokenDesc, tokenWeb, tokenTg, tokenTw, tokenLogo]);

  const setStates = useMemo(() => ({
    deployNetwork: setDeployNetwork,
    tokenName: setTokenName,
    tokenSymbol: setTokenSymbol,
    tokenSupply: setTokenSupply,
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
  const [userRole, setUserRole] = useState('Member');

  React.useEffect(() => {
    const role = localStorage.getItem('userRole') || 'Member';
    setUserRole(role);

    const pk = localStorage.getItem('deploy_private_key');
    if (pk) setPrivateKey(pk);

    const handleProfileUpdate = () => {
      setUserRole(localStorage.getItem('userRole') || 'Member');
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, []);

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
    setDeployResult("⏳ Sedang Mendeply Token... Menunggu proses selesai...");
    showNotification(`Memulai proses deploy on-chain ke ${deployNetwork}... (Jangan tutup halaman ini)`);

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: deployNetwork,
          privateKey,
          name: tokenName,
          symbol: tokenSymbol,
          supply: tokenSupply,
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

        // Auto-save to profile for Add LP
        if (data.contractAddress) {
          const caAddress = data.contractAddress;
          const newProfile = { name: tokenName, symbol: tokenSymbol, ca: caAddress, network: deployNetwork, privateKey: privateKey, timestamp: Date.now() };
          
          try {
            const existingProfiles = JSON.parse(localStorage.getItem('deployed_tokens') || '[]');
            existingProfiles.unshift(newProfile); // Add to top
            localStorage.setItem('deployed_tokens', JSON.stringify(existingProfiles));
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

      <div style={{ background: '#0d0d12', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem 2.5rem', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
        {(userRole !== 'Premium' && userRole !== 'Developer') && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔒</div>
            <h3 style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Fitur Premium</h3>
            <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '300px', fontSize: '0.85rem' }}>Fitur ini khusus untuk Member Premium. Masukkan kode premium di menu Profil untuk membuka kunci.</p>
          </div>
        )}

        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'white', textAlign: 'center' }}>Auto Deploy Token</h2>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '0.8rem', minHeight: 0 }}>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '500', textAlign: 'center' }}>Wallet Private Key</label>
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
              style={{ width: '100%', padding: '0.6rem 1rem', background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', minHeight: 0, textAlign: 'center', WebkitTextSecurity: 'disc' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '500', textAlign: 'center' }}>Token Name</label>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g. My Awesome Token"
                style={{ width: '100%', padding: '0.6rem 1rem', background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', flex: 1, minHeight: 0, textAlign: 'center' }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '500', textAlign: 'center' }}>Token Symbol</label>
              <input
                type="text"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value)}
                placeholder="e.g. MAT"
                style={{ width: '100%', padding: '0.6rem 1rem', background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', flex: 1, minHeight: 0, textAlign: 'center' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '500', textAlign: 'center' }}>Initial Supply (Optional)</label>
            <input
              type="number"
              value={tokenSupply}
              onChange={(e) => setTokenSupply(e.target.value)}
              placeholder="1000000000"
              style={{ width: '100%', padding: '0.6rem 1rem', background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', minHeight: 0, textAlign: 'center' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              style={{ width: '100%', padding: '0.6rem', background: '#1a1a24', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.3s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#222230'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#1a1a24'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            >
              <span>⚙️ Konfigurasi Lanjutan (Opsional)</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '500', textAlign: 'center' }}>Select Network</label>
            <div style={{ display: 'flex', gap: '0.5rem', height: '39px' }}>
              <button
                onClick={() => setDeployNetwork('BASE')}
                style={{ flex: 1, padding: '0.5rem', background: deployNetwork === 'BASE' ? 'rgba(0, 82, 255, 0.1)' : '#13131a', border: deployNetwork === 'BASE' ? '1px solid #0052ff' : '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: deployNetwork === 'BASE' ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.3s' }}>
                <span style={{ width: '10px', height: '10px', background: deployNetwork === 'BASE' ? '#0052ff' : 'transparent', border: deployNetwork === 'BASE' ? 'none' : '2px solid rgba(255,255,255,0.2)', borderRadius: '50%', display: 'inline-block' }}></span> BASE
              </button>
              <button
                onClick={() => setDeployNetwork('ROBINHOOD')}
                style={{ flex: 1, padding: '0.5rem', background: deployNetwork === 'ROBINHOOD' ? 'rgba(0, 190, 100, 0.1)' : '#13131a', border: deployNetwork === 'ROBINHOOD' ? '1px solid #00be64' : '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: deployNetwork === 'ROBINHOOD' ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.3s' }}>
                <span style={{ width: '10px', height: '10px', background: deployNetwork === 'ROBINHOOD' ? '#00be64' : 'transparent', border: deployNetwork === 'ROBINHOOD' ? 'none' : '2px solid rgba(255,255,255,0.2)', borderRadius: '50%', display: 'inline-block' }}></span> ROBINHOOD
              </button>
            </div>
          </div>

          <div style={{ flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: 'bold' }}>Terminal Output:</div>
            <pre ref={terminalRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', wordBreak: 'break-all', color: '#00d180', fontSize: '0.75rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>
              {renderTerminalOutput(deployResult)}
            </pre>
          </div>

          <button
            onClick={handleDeploy}
            disabled={isDeploying}
            style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', background: isDeploying ? '#222' : '#1a1a24', color: isDeploying ? '#888' : 'white', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', fontWeight: 'bold', cursor: isDeploying ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', transition: 'all 0.3s', marginTop: '0.5rem' }}
            onMouseOver={(e) => { if (!isDeploying) { e.currentTarget.style.background = '#222230'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; } }}
            onMouseOut={(e) => { if (!isDeploying) { e.currentTarget.style.background = '#1a1a24'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; } }}
          >
            <span style={{ fontSize: '1.1rem' }}>{isDeploying ? '⏳' : '🚀'}</span> {isDeploying ? 'Deploying On-Chain...' : 'Deploy Token'}
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
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ background: '#0d0d12', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', width: '90%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ color: 'white', fontSize: '1.2rem', margin: 0 }}>⚙️ Konfigurasi Lanjutan</h3>
                  <button onClick={() => setShowConfigModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: '500' }}>Description (Optional)</label>
                  <textarea
                    className="hide-scrollbar"
                    value={tokenDesc}
                    onChange={(e) => setTokenDesc(e.target.value)}
                    placeholder="e.g. This is a community token for..."
                    style={{ width: '100%', padding: '0.6rem 1rem', background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', resize: 'none', height: '5rem', minHeight: '5rem', maxHeight: '5rem', overflowY: 'auto' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: '500' }}>Logo URL (Optional)</label>
                    <input type="text" value={tokenLogo} onChange={(e) => setTokenLogo(e.target.value)} placeholder="https://example.com/logo.png" style={{ width: '100%', padding: '0.6rem 1rem', background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', flex: 1, minHeight: 0 }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: '500' }}>Website URL (Optional)</label>
                    <input type="text" value={tokenWeb} onChange={(e) => setTokenWeb(e.target.value)} placeholder="https://mytoken.com" style={{ width: '100%', padding: '0.6rem 1rem', background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', flex: 1, minHeight: 0 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: '500' }}>Telegram URL (Optional)</label>
                    <input type="text" value={tokenTg} onChange={(e) => setTokenTg(e.target.value)} placeholder="https://t.me/mytoken" style={{ width: '100%', padding: '0.6rem 1rem', background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', flex: 1, minHeight: 0 }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: '500' }}>Twitter URL (Optional)</label>
                    <input type="text" value={tokenTw} onChange={(e) => setTokenTw(e.target.value)} placeholder="https://x.com/mytoken" style={{ width: '100%', padding: '0.6rem 1rem', background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', flex: 1, minHeight: 0 }} />
                  </div>
                </div>

                <button type="button" onClick={() => setShowConfigModal(false)} style={{ width: '100%', padding: '0.8rem', background: '#00d180', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem', transition: 'background 0.2s' }} onMouseOver={(e) => e.target.style.background = '#00be64'} onMouseOut={(e) => e.target.style.background = '#00d180'}>Simpan & Tutup</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
