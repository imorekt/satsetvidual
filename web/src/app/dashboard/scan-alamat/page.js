"use client";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { useFormCache } from '@/lib/useFormCache';

const RPC_URLS = [
  "https://base-mainnet.g.alchemy.com/v2/public",
  "https://mainnet.base.org",
  "https://base.drpc.org",
  "https://base-rpc.keccak.io",
  "https://base.gateway.tenderly.co",
  "https://base.meowrpc.com",
  "https://base-mainnet.public.blastapi.io",
  "https://base.api.pocket.network"
];

const getRandomRpc = () => RPC_URLS[Math.floor(Math.random() * RPC_URLS.length)];

async function rpcRequest(method, params, retry = 0) {
  const url = getRandomRpc();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'RPC Error');
    return data.result;
  } catch (err) {
    clearTimeout(timeoutId);
    if (retry < 15) {
      await new Promise(r => setTimeout(r, 500));
      return rpcRequest(method, params, retry + 1);
    }
    throw err;
  }
}

async function rpcBatchRequest(payloads, retry = 0) {
  const url = getRandomRpc();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout for batch
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloads),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (retry < 10) {
      await new Promise(r => setTimeout(r, 500));
      return rpcBatchRequest(payloads, retry + 1);
    }
    return [];
  }
}

export default function ScanAlamatPage() {
  const [caList, setCaList] = useState([]);
  const [showCaModal, setShowCaModal] = useState(false);
  const [tempCaList, setTempCaList] = useState([]);
  const [newCaInput, setNewCaInput] = useState('');
  const [durationMode, setDurationMode] = useState('1'); 
  const [scanNetwork, setScanNetwork] = useState('BASE');
  const [isScanning, setIsScanning] = useState(false);
  const [terminalLog, setTerminalLog] = useState('');
  const [uniqueAddresses, setUniqueAddresses] = useState([]);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [userRole, setUserRole] = useState('Member');

  const states = useMemo(() => ({
    caList, durationMode, scanNetwork
  }), [caList, durationMode, scanNetwork]);

  const setStates = useMemo(() => ({
    caList: setCaList,
    durationMode: setDurationMode,
    scanNetwork: setScanNetwork
  }), []);

  useFormCache('scan_alamat', '', states, setStates);

  const terminalRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('userRole') || 'Member';
      setUserRole(role);
      
      const handleProfileUpdated = () => {
        setUserRole(localStorage.getItem('userRole') || 'Member');
      };
      window.addEventListener('profileUpdated', handleProfileUpdated);

      const saved = localStorage.getItem('websell_caList');
      if (saved) {
        try {
          setCaList(JSON.parse(saved));
        } catch (e) {}
      }
      
      // Restore session data
      if (typeof sessionStorage !== 'undefined') {
        const savedLog = sessionStorage.getItem('websell_terminalLog');
        if (savedLog) setTerminalLog(savedLog);
        
        const savedAddrs = sessionStorage.getItem('websell_uniqueAddresses');
        if (savedAddrs) {
          try {
            setUniqueAddresses(JSON.parse(savedAddrs));
          } catch(e) {}
        }
        
        const scanning = sessionStorage.getItem('websell_isScanning');
        if (scanning === 'true') setIsScanning(true);
      }
      
      setIsLoaded(true);

      return () => window.removeEventListener('profileUpdated', handleProfileUpdated);
    }
  }, []);

  // Poll sessionStorage to update UI if a detached background scan is running
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof sessionStorage !== 'undefined') {
        const scanning = sessionStorage.getItem('websell_isScanning');
        if (scanning === 'true') {
          const savedLog = sessionStorage.getItem('websell_terminalLog');
          if (savedLog && savedLog !== terminalLog) setTerminalLog(savedLog);
          
          const savedAddrs = sessionStorage.getItem('websell_uniqueAddresses');
          if (savedAddrs) {
            try {
              const parsed = JSON.parse(savedAddrs);
              if (parsed.length !== uniqueAddresses.length) setUniqueAddresses(parsed);
            } catch(e) {}
          }
        }
        if (scanning === 'false' && isScanning) {
          setIsScanning(false);
          const savedLog = sessionStorage.getItem('websell_terminalLog');
          if (savedLog) setTerminalLog(savedLog);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [terminalLog, uniqueAddresses.length, isScanning]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('websell_caList', JSON.stringify(caList));
    }
  }, [caList, isLoaded]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', scanNetwork);
    }
    // Cleanup on unmount (optional, but good practice if leaving page)
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-theme');
      }
    };
  }, [scanNetwork]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
    if (isLoaded && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('websell_terminalLog', terminalLog);
    }
  }, [terminalLog, isLoaded]);

  useEffect(() => {
    if (isLoaded && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('websell_uniqueAddresses', JSON.stringify(uniqueAddresses));
    }
  }, [uniqueAddresses, isLoaded]);

  const addLog = (msg) => {
    if (typeof sessionStorage !== 'undefined') {
      const prev = sessionStorage.getItem('websell_terminalLog') || '';
      sessionStorage.setItem('websell_terminalLog', prev + msg + '\n');
    }
    setTerminalLog(prev => prev + msg + '\n');
  };

  const addLogReplaceLast = (msg) => {
    if (typeof sessionStorage !== 'undefined') {
      const prev = sessionStorage.getItem('websell_terminalLog') || '';
      const lines = prev.trimEnd().split('\n');
      lines.pop();
      sessionStorage.setItem('websell_terminalLog', lines.join('\n') + '\n' + msg + '\n');
    }
    setTerminalLog(prev => {
      const lines = prev.trimEnd().split('\n');
      lines.pop();
      return lines.join('\n') + '\n' + msg + '\n';
    });
  };

  const checkAborted = (signal) => {
    if (signal.aborted) return true;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('websell_abortScan') === 'true') {
      return true;
    }
    return false;
  };

  const handleScan = async () => {
    const activeCAs = caList.filter(item => item.checked);
    if (activeCAs.length === 0) {
      alert("Centang minimal 1 Contract Address (CA)!");
      return;
    }

    setIsScanning(true);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('websell_isScanning', 'true');
      sessionStorage.setItem('websell_abortScan', 'false');
    }
    const startMsg = "==========================================\n🤖 BOT SCANNER INTERAKSI CONTRACT (CA)\n==========================================\n";
    setTerminalLog(startMsg);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('websell_terminalLog', startMsg);
    setUniqueAddresses([]);
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      addLog(`\n📄 Ditemukan ${activeCAs.length} Contract Address yang aktif.`);
      addLog("🔍 Mengecek blok terbaru di jaringan...");
      
      const latestBlockHex = await rpcRequest("eth_blockNumber", []);
      const latestBlock = parseInt(latestBlockHex, 16);
      
      const blocksPerHour = 3600;
      let blocksBack = blocksPerHour * 1;
      if (durationMode === '2') blocksBack = blocksPerHour * 3;
      else if (durationMode === '3') blocksBack = blocksPerHour * 6;
      else if (durationMode === '4') blocksBack = blocksPerHour * 12;
      else if (durationMode === '5') blocksBack = blocksPerHour * 24;
      else if (durationMode === '6') blocksBack = blocksPerHour * 72;
      else if (durationMode === '7') blocksBack = blocksPerHour * 168;

      const startBlock = latestBlock - blocksBack;
      addLog(`✅ Block terbaru: ${latestBlock}. Scan dari blok ${startBlock} sampai ${latestBlock}.`);

      const allFoundAddresses = new Set();

      for (let i = 0; i < activeCAs.length; i++) {
        if (checkAborted(signal)) break;
        const caRaw = activeCAs[i].address;
        const caLabel = activeCAs[i].label ? ` (${activeCAs[i].label})` : '';
        let ca;
        try {
          ca = ethers.getAddress(caRaw);
        } catch(e) {
          addLog(`❌ CA tidak valid, dilewati: ${caRaw}${caLabel}`);
          continue;
        }

        addLog(`\n[${i+1}/${activeCAs.length}] Memindai CA: ${ca}${caLabel}`);
        
        // --- TAHAP 1 ---
        addLog(`\n🚀 [Tahap 1] Mengumpulkan rekam jejak interaksi...`);
        const batchSize = 2000;
        const chunks = [];
        for (let b = startBlock; b <= latestBlock; b += batchSize) {
          chunks.push({ start: b, end: Math.min(b + batchSize - 1, latestBlock) });
        }
        
        const txHashes = new Set();
        let logsDone = 0;
        let logsLineAdded = false;

        // Concurrency limiter for Stage 1 (Max 10 concurrent requests to avoid killing browser)
        const runStage1 = async (chunkList) => {
          const limit = 10;
          let index = 0;
          const execute = async () => {
            while (index < chunkList.length && !checkAborted(signal)) {
              const current = index++;
              const chunk = chunkList[current];
              try {
                // Empty topics to catch all events
                const logs = await rpcRequest("eth_getLogs", [{
                  fromBlock: "0x" + chunk.start.toString(16),
                  toBlock: "0x" + chunk.end.toString(16),
                  address: ca,
                  topics: []
                }]);
                
                for (const log of logs) {
                  if (log.transactionHash) txHashes.add(log.transactionHash);
                }
              } catch(e) {
                // error fetching log chunk, ignore and continue
              }
              logsDone++;
              const pct = ((logsDone / chunkList.length) * 100).toFixed(1);
              const msg = `🚀 Progress Tahap 1: ${pct}% | Selesai: ${logsDone}/${chunkList.length} batch | Tx Ditemukan: ${txHashes.size}`;
              if (!logsLineAdded) {
                addLog(msg);
                logsLineAdded = true;
              } else {
                addLogReplaceLast(msg);
              }
            }
          };
          const promises = [];
          for (let w = 0; w < limit; w++) promises.push(execute());
          await Promise.all(promises);
        };

        await runStage1(chunks);
        if (checkAborted(signal)) break;

        if (txHashes.size === 0) {
          addLog(`\n❌ Tidak ada interaksi ditemukan untuk CA ini.`);
          continue;
        }

        // --- TAHAP 2 ---
        addLog(`\n\n🔍 [Tahap 2] Mengekstrak dompet dari ${txHashes.size} transaksi...`);
        const txArray = Array.from(txHashes);
        const txChunks = [];
        const rpcBatchSize = 50;
        for (let idx = 0; idx < txArray.length; idx += rpcBatchSize) {
          txChunks.push(txArray.slice(idx, idx + rpcBatchSize));
        }

        const uniqueFromAddrs = new Set();
        const uniqueToAddrs = new Set();
        let txDone = 0;
        let txLineAdded = false;

        const runStage2 = async (chunkList) => {
          const limit = 15;
          let index = 0;
          const execute = async () => {
            while (index < chunkList.length && !checkAborted(signal)) {
              const current = index++;
              const chunk = chunkList[current];
              
              const payload = chunk.map((hash, i) => ({
                jsonrpc: "2.0", id: i, method: "eth_getTransactionByHash", params: [hash]
              }));

              try {
                const results = await rpcBatchRequest(payload);
                for (const res of results) {
                  if (res.result) {
                    const txData = res.result;
                    if (txData.from) {
                      try { uniqueFromAddrs.add(ethers.getAddress(txData.from)); } catch(e) {}
                    }
                    if (txData.to) {
                      try { uniqueToAddrs.add(ethers.getAddress(txData.to)); } catch(e) {}
                    }
                  }
                }
              } catch (e) {
                // error ignore
              }
              txDone += chunk.length;
              const pct = ((txDone / txArray.length) * 100).toFixed(1);
              const maxUnique = Math.max(uniqueFromAddrs.size, uniqueToAddrs.size);
              const msg = `🚀 Progress Tahap 2: ${pct}% | Selesai: ${txDone}/${txArray.length} Tx | Dompet Unik (Max): ${maxUnique}`;
              if (!txLineAdded) {
                addLog(msg);
                txLineAdded = true;
              } else {
                addLogReplaceLast(msg);
              }
            }
          };
          const promises = [];
          for (let w = 0; w < limit; w++) promises.push(execute());
          await Promise.all(promises);
        };

        await runStage2(txChunks);
        if (signal.aborted) break;
        
        if (uniqueFromAddrs.size >= uniqueToAddrs.size) {
          addLog(`\n✅ Otomatis: Memilih [From] karena lebih banyak dompet unik (${uniqueFromAddrs.size} vs To: ${uniqueToAddrs.size}).`);
          for (const a of uniqueFromAddrs) allFoundAddresses.add(a);
        } else {
          addLog(`\n✅ Otomatis: Memilih [To] karena lebih banyak dompet unik (${uniqueToAddrs.size} vs From: ${uniqueFromAddrs.size}).`);
          for (const a of uniqueToAddrs) allFoundAddresses.add(a);
        }
      }
      
      if (checkAborted(signal)) {
        addLog(`\n\n🛑 Proses dibatalkan.`);
      } else {
        addLog(`\n\n✅ Selesai! Ditemukan total ${allFoundAddresses.size} dompet unik.`);
        const arr = Array.from(allFoundAddresses);
        setUniqueAddresses(arr);
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('websell_uniqueAddresses', JSON.stringify(arr));
      }

    } catch (err) {
      if (!checkAborted(signal)) {
        addLog(`\n\n❌ ERROR: ${err.message}`);
      }
    } finally {
      setIsScanning(false);
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('websell_isScanning', 'false');
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('websell_abortScan', 'true');
      sessionStorage.setItem('websell_isScanning', 'false');
    }
  };

  const handleCopy = () => {
    if (uniqueAddresses.length > 0) {
      navigator.clipboard.writeText(uniqueAddresses.join('\n'));
      alert('Berhasil disalin ke clipboard!');
    }
  };

  const handleDownload = () => {
    if (uniqueAddresses.length > 0) {
      const blob = new Blob([uniqueAddresses.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Scanner_Hasil_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 2rem', width: '100%', maxWidth: '1200px', margin: '0 auto', height: 'calc(100vh - 90px - 1.5rem)', maxHeight: 'calc(100vh - 90px - 1.5rem)', minHeight: 0 }}>
      <div style={{ background: '#0d0d12', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem 2.5rem', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        
        {(userRole !== 'Premium' && userRole !== 'Developer') && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(13, 13, 18, 0.85)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
            <h3 style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Fitur Premium</h3>
            <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '300px', fontSize: '0.85rem' }}>Fitur ini khusus untuk Member Premium. Masukkan kode premium di menu Profil untuk membuka kunci.</p>
          </div>
        )}

        <div style={{ paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: 'white', textAlign: 'center' }}>🔍 Scan Alamat</h2>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '1.25rem', minHeight: 0 }}>
          
          <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0 }}>
            {/* Input Kiri */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500', margin: 0 }}>Contract Addresses (CA)</label>
                  <button 
                    onClick={() => { setTempCaList([...caList]); setNewCaInput(''); setShowCaModal(true); }}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', padding: '0.2rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem', borderRadius: '4px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                    title="Setting CA"
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
                  >
                    <span>⚙️ SETUP</span>
                  </button>
                </div>
                <div style={{ width: '100%', flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {caList.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '0.5rem', fontFamily: 'monospace' }}>
                      Klik tombol SETUP untuk mengisi CA...
                    </div>
                  ) : (
                    caList.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1, minWidth: 0 }}>
                          <input
                            type="text"
                            value={item.label || ""}
                            onChange={(e) => {
                              const newList = [...caList];
                              newList[idx].label = e.target.value;
                              setCaList(newList);
                            }}
                            placeholder="🏷️ Label"
                            style={{
                              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: item.label ? 'var(--accent-purple)' : '#94a3b8', fontSize: '0.75rem', fontWeight: 'bold', minWidth: '80px', width: '100px', maxWidth: '120px', textAlign: 'center', flexShrink: 0, outline: 'none', transition: 'all 0.2s'
                            }}
                            onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.border = '1px solid var(--accent-purple)'; }}
                            onBlur={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; }}
                            title="Ketik untuk memberi nama label"
                          />
                          <span style={{ color: item.checked ? 'white' : '#94a3b8', fontFamily: 'monospace', fontSize: '0.85rem', opacity: item.checked ? 1 : 0.5, wordBreak: 'break-all' }}>
                            {item.address}
                          </span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={item.checked} 
                          onChange={(e) => {
                            const newList = [...caList];
                            newList[idx].checked = e.target.checked;
                            setCaList(newList);
                          }}
                          style={{ cursor: 'pointer', width: '14px', height: '14px', margin: 0, padding: 0, flexShrink: 0 }}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '500' }}>Durasi (Ke belakang)</label>
                  <select 
                    value={durationMode} 
                    onChange={(e) => setDurationMode(e.target.value)}
                    style={{ padding: '0.8rem', background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none' }}
                  >
                    <option value="1">1 Jam (3600 blok)</option>
                    <option value="2">3 Jam</option>
                    <option value="3">6 Jam</option>
                    <option value="4">12 Jam</option>
                    <option value="5">1 Hari (24 Jam)</option>
                    <option value="6">3 Hari (72 Jam)</option>
                    <option value="7">1 Minggu (168 Jam)</option>
                  </select>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '500' }}>Network</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                    <button
                      onClick={() => setScanNetwork('BASE')}
                      style={{ flex: 1, background: scanNetwork === 'BASE' ? 'rgba(0, 123, 255, 0.1)' : '#13131a', border: scanNetwork === 'BASE' ? '1px solid #007bff' : '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: scanNetwork === 'BASE' ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.3s' }}>
                      <span style={{ width: '8px', height: '8px', background: scanNetwork === 'BASE' ? '#007bff' : 'transparent', border: scanNetwork === 'BASE' ? 'none' : '2px solid rgba(255,255,255,0.2)', borderRadius: '50%', display: 'inline-block' }}></span> BASE
                    </button>
                    <button
                      onClick={() => alert("Segera Hadir")}
                      style={{ flex: 1, background: scanNetwork === 'ROBINHOOD' ? 'rgba(0, 190, 100, 0.1)' : '#13131a', border: scanNetwork === 'ROBINHOOD' ? '1px solid #00be64' : '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: scanNetwork === 'ROBINHOOD' ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.3s' }}>
                      <span style={{ width: '8px', height: '8px', background: scanNetwork === 'ROBINHOOD' ? '#00be64' : 'transparent', border: scanNetwork === 'ROBINHOOD' ? 'none' : '2px solid rgba(255,255,255,0.2)', borderRadius: '50%', display: 'inline-block' }}></span> ROBINHOOD
                    </button>
                  </div>
                </div>
              </div>

              {isScanning ? (
                 <button onClick={handleStop} style={{ width: '100%', padding: '1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s' }}>
                  🛑 Hentikan Scan
                 </button>
              ) : (
                <button onClick={handleScan} style={{ width: '100%', padding: '1rem', background: 'var(--accent-purple)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.3s' }}>
                  🚀 Mulai Scan
                </button>
              )}
            </div>

            {/* Pembatas Tengah */}
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', marginTop: '-1.5rem', marginBottom: '-1.5rem' }}></div>

            {/* Terminal Kanan */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0 }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Terminal Output:</span>
                {uniqueAddresses.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleCopy} style={{ background: '#1a1a24', color: '#00d180', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer' }}>📋 Copy</button>
                    <button onClick={handleDownload} style={{ background: '#1a1a24', color: '#00d180', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer' }}>💾 Download</button>
                  </div>
                )}
              </div>
              <pre ref={terminalRef} style={{ flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem', overflowY: 'auto', overflowX: 'hidden', color: '#00d180', fontSize: '0.8rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>
                {terminalLog || ">_ Menunggu perintah scan..."}
              </pre>
            </div>
          </div>
          
        </div>
      </div>

      {/* CA Modal */}
      {showCaModal && (
        <div
          onClick={() => setShowCaModal(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0d0d12', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ color: 'white', fontSize: '1.2rem', margin: 0, fontWeight: 'bold' }}>Add Contract Addresses (CA)</h3>
              <button onClick={() => setShowCaModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <textarea
                  value={newCaInput}
                  onChange={(e) => setNewCaInput(e.target.value)}
                  placeholder="Paste CA baru di sini (bisa banyak)...\n0x..."
                  style={{ flex: 1, height: '60px', padding: '0.8rem 1rem', background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', resize: 'none', fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                <button
                  onClick={() => {
                    const lines = newCaInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                    if (lines.length > 0) {
                      const added = lines.map(addr => {
                        const existing = caList.find(item => item.address === addr);
                        return {
                          address: addr,
                          checked: existing !== undefined ? existing.checked : true,
                          label: existing !== undefined ? existing.label : ""
                        };
                      });
                      setTempCaList([...tempCaList, ...added]);
                      setNewCaInput('');
                    }
                  }}
                  style={{ padding: '0 1rem', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  Tambah
                </button>
              </div>

              <div style={{ height: '200px', overflowY: 'auto', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {tempCaList.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', marginTop: '1rem' }}>Belum ada CA. Silakan tambah di atas.</div>
                ) : (
                  tempCaList.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                      <span style={{ color: 'white', fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>{item.address}</span>
                      <button 
                        onClick={() => {
                          const newList = [...tempCaList];
                          newList.splice(idx, 1);
                          setTempCaList(newList);
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: '0 0.5rem' }}
                        title="Hapus CA"
                      >
                        ❌
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setCaList(tempCaList);
                setShowCaModal(false);
              }}
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
