"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ethers } from 'ethers';
import { useFormCache } from '@/lib/useFormCache';

// Global background state
let globalIsDeploying = false;
let globalIsProcessRunning = false;
let globalDeploySessionId = 0;
let globalAbortController = null;
let globalActiveSetDeployResult = null;
let globalActiveSetIsDeploying = null;
let globalActiveSetIsProcessRunning = null;
let globalActiveShowNotification = null;

const updateLogs = (text, sessionId = null) => {
  if (sessionId !== null && sessionId !== globalDeploySessionId) return; // ignore if from old session
  sessionStorage.setItem('addLpTerminalLog', text);
  if (globalActiveSetDeployResult) globalActiveSetDeployResult(text);
};

const updateIsDeploying = (state) => {
  globalIsDeploying = state;
  if (globalActiveSetIsDeploying) globalActiveSetIsDeploying(state);
};

const updateIsProcessRunning = (state) => {
  globalIsProcessRunning = state;
  if (globalActiveSetIsProcessRunning) globalActiveSetIsProcessRunning(state);
};

const showNotificationGlobal = (msg, type) => {
  if (globalActiveShowNotification) globalActiveShowNotification(msg, type);
};

const runDeployProcess = async (params) => {
  if (globalIsDeploying) return;
  
  globalDeploySessionId++;
  const mySessionId = globalDeploySessionId;

  updateIsDeploying(true);
  updateIsProcessRunning(true);
  globalIsDeploying = true;
  globalIsProcessRunning = true;

  const { deployNetwork, privateKey, tokenAddress, tokenAmount, initialPrice, minPrice, deployedTokens, telegramUser } = params;

  updateLogs("⏳ Sedang Menambah LP... Menunggu proses selesai...", mySessionId);
  showNotificationGlobal(`Memulai proses Add LP on-chain ke ${deployNetwork}... (Berjalan di latar belakang)`);

  globalAbortController = new AbortController();

  try {
    const response = await fetch('/api/add-lp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: globalAbortController.signal,
      body: JSON.stringify({
        network: deployNetwork,
        privateKey,
        tokenAddress,
        tokenAmount,
        initialPrice,
        minPrice
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedLog = "";
    let finalData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.log !== undefined) {
              accumulatedLog += parsed.log + "\n";
              updateLogs(accumulatedLog, mySessionId);
            } else if (parsed.done) {
              finalData = parsed;
            }
          } catch(e) {}
        }
      }
    }

    const data = finalData;

    if (data && data.success) {
      showNotificationGlobal('Add LP Berhasil!', 'success');

      // Auto-save ke Screener V2 (gunakan data.poolUrl dari server langsung)
      try {
        if (data.poolUrl) {
          const poolIdMatch = data.poolUrl.match(/(0x[a-fA-F0-9]{64})/);
          const lpPool = poolIdMatch ? poolIdMatch[1] : null;
          if (lpPool) {
            let profileName = "ProfilBaru";
            const profileObj = deployedTokens.find(t => t.ca.toLowerCase() === tokenAddress.toLowerCase());
            if (profileObj && profileObj.name) profileName = profileObj.name;

            const rpc = deployNetwork === 'BASE' ? 'https://mainnet.base.org' : 'https://rpc.mainnet.chain.robinhood.com';

            fetch('/api/autosell/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userName: telegramUser,
                profileName: profileName,
                privateKey: privateKey,
                inputCa: tokenAddress,
                lpPool: lpPool,
                rpc: rpc,
                gasMultiplier: "1.2",
                slippage: "30",
                sellRatio: "100"
              })
            }).then(res => {
              if (res.ok) {
                if (privateKey) localStorage.setItem(`pk_${telegramUser}_${profileName}`, privateKey);
                localStorage.setItem('activeProfile', profileName);
                console.log("Berhasil auto-save profil ke Screener V2!");
              }
            });
          }
        }
      } catch (e) {
        console.error("Gagal auto-save ke Screener V2", e);
      }

      // Unlock tombol segera setelah Add LP selesai (sebelum countdown)
      updateIsDeploying(false);

      // --- AUTO BUY COUNTDOWN & FETCH — jalan di background, tidak block tombol ---
      (async () => {
        updateLogs(accumulatedLog + `\n    [*] Memulai pendeteksian LP di app.uniswap.org/positions...`, mySessionId);
        
        // Loop pendeteksian tanpa limit sampai LP benar-benar aktif di pool
        let found = false;
        let attempts = 1;
        while (!found) {
          if (mySessionId !== globalDeploySessionId) return; // Abort if session cleared
          updateLogs(accumulatedLog + `\n    [*] Mendeteksi LP pasangan baru di Uniswap V4... (Percobaan ${attempts})`, mySessionId);
          
          try {
            const walletAddr = new ethers.Wallet(privateKey).address;
            const checkRes = await fetch('/api/check-liquidity', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: globalAbortController.signal,
              body: JSON.stringify({ network: deployNetwork, walletAddress: walletAddr })
            });
            const checkData = await checkRes.json();
            
            if (checkData.success) {
              found = true;
              break;
            }
          } catch (e) {
            if (e.name === 'AbortError') return;
            // biarkan dan coba lagi
          }
          
          await new Promise(r => setTimeout(r, 3000));
          attempts++;
        }

        if (mySessionId !== globalDeploySessionId) return;
        
        updateLogs(accumulatedLog + `\n    [+] Pasangan LP berhasil terdeteksi aktif di Pool!`, mySessionId);
        updateLogs(accumulatedLog + `\n    [*] Menjalankan API Auto-Buy...`, mySessionId);
        try {
          const buyRes = await fetch('/api/auto-buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: globalAbortController.signal,
            body: JSON.stringify({ network: deployNetwork, privateKey, tokenAddress })
          });
          const buyData = await buyRes.json();
          if (mySessionId !== globalDeploySessionId) return;
          updateLogs(accumulatedLog + "\n" + buyData.stdout, mySessionId);
        } catch (err) {
          if (err.name === 'AbortError') return;
          if (mySessionId !== globalDeploySessionId) return;
          updateLogs(accumulatedLog + `\n    [-] Gagal memanggil API Auto-Buy: ${err.message}`, mySessionId);
        }
        if (mySessionId === globalDeploySessionId) {
          updateIsProcessRunning(false);
        }
      })();

    } else {
      showNotificationGlobal(`Gagal: ${data ? data.error : 'Tidak ada response'}`, 'error');
      updateLogs(accumulatedLog + "\n[!] ERROR:\n" + (data ? data.error : 'Unknown error'), mySessionId);
      updateIsDeploying(false);
      updateIsProcessRunning(false);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Proses Add LP dibatalkan oleh user.');
      updateIsDeploying(false);
      updateIsProcessRunning(false);
      return;
    }
    showNotificationGlobal(`Terjadi kesalahan jaringan: ${err.message}`, 'error');
    updateIsDeploying(false);
    updateIsProcessRunning(false);
  }
};

const IconCheckFilled = () => (
  <svg viewBox="0 0 24 24" fill="#00be64" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#00be64" />
    <path d="M10 17l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#13131a" />
  </svg>
);
const IconChevronDown = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>;

export default function AddSingleLpPage() {
  const [deployNetwork, setDeployNetwork] = useState('BASE');
  const [privateKey, setPrivateKey] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [selectedPriceTier, setSelectedPriceTier] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isProcessRunning, setIsProcessRunning] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const terminalRef = useRef(null);

  const states = useMemo(() => ({
    deployNetwork, tokenAddress, tokenAmount, selectedPriceTier, maxSupply: 1000000000, selectedProfileId: 'manual'
  }), [deployNetwork, tokenAddress, tokenAmount, selectedPriceTier]);

  const setStates = useMemo(() => ({
    deployNetwork: setDeployNetwork,
    tokenAddress: setTokenAddress,
    tokenAmount: setTokenAmount,
    selectedPriceTier: setSelectedPriceTier
  }), []);

  useFormCache('addLp', privateKey, states, setStates);

  useEffect(() => {
    globalActiveSetDeployResult = setDeployResult;
    globalActiveSetIsDeploying = setIsDeploying;
    globalActiveSetIsProcessRunning = setIsProcessRunning;

    const saved = sessionStorage.getItem('addLpTerminalLog');
    if (saved) setDeployResult(saved);
    if (globalIsDeploying) setIsDeploying(true);
    if (globalIsProcessRunning) setIsProcessRunning(true);

    return () => {
      globalActiveSetDeployResult = null;
      globalActiveSetIsDeploying = null;
      globalActiveSetIsProcessRunning = null;
      globalActiveShowNotification = null;
    };
  }, []);

  useEffect(() => {
    if (deployResult !== null) sessionStorage.setItem('addLpTerminalLog', deployResult);
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [deployResult]);

  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userRole, setUserRole] = useState('Member');
  const [deployedTokens, setDeployedTokens] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('manual');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [maxSupply, setMaxSupply] = useState(1000000000);

  const priceTiers = [
    { initial: '0.0000002', min: '0.00000026' },
    { initial: '0.00000002', min: '0.000000026' },
    { initial: '0.000000002', min: '0.0000000026' },
  ];

  React.useEffect(() => {
    const role = localStorage.getItem('userRole') || 'Member';
    setUserRole(role);

    const pk = localStorage.getItem('deploy_private_key');
    if (pk) setPrivateKey(pk);

    try {
      const tokens = JSON.parse(localStorage.getItem('deployed_tokens') || '[]');
      setDeployedTokens(tokens);
      const available = tokens.filter(t => !t.network || t.network === 'BASE'); // default network is BASE on load
      if (available.length > 0) {
        setSelectedProfileId(available[0].ca);
        setTokenAddress(available[0].ca);
      }
    } catch (e) { }

    const handleProfileUpdate = () => {
      setUserRole(localStorage.getItem('userRole') || 'Member');
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, []);

  useEffect(() => {
    async function fetchSupply() {
      if (!tokenAddress || tokenAddress.length !== 42) {
        setMaxSupply(1000000000);
        return;
      }
      try {
        const rpcUrl = deployNetwork === 'BASE' ? 'https://mainnet.base.org' : 'https://rpc.mainnet.chain.robinhood.com';
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Cek apakah contract ada di jaringan ini untuk menghindari error BAD_DATA
        const code = await provider.getCode(tokenAddress);
        if (code === '0x') {
          setMaxSupply(1000000000);
          return;
        }

        const abi = [
          "function totalSupply() view returns (uint256)",
          "function decimals() view returns (uint8)"
        ];
        const contract = new ethers.Contract(tokenAddress, abi, provider);
        const [totalSupply, decimals] = await Promise.all([
          contract.totalSupply(),
          contract.decimals()
        ]);
        const formattedSupply = ethers.formatUnits(totalSupply, decimals);
        setMaxSupply(Number(formattedSupply));
      } catch (err) {
        console.warn("Info: Token belum ada di jaringan", deployNetwork, "atau RPC gagal. Menggunakan supply default.");
        setMaxSupply(1000000000); // fallback
      }
    }
    fetchSupply();
  }, [tokenAddress, deployNetwork]);

  useEffect(() => {
    // Sesuaikan pilihan dropdown saat network dan privateKey berubah
    const availableTokens = deployedTokens.filter(t => 
      (!t.network || t.network === deployNetwork) && 
      (t.privateKey === privateKey)
    );
    
    if (availableTokens.length > 0) {
      const stillExists = availableTokens.find(t => t.ca === tokenAddress);
      if (!stillExists) {
        setSelectedProfileId(availableTokens[0].ca);
        setTokenAddress(availableTokens[0].ca);
      } else {
        setSelectedProfileId(tokenAddress);
      }
    } else {
      setSelectedProfileId('manual');
      setTokenAddress('');
    }
  }, [deployNetwork, deployedTokens, privateKey]);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 5000);
  };

  useEffect(() => {
    globalActiveShowNotification = showNotification;
  }, [notification]);

  const renderTerminalOutput = (text) => {
    if (!text) return ">_ Menunggu perintah add lp...";
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
    if (!tokenAddress || !tokenAmount) {
      showNotification('Contract Address dan Jumlah Token (LP) harus diisi!', 'error');
      // Tampilkan juga di terminal agar user sadar ada error validasi form
      setDeployResult(
        (prev) => (prev ? prev + '\n' : '') + `[!] GAGAL: Contract Address dan Jumlah Token (LP) belum diisi.`
      );
      return;
    }

    // Pastikan tidak stuck dari run sebelumnya
    globalIsDeploying = false;

    const telegramUser = localStorage.getItem('userName') || 'default_user';
    
    // Mulai proses
    runDeployProcess({
      deployNetwork,
      privateKey,
      tokenAddress,
      tokenAmount,
      initialPrice: priceTiers[selectedPriceTier].initial,
      minPrice: priceTiers[selectedPriceTier].min,
      deployedTokens,
      telegramUser
    });
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

        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'white', textAlign: 'center' }}>Add Single LP</h2>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '0.8rem', minHeight: 0 }}>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '500', textAlign: 'center' }}>Token Contract Address</label>
              <button
                onClick={() => setShowProfileModal(true)}
                type="button"
                style={{ width: '100%', padding: '0.6rem', background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s' }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#222230'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#1a1a24'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              >
                {(() => {
                  if (selectedProfileId !== 'manual') {
                    const profile = deployedTokens.find(t => t.ca === selectedProfileId);
                    if (profile) return profile.name;
                  }
                  return tokenAddress && tokenAddress.length >= 42 ? `${tokenAddress.substring(0, 6)}...${tokenAddress.substring(38)}` : (tokenAddress || 'Pilih Profil / Input Manual');
                })()}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '500', textAlign: 'center' }}>Pilih Price Tier (Initial & Min Price)</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {priceTiers.map((tier, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedPriceTier(index)}
                  type="button"
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    background: selectedPriceTier === index ? (deployNetwork === 'BASE' ? 'rgba(0, 82, 255, 0.08)' : 'rgba(0, 209, 128, 0.08)') : '#13131a',
                    border: selectedPriceTier === index ? `1px solid ${deployNetwork === 'BASE' ? '#0052ff' : '#00d180'}` : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    color: selectedPriceTier === index ? 'white' : '#94a3b8',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.3s'
                  }}
                  onMouseOver={(e) => { if (selectedPriceTier !== index) { e.currentTarget.style.background = '#1a1a24'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; } }}
                  onMouseOut={(e) => { if (selectedPriceTier !== index) { e.currentTarget.style.background = '#13131a'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; } }}
                >
                  <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#94a3b8' }}>Initial:</span> <span style={{ color: selectedPriceTier === index ? (deployNetwork === 'BASE' ? '#0052ff' : '#00d180') : 'white', fontWeight: 'bold' }}>{tier.initial}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem' }}>
                    <span style={{ color: '#94a3b8' }}>Min:</span> <span style={{ color: selectedPriceTier === index ? (deployNetwork === 'BASE' ? '#0052ff' : '#00d180') : 'white', fontWeight: 'bold' }}>{tier.min}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '500', textAlign: 'center' }}>
              Jumlah Token (LP) <span style={{ color: '#00be64', marginLeft: '0.3rem' }}>(Max: {maxSupply.toLocaleString()})</span>
            </label>
            <input
              type="number"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              placeholder="Jumlah token..."
              style={{ width: '100%', padding: '0.6rem 1rem', background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', minHeight: 0, textAlign: 'center' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', justifyContent: 'center' }}>
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setTokenAmount((maxSupply * (pct / 100)).toString())}
                  type="button"
                  style={{
                    padding: '0.2rem 0.6rem',
                    background: '#1a1a24',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    color: '#94a3b8',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#222230'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#1a1a24'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  {pct === 100 ? 'Max' : `${pct}%`}
                </button>
              ))}
            </div>
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
                <span style={{ width: '10px', height: '10px', background: deployNetwork === 'ROBINHOOD' ? '#00be64' : 'transparent', border: deployNetwork === 'ROBINHOOD' ? 'none' : '2px solid rgba(255,255,255,0.2)', borderRadius: '50%', display: 'inline-block' }}></span> RBNHD
              </button>
            </div>
          </div>

          <div style={{ flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: 'bold' }}>Terminal Output:</div>
            <button
              disabled={isProcessRunning}
              onClick={() => {
                if (isProcessRunning) return;
                if (globalAbortController) {
                  globalAbortController.abort();
                }
                globalDeploySessionId++; // invalidates any running background loops
                sessionStorage.removeItem('addLpTerminalLog');
                setDeployResult(null);
                globalIsDeploying = false;
                globalIsProcessRunning = false;
                if (globalActiveSetIsDeploying) globalActiveSetIsDeploying(false);
                if (globalActiveSetIsProcessRunning) globalActiveSetIsProcessRunning(false);
              }}
              title={isProcessRunning ? "Tunggu proses selesai" : "Clear Log"}
              style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: isProcessRunning ? 'rgba(148,163,184,0.3)' : '#94a3b8', fontSize: '0.7rem', padding: '0.15rem 0.4rem', cursor: isProcessRunning ? 'not-allowed' : 'pointer', lineHeight: 1, zIndex: 10, transition: 'all 0.2s', opacity: isProcessRunning ? 0.5 : 1 }}
              onMouseOver={e => { if(!isProcessRunning) { e.currentTarget.style.background = 'rgba(255,80,80,0.15)'; e.currentTarget.style.color = '#ff6b6b'; e.currentTarget.style.borderColor = 'rgba(255,80,80,0.3)'; } }}
              onMouseOut={e => { if(!isProcessRunning) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; } }}
            >✕ Clear</button>
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
            <span style={{ fontSize: '1.1rem' }}>{isDeploying ? '⏳' : '💧'}</span> {isDeploying ? 'Adding Liquidity...' : 'Add Liquidity'}
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
        </div>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div
          onClick={() => setShowProfileModal(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0d0d12', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ color: 'white', fontSize: '1.2rem', margin: 0, fontWeight: 'bold' }}>Pilih Profil Token</h3>
              <button onClick={() => setShowProfileModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            {(() => {
              const availableTokens = deployedTokens.filter(t => !t.network || t.network === deployNetwork);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '1.5rem' }}>
                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: selectedProfileId === 'manual' ? '0.5rem' : '0' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        style={{ flex: 1, padding: '0.8rem', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                          {selectedProfileId === 'manual'
                            ? '-- Input CA Manual --'
                            : (availableTokens.find(t => t.ca === selectedProfileId)
                              ? `${availableTokens.find(t => t.ca === selectedProfileId).name} (${availableTokens.find(t => t.ca === selectedProfileId).symbol})`
                              : 'Pilih Profil...')}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>▼</span>
                      </div>

                      {tokenAddress && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(tokenAddress);
                            showNotification('CA berhasil disalin!', 'success');
                          }}
                          title="Copy Contract Address"
                          style={{ padding: '0 1rem', background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#00d180', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}
                          onMouseOver={(e) => { e.currentTarget.style.background = '#222230'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = '#1a1a24'; }}
                        >
                          📋
                        </button>
                      )}
                    </div>

                    {isDropdownOpen && (
                      <div className="hide-scrollbar" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#13131a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', marginTop: '0.2rem', zIndex: 10, maxHeight: '265px', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                        {availableTokens.length === 0 && (
                          <div style={{ padding: '0.8rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>Belum ada token {deployNetwork}</div>
                        )}
                        {availableTokens.map((token) => (
                          <div key={token.ca} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#1a1a24'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', padding: '0.8rem', cursor: 'pointer' }} onClick={() => {
                              setSelectedProfileId(token.ca);
                              setTokenAddress(token.ca);
                              if (token.network) setDeployNetwork(token.network);
                              setIsDropdownOpen(false);
                            }}>
                              <span style={{ fontWeight: 'bold', color: 'white', fontSize: '0.9rem' }}>{token.name} <span style={{ color: '#94a3b8' }}>({token.symbol})</span></span>
                              <span style={{ color: '#00d180', fontFamily: 'monospace', fontSize: '0.8rem' }}>{token.ca.substring(0, 6)}...{token.ca.substring(38)}</span>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Yakin ingin menghapus profil ${token.name}?`)) {
                                  const newTokens = deployedTokens.filter(t => t.ca !== token.ca);
                                  setDeployedTokens(newTokens);
                                  localStorage.setItem('deployed_tokens', JSON.stringify(newTokens));
                                  if (selectedProfileId === token.ca) {
                                    setSelectedProfileId('manual');
                                    setTokenAddress('');
                                  }
                                  showNotification('Profil berhasil dihapus!', 'success');
                                  if (newTokens.filter(t => !t.network || t.network === deployNetwork).length === 0) {
                                    setIsDropdownOpen(false);
                                  }
                                }
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '0.8rem', display: 'flex', alignItems: 'center' }}
                              title="Hapus Profil"
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,68,68,0.1)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              🗑️
                            </button>
                          </div>
                        ))}

                        <div
                          onClick={() => {
                            setSelectedProfileId('manual');
                            setTokenAddress('');
                            setIsDropdownOpen(false);
                          }}
                          style={{ padding: '0.8rem', cursor: 'pointer', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#1a1a24'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          -- Input CA Manual --
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedProfileId === 'manual' && (
                    <input
                      type="text"
                      value={tokenAddress}
                      onChange={(e) => setTokenAddress(e.target.value)}
                      placeholder="Ketik 0x..."
                      style={{ width: '100%', padding: '0.8rem', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', textAlign: 'center' }}
                    />
                  )}
                </div>
              );
            })()}
            <button
              onClick={() => setShowProfileModal(false)}
              style={{ width: '100%', padding: '0.8rem', background: 'linear-gradient(to right, #00d180, #00b86a)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem' }}
            >
              Simpan & Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
