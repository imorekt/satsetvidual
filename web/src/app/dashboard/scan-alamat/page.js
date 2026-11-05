"use client";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { useFormCache } from '@/lib/useFormCache';

const BASE_RPC_URLS = [
  "https://base-mainnet.g.alchemy.com/v2/public",
  "https://mainnet.base.org",
  "https://base.drpc.org",
  "https://base-rpc.keccak.io",
  "https://base.gateway.tenderly.co",
  "https://base.meowrpc.com",
  "https://base-mainnet.public.blastapi.io",
  "https://base.api.pocket.network"
];

const ROBIN_RPC_URLS = [
  "https://rpc.mainnet.chain.robinhood.com",
  "https://robinhood.drpc.org"
];

const SIG_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const BURN_ADDRESS = "0x0000000000000000000000000000000000000000";

const ROBIN_PRESETS_BY_MODE = {
  transaction: [
    { address: "0x3d90f66B534Dd8482b181e24655A9e8265316BE9", label: "Router #1", checked: true },
    { address: "0x69460570c93f9DE5E2edbC3052bf10125f0Ca22d", label: "Router #2", checked: true },
    { address: "0x0729E2a4716d9f7dD17858d5d504426D228697f7", label: "Router #3", checked: true }
  ],
  token_transfer_from: [
    { address: "0x04822Ea321A0DEE6F40656172F29312104855d66", label: "Token From #1", checked: true }
  ],
  token_transfer_to: [
    { address: "0x2CfF890f0378a11913B6129B2E97417a2c302680", label: "Token To #1", checked: true }
  ]
};

const getRandomBaseRpc = () => BASE_RPC_URLS[Math.floor(Math.random() * BASE_RPC_URLS.length)];
const getRandomRobinRpc = () => ROBIN_RPC_URLS[Math.floor(Math.random() * ROBIN_RPC_URLS.length)];

const PRIMARY_BASE_RPC = "https://base-mainnet.core.chainstack.com/777f7306a808d70ba68c63ff713a2f2b";
const PRIMARY_ROBIN_RPC = "https://rpc.mainnet.chain.robinhood.com";

async function rpcRequest(method, params, retry = 0, usePrimary = true, network = 'BASE') {
  const url = network === 'ROBINHOOD'
    ? (usePrimary ? PRIMARY_ROBIN_RPC : getRandomRobinRpc())
    : (usePrimary ? PRIMARY_BASE_RPC : getRandomBaseRpc());
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data.error) {
      const err = new Error(data.error.message || 'RPC Error');
      err.code = data.error.code;
      throw err;
    }
    return data.result;
  } catch (err) {
    clearTimeout(timeoutId);
    // Jangan retry jika error berasal dari limit logs > 10,000 agar langsung di-split chunk-nya
    if (err.message && (err.message.includes('exceeds limit') || err.message.includes('only 30000'))) {
      throw err;
    }
    if (usePrimary) {
      return rpcRequest(method, params, retry, false, network);
    }
    if (retry < 10) {
      await new Promise(r => setTimeout(r, 400));
      return rpcRequest(method, params, retry + 1, false, network);
    }
    throw err;
  }
}

async function rpcBatchRequest(payloads, retry = 0, usePrimary = true, network = 'BASE') {
  const url = network === 'ROBINHOOD'
    ? (usePrimary ? PRIMARY_ROBIN_RPC : getRandomRobinRpc())
    : (usePrimary ? PRIMARY_BASE_RPC : getRandomBaseRpc());
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloads),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Batch RPC non-array response');
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (usePrimary) {
      return rpcBatchRequest(payloads, retry, false, network);
    }
    if (retry < 8) {
      await new Promise(r => setTimeout(r, 400));
      return rpcBatchRequest(payloads, retry + 1, false, network);
    }
    return [];
  }
}

async function fetchRobinLogsAdaptive(filterBase, fromBlock, toBlock, signal) {
  if (signal && signal.aborted) return [];
  try {
    const logs = await rpcRequest("eth_getLogs", [{
      ...filterBase,
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + toBlock.toString(16)
    }], 0, true, 'ROBINHOOD');
    return Array.isArray(logs) ? logs : [];
  } catch (err) {
    const msg = (err?.message || '').toLowerCase();
    if ((msg.includes('exceeds limit') || msg.includes('only 30000') || msg.includes('range')) && (toBlock - fromBlock > 500)) {
      const mid = Math.floor((fromBlock + toBlock) / 2);
      const left = await fetchRobinLogsAdaptive(filterBase, fromBlock, mid, signal);
      const right = await fetchRobinLogsAdaptive(filterBase, mid + 1, toBlock, signal);
      return left.concat(right);
    }
    return [];
  }
}

function getRobinLimitConfig(durationMode) {
  switch (durationMode) {
    case 'rec_1000':
      return { maxRecords: 1000, maxAgeSeconds: null, label: '1,000 Record Terakhir (20 Halaman)' };
    case 'rec_5000':
      return { maxRecords: 5000, maxAgeSeconds: null, label: '5,000 Record Terakhir (100 Halaman)' };
    case 'rec_10000':
    default:
      return { maxRecords: 10000, maxAgeSeconds: null, label: '10,000 Record Terakhir (200 Halaman)' };
  }
}

const DEFAULT_ROBIN_TX_CAS = [
  { address: "0x3d90f66B534Dd8482b181e24655A9e8265316BE9", label: "Router #1", checked: true },
  { address: "0x69460570c93f9DE5E2edbC3052bf10125f0Ca22d", label: "Router #2", checked: true },
  { address: "0x0729E2a4716d9f7dD17858d5d504426D228697f7", label: "Router #3", checked: true }
];

export default function ScanAlamatPage() {
  const [baseTxCaList, setBaseTxCaList] = useState([]);
  const [baseTokenFromCaList, setBaseTokenFromCaList] = useState([]);
  const [baseTokenToCaList, setBaseTokenToCaList] = useState([]);
  const [robinTxCaList, setRobinTxCaList] = useState(DEFAULT_ROBIN_TX_CAS);
  const [robinTokenFromCaList, setRobinTokenFromCaList] = useState([]);
  const [robinTokenToCaList, setRobinTokenToCaList] = useState([]);
  const [showCaModal, setShowCaModal] = useState(false);
  const [tempCaList, setTempCaList] = useState([]);
  const [newCaInput, setNewCaInput] = useState('');
  const [durationMode, setDurationMode] = useState('5'); 
  const [scanNetwork, setScanNetwork] = useState('BASE');
  // Pilihan Menu Scanner: '1' = Transaction (/txs?a=...), '2' = Token Transfer (/tokentxns?a=...)
  const [robinMenu, setRobinMenu] = useState('1');
  // Pilihan Sub-Tipe Token Transfer: 'from' = Kolom From, 'to' = Kolom To
  const [robinTransferDir, setRobinTransferDir] = useState('from');

  const caList = useMemo(() => {
    if (scanNetwork === 'ROBINHOOD') {
      if (robinMenu === '1') return robinTxCaList;
      return robinTransferDir === 'to' ? robinTokenToCaList : robinTokenFromCaList;
    }
    if (robinMenu === '1') return baseTxCaList;
    return robinTransferDir === 'to' ? baseTokenToCaList : baseTokenFromCaList;
  }, [scanNetwork, robinMenu, robinTransferDir, baseTxCaList, baseTokenFromCaList, baseTokenToCaList, robinTxCaList, robinTokenFromCaList, robinTokenToCaList]);

  const setCaList = (newVal) => {
    if (scanNetwork === 'ROBINHOOD') {
      if (robinMenu === '1') {
        setRobinTxCaList(newVal);
      } else if (robinTransferDir === 'to') {
        setRobinTokenToCaList(newVal);
      } else {
        setRobinTokenFromCaList(newVal);
      }
    } else {
      if (robinMenu === '1') {
        setBaseTxCaList(newVal);
      } else if (robinTransferDir === 'to') {
        setBaseTokenToCaList(newVal);
      } else {
        setBaseTokenFromCaList(newVal);
      }
    }
  };

  const [isScanning, setIsScanning] = useState(false);
  const [terminalLog, setTerminalLog] = useState('');
  const [uniqueAddresses, setUniqueAddresses] = useState([]);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [userRole, setUserRole] = useState('Member');

  const effectiveRobinMode = useMemo(() => {
    if (robinMenu === '2') {
      return robinTransferDir === 'to' ? 'token_transfer_to' : 'token_transfer_from';
    }
    return 'transaction';
  }, [robinMenu, robinTransferDir]);

  const states = useMemo(() => ({
    durationMode, scanNetwork, robinMenu, robinTransferDir
  }), [durationMode, scanNetwork, robinMenu, robinTransferDir]);

  const setStates = useMemo(() => ({
    durationMode: setDurationMode,
    scanNetwork: setScanNetwork,
    robinMenu: setRobinMenu,
    robinTransferDir: setRobinTransferDir
  }), []);

  useFormCache('scan_alamat_mode', '', states, setStates);

  useEffect(() => {
    if (scanNetwork === 'ROBINHOOD') {
      if (!['rec_1000', 'rec_5000', 'rec_10000'].includes(durationMode)) {
        setDurationMode('rec_10000');
      }
    } else {
      if (!['5', '6', '7'].includes(durationMode)) {
        setDurationMode('5');
      }
    }
  }, [scanNetwork, durationMode]);

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

      const applyCachedCaData = (cached) => {
        if (!cached || typeof cached !== 'object') return;
        if (Array.isArray(cached.baseTxCaList)) setBaseTxCaList(cached.baseTxCaList);
        else if (Array.isArray(cached.baseCaList)) setBaseTxCaList(cached.baseCaList);
        if (Array.isArray(cached.baseTokenFromCaList)) setBaseTokenFromCaList(cached.baseTokenFromCaList);
        if (Array.isArray(cached.baseTokenToCaList)) setBaseTokenToCaList(cached.baseTokenToCaList);
        if (Array.isArray(cached.robinTxCaList)) setRobinTxCaList(cached.robinTxCaList);
        if (Array.isArray(cached.robinTokenFromCaList)) setRobinTokenFromCaList(cached.robinTokenFromCaList);
        if (Array.isArray(cached.robinTokenToCaList)) setRobinTokenToCaList(cached.robinTokenToCaList);
      };

      let foundBrowserCache = false;
      const savedV3 = localStorage.getItem('websell_scan_ca_cache_v3');
      if (savedV3) {
        try {
          const parsed = JSON.parse(savedV3);
          applyCachedCaData(parsed);
          foundBrowserCache = true;
        } catch (e) {}
      }

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

      // Sinkronisasi dari Cache PC Lokal (untuk build EXE / PC Lokal)
      fetch('/api/scan-robin')
        .then(res => res.json())
        .then(res => {
          if (res && res.exists && res.data) {
            if (!foundBrowserCache) {
              applyCachedCaData(res.data);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsLoaded(true);
        });

      return () => window.removeEventListener('profileUpdated', handleProfileUpdated);
    }
  }, []);

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
    if (!isLoaded) return;
    const payload = {
      baseTxCaList,
      baseTokenFromCaList,
      baseTokenToCaList,
      robinTxCaList,
      robinTokenFromCaList,
      robinTokenToCaList
    };
    try {
      localStorage.setItem('websell_scan_ca_cache_v3', JSON.stringify(payload));
    } catch (e) {}
    fetch('/api/scan-robin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }, [baseTxCaList, baseTokenFromCaList, baseTokenToCaList, robinTxCaList, robinTokenFromCaList, robinTokenToCaList, isLoaded]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', scanNetwork);
    }
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

  // =========================================================================
  // 🟢 ROBINHOOD SCANNER: Sesuai D:\SEMUABOT\NEWBOT\deploy\robin\scanner.py
  // Menu [1]: Transaction (Fungsi Standar - /txs?a=...) -> Ambil Wallet 'From'
  // Menu [2]: Token Transfer (ERC-20 - /tokentxns?a=...) -> [1] From / [2] To
  // 100% di memori Web (Tidak pernah menyimpan ke file target.txt)
  // =========================================================================
  const handleScanRobinhood = async (activeCAs, signal) => {
    const startTime = Date.now();
    const { maxRecords, maxAgeSeconds, label: limitLabel } = getRobinLimitConfig(durationMode);
    const PAGE_SIZE = 50;
    const targetPages = maxRecords > 0 ? Math.ceil(maxRecords / PAGE_SIZE) : 200;
    const BATCH_SIZE = 10;

    const modeTitles = {
      transaction: "Transaction (Normal)",
      token_transfer_from: "Token Transfer (From)",
      token_transfer_to: "Token Transfer (To)"
    };
    const modeEndpoints = {
      transaction: "txs",
      token_transfer_from: "tokentxns",
      token_transfer_to: "tokentxns"
    };

    const modeLabel = modeTitles[effectiveRobinMode] || effectiveRobinMode;
    const endpoint = modeEndpoints[effectiveRobinMode] || "txs";
    const colLabel = effectiveRobinMode === "token_transfer_to" ? "To Baru" : "From Baru";
    const colSummary = effectiveRobinMode === "token_transfer_to" ? "To Baru Ditambahkan" : "From Baru Ditambahkan";

    const banner = [
      "=============================================================================",
      "         ROBINHOOD CHAIN (RobinScan) MULTI-MODE SCANNER v2.2 (TURBO)",
      "=============================================================================",
      " • Network        : Robinhood Chain (EVM Chain ID: 4663)",
      ` • Explorer       : https://robin.etherscan.io/${endpoint}?a=...`,
      ` • Mode Scanner   : ${modeLabel}`,
      ` • Batas Dipilih  : ${limitLabel} (Maks. ${targetPages} Halaman)`,
      " • Penyimpanan    : Langsung di Web (Memory Web - Tanpa File target.txt)",
      "============================================================================="
    ].join("\n");

    setTerminalLog(banner + "\n");
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('websell_terminalLog', banner + "\n");

    const existingTargets = new Set();
    let grandRecordsScanned = 0;
    let grandNewAdded = 0;

    for (let i = 0; i < activeCAs.length; i++) {
      if (checkAborted(signal)) break;
      const caRaw = activeCAs[i].address.trim();
      const caLabel = activeCAs[i].label ? ` (${activeCAs[i].label})` : '';
      let ca;
      try {
        ca = ethers.getAddress(caRaw).toLowerCase();
      } catch (e) {
        addLog(`❌ Address '${caRaw}' tidak valid! Format harus 0x + 40 digit hex.`);
        continue;
      }

      addLog(`\n[${i + 1}/${activeCAs.length}] Memindai Target: ${ca}${caLabel} (${modeLabel})`);
      addLog(`    [*] Explorer: https://robin.etherscan.io/${endpoint}?a=${ca}`);
      addLog(`    [*] Target Filter: ${limitLabel} (Maks. ${targetPages} Halaman)`);

      let totalRecordsScanned = 0;
      let newAddressCount = 0;
      let pagesProcessed = 0;
      let progressLineAdded = false;

      for (let startP = 1; startP <= targetPages; startP += BATCH_SIZE) {
        if (checkAborted(signal)) break;
        const endP = Math.min(startP + BATCH_SIZE, targetPages + 1);
        const pagesToFetch = [];
        for (let p = startP; p < endP; p++) pagesToFetch.push(p);

        const res = await fetch('/api/scan-robin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetAddress: ca,
            pages: pagesToFetch,
            mode: effectiveRobinMode,
            maxAgeSeconds
          }),
          signal
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const pageResults = data.results || [];

        let stopScanning = false;

        for (const pRes of pageResults) {
          if (checkAborted(signal)) {
            stopScanning = true;
            break;
          }

          const addrs = pRes.addresses || [];
          const rowCount = pRes.rowCount || 0;
          const isLast = pRes.isLastPage;
          const reachedTime = pRes.reachedTimeLimit;

          totalRecordsScanned += rowCount;
          pagesProcessed += 1;

          for (const addr of addrs) {
            const lower = addr.toLowerCase();
            if (!existingTargets.has(lower)) {
              existingTargets.add(lower);
              newAddressCount += 1;
            }
          }

          const msg = `    🚀 Halaman ${String(pagesProcessed).padStart(3, ' ')}/${targetPages} | Record: ${totalRecordsScanned.toLocaleString()} | ${colLabel}: +${newAddressCount.toLocaleString()} | Total Unik di Web: ${existingTargets.size.toLocaleString()}`;
          if (!progressLineAdded) {
            addLog(msg);
            progressLineAdded = true;
          } else {
            addLogReplaceLast(msg);
          }

          if (reachedTime) {
            stopScanning = true;
            addLog(`    [i] Batas waktu (${limitLabel}) tercapai pada halaman ${pagesProcessed}. Selesai memindai target ini.`);
            break;
          }

          if (isLast || (rowCount === 0 && pRes.isLastPage)) {
            stopScanning = true;
            break;
          }
        }

        const currentArr = Array.from(existingTargets);
        setUniqueAddresses(currentArr);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('websell_uniqueAddresses', JSON.stringify(currentArr));
        }

        if (stopScanning) break;
      }

      grandRecordsScanned += totalRecordsScanned;
      grandNewAdded += newAddressCount;
      addLog(`    ✓ Selesai Target ${ca.slice(0, 10)}...${ca.slice(-6)}: ${totalRecordsScanned.toLocaleString()} record discan | +${newAddressCount.toLocaleString()} address unik didapat.`);
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    if (checkAborted(signal)) {
      addLog(`\n🛑 [!] Pemindaian dihentikan oleh pengguna.`);
    } else {
      addLog([
        "",
        "=============================================================================",
        "                        RINGKASAN HASIL PEMINDAIAN",
        "=============================================================================",
        ` • Total Target Discan   : ${activeCAs.length}`,
        ` • Total Record Diperiksa: ${grandRecordsScanned.toLocaleString()}`,
        ` • ${colSummary.padEnd(22, ' ')}: +${grandNewAdded.toLocaleString()} Address`,
        ` • Total Unik di Web     : ${existingTargets.size.toLocaleString()} Address`,
        ` • Waktu Eksekusi        : ${durationSec} detik`,
        "============================================================================="
      ].join("\n"));
    }
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
    setUniqueAddresses([]);
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      if (scanNetwork === 'ROBINHOOD') {
        await handleScanRobinhood(activeCAs, signal);
        return;
      }

      const startMsg = "==========================================\n🤖 BOT SCANNER INTERAKSI CONTRACT (CA)\n==========================================\n";
      setTerminalLog(startMsg);
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('websell_terminalLog', startMsg);

      const baseModeLabel = robinMenu === '2'
        ? `Token Transfer (/tokentxns - ${robinTransferDir.toUpperCase()})`
        : `Transaction (/txs?a=CA)`;
      addLog(`\n📄 Ditemukan ${activeCAs.length} Contract Address yang aktif (${baseModeLabel}).`);
      addLog("🔍 Mengecek blok terbaru di jaringan BASE...");
      
      const latestBlockHex = await rpcRequest("eth_blockNumber", []);
      const latestBlock = parseInt(latestBlockHex, 16);
      
      const blocksPerHour = 1800; // Base ~2s/block
      let blocksBack = blocksPerHour * 24;
      if (durationMode === '5') blocksBack = blocksPerHour * 24;
      else if (durationMode === '6') blocksBack = blocksPerHour * 72;
      else if (durationMode === '7') blocksBack = blocksPerHour * 168;
      else if (durationMode === 'rec_1000') blocksBack = blocksPerHour * 24;
      else if (durationMode === 'rec_5000') blocksBack = blocksPerHour * 24;
      else if (durationMode === 'rec_10000') blocksBack = blocksPerHour * 72;

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

        addLog(`\n[${i+1}/${activeCAs.length}] Memindai CA: ${ca}${caLabel} [${baseModeLabel}]`);
        
        // --- TAHAP 1 ---
        addLog(`\n🚀 [Tahap 1] Mengumpulkan rekam jejak interaksi...`);
        const batchSize = 2000;
        const chunks = [];
        for (let b = startBlock; b <= latestBlock; b += batchSize) {
          chunks.push({ start: b, end: Math.min(b + batchSize - 1, latestBlock) });
        }
        
        const txHashes = new Set();
        const directTokenTransferAddrs = new Set();
        let logsDone = 0;
        let logsLineAdded = false;

        const runStage1 = async (chunkList) => {
          const limit = 10;
          let index = 0;
          const execute = async () => {
            while (index < chunkList.length && !checkAborted(signal)) {
              const current = index++;
              const chunk = chunkList[current];
              try {
                const logs = await rpcRequest("eth_getLogs", [{
                  fromBlock: "0x" + chunk.start.toString(16),
                  toBlock: "0x" + chunk.end.toString(16),
                  address: ca,
                  topics: robinMenu === '2' ? [SIG_TRANSFER] : []
                }]);
                
                for (const log of logs) {
                  if (robinMenu === '2' && Array.isArray(log.topics) && log.topics.length >= 3) {
                    const rawTopic = robinTransferDir === 'to' ? log.topics[2] : log.topics[1];
                    if (rawTopic && rawTopic.length >= 66) {
                      try {
                        const parsedAddr = ethers.getAddress('0x' + rawTopic.slice(26));
                        if (parsedAddr.toLowerCase() !== BURN_ADDRESS && parsedAddr.toLowerCase() !== ca.toLowerCase()) {
                          directTokenTransferAddrs.add(parsedAddr);
                        }
                      } catch (e) {}
                    }
                  }
                  if (log.transactionHash) txHashes.add(log.transactionHash);
                }
              } catch(e) {
              }
              logsDone++;
              const pct = ((logsDone / chunkList.length) * 100).toFixed(1);
              const msg = robinMenu === '2'
                ? `🚀 Progress Tahap 1: ${pct}% | Selesai: ${logsDone}/${chunkList.length} batch | Transfer: ${txHashes.size} | Dompet (${robinTransferDir.toUpperCase()}): ${directTokenTransferAddrs.size}`
                : `🚀 Progress Tahap 1: ${pct}% | Selesai: ${logsDone}/${chunkList.length} batch | Tx Ditemukan: ${txHashes.size}`;
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

        if (robinMenu === '2' && directTokenTransferAddrs.size > 0) {
          addLog(`\n✅ Selesai Ekstrak Token Transfer [Kolom ${robinTransferDir.toUpperCase()}]: +${directTokenTransferAddrs.size} dompet unik.`);
          for (const a of directTokenTransferAddrs) allFoundAddresses.add(a);
          const curArr = Array.from(allFoundAddresses);
          setUniqueAddresses(curArr);
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('websell_uniqueAddresses', JSON.stringify(curArr));
          continue;
        }

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
        
        if (robinMenu === '2') {
          if (robinTransferDir === 'to') {
            addLog(`\n✅ Memilih Kolom [To]: +${uniqueToAddrs.size} dompet unik.`);
            for (const a of uniqueToAddrs) allFoundAddresses.add(a);
          } else {
            addLog(`\n✅ Memilih Kolom [From]: +${uniqueFromAddrs.size} dompet unik.`);
            for (const a of uniqueFromAddrs) allFoundAddresses.add(a);
          }
        } else if (uniqueFromAddrs.size >= uniqueToAddrs.size) {
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
      a.download = `Scanner_Hasil_${scanNetwork}_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const renderInlineTokens = (str, baseColor = '#e2e8f0') => {
    const tokenRegex = /(https?:\/\/[^\s]+|0x[a-fA-F0-9]{4,40}(?:\.\.\.[a-fA-F0-9]{4,10})?|\+\d[\d,.]*|(?:#)?\b\d[\d,.]*(?:%)?(?:\/\d[\d,.]*)?\b)/g;
    const parts = String(str).split(tokenRegex);
    return parts.map((part, i) => {
      if (!part) return null;
      if (/^https?:\/\//.test(part)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
            {part}
          </a>
        );
      }
      if (/^0x[a-fA-F0-9]/i.test(part)) {
        return <span key={i} style={{ color: '#facc15', fontWeight: 700 }}>{part}</span>;
      }
      if (/^\+\d/.test(part)) {
        return <span key={i} style={{ color: '#ff3b5c', fontWeight: 800, textShadow: '0 0 8px rgba(255, 59, 92, 0.35)' }}>{part}</span>;
      }
      if (/^#\d/.test(part)) {
        return <span key={i} style={{ color: '#c084fc', fontWeight: 700 }}>{part}</span>;
      }
      if (/^\d/.test(part)) {
        return <span key={i} style={{ color: '#ff4d6d', fontWeight: 800 }}>{part}</span>;
      }
      return <span key={i} style={{ color: baseColor }}>{part}</span>;
    });
  };

  const renderColoredTerminal = (text) => {
    if (!text) return <span style={{ color: '#64748b' }}>&gt;_ Menunggu perintah scan...</span>;
    const lines = String(text).split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      let lineColor = '#e2e8f0';

      if (trimmed.startsWith('===')) {
        return (
          <div key={idx} style={{ color: '#00f2fe', fontWeight: 700 }}>
            {line}
          </div>
        );
      }
      if (
        trimmed.includes('MULTI-MODE SCANNER') ||
        trimmed.includes('RINGKASAN HASIL PEMINDAIAN') ||
        trimmed.includes('BOT SCANNER INTERAKSI')
      ) {
        return (
          <div key={idx} style={{ color: '#facc15', fontWeight: 800, letterSpacing: '0.4px' }}>
            {line}
          </div>
        );
      }

      if (/^\[\d+\/\d+\]\s+Memindai/i.test(trimmed)) {
        lineColor = '#38bdf8';
      } else if (trimmed.startsWith('✓') || trimmed.startsWith('✅')) {
        lineColor = '#4ade80';
      } else if (trimmed.startsWith('🚀')) {
        lineColor = '#a7f3d0';
      } else if (trimmed.startsWith('🔎') || trimmed.startsWith('🔍')) {
        lineColor = '#fde047';
      } else if (trimmed.startsWith('[*]') || trimmed.startsWith('•')) {
        lineColor = '#cbd5e1';
      } else if (trimmed.startsWith('❌') || trimmed.startsWith('🛑') || trimmed.startsWith('⚠️')) {
        lineColor = '#f87171';
      }

      return (
        <div key={idx} style={{ minHeight: '1.15em' }}>
          {renderInlineTokens(line, lineColor)}
        </div>
      );
    });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 2rem', width: '100%', maxWidth: '1200px', margin: '0 auto', height: 'calc(100vh - 90px - 1.5rem)', maxHeight: 'calc(100vh - 90px - 1.5rem)', minHeight: 0, minWidth: 0 }}>
      <div className="mev-panel" style={{ background: 'linear-gradient(135deg, rgba(13, 20, 36, 0.92) 0%, rgba(9, 14, 26, 0.85) 100%)', borderRadius: '12px', border: '1px solid rgba(0, 82, 255, 0.28)', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.55)', padding: '1.5rem 2.5rem', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        
        {(userRole !== 'Premium' && userRole !== 'Developer') && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 8, 17, 0.85)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
            <h3 style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>Fitur Premium</h3>
            <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '300px', fontSize: '0.85rem' }}>Fitur ini khusus untuk Member Premium. Masukkan kode premium di menu Profil untuk membuka kunci.</p>
          </div>
        )}

        <div style={{ paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.2rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', fontWeight: 800, margin: 0, color: '#f8fafc', textAlign: 'center' }}>
            🔍 Scan Alamat — {scanNetwork === 'ROBINHOOD' ? 'RobinScan' : 'BaseScan'} {robinMenu === '1' ? '(/txs?a=CA)' : '(/tokentxns?a=CA)'}
          </h2>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '1.25rem', minHeight: 0, minWidth: 0 }}>
          
          <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0, minWidth: 0 }}>
            {/* Input Kiri */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem', minHeight: 0, minWidth: 0 }}>

              {/* PILIH MENU SCANNER (BASE & ROBINHOOD) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', background: 'rgba(6, 10, 20, 0.75)', border: '1px solid rgba(0, 200, 5, 0.22)', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#facc15', fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
                  PILIH MENU SCANNER:
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setRobinMenu('1')}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.65rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      transition: 'all 0.2s',
                      background: robinMenu === '1' ? 'rgba(0, 200, 5, 0.18)' : 'rgba(13, 22, 40, 0.65)',
                      border: robinMenu === '1' ? '1px solid #00c805' : '1px solid rgba(255,255,255,0.08)',
                      color: robinMenu === '1' ? '#4ade80' : '#94a3b8'
                    }}
                  >
                    [1] Transaction (/txs?a=...)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRobinMenu('2')}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.65rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      transition: 'all 0.2s',
                      background: robinMenu === '2' ? 'rgba(0, 200, 5, 0.18)' : 'rgba(13, 22, 40, 0.65)',
                      border: robinMenu === '2' ? '1px solid #00c805' : '1px solid rgba(255,255,255,0.08)',
                      color: robinMenu === '2' ? '#4ade80' : '#94a3b8'
                    }}
                  >
                    [2] Token Transfer (/tokentxns?a=...)
                  </button>
                </div>

                {/* SUB-PILIHAN TIPE TOKEN TRANSFER (ERC-20) */}
                {robinMenu === '2' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem', paddingTop: '0.45rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '0.7rem', color: '#facc15', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                      --- PILIH TIPE TOKEN TRANSFER (ERC-20) ---
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setRobinTransferDir('from')}
                        style={{
                          flex: 1,
                          padding: '0.42rem 0.6rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.71rem',
                          fontWeight: 700,
                          transition: 'all 0.2s',
                          background: robinTransferDir === 'from' ? 'rgba(0, 242, 254, 0.16)' : 'rgba(13, 22, 40, 0.65)',
                          border: robinTransferDir === 'from' ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.08)',
                          color: robinTransferDir === 'from' ? '#00f2fe' : '#94a3b8'
                        }}
                      >
                        [1] From (Ambil Kolom &apos;From&apos;)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRobinTransferDir('to')}
                        style={{
                          flex: 1,
                          padding: '0.42rem 0.6rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.71rem',
                          fontWeight: 700,
                          transition: 'all 0.2s',
                          background: robinTransferDir === 'to' ? 'rgba(0, 242, 254, 0.16)' : 'rgba(13, 22, 40, 0.65)',
                          border: robinTransferDir === 'to' ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.08)',
                          color: robinTransferDir === 'to' ? '#00f2fe' : '#94a3b8'
                        }}
                      >
                        [2] To (Ambil Kolom &apos;To&apos;)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                    {robinMenu === '1'
                      ? `Alamat Router / Contract ${scanNetwork} (/txs?a=CA)`
                      : `Alamat Token / Contract ${scanNetwork} (/tokentxns?a=CA)`}
                  </label>
                  <button 
                    onClick={() => { setTempCaList([...caList]); setNewCaInput(''); setShowCaModal(true); }}
                    style={{ background: 'rgba(13, 22, 40, 0.75)', border: '1px solid rgba(0, 242, 254, 0.25)', cursor: 'pointer', padding: '0.25rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', borderRadius: '6px', color: '#00f2fe', fontFamily: 'var(--font-display)', fontSize: '0.75rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                    title="Setting CA"
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(0, 82, 255, 0.25)'; e.currentTarget.style.color = 'white'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(13, 22, 40, 0.75)'; e.currentTarget.style.color = '#00f2fe'; }}
                  >
                    <span>⚙️ SETUP</span>
                  </button>
                </div>
                <div style={{ width: '100%', flex: 1, background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', minHeight: 0 }}>
                  {caList.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.82rem', padding: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                      Klik tombol SETUP untuk mengisi CA...
                    </div>
                  ) : (
                    caList.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.45rem 0.65rem', background: 'rgba(13, 22, 40, 0.55)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px' }}>
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
                              background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: item.label ? '#00f2fe' : '#94a3b8', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 'bold', minWidth: '80px', width: '100px', maxWidth: '120px', textAlign: 'center', flexShrink: 0, outline: 'none', transition: 'all 0.2s'
                            }}
                            onFocus={(e) => { e.currentTarget.style.background = 'rgba(13, 22, 40, 0.9)'; e.currentTarget.style.border = '1px solid #00f2fe'; }}
                            onBlur={(e) => { e.currentTarget.style.background = 'rgba(6, 10, 20, 0.85)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; }}
                            title="Ketik untuk memberi nama label"
                          />
                          <span style={{ color: item.checked ? '#f8fafc' : '#94a3b8', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', opacity: item.checked ? 1 : 0.5, wordBreak: 'break-all' }}>
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
              
              <div className="scan-limit-network-row" style={{ display: 'flex', gap: '1rem', minWidth: 0 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {scanNetwork === 'ROBINHOOD' ? 'Batas Pemindaian (Jumlah Record)' : 'Durasi (Ke belakang)'}
                  </label>
                  <select 
                    value={durationMode} 
                    onChange={(e) => setDurationMode(e.target.value)}
                    className="mev-input"
                    style={{ width: '100%', minWidth: 0, padding: '0.75rem', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontFamily: 'var(--font-mono)', outline: 'none' }}
                  >
                    {scanNetwork === 'ROBINHOOD' ? (
                      <optgroup label="Berdasarkan Jumlah Record (RobinScan)">
                        <option value="rec_1000">1,000 Record Terakhir (20 Halaman)</option>
                        <option value="rec_5000">5,000 Record Terakhir (100 Halaman)</option>
                        <option value="rec_10000">10,000 Record Terakhir (200 Halaman) [Default]</option>
                      </optgroup>
                    ) : (
                      <optgroup label="Berdasarkan Rentang Waktu">
                        <option value="5">1 Hari Terakhir (&lt;= 24 Jam Lalu)</option>
                        <option value="6">3 Hari Terakhir (&lt;= 72 Jam Lalu)</option>
                        <option value="7">1 Minggu Terakhir (168 Jam)</option>
                      </optgroup>
                    )}
                  </select>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Network</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    <button
                      onClick={() => setScanNetwork('BASE')}
                      style={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', background: scanNetwork === 'BASE' ? 'rgba(0, 82, 255, 0.18)' : 'rgba(6, 10, 20, 0.85)', border: scanNetwork === 'BASE' ? '1px solid #0052ff' : '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: scanNetwork === 'BASE' ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.3s' }}>
                      <span style={{ width: '8px', height: '8px', background: scanNetwork === 'BASE' ? '#0052ff' : 'transparent', border: scanNetwork === 'BASE' ? 'none' : '2px solid rgba(255,255,255,0.2)', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}></span> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>BASE</span>
                    </button>
                    <button
                      onClick={() => setScanNetwork('ROBINHOOD')}
                      style={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', background: scanNetwork === 'ROBINHOOD' ? 'rgba(0, 200, 5, 0.16)' : 'rgba(6, 10, 20, 0.85)', border: scanNetwork === 'ROBINHOOD' ? '1px solid #00c805' : '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: scanNetwork === 'ROBINHOOD' ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.3s' }}>
                      <span style={{ width: '8px', height: '8px', background: scanNetwork === 'ROBINHOOD' ? '#00c805' : 'transparent', border: scanNetwork === 'ROBINHOOD' ? 'none' : '2px solid rgba(255,255,255,0.2)', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}></span> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>ROBINHOOD</span>
                    </button>
                  </div>
                </div>
              </div>

              {isScanning ? (
                 <button onClick={handleStop} style={{ width: '100%', padding: '0.95rem', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: 'white', border: 'none', borderRadius: '8px', fontFamily: 'var(--font-display)', fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s' }}>
                  🛑 Hentikan Scan
                 </button>
              ) : (
                <button onClick={handleScan} style={{ width: '100%', padding: '0.95rem', background: 'linear-gradient(135deg, rgba(0, 82, 255, 0.35) 0%, rgba(0, 242, 254, 0.2) 100%)', color: 'white', border: '1px solid rgba(0, 242, 254, 0.45)', boxShadow: '0 4px 18px rgba(0, 82, 255, 0.25)', borderRadius: '8px', fontFamily: 'var(--font-display)', fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s' }}>
                  🚀 Mulai Scan {robinMenu === '1' ? '(/txs?a=CA)' : `(/tokentxns - ${robinTransferDir.toUpperCase()})`}
                </button>
              )}
            </div>

            {/* Pembatas Tengah */}
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', marginTop: '-1.5rem', marginBottom: '-1.5rem' }}></div>

            {/* Terminal Kanan */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'var(--font-display)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  Terminal Output (<span style={{ color: '#ff3b5c', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{uniqueAddresses.length.toLocaleString()}</span> Wallet Unik):
                </span>
                {uniqueAddresses.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleCopy} style={{ background: 'rgba(13, 22, 40, 0.75)', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.25)', borderRadius: '4px', padding: '0.2rem 0.6rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer' }}>📋 Copy</button>
                    <button onClick={handleDownload} style={{ background: 'rgba(13, 22, 40, 0.75)', color: '#00c805', border: '1px solid rgba(0, 200, 5, 0.25)', borderRadius: '4px', padding: '0.2rem 0.6rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer' }}>💾 Download</button>
                  </div>
                )}
              </div>
              <pre ref={terminalRef} className="mev-terminal" style={{ flex: 1, minWidth: 0, background: 'radial-gradient(circle at top right, rgba(0, 242, 254, 0.04), transparent 70%), #02040a', border: '1px solid rgba(0, 242, 254, 0.22)', boxShadow: 'inset 0 1px 18px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 242, 254, 0.04)', borderRadius: '8px', padding: '1rem', overflowY: 'auto', overflowX: 'hidden', color: '#e2e8f0', fontSize: '0.78rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', margin: 0 }}>
                {renderColoredTerminal(terminalLog)}
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
            style={{ background: '#0d0d12', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '620px', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ color: 'white', fontSize: '1.2rem', margin: 0, fontWeight: 'bold' }}>
                {`Setup Target CA ${scanNetwork} (${robinMenu === '1' ? 'Transaction /txs' : `Token Transfer /tokentxns - ${robinTransferDir.toUpperCase()}`})`}
              </h3>
              <button onClick={() => setShowCaModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <textarea
                  value={newCaInput}
                  onChange={(e) => setNewCaInput(e.target.value)}
                  placeholder="Paste alamat Router / CA baru di sini (bisa banyak)...&#10;0x..."
                  style={{ flex: 1, height: '60px', padding: '0.8rem 1rem', background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', outline: 'none', resize: 'none', fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                <button
                  onClick={() => {
                    const lines = newCaInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                    if (lines.length > 0) {
                      const added = lines.map(addr => {
                        const existing = caList.find(item => item.address.toLowerCase() === addr.toLowerCase());
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

              <div style={{ height: '190px', overflowY: 'auto', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
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
