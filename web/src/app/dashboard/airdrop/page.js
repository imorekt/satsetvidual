"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ethers } from 'ethers';
import { useFormCache } from '@/lib/useFormCache';

// RPC Setup
const getRpcUrl = (network) => {
  if (network === 'BASE') return "https://mainnet.base.org";
  if (network === 'RBNHD') return "https://rpc.robinhood.com"; // Ganti dengan RPC Robinhood yang valid
  return "https://mainnet.base.org";
};

const PRIMARY_RPC = "https://base-mainnet.core.chainstack.com/777f7306a808d70ba68c63ff713a2f2b";
const createFallbackProvider = (networkUrl) => {
  if (networkUrl.includes("base.org") || networkUrl.includes("base") || networkUrl.includes("chainstack")) {
    const primary = new ethers.JsonRpcProvider(PRIMARY_RPC);
    const secondary = new ethers.JsonRpcProvider(networkUrl);
    return new ethers.FallbackProvider([
      { provider: primary, priority: 1, stallTimeout: 2000 },
      { provider: secondary, priority: 2 }
    ]);
  }
  return new ethers.JsonRpcProvider(networkUrl);
};

// ABI Constants
const DISPERSE_ABI = [
  {
    "inputs": [
      {"name": "token", "type": "address"},
      {"name": "recipients", "type": "address[]"},
      {"name": "amountPerWallet", "type": "uint256[]"}
    ],
    "name": "disperseToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "recipients", "type": "address[]"},
      {"name": "amountPerWallet", "type": "uint256[]"}
    ],
    "name": "disperseEther",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

const BATCH_SIZE = 500;

let globalAirdropAbortController = null;
let globalAirdropSession = null;

export default function AirdropPage() {
  const [privateKey, setPrivateKey] = useState('');
  const [disperseContract, setDisperseContract] = useState('0xf4691C5Aa0d8470C832c1cBd05d6A77bd570ad65');
  const [skipHolderCA, setSkipHolderCA] = useState('');
  const [nominalAmount, setNominalAmount] = useState('1.0');
  const [walletList, setWalletList] = useState('');
  const [scanNetwork, setScanNetwork] = useState('BASE');

  const [isAirdropping, setIsAirdropping] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [userRole, setUserRole] = useState('Member');
  const [terminalLog, setTerminalLog] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [skipHolderSymbol, setSkipHolderSymbol] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);

  // Profile Popup
  const [deployedTokens, setDeployedTokens] = useState([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('manual');

  const terminalRef = useRef(null);

  const states = useMemo(() => ({
    disperseContract, skipHolderCA, nominalAmount, scanNetwork, selectedProfileId: 'manual'
  }), [disperseContract, skipHolderCA, nominalAmount, scanNetwork]);

  const setStates = useMemo(() => ({
    disperseContract: setDisperseContract,
    skipHolderCA: setSkipHolderCA,
    nominalAmount: setNominalAmount,
    scanNetwork: setScanNetwork
  }), []);

  useFormCache('airdrop', privateKey, states, setStates);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('userRole') || 'Member';
      setUserRole(role);
      
      const handleProfileUpdated = () => {
        setUserRole(localStorage.getItem('userRole') || 'Member');
      };
      window.addEventListener('profileUpdated', handleProfileUpdated);

      const savedLog = sessionStorage.getItem('websell_airdrop_terminalLog');
      if (savedLog) setTerminalLog(savedLog);
      
      const dropping = sessionStorage.getItem('websell_airdrop_isAirdropping');
      if (dropping === 'true') setIsAirdropping(true);

      const confirming = sessionStorage.getItem('websell_airdrop_isConfirming');
      if (confirming === 'true') setIsConfirming(true);
      
      const savedDc = localStorage.getItem('websell_airdrop_disperseContract');
      if (savedDc) setDisperseContract(savedDc);

      const savedScan = sessionStorage.getItem('websell_uniqueAddresses');
      let loadedFromScan = false;
      if (savedScan) {
        try {
          const addrs = JSON.parse(savedScan);
          if (Array.isArray(addrs) && addrs.length > 0) {
            const formatted = addrs.join('\n');
            setWalletList(formatted);
            sessionStorage.removeItem('websell_uniqueAddresses');
            loadedFromScan = true;
          }
        } catch(e) {}
      }
      
      if (!loadedFromScan) {
        const sWall = sessionStorage.getItem('websell_airdrop_walletList');
        if (sWall) setWalletList(sWall);
      }

      const sPk = sessionStorage.getItem('websell_airdrop_privateKey');
      if (sPk) setPrivateKey(sPk);
      
      const sNom = sessionStorage.getItem('websell_airdrop_nominalAmount');
      if (sNom) setNominalAmount(sNom);
      
      const scanNet = localStorage.getItem('websell_airdrop_scanNetwork') || 'BASE';
      setScanNetwork(scanNet);
      
      const sSkipCA = sessionStorage.getItem('websell_airdrop_skipHolderCA');
      if (sSkipCA) setSkipHolderCA(sSkipCA);
      const sSkipSym = sessionStorage.getItem('websell_airdrop_skipHolderSymbol');
      if (sSkipSym) setSkipHolderSymbol(sSkipSym);
      
      const savedTokens = JSON.parse(localStorage.getItem('deployed_tokens') || '[]');
      setDeployedTokens(savedTokens);
      
      setIsLoaded(true);
      return () => window.removeEventListener('profileUpdated', handleProfileUpdated);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && typeof localStorage !== 'undefined') {
      localStorage.setItem('websell_airdrop_disperseContract', disperseContract);
    }
  }, [disperseContract, isLoaded]);

  useEffect(() => {
    if (isLoaded && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('websell_airdrop_privateKey', privateKey);
      sessionStorage.setItem('websell_airdrop_nominalAmount', nominalAmount);
      sessionStorage.setItem('websell_airdrop_walletList', walletList);
      sessionStorage.setItem('websell_airdrop_scanNetwork', scanNetwork);
      sessionStorage.setItem('websell_airdrop_skipHolderCA', skipHolderCA);
      sessionStorage.setItem('websell_airdrop_skipHolderSymbol', skipHolderSymbol);
      if (typeof localStorage !== 'undefined') localStorage.setItem('websell_airdrop_scanNetwork', scanNetwork);
    }
  }, [privateKey, nominalAmount, walletList, scanNetwork, skipHolderCA, skipHolderSymbol, isLoaded]);

  const countAddresses = (text) => {
    if (!text) return 0;
    const matches = text.match(/(0x[a-fA-F0-9]{40})/gi);
    if (!matches) return 0;
    const unique = new Set(matches.map(a => a.toLowerCase()));
    return unique.size;
  };
  const addressCount = countAddresses(walletList);

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
  }, [terminalLog]);

  // Polling for background execution
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof sessionStorage !== 'undefined') {
        const dropping = sessionStorage.getItem('websell_airdrop_isAirdropping');
        if (dropping === 'true') {
          const savedLog = sessionStorage.getItem('websell_airdrop_terminalLog');
          if (savedLog && savedLog !== terminalLog) setTerminalLog(savedLog);
        }
        if (dropping === 'false' && isAirdropping) {
          setIsAirdropping(false);
          const savedLog = sessionStorage.getItem('websell_airdrop_terminalLog');
          if (savedLog) setTerminalLog(savedLog);
        }
        
        const confirming = sessionStorage.getItem('websell_airdrop_isConfirming');
        if (confirming === 'false' && isConfirming) setIsConfirming(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [terminalLog, isAirdropping]);

  const addLog = (msg) => {
    if (typeof sessionStorage !== 'undefined') {
      const prev = sessionStorage.getItem('websell_airdrop_terminalLog') || '';
      sessionStorage.setItem('websell_airdrop_terminalLog', prev + msg + '\n');
    }
    setTerminalLog(prev => prev + msg + '\n');
  };

  const checkAborted = (signal) => {
    if (signal.aborted) return true;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('websell_airdrop_abortScan') === 'true') {
      return true;
    }
    return false;
  };

  // Skip Holder Logic
  useEffect(() => {
    let active = true;
    const fetchSymbol = async () => {
      if (!skipHolderCA || !ethers.isAddress(skipHolderCA)) {
        if (active) setSkipHolderSymbol('');
        return;
      }
      try {
        const rpcUrl = getRpcUrl(scanNetwork);
        const provider = createFallbackProvider(rpcUrl);
        const contract = new ethers.Contract(skipHolderCA, ERC20_ABI, provider);
        const sym = await contract.symbol();
        
        let tName = sym;
        try { tName = await contract.name(); } catch(e) {}
        
        if (active) {
          setSkipHolderSymbol(sym);
          
          // Auto-save the CA profile so it appears in the Profil Token list automatically
          const pk = typeof privateKey !== 'undefined' ? privateKey.trim() : '';
          const currentTokens = JSON.parse(localStorage.getItem('deployed_tokens') || '[]');
          if (!currentTokens.find(t => t.ca.toLowerCase() === skipHolderCA.toLowerCase() && t.privateKey === pk && (!t.network || t.network === scanNetwork))) {
            const newToken = {
              name: tName,
              symbol: sym,
              ca: skipHolderCA,
              network: scanNetwork,
              privateKey: pk
            };
            currentTokens.push(newToken);
            localStorage.setItem('deployed_tokens', JSON.stringify(currentTokens));
            if (typeof setDeployedTokens === 'function') {
              setDeployedTokens(currentTokens);
            }
          }
        }
      } catch (err) {
        if (active) setSkipHolderSymbol('? (Gagal/Bukan Token)');
      }
    };
    fetchSymbol();
    return () => { active = false; };
  }, [skipHolderCA, scanNetwork, privateKey]);

  const handlePrivateKeyChange = (val) => {
    setPrivateKey(val);
    const pk = val.trim();
    const tokens = deployedTokens.filter(t => (!t.network || t.network === scanNetwork) && t.privateKey === pk);
    if (tokens.length > 0) {
      setSkipHolderCA(tokens[0].ca);
      setSkipHolderSymbol(tokens[0].symbol || '');
      setSelectedProfileId(tokens[0].ca);
    } else {
      setSkipHolderCA('');
      setSkipHolderSymbol('');
      setSelectedProfileId('manual');
    }
  };

  const handleFilterHolders = async () => {
    if (!walletList.trim()) return alert("Daftar Address kosong!");
    if (!skipHolderCA || !ethers.isAddress(skipHolderCA)) return alert("CA Skip Holder tidak valid!");
    
    setIsFiltering(true);
    addLog(`\n🔎 [FILTER] Memulai scan Holder untuk token ${skipHolderSymbol || skipHolderCA}`);
    
    try {
      const rpcUrl = getRpcUrl(scanNetwork);
      const provider = createFallbackProvider(rpcUrl);
      
      const rawLines = walletList.split('\n');
      const uniqueAddrs = [];
      const seen = new Set();
      
      for (const line of rawLines) {
        const match = line.match(/(0x[a-fA-F0-9]{40})/);
        if (!match) continue;
        const cleanLine = ethers.getAddress(match[1]);
        if (!seen.has(cleanLine) && cleanLine !== "0x0000000000000000000000000000000000000000") {
          seen.add(cleanLine);
          uniqueAddrs.push(cleanLine);
        }
      }
      
      if (uniqueAddrs.length === 0) {
        addLog(`❌ Tidak ada alamat valid untuk di-scan.`);
        setIsFiltering(false);
        return;
      }

      const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
      const multicallAbi = ["function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)"];
      const multicall = new ethers.Contract(MULTICALL3, multicallAbi, provider);
      
      const tokenIface = new ethers.Interface(ERC20_ABI);
      const BATCH_SIZE = 500;
      let nonHolders = [];
      let foundHoldersCount = 0;
      
      for (let i = 0; i < uniqueAddrs.length; i += BATCH_SIZE) {
        const batchAddrs = uniqueAddrs.slice(i, i + BATCH_SIZE);
        addLog(`[FILTER] Mengecek batch ${i+1} sampai ${i + batchAddrs.length}...`);
        
        const calls = batchAddrs.map(addr => {
          return {
            target: skipHolderCA,
            callData: tokenIface.encodeFunctionData("balanceOf", [addr])
          };
        });
        
        try {
          const result = await multicall.tryAggregate(false, calls);
          
          for (let j = 0; j < batchAddrs.length; j++) {
            const success = result[j][0];
            const returnData = result[j][1];
            
            if (success && returnData !== '0x') {
              try {
                const bal = tokenIface.decodeFunctionResult("balanceOf", returnData)[0];
                if (bal === 0n) {
                  nonHolders.push(batchAddrs[j]);
                } else {
                  foundHoldersCount++;
                }
              } catch(e) {
                // Decode fail
                nonHolders.push(batchAddrs[j]);
              }
            } else {
              nonHolders.push(batchAddrs[j]);
            }
          }
        } catch (e) {
          addLog(`❌ Gagal mengecek batch ini: ${e.shortMessage || e.message}`);
          nonHolders.push(...batchAddrs); // Asumsi aman
        }
        
        // Jeda 500ms agar tidak over-limit RPC
        if (i + BATCH_SIZE < uniqueAddrs.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      const formatted = nonHolders.join('\n');
      setWalletList(formatted);
      addLog(`✅ [FILTER SELESAI] Ditemukan dan dihapus: ${foundHoldersCount} alamat holder.`);
      addLog(`✅ Sisa alamat yang belum memiliki token: ${nonHolders.length}`);
      
    } catch (err) {
      addLog(`❌ ERROR FILTER: ${err.message}`);
    } finally {
      setIsFiltering(false);
    }
  };

  const handleStartAirdrop = async () => {
    if (!privateKey) return alert("Private Key harus diisi!");
    if (!disperseContract) return alert("Disperse Contract harus diisi!");
    if (!walletList.trim()) return alert("Daftar Address tidak boleh kosong!");
    if (!nominalAmount || isNaN(Number(nominalAmount)) || Number(nominalAmount) <= 0) return alert("Nominal per wallet tidak valid!");

    setIsAirdropping(true);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('websell_airdrop_isAirdropping', 'true');
      sessionStorage.setItem('websell_airdrop_abortScan', 'false');
    }
    
    const startMsg = "==========================================\n🚀 MEMULAI PROSES AIRDROP\n==========================================\n";
    setTerminalLog(startMsg);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('websell_airdrop_terminalLog', startMsg);
    
    globalAirdropAbortController = new AbortController();
    const signal = globalAirdropAbortController.signal;

    try {
      // 1. Setup Provider & Wallet
      const rpcUrl = getRpcUrl(scanNetwork);
      addLog(`[NET] Menghubungkan ke jaringan...`);
      const provider = createFallbackProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      
      const disperseAddress = ethers.getAddress(disperseContract);
      const disperse = new ethers.Contract(disperseAddress, DISPERSE_ABI, wallet);
      
      const mode = skipHolderCA.trim() === '' ? 'eth' : 'erc20';
      let tokenContract = null;
      let decimals = 18;
      let symbol = scanNetwork === 'BASE' ? 'ETH' : 'RBNHD'; // assuming native currency symbol
      
      if (mode === 'erc20') {
        const tAddr = ethers.getAddress(skipHolderCA);
        tokenContract = new ethers.Contract(tAddr, ERC20_ABI, wallet);
        addLog(`[TOKEN] Mengambil info token...`);
        symbol = await tokenContract.symbol();
        decimals = Number(await tokenContract.decimals());
        addLog(`[TOKEN] ✓ Ditemukan: ${symbol} (Decimals: ${decimals})`);
      }

      // 2. Parse Recipients
      addLog(`[DATA] Membaca daftar alamat...`);
      const rawLines = walletList.split('\n');
      const recipients = [];
      const seen = new Set();
      
      for (const line of rawLines) {
        const match = line.match(/(0x[a-fA-F0-9]{40})/);
        if (!match) continue;
        const cleanLine = match[1];
        
        try {
          if (ethers.isAddress(cleanLine)) {
            const addr = ethers.getAddress(cleanLine);
            if (!seen.has(addr) && addr !== "0x0000000000000000000000000000000000000000") {
              seen.add(addr);
              recipients.push(addr);
            }
          }
        } catch(e) {}
      }
      
      if (recipients.length === 0) {
        addLog(`❌ Tidak ada alamat valid yang ditemukan!`);
        throw new Error("No valid recipients");
      }
      
      addLog(`[DATA] ✓ ${recipients.length} alamat valid dimuat.`);
      
      const amountPerWalletHuman = Number(nominalAmount);
      const amountPerWalletWei = ethers.parseUnits(amountPerWalletHuman.toString(), decimals);
      const totalHuman = amountPerWalletHuman * recipients.length;
      const totalWei = amountPerWalletWei * BigInt(recipients.length);
      
      addLog(`[INFO] Total Airdrop: ${totalHuman} ${symbol}`);
      
      // 3. Cek Saldo
      addLog(`[GAS] Mengecek saldo...`);
      const ethBal = await provider.getBalance(wallet.address);
      if (mode === 'erc20') {
        const tokenBal = await tokenContract.balanceOf(wallet.address);
        if (tokenBal < totalWei) {
          addLog(`❌ Saldo Token tidak mencukupi. Butuh ${totalHuman} ${symbol}`);
          throw new Error("Insufficient Token Balance");
        }
        addLog(`[GAS] ✓ Saldo Token cukup.`);
      } else {
        if (ethBal < totalWei) {
          addLog(`❌ Saldo Native tidak mencukupi. Butuh ${totalHuman} ${symbol}`);
          throw new Error("Insufficient Native Balance");
        }
        addLog(`[GAS] ✓ Saldo Native cukup.`);
      }
      
      // GAS ESTIMATION ASCII BOX
      const BATCH_SIZE = 450;
      const n_batches = Math.ceil(recipients.length / BATCH_SIZE);
      let ethPriceUsd = 0;
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
        if (res.ok) {
          const data = await res.json();
          ethPriceUsd = Number(data.ethereum.usd);
        }
      } catch (e) {}

      const feeData = await provider.getFeeData();
      const baseFee = feeData.gasPrice || ethers.parseUnits('0.005', 'gwei'); // fallback
      const maxFee = feeData.maxFeePerGas || baseFee;
      const baseGwei = Number(ethers.formatUnits(baseFee, 'gwei'));
      const maxGwei = Number(ethers.formatUnits(maxFee, 'gwei'));

      let avg_gas_per_batch = 0;
      let gas_approve = 0;
      if (mode === 'erc20') {
        gas_approve = 60000;
        const batchSample = Math.min(recipients.length, BATCH_SIZE);
        avg_gas_per_batch = 35000 + batchSample * 25000;
      } else {
        const batchSample = Math.min(recipients.length, BATCH_SIZE);
        avg_gas_per_batch = 35000 + batchSample * 6800;
      }
      const gas_disperse_total = avg_gas_per_batch * n_batches;
      const gas_per_wallet = gas_approve + gas_disperse_total;
      
      const fee_avg = Number(ethers.formatEther(BigInt(Math.floor(avg_gas_per_batch)) * baseFee));
      const fee_per_wallet = Number(ethers.formatEther(BigInt(Math.floor(gas_per_wallet)) * baseFee));
      const fee_approve_eth = Number(ethers.formatEther(BigInt(gas_approve) * baseFee));
      const disp_total = Number(ethers.formatEther(BigInt(Math.floor(gas_disperse_total)) * baseFee));
      const fee_total_eth = fee_per_wallet;

      const toUsd = (eth) => ethPriceUsd ? `(≈ $${(eth * ethPriceUsd).toFixed(4)} USD)` : "";
      const padL = (str, len) => str.length >= len ? str : " ".repeat(len - str.length) + str;
      const padR = (str, len) => str.length >= len ? str : str + " ".repeat(len - str.length);

      let estLog = `\n*** ESTIMASI GAS FEE ***\n`;
      if (ethPriceUsd) {
        estLog += `Harga ETH: $${ethPriceUsd.toFixed(2)} USD (CoinGecko)\n`;
      }
      estLog += `\n[Estimasi cepat - sample 3 batch, sisanya rata-rata]\n`;
      estLog += `  Avg gas per batch   : ${padL(avg_gas_per_batch.toLocaleString("en-US"), 12)} gas\n`;
      estLog += `  Fee per batch       : ${padR(fee_avg.toFixed(8) + " ETH", 18)} ${toUsd(fee_avg)}\n`;
      estLog += `  Total batch         : ${n_batches}\n\n`;
      
      estLog += `[Network Info]\n`;
      estLog += `  Gas Price (base fee): ${baseGwei.toFixed(6)} gwei\n`;
      estLog += `  Gas Price (max fee) : ${maxGwei.toFixed(6)} gwei\n\n`;
      
      estLog += `[PER WALLET]\n`;
      if (mode === 'erc20') {
        estLog += `  Gas approve         : ${padL(gas_approve.toLocaleString("en-US"), 12)} gas\n`;
      }
      estLog += `  Gas disperse total  : ${padL(gas_disperse_total.toLocaleString("en-US"), 12)} gas (${n_batches} batch x avg)\n`;
      estLog += `  Gas total           : ${padL(gas_per_wallet.toLocaleString("en-US"), 12)} gas\n`;
      estLog += `  Fee ETH per wallet  : ${padR(fee_per_wallet.toFixed(8) + " ETH", 18)} ${toUsd(fee_per_wallet)}\n\n`;
      
      estLog += `[TOTAL SEMUA WALLET]\n`;
      estLog += `  Jumlah wallet       : 1\n`;
      if (mode === 'erc20') {
        estLog += `  Fee approve total   : ${padR(fee_approve_eth.toFixed(8) + " ETH", 18)} ${toUsd(fee_approve_eth)}\n`;
      }
      estLog += `  Fee disperse total  : ${padR(disp_total.toFixed(8) + " ETH", 18)} ${toUsd(disp_total)}\n\n`;
      
      estLog += `* TOTAL GAS FEE (estimasi): ${fee_total_eth.toFixed(8)} ETH  ${toUsd(fee_total_eth)}\n`;
      
      addLog(estLog);

      // Selesai estimasi
      addLog(`\n✅ ESTIMASI SELESAI. Silakan klik "Konfirmasi Airdrop" untuk melanjutkan transaksi.`);
      
      globalAirdropSession = {
        wallet, disperseAddress, disperse, mode, tokenContract, totalWei,
        amountPerWalletWei, recipients, skipHolderCA
      };
      
      setIsConfirming(true);
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('websell_airdrop_isConfirming', 'true');

    } catch (err) {
      if (err.message === "Dibatalkan User") {
        // Logged in handleStop
      } else {
        addLog(`\n❌ ERROR KRITIKAL: ${err.message}`);
      }
      setIsAirdropping(false);
      setIsConfirming(false);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('websell_airdrop_isAirdropping', 'false');
        sessionStorage.setItem('websell_airdrop_isConfirming', 'false');
      }
    }
  };

  const handleConfirmAirdrop = async () => {
    setIsConfirming(false);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('websell_airdrop_isConfirming', 'false');
    const session = globalAirdropSession;
    if (!session) return;
    const { wallet, disperseAddress, disperse, mode, tokenContract, totalWei, amountPerWalletWei, recipients, skipHolderCA } = session;
    const signal = globalAirdropAbortController ? globalAirdropAbortController.signal : new AbortController().signal;

    try {
      // 4. Approve (Jika ERC20)
      if (mode === 'erc20') {
        addLog(`[APPROVE] Mengecek allowance ke contract Disperse...`);
        const currentAllowance = await tokenContract.allowance(wallet.address, disperseAddress);
          if (currentAllowance < totalWei) {
            addLog(`[APPROVE] Meminta persetujuan (Approve) untuk MAX amount...`);
            const maxInt = ethers.MaxUint256;
            const nonce = await wallet.provider.getTransactionCount(wallet.address, 'pending');
            const approveTx = await tokenContract.approve(disperseAddress, maxInt, { nonce, gasLimit: 60000 });
            addLog(`[APPROVE] Tx: ${approveTx.hash}`);
          await approveTx.wait(1);
          addLog(`[APPROVE] ✓ Approve Sukses!`);
        } else {
          addLog(`[APPROVE] ✓ Allowance sudah mencukupi.`);
        }
      }

      if (checkAborted(signal)) throw new Error("Dibatalkan User");

      // 5. Chunking & Disperse
      const BATCH_SIZE = 450;
      const batches = [];
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        batches.push(recipients.slice(i, i + BATCH_SIZE));
      }
      
      addLog(`\n🚀 Mulai Disperse (${batches.length} Batch)...`);
      
      for (let i = 0; i < batches.length; i++) {
        if (checkAborted(signal)) throw new Error("Dibatalkan User");
        const batchAddrs = batches[i];
        const batchAmounts = Array(batchAddrs.length).fill(amountPerWalletWei);
        const batchTotalWei = amountPerWalletWei * BigInt(batchAddrs.length);
        
        addLog(`[BATCH ${i+1}/${batches.length}] Mengirim ke ${batchAddrs.length} alamat...`);
        
        try {
          let tx;
          const nonce = await wallet.provider.getTransactionCount(wallet.address, 'pending');
          const batchSample = batchAddrs.length;
          let gasLimitEstimated;
          
          if (mode === 'erc20') {
            try {
              gasLimitEstimated = await disperse.disperseToken.estimateGas(skipHolderCA, batchAddrs, batchAmounts, { nonce });
              gasLimitEstimated = (gasLimitEstimated * 115n) / 100n; // 15% buffer
            } catch (e) {
               addLog(`   ❌ Simulasi Error: Transaksi gagal (Saldo/Tax/Revert). Info: ${e.shortMessage || e.message}`);
               continue;
            }
            tx = await disperse.disperseToken(skipHolderCA, batchAddrs, batchAmounts, { nonce, gasLimit: gasLimitEstimated });
          } else {
            try {
              gasLimitEstimated = await disperse.disperseEther.estimateGas(batchAddrs, batchAmounts, { value: batchTotalWei, nonce });
              gasLimitEstimated = (gasLimitEstimated * 115n) / 100n; // 15% buffer
            } catch (e) {
               addLog(`   ❌ Simulasi Error: Transaksi gagal (Saldo/Revert). Info: ${e.shortMessage || e.message}`);
               continue;
            }
            tx = await disperse.disperseEther(batchAddrs, batchAmounts, { value: batchTotalWei, nonce, gasLimit: gasLimitEstimated });
          }
          
          addLog(`\n[DISPERSE] Batch ${i + 1}/${batches.length} Tx: ${tx.hash}\n   🔗 https://basescan.org/tx/${tx.hash}`);
          addLog(`   Menunggu konfirmasi blok...`);
          const receipt = await tx.wait(1);
          addLog(`   ✓ Selesai di blok #${receipt.blockNumber}`);
        } catch (e) {
          console.error("Disperse error:", e);
          let errMsg = e.shortMessage || e.message;
          if (e.info && e.info.error && e.info.error.message) {
            errMsg = e.info.error.message;
          } else if (e.error && e.error.message) {
            errMsg = e.error.message;
          }
          addLog(`   ❌ Gagal Batch ${i+1}: ${errMsg}`);
        }
      }
      
      if (!checkAborted(signal)) {
        addLog(`\n✅ PROSES AIRDROP SELESAI SELURUHNYA!`);
      }

    } catch (err) {
      if (err.message === "Dibatalkan User") {
        // Logged in handleStop
      } else {
        addLog(`\n❌ ERROR KRITIKAL: ${err.message}`);
      }
    } finally {
      setIsAirdropping(false);
      setIsConfirming(false);
      globalAirdropSession = null;
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('websell_airdrop_isAirdropping', 'false');
        sessionStorage.setItem('websell_airdrop_isConfirming', 'false');
      }
    }
  };

  const handleStop = () => {
    addLog(`\n🛑 PROSES DIBATALKAN OLEH USER.`);
    if (globalAirdropAbortController) globalAirdropAbortController.abort();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('websell_airdrop_abortScan', 'true');
      sessionStorage.setItem('websell_airdrop_isAirdropping', 'false');
      sessionStorage.setItem('websell_airdrop_isConfirming', 'false');
    }
    setIsConfirming(false);
    setIsAirdropping(false);
    globalAirdropSession = null;
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: 'white', textAlign: 'center' }}>🎁 Airdrop Token (Disperse)</h2>
        </div>

        <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0 }}>
          
          {/* Form Kiri */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: '400px', minHeight: 0 }}>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>Wallet Private Key</label>
                <input type="text" autoComplete="off" spellCheck="false" data-lpignore="true" data-1p-ignore="true" value={privateKey} onChange={(e) => handlePrivateKeyChange(e.target.value)} disabled={isAirdropping} style={{ width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 1rem', borderRadius: '8px', color: 'white', outline: 'none', WebkitTextSecurity: 'disc' }} placeholder="0x..." />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>Disperse Contract Address</label>
                <input type="password" value={disperseContract} onChange={(e) => setDisperseContract(e.target.value)} disabled={isAirdropping} style={{ width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 1rem', borderRadius: '8px', color: 'white', outline: 'none' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>Nominal (Per Address)</label>
                <input type="text" value={nominalAmount} onChange={(e) => setNominalAmount(e.target.value)} disabled={isAirdropping} style={{ width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 1rem', borderRadius: '8px', color: 'white', outline: 'none' }} placeholder="Contoh: 1.5" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>
                  Skip Holder (Input Token CA)
                  {skipHolderSymbol && <span style={{ color: skipHolderSymbol.includes('?') ? '#e11d48' : '#10b981', marginLeft: '0.5rem' }}>[{skipHolderSymbol}]</span>}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" value={skipHolderCA} onChange={(e) => setSkipHolderCA(e.target.value)} disabled={isAirdropping || isFiltering} style={{ flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 1rem', borderRadius: '8px', color: 'white', outline: 'none' }} placeholder="0x..." />
                  <button onClick={() => setShowProfileModal(true)} disabled={isAirdropping || isFiltering} style={{ padding: '0 1rem', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', cursor: (isAirdropping || isFiltering) ? 'not-allowed' : 'pointer', opacity: (isAirdropping || isFiltering) ? 0.5 : 1 }}>
                    🔍 Profil
                  </button>
                </div>
              </div>
              <button onClick={handleFilterHolders} disabled={isAirdropping || isFiltering || !skipHolderCA} style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: (isAirdropping || isFiltering || !skipHolderCA) ? 'not-allowed' : 'pointer', opacity: (isAirdropping || isFiltering || !skipHolderCA) ? 0.5 : 1, transition: 'all 0.2s', height: '46px' }}>
                {isFiltering ? 'Menyaring...' : '🗑️ Filter Holder'}
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>Daftar Address Penerima (Hasil Scan akan Otomatis Muncul di Sini)</label>
              
              <div style={{ display: 'flex', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', minHeight: 0, flex: 1, marginBottom: '0.5rem' }}>
                <div 
                  id="wallet-line-numbers"
                  style={{ width: '65px', minWidth: '65px', padding: '1rem 0.5rem', background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.1)', color: '#64748b', textAlign: 'right', fontFamily: 'monospace', userSelect: 'none', overflow: 'hidden', whiteSpace: 'pre', lineHeight: '1.5', fontSize: '14px' }}
                >
                  {walletList.split('\n').map((_, i) => (i + 1) + '.').join('\n')}
                </div>
                <textarea 
                  value={walletList}
                  onChange={(e) => setWalletList(e.target.value)}
                  onScroll={(e) => { const ln = document.getElementById('wallet-line-numbers'); if (ln) ln.scrollTop = e.target.scrollTop; }}
                  disabled={isAirdropping}
                  wrap="off"
                  style={{ width: '100%', flex: 1, background: 'transparent', border: 'none', padding: '1rem', color: 'white', outline: 'none', resize: 'none', fontFamily: 'monospace', whiteSpace: 'pre', lineHeight: '1.5', fontSize: '14px' }}
                  placeholder={`0x123...456\n0xabc...def`}
                />
              </div>
              
              <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 'bold' }}>
                Total Address Terdeteksi: {addressCount} address
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>Select Network</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {['BASE', 'RBNHD'].map((net) => (
                  <label key={net} style={{ flex: 1, background: scanNetwork === net ? 'rgba(255,255,255,0.05)' : 'transparent', border: `1px solid ${scanNetwork === net ? 'var(--accent-purple)' : 'rgba(255,255,255,0.1)'}`, padding: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: isAirdropping ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: isAirdropping ? 0.5 : 1 }}>
                    <input type="radio" name="network" value={net} checked={scanNetwork === net} onChange={() => setScanNetwork(net)} disabled={isAirdropping} style={{ accentColor: 'var(--accent-purple)' }} />
                    <span style={{ color: 'white', fontWeight: '500' }}>{net}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {!isAirdropping && !isConfirming ? (
              <button onClick={handleStartAirdrop} style={{ width: '100%', padding: '1rem', background: '#1c1c26', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                🎁 Mulai Airdrop
              </button>
            ) : isConfirming ? (
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={handleConfirmAirdrop} style={{ flex: 1, padding: '1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)' }}>
                  ✅ Konfirmasi Airdrop
                </button>
                <button onClick={handleStop} style={{ flex: 1, padding: '1rem', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                  ❌ Batal
                </button>
              </div>
            ) : (
              <button onClick={handleStop} style={{ width: '100%', padding: '1rem', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 15px rgba(225, 29, 72, 0.4)' }}>
                🛑 Hentikan Airdrop
              </button>
            )}
          </div>

          {/* Terminal Kanan */}
          <div style={{ flex: 1, background: '#0a0a0f', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold' }}>Terminal Output:</span>
              <button onClick={() => setTerminalLog('')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>✖ Clear</button>
            </div>
            <div ref={terminalRef} style={{ flex: 1, padding: '1rem', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#00d180', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '1.5' }}>
              {terminalLog ? terminalLog.split('\n').map((line, i) => {
                  let color = 'inherit';
                  if (line.includes('* TOTAL GAS FEE') || line.includes('★ TOTAL GAS FEE')) color = 'orange';
                  else if (line.includes('❌') || line.includes('ERROR')) color = '#ef4444';
                  else if (line.includes('✅')) color = '#00d180';
                  
                  return (
                    <div key={i} style={{ color, minHeight: '1.5em' }}>
                      {line.includes('https://') ? (
                          <>
                            {line.split(/(https:\/\/\S+)/).map((part, j) => 
                              part.startsWith('https://') ? 
                                <a key={j} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>{part}</a> 
                              : part
                            )}
                          </>
                        ) : line}
                    </div>
                  );
                }) : '>> Menunggu perintah...'}
            </div>
          </div>
          
        </div>
      </div>

      {showProfileModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0d0d12', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', width: '400px', maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: 'bold' }}>Profil Token</h3>
              <button onClick={() => setShowProfileModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            {(() => {
              const availableTokens = deployedTokens.filter(t => 
                (!t.network || t.network === scanNetwork) && 
                (t.privateKey === privateKey)
              );

              return (
                <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '1.5rem' }}>
                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: selectedProfileId === 'manual' ? '0.5rem' : '0' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        style={{ flex: 1, padding: '0.8rem', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                          {availableTokens.find(t => t.ca === selectedProfileId)
                            ? `${availableTokens.find(t => t.ca === selectedProfileId).name} (${availableTokens.find(t => t.ca === selectedProfileId).symbol})`
                            : 'Pilih Profil...'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>▼</span>
                      </div>
                    </div>

                    {isDropdownOpen && (
                      <div className="hide-scrollbar" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#13131a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', marginTop: '0.2rem', zIndex: 10, maxHeight: '265px', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                        {availableTokens.length === 0 && (
                          <div style={{ padding: '0.8rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>Belum ada token {scanNetwork}</div>
                        )}
                        {availableTokens.map((token) => (
                          <div key={token.ca} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#1a1a24'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', padding: '0.8rem', cursor: 'pointer' }} onClick={() => {
                              setSelectedProfileId(token.ca);
                              setSkipHolderCA(token.ca);
                              setIsDropdownOpen(false);
                            }}>
                              <span style={{ fontWeight: 'bold', color: 'white', fontSize: '0.9rem' }}>{token.name} <span style={{ color: '#94a3b8' }}>({token.symbol})</span></span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newList = deployedTokens.filter(t => t.ca !== token.ca || t.privateKey !== token.privateKey);
                                setDeployedTokens(newList);
                                localStorage.setItem('deployed_tokens', JSON.stringify(newList));
                                if (selectedProfileId === token.ca) {
                                  setSelectedProfileId('manual');
                                  setSkipHolderCA('');
                                }
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: '0 0.8rem', cursor: 'pointer', fontSize: '1.2rem', transition: 'color 0.2s' }}
                              onMouseOver={(e) => e.target.style.color = '#f87171'}
                              onMouseOut={(e) => e.target.style.color = '#ef4444'}
                              title="Hapus Profil"
                            >
                              &times;
                            </button>
                          </div>
                        ))}


                      </div>
                    )}
                  </div>


                </div>
              );
            })()}
            <button
              onClick={() => setShowProfileModal(false)}
              style={{ width: '100%', padding: '0.8rem', background: 'linear-gradient(to right, #3b82f6, #2563eb)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem' }}
            >
              Simpan & Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
