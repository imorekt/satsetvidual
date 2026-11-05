"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ethers } from 'ethers';
import { useFormCache } from '@/lib/useFormCache';

// RPC Setup
const getRpcUrl = (network) => {
  if (network === 'BASE') return "https://mainnet.base.org";
  if (network === 'RBNHD' || network === 'ROBINHOOD') return "https://rpc.mainnet.chain.robinhood.com";
  return "https://mainnet.base.org";
};

const PRIMARY_RPC_BASE = "https://base-mainnet.core.chainstack.com/777f7306a808d70ba68c63ff713a2f2b";
const SECONDARY_RPC_ROBINHOOD = "https://robinhood.drpc.org";

class FallbackJsonRpcProvider extends ethers.JsonRpcProvider {
  constructor(primary, secondary) {
    super(primary);
    this.secondaryProvider = new ethers.JsonRpcProvider(secondary);
  }
  async send(method, params) {
    try {
      return await super.send(method, params);
    } catch (e) {
      console.warn("Primary RPC failed:", e.message, "- Falling back to secondary");
      return await this.secondaryProvider.send(method, params);
    }
  }
}

const createFallbackProvider = (networkUrl) => {
  if (networkUrl.includes("base.org") || networkUrl.includes("base") || networkUrl.includes("chainstack")) {
    return new FallbackJsonRpcProvider(PRIMARY_RPC_BASE, networkUrl);
  }
  if (networkUrl.includes("robinhood")) {
    return new FallbackJsonRpcProvider(networkUrl, SECONDARY_RPC_ROBINHOOD);
  }
  return new ethers.JsonRpcProvider(networkUrl);
};

// ABI Constants
const DISPERSE_ABI = [
  {
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "recipients", "type": "address[]" },
      { "name": "value", "type": "uint256" }
    ],
    "name": "disperseTokenSameValue",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "recipients", "type": "address[]" },
      { "name": "values", "type": "uint256[]" }
    ],
    "name": "disperseToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "recipients", "type": "address[]" },
      { "name": "amountPerWallet", "type": "uint256" }
    ],
    "name": "disperseTokenFixed",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "recipients", "type": "address[]" },
      { "name": "amountPerWallet", "type": "uint256[]" }
    ],
    "name": "disperseEther",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

const ERC20_ABI = [
  "function name() view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

const DEFAULT_DISPERSE_BASE = "0xD152f549545093347A162Dce210e7293f1452150";
const DEFAULT_DISPERSE_ROBINHOOD = "0xfBB464318e8C283A2bF186b6BD6420143338e1c8";

const BATCH_SIZE = 500;

let globalAirdropAbortController = null;
let globalAirdropSession = null;

export default function AirdropPage() {
  const [privateKey, setPrivateKey] = useState('');
  const [disperseContract, setDisperseContract] = useState('0xD152f549545093347A162Dce210e7293f1452150');
  const [skipHolderCA, setSkipHolderCA] = useState('');
  const [nominalAmount, setNominalAmount] = useState('10');
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
  
  const [loadedKeys, setLoadedKeys] = useState([]);
  const [showKeysDropdown, setShowKeysDropdown] = useState(false);

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
        } catch (e) { }
      }

      if (!loadedFromScan) {
        const sWall = sessionStorage.getItem('websell_airdrop_walletList');
        if (sWall) setWalletList(sWall);
      }

      const sPk = sessionStorage.getItem('websell_airdrop_privateKey');
      if (sPk) setPrivateKey(sPk);

      const sNom = sessionStorage.getItem('websell_airdrop_nominalAmount');
      if (sNom && sNom !== '1.0' && sNom !== '0') setNominalAmount(sNom);
      else setNominalAmount('10');

      const scanNet = localStorage.getItem('websell_airdrop_scanNetwork') || 'BASE';
      setScanNetwork(scanNet);

      const sSkipCA = sessionStorage.getItem('websell_airdrop_skipHolderCA');
      if (sSkipCA) setSkipHolderCA(sSkipCA);
      const sSkipSym = sessionStorage.getItem('websell_airdrop_skipHolderSymbol');
      if (sSkipSym) setSkipHolderSymbol(sSkipSym);

      const savedTokens = JSON.parse(localStorage.getItem('deployed_tokens') || '[]');
      setDeployedTokens(savedTokens);
      
      // Fetch private keys
      fetch('/api/privatekeys')
        .then(res => res.json())
        .then(data => {
          if (data.accounts) setLoadedKeys(data.accounts);
        })
        .catch(err => console.error("Gagal load private keys", err));
      
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

  const hasLoadedData = useRef(false);
  useEffect(() => {
    if (isLoaded) {
      if (!hasLoadedData.current) {
        hasLoadedData.current = true;
        if (!nominalAmount || nominalAmount === '1.0' || nominalAmount === '0') {
          setNominalAmount('10');
        }
      } else if (!nominalAmount || nominalAmount === '1.0' || nominalAmount === '0') {
        setNominalAmount('10');
      }
    }
  }, [privateKey, skipHolderCA, isLoaded]);

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
      document.documentElement.setAttribute('data-theme', scanNetwork === 'RBNHD' ? 'ROBINHOOD' : scanNetwork);
    }
    if (isLoaded) {
      const isRobin = scanNetwork === 'RBNHD' || scanNetwork === 'ROBINHOOD';
      if (isRobin && (!disperseContract || disperseContract.toLowerCase() === DEFAULT_DISPERSE_BASE.toLowerCase() || disperseContract.toLowerCase().startsWith('0xf4691'))) {
        setDisperseContract(DEFAULT_DISPERSE_ROBINHOOD);
      } else if (!isRobin && (!disperseContract || disperseContract.toLowerCase() === DEFAULT_DISPERSE_ROBINHOOD.toLowerCase())) {
        setDisperseContract(DEFAULT_DISPERSE_BASE);
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-theme');
      }
    };
  }, [scanNetwork, isLoaded]);

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
        try { tName = await contract.name(); } catch (e) { }

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
      let multicall = new ethers.Contract(MULTICALL3, multicallAbi, provider);

      const tokenIface = new ethers.Interface(ERC20_ABI);
      const BATCH_SIZE = 500;
      let nonHolders = [];
      let foundHoldersCount = 0;

      for (let i = 0; i < uniqueAddrs.length; i += BATCH_SIZE) {
        const batchAddrs = uniqueAddrs.slice(i, i + BATCH_SIZE);
        addLog(`[FILTER] Mengecek batch ${i + 1} sampai ${i + batchAddrs.length}...`);

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
              } catch (e) {
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
      const isRobin = scanNetwork === 'RBNHD' || scanNetwork === 'ROBINHOOD';
      const rpcUrl = getRpcUrl(scanNetwork);
      addLog(`[NET] Menghubungkan ke jaringan ${isRobin ? 'Robinhood Chain' : 'Base Mainnet'}...`);
      const provider = createFallbackProvider(rpcUrl);
      const cleanPk = privateKey.trim().startsWith('0x') ? privateKey.trim() : '0x' + privateKey.trim();
      const wallet = new ethers.Wallet(cleanPk, provider);

      let targetDisperseRaw = disperseContract.trim();
      if (isRobin && (!targetDisperseRaw || targetDisperseRaw.toLowerCase() === DEFAULT_DISPERSE_BASE.toLowerCase() || targetDisperseRaw.toLowerCase().startsWith('0xf4691'))) {
        targetDisperseRaw = DEFAULT_DISPERSE_ROBINHOOD;
        setDisperseContract(DEFAULT_DISPERSE_ROBINHOOD);
      }
      const disperseAddress = ethers.getAddress(targetDisperseRaw);
      let disperse = new ethers.Contract(disperseAddress, DISPERSE_ABI, wallet);

      // Deteksi fungsi disperseTokenSameValue pada bytecode (hemat calldata seperti di bot.py)
      let hasSameValue = false;
      try {
        const targetCode = await provider.getCode(disperseAddress);
        hasSameValue = targetCode.toLowerCase().includes("17546c6c");
      } catch (e) {
        hasSameValue = isRobin;
      }
      const disperseModeLabel = hasSameValue ? "disperseTokenSameValue (Ultra Hemat Calldata)" : "disperseToken (Standard)";

      const mode = skipHolderCA.trim() === '' ? 'eth' : 'erc20';
      let tokenContract = null;
      let decimals = 18;
      let symbol = 'ETH';
      let tokenName = 'Ethereum';

      if (mode === 'erc20') {
        const tAddr = ethers.getAddress(skipHolderCA.trim());
        tokenContract = new ethers.Contract(tAddr, ERC20_ABI, wallet);
        addLog(`[TOKEN] Mengambil info token...`);
        symbol = await tokenContract.symbol().catch(() => 'TOKEN');
        tokenName = await tokenContract.name().catch(() => symbol);
        decimals = Number(await tokenContract.decimals().catch(() => 18));
        addLog(`[TOKEN] ✓ Ditemukan: ${tokenName} (${symbol}) (Decimals: ${decimals})`);
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
        } catch (e) { }
      }

      if (recipients.length === 0) {
        addLog(`❌ Tidak ada alamat valid yang ditemukan!`);
        throw new Error("No valid recipients");
      }

      addLog(`[DATA] ✓ ${recipients.length.toLocaleString()} alamat valid dimuat.`);

      const amountPerWalletHuman = Number(nominalAmount);
      const amountPerWalletWei = ethers.parseUnits(amountPerWalletHuman.toString(), decimals);
      const totalHuman = amountPerWalletHuman * recipients.length;
      const totalWei = amountPerWalletWei * BigInt(recipients.length);

      addLog(`[INFO] Total Airdrop: ${totalHuman.toLocaleString()} ${symbol}`);

      // 3. Cek Saldo & Harga Live ETH
      addLog(`[GAS] Mengecek saldo & parameter gas realtime...`);
      const ethBal = await provider.getBalance(wallet.address);
      const deployerBalEth = Number(ethers.formatEther(ethBal));

      let ethPriceUsd = 2420.0;
      let priceSource = "Estimasi Default";
      const priceApis = [
        { name: "Binance", url: "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT", parse: (d) => Number(d.price) },
        { name: "Coinbase", url: "https://api.coinbase.com/v2/prices/ETH-USD/spot", parse: (d) => Number(d.data.amount) },
        { name: "CoinGecko", url: "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", parse: (d) => Number(d.ethereum.usd) }
      ];
      for (const api of priceApis) {
        try {
          const res = await fetch(api.url);
          if (res.ok) {
            const data = await res.json();
            const p = api.parse(data);
            if (p > 0) {
              ethPriceUsd = p;
              priceSource = api.name;
              break;
            }
          }
        } catch (e) { }
      }

      let needsApprove = false;
      if (mode === 'erc20') {
        const tokenBal = await tokenContract.balanceOf(wallet.address);
        if (tokenBal < totalWei) {
          const kurang = Number(ethers.formatUnits(totalWei - tokenBal, decimals));
          addLog(`❌ Saldo ${symbol} tidak mencukupi! Kurang ${kurang.toLocaleString()} ${symbol}.`);
          throw new Error("Insufficient Token Balance");
        }
        addLog(`[GAS] ✓ Saldo Token cukup (${Number(ethers.formatUnits(tokenBal, decimals)).toLocaleString()} ${symbol}).`);
        try {
          const currentAllowance = await tokenContract.allowance(wallet.address, disperseAddress);
          needsApprove = currentAllowance < totalWei;
        } catch (e) {
          needsApprove = true;
        }
      } else {
        if (ethBal < totalWei) {
          addLog(`❌ Saldo Native tidak mencukupi. Butuh ${totalHuman} ${symbol}`);
          throw new Error("Insufficient Native Balance");
        }
        addLog(`[GAS] ✓ Saldo Native cukup.`);
      }

      const BATCH_SIZE = 500;
      const totalBatches = Math.ceil(recipients.length / BATCH_SIZE);

      // 4. Kalkulasi Gas Fee PALING DASAR & PALING MURAH (Persis seperti bot.py Menu [3] Airdrop Token Disperse)
      const latestBlock = await provider.getBlock('latest');
      const feeData = await provider.getFeeData();
      const baseFeeWei = (latestBlock && latestBlock.baseFeePerGas)
        ? latestBlock.baseFeePerGas
        : (feeData.gasPrice || ethers.parseUnits('0.005', 'gwei'));

      const prioFeeWei = 10n; // 10 wei (0.00000001 Gwei - Paling Dasar)
      const maxFeeWei = (baseFeeWei * 105n) / 100n + prioFeeWei;
      const actualGasPriceWei = baseFeeWei + prioFeeWei;

      const baseFeeGwei = Number(ethers.formatUnits(baseFeeWei, 'gwei'));
      const actualGasPriceGwei = Number(ethers.formatUnits(actualGasPriceWei, 'gwei'));

      let totalGasUnits = 0;
      const approveNeededCount = (mode === 'erc20' && needsApprove) ? 1 : 0;
      if (approveNeededCount > 0) {
        totalGasUnits += 45000;
      }

      const gasPerWallet = mode === 'erc20' ? (hasSameValue ? 28500 : 31200) : 10000;
      const baseTxOverhead = 35000;

      for (let b = 0; b < totalBatches; b++) {
        const bRecipientsCount = Math.min(BATCH_SIZE, recipients.length - (b * BATCH_SIZE));
        totalGasUnits += baseTxOverhead + (gasPerWallet * bRecipientsCount);
      }

      const realCostWei = BigInt(totalGasUnits) * actualGasPriceWei;
      const realCostEth = Number(ethers.formatEther(realCostWei));
      const realCostUsd = realCostEth * ethPriceUsd;

      const maxCostWei = BigInt(totalGasUnits) * maxFeeWei;
      const maxCostEth = Number(ethers.formatEther(maxCostWei));
      const maxCostUsd = maxCostEth * ethPriceUsd;

      const costPerWalletEth = realCostEth / recipients.length;
      const costPerWalletUsd = realCostUsd / recipients.length;

      const costPerBatchEth = realCostEth / totalBatches;
      const costPerBatchUsd = realCostUsd / totalBatches;

      const totalTxAll = totalBatches + approveNeededCount;
      const deployerBalUsd = deployerBalEth * ethPriceUsd;

      let estLog = `\n👛 Wallet Pengirim/Owner : ${wallet.address}\n`;
      estLog += `⛽ Saldo Gas ETH          : ${deployerBalEth.toFixed(6)} ETH (~$${deployerBalUsd.toFixed(2)} USD)\n`;
      estLog += `💵 Harga Live ETH         : $${ethPriceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD (Sumber: ${priceSource})\n`;
      estLog += `\n═════════════════════════════════════════════════════════════════\n`;
      estLog += `  📊 RINGKASAN ESTIMASI BIAYA AIRDROP (DISPERSE):\n`;
      estLog += `═════════════════════════════════════════════════════════════════\n`;
      estLog += `  • Token Target          : ${symbol} (${amountPerWalletHuman.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/wallet)\n`;
      estLog += `  • Total Wallet Tujuan   : ${recipients.length.toLocaleString('en-US')} wallet\n`;
      estLog += `  • Ukuran per Batch      : ${BATCH_SIZE} wallet / TX\n`;
      estLog += `  • Total Batch           : ${totalBatches} Batch (Total ${totalTxAll} TX On-Chain)\n`;
      estLog += `  • Kontrak Disperse      : ${disperseAddress}\n`;
      estLog += `  • Metode Disperse       : ${disperseModeLabel}\n`;
      if (mode === 'erc20') {
        estLog += `  • Perlu Approve Token   : ${approveNeededCount} token (${1 - approveNeededCount} sudah approve)\n`;
      }
      estLog += `  ─────────────────────────────────────────────────────────────\n`;
      estLog += `  • Base Fee Jaringan     : ${baseFeeGwei.toFixed(5)} Gwei (${baseFeeWei.toLocaleString('en-US')} wei)\n`;
      estLog += `  • Priority Tip (Dasar)  : 10 wei (0.00000001 Gwei - Paling Dasar)\n`;
      estLog += `  • Gas Price Aktual      : ${actualGasPriceGwei.toFixed(5)} Gwei (${actualGasPriceWei.toLocaleString('en-US')} wei)\n`;
      estLog += `  • Total Estimasi Gas    : ${totalGasUnits.toLocaleString('en-US')} gas\n`;
      estLog += `  ─────────────────────────────────────────────────────────────\n`;
      estLog += `  💰 ESTIMASI BIAYA NYATA : ~${realCostEth.toFixed(6)} ETH  (~$${realCostUsd.toFixed(2)} USD)\n`;
      estLog += `  👉 Biaya per Batch      : ~${costPerBatchEth.toFixed(6)} ETH  (~$${costPerBatchUsd.toFixed(4)} USD / batch)\n`;
      estLog += `  👉 Biaya per Wallet     : ~${costPerWalletEth.toFixed(8)} ETH  (~$${costPerWalletUsd.toFixed(5)} USD / wallet)\n`;
      estLog += `  🛡️  Batas Maksimum Cap   : ${maxCostEth.toFixed(6)} ETH  (~$${maxCostUsd.toFixed(2)} USD - Buffer antisipasi)\n`;
      estLog += `  ─────────────────────────────────────────────────────────────\n`;
      if (deployerBalEth < realCostEth) {
        const kurangEth = realCostEth - deployerBalEth;
        estLog += `  ⚠️ PERINGATAN: Saldo ETH Anda TIDAK CUKUP!\n`;
        estLog += `     Saldo Anda : ${deployerBalEth.toFixed(6)} ETH  |  Kurang : ~${kurangEth.toFixed(6)} ETH (~$${(kurangEth * ethPriceUsd).toFixed(2)} USD)\n`;
      } else {
        const sisaEth = deployerBalEth - realCostEth;
        estLog += `  ✓ Saldo Gas CUKUP (Sisa setelah airdrop: ~${sisaEth.toFixed(6)} ETH)\n`;
      }
      estLog += `═════════════════════════════════════════════════════════════════\n`;

      addLog(estLog);

      // Selesai estimasi
      addLog(`\n✅ ESTIMASI SELESAI. Silakan klik "Konfirmasi Airdrop" untuk melanjutkan transaksi dengan fee paling murah.`);

      globalAirdropSession = {
        wallet, disperseAddress, disperse, mode, tokenContract, totalWei,
        amountPerWalletWei, amountPerWalletHuman, symbol, recipients, skipHolderCA: skipHolderCA.trim(),
        hasSameValue, needsApprove, isRobin, ethPriceUsd, actualGasPriceWei
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
    const {
      wallet, disperseAddress, disperse, mode, tokenContract, totalWei,
      amountPerWalletWei, amountPerWalletHuman, symbol, recipients, skipHolderCA,
      hasSameValue, isRobin, ethPriceUsd, actualGasPriceWei
    } = session;
    const signal = globalAirdropAbortController ? globalAirdropAbortController.signal : new AbortController().signal;

    try {
      let currentNonce = await wallet.provider.getTransactionCount(wallet.address, 'pending');
      const explorerBaseUrl = isRobin ? 'https://robin.etherscan.io/tx/' : 'https://basescan.org/tx/';

      // 4. Approve (Jika ERC20) dengan Fee Paling Dasar & Murah (maxPriorityFeePerGas = 10 wei)
      if (mode === 'erc20') {
        addLog(`[APPROVE] Mengecek allowance ke contract Disperse...`);
        const currentAllowance = await tokenContract.allowance(wallet.address, disperseAddress);
        if (currentAllowance < totalWei) {
          const tokNeededFmt = Number(amountPerWalletHuman || 0) * recipients.length;
          addLog(`[*] Melakukan Approve ${tokNeededFmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol || 'Token'} ke Disperse Contract...`);
          const latestB = await wallet.provider.getBlock('latest');
          const feeD = await wallet.provider.getFeeData();
          const bFee = (latestB && latestB.baseFeePerGas) ? latestB.baseFeePerGas : (feeD.gasPrice || 1000000n);
          const appMaxFee = (bFee * 105n) / 100n + 10n;

          let appGas = 60000n;
          try {
            const estApp = await tokenContract.approve.estimateGas(disperseAddress, totalWei, {
              nonce: currentNonce,
              maxFeePerGas: appMaxFee,
              maxPriorityFeePerGas: 10n
            });
            appGas = (estApp * 110n) / 100n;
          } catch (e) {
            appGas = 60000n;
          }

          const approveTx = await tokenContract.approve(disperseAddress, totalWei, {
            nonce: currentNonce,
            gasLimit: appGas,
            maxFeePerGas: appMaxFee,
            maxPriorityFeePerGas: 10n
          });
          addLog(`    Tx Hash Approve: ${approveTx.hash}`);
          addLog(`    Menunggu konfirmasi approve ${symbol || ''}...`);
          await approveTx.wait(1);
          addLog(`    [SUKSES!]`);
          currentNonce++;
        } else {
          addLog(`✓ Token ${symbol || ''} sudah di-approve.`);
        }
      }

      if (checkAborted(signal)) throw new Error("Dibatalkan User");

      // 5. Chunking & Disperse (Fee Paling Dasar & Murah: maxPriorityFeePerGas = 10 wei, maxFeePerGas = baseFee * 1.05 + 10 wei)
      const BATCH_SIZE = 500;
      const batches = [];
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        batches.push(recipients.slice(i, i + BATCH_SIZE));
      }

      addLog(`\n🚀 Memulai pengiriman airdrop (${batches.length} batch)...`);
      let totalSpentWei = 0n;
      let totalSentWallets = 0;
      const startTime = Date.now();

      for (let i = 0; i < batches.length; i++) {
        if (checkAborted(signal)) throw new Error("Dibatalkan User");
        const batchAddrs = batches[i];
        const batchAmounts = Array(batchAddrs.length).fill(amountPerWalletWei);
        const batchTotalWei = amountPerWalletWei * BigInt(batchAddrs.length);

        addLog(`\n  📦 [Batch ${i + 1}/${batches.length}] Mengirim ke ${batchAddrs.length} wallet...`);

        try {
          const lBlock = await wallet.provider.getBlock('latest');
          const fData = await wallet.provider.getFeeData();
          const bFee = (lBlock && lBlock.baseFeePerGas) ? lBlock.baseFeePerGas : (fData.gasPrice || 1000000n);
          const bPrio = 10n;
          const bMaxFee = (bFee * 105n) / 100n + bPrio;

          const txOverrides = {
            nonce: currentNonce,
            maxFeePerGas: bMaxFee,
            maxPriorityFeePerGas: bPrio
          };

          let tx;
          const batchSample = batchAddrs.length;
          let gasLimitEstimated;

          if (mode === 'erc20') {
            if (hasSameValue) {
              try {
                const estGas = await disperse.disperseTokenSameValue.estimateGas(skipHolderCA, batchAddrs, amountPerWalletWei, txOverrides);
                gasLimitEstimated = (estGas * 105n) / 100n; // 5% buffer seperti bot.py
              } catch (e) {
                const fallbackGas = 35000 + (32000 * batchSample);
                gasLimitEstimated = BigInt(Math.floor(fallbackGas * 1.1));
              }
              tx = await disperse.disperseTokenSameValue(skipHolderCA, batchAddrs, amountPerWalletWei, { ...txOverrides, gasLimit: gasLimitEstimated });
            } else {
              try {
                const estGas = await disperse.disperseToken.estimateGas(skipHolderCA, batchAddrs, batchAmounts, txOverrides);
                gasLimitEstimated = (estGas * 105n) / 100n;
              } catch (e) {
                const fallbackGas = 35000 + (32000 * batchSample);
                gasLimitEstimated = BigInt(Math.floor(fallbackGas * 1.1));
              }
              tx = await disperse.disperseToken(skipHolderCA, batchAddrs, batchAmounts, { ...txOverrides, gasLimit: gasLimitEstimated });
            }
          } else {
            try {
              const estGas = await disperse.disperseEther.estimateGas(batchAddrs, batchAmounts, { ...txOverrides, value: batchTotalWei });
              gasLimitEstimated = (estGas * 105n) / 100n;
            } catch (e) {
              gasLimitEstimated = BigInt(50000 + batchSample * 10000);
            }
            tx = await disperse.disperseEther(batchAddrs, batchAmounts, { ...txOverrides, value: batchTotalWei, gasLimit: gasLimitEstimated });
          }

          addLog(`       📡 Tx Hash : ${tx.hash}`);
          addLog(`       🔗 Explorer: ${explorerBaseUrl}${tx.hash}`);
          addLog(`       ⏳ Menunggu konfirmasi...`);
          const receipt = await tx.wait(1);
          addLog(`       [CONFIRMED!]`);

          const gasUsed = receipt.gasUsed || 0n;
          const effPrice = receipt.gasPrice || receipt.effectiveGasPrice || actualGasPriceWei || (bFee + bPrio);
          const batchFeeWei = gasUsed * effPrice;
          const batchFeeEth = Number(ethers.formatEther(batchFeeWei));
          totalSpentWei += batchFeeWei;
          totalSentWallets += batchAddrs.length;
          currentNonce++;

          addLog(`       ⛽ Gas Terpakai : ${gasUsed.toLocaleString('en-US')} gas  | Biaya: ~${batchFeeEth.toFixed(6)} ETH (~$${(batchFeeEth * (ethPriceUsd || 2420)).toFixed(4)} USD)`);
        } catch (e) {
          console.error("Disperse error:", e);
          let errMsg = e.shortMessage || e.message;
          if (e.info && e.info.error && e.info.error.message) {
            errMsg = e.info.error.message;
          } else if (e.error && e.error.message) {
            errMsg = e.error.message;
          }
          addLog(`   ❌ Gagal Batch ${i + 1}: ${errMsg}`);
          currentNonce = await wallet.provider.getTransactionCount(wallet.address, 'pending');
        }
      }

      if (!checkAborted(signal)) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const totalSpentEth = Number(ethers.formatEther(totalSpentWei));
        const totalSpentUsd = totalSpentEth * (ethPriceUsd || 2420);
        const totDitebar = totalSentWallets * Number(amountPerWalletHuman || 0);

        let finalSummary = `\n=================================================================\n`;
        finalSummary += `🎉 SELURUH PROSES AIRDROP SELESAI!\n`;
        finalSummary += `=================================================================\n`;
        finalSummary += `  • Total Wallet Terkirim : ${totalSentWallets.toLocaleString('en-US')} / ${recipients.length.toLocaleString('en-US')} wallet\n`;
        finalSummary += `  • Total ${symbol || 'Token'} Ditebar   : ${totDitebar.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol || 'Token'}\n`;
        finalSummary += `  • Total Biaya Gas Nyata : ${totalSpentEth.toFixed(6)} ETH  (~$${totalSpentUsd.toFixed(2)} USD)\n`;
        finalSummary += `  • Waktu Pengerjaan      : ${elapsed} detik\n`;
        finalSummary += `=================================================================\n`;
        addLog(finalSummary);
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
      <div className="mev-panel" style={{ background: 'linear-gradient(135deg, rgba(13, 20, 36, 0.92) 0%, rgba(9, 14, 26, 0.85) 100%)', borderRadius: '12px', border: '1px solid rgba(0, 82, 255, 0.28)', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.55)', padding: '1.5rem 2.5rem', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0, overflow: 'hidden' }}>

        {(userRole !== 'Premium' && userRole !== 'Developer') && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 8, 17, 0.85)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
            <h3 style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>Fitur Premium</h3>
            <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '300px', fontSize: '0.85rem' }}>Fitur ini khusus untuk Member Premium. Masukkan kode premium di menu Profil untuk membuka kunci.</p>
          </div>
        )}

        <div style={{ paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', fontWeight: 800, margin: 0, color: '#f8fafc', textAlign: 'center' }}>🎁 Airdrop Token (Disperse)</h2>
        </div>

        <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0 }}>

          {/* Form Kiri */}
          <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', gap: '1.1rem', minWidth: '420px', minHeight: 0 }}>

            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.45rem', display: 'block', whiteSpace: 'nowrap' }}>
                Wallet Private Key
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', minWidth: 0 }}>
                <input
                  type="text"
                  className="mev-input"
                  autoComplete="off"
                  spellCheck="false"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  value={privateKey}
                  onChange={(e) => handlePrivateKeyChange(e.target.value)}
                  disabled={isAirdropping}
                  style={{ flex: 1, minWidth: 0, height: '42px', boxSizing: 'border-box', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', padding: '0 0.9rem', borderRadius: '8px', color: 'white', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', outline: 'none', WebkitTextSecurity: 'disc' }}
                  placeholder="0x..."
                />
                {loadedKeys.length > 0 && (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      onClick={() => setShowKeysDropdown(!showKeysDropdown)}
                      disabled={isAirdropping}
                      style={{ height: '42px', boxSizing: 'border-box', padding: '0 0.9rem', background: 'rgba(13, 22, 40, 0.75)', border: '1px solid rgba(0, 242, 254, 0.25)', borderRadius: '8px', color: '#f8fafc', fontFamily: 'var(--font-display)', fontSize: '0.82rem', fontWeight: 600, cursor: isAirdropping ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                    >
                      📂 Pilih Akun
                    </button>
                    {showKeysDropdown && (
                      <div style={{ position: 'absolute', top: '110%', right: 0, width: '250px', background: 'rgba(10, 16, 28, 0.96)', border: '1px solid rgba(0, 82, 255, 0.3)', borderRadius: '8px', overflow: 'hidden', zIndex: 50, boxShadow: '0 10px 25px rgba(0,0,0,0.65)' }}>
                        {loadedKeys.map((acc, idx) => (
                          <div
                            key={idx}
                            onClick={() => { handlePrivateKeyChange(acc.key); setShowKeysDropdown(false); }}
                            style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 82, 255, 0.15)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'white' }}>{acc.label}</span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{acc.key.substring(0,6)}...{acc.key.substring(acc.key.length-4)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="airdrop-spec-row" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', minWidth: 0 }}>
              <div style={{ flex: 2.6, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.45rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Disperse Contract Address
                </label>
                <input
                  type="text"
                  className="mev-input"
                  value={disperseContract}
                  onChange={(e) => setDisperseContract(e.target.value)}
                  disabled={isAirdropping}
                  style={{ width: '100%', height: '42px', boxSizing: 'border-box', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', padding: '0 0.85rem', borderRadius: '8px', color: 'white', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', outline: 'none' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '130px', display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.45rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Nominal / Address
                </label>
                <input
                  type="text"
                  className="mev-input"
                  value={nominalAmount}
                  onChange={(e) => setNominalAmount(e.target.value)}
                  disabled={isAirdropping}
                  style={{ width: '100%', height: '42px', boxSizing: 'border-box', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', padding: '0 0.85rem', borderRadius: '8px', color: 'white', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', outline: 'none' }}
                  placeholder="Contoh: 10"
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.45rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Skip Holder (Input Token CA)
                {skipHolderSymbol && <span style={{ color: skipHolderSymbol.includes('?') ? '#e11d48' : '#00c805', marginLeft: '0.5rem', fontFamily: 'var(--font-mono)' }}>[{skipHolderSymbol}]</span>}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', minWidth: 0 }}>
                <input
                  type="text"
                  className="mev-input"
                  value={skipHolderCA}
                  onChange={(e) => setSkipHolderCA(e.target.value)}
                  disabled={isAirdropping || isFiltering}
                  style={{ flex: 1, minWidth: 0, height: '42px', boxSizing: 'border-box', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', padding: '0 0.85rem', borderRadius: '8px', color: 'white', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', outline: 'none' }}
                  placeholder="0x..."
                />
                <button
                  onClick={() => setShowProfileModal(true)}
                  disabled={isAirdropping || isFiltering}
                  style={{ height: '42px', boxSizing: 'border-box', padding: '0 0.85rem', background: 'rgba(13, 22, 40, 0.75)', border: '1px solid rgba(0, 242, 254, 0.25)', borderRadius: '8px', color: '#f8fafc', fontFamily: 'var(--font-display)', fontSize: '0.82rem', fontWeight: 600, cursor: (isAirdropping || isFiltering) ? 'not-allowed' : 'pointer', opacity: (isAirdropping || isFiltering) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  🔍 Profil
                </button>
                <button
                  onClick={handleFilterHolders}
                  disabled={isAirdropping || isFiltering || !skipHolderCA}
                  style={{ height: '42px', boxSizing: 'border-box', padding: '0 1rem', background: 'linear-gradient(135deg, #0052ff, #0088ff)', color: 'white', border: 'none', borderRadius: '8px', fontFamily: 'var(--font-display)', fontSize: '0.82rem', fontWeight: 700, cursor: (isAirdropping || isFiltering || !skipHolderCA) ? 'not-allowed' : 'pointer', opacity: (isAirdropping || isFiltering || !skipHolderCA) ? 0.5 : 1, transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {isFiltering ? 'Menyaring...' : '🗑️ Filter Holder'}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem', display: 'block' }}>Daftar Address Penerima (Hasil Scan akan Otomatis Muncul di Sini)</label>

              <div style={{ display: 'flex', background: 'rgba(6, 10, 20, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', minHeight: 0, flex: 1, marginBottom: '0.5rem' }}>
                <div
                  id="wallet-line-numbers"
                  style={{ width: '65px', minWidth: '65px', padding: '1rem 0.5rem', background: 'rgba(13, 22, 40, 0.45)', borderRight: '1px solid rgba(255,255,255,0.08)', color: '#64748b', textAlign: 'right', fontFamily: 'var(--font-mono)', userSelect: 'none', overflow: 'hidden', whiteSpace: 'pre', lineHeight: '1.5', fontSize: '13px' }}
                >
                  {walletList.split('\n').map((_, i) => (i + 1) + '.').join('\n')}
                </div>
                <textarea
                  value={walletList}
                  onChange={(e) => setWalletList(e.target.value)}
                  onScroll={(e) => { const ln = document.getElementById('wallet-line-numbers'); if (ln) ln.scrollTop = e.target.scrollTop; }}
                  disabled={isAirdropping}
                  wrap="off"
                  style={{ width: '100%', flex: 1, background: 'transparent', border: 'none', padding: '1rem', color: 'white', outline: 'none', resize: 'none', fontFamily: 'var(--font-mono)', whiteSpace: 'pre', lineHeight: '1.5', fontSize: '13px' }}
                  placeholder={`0x123...456\n0xabc...def`}
                />
              </div>

              <div style={{ fontSize: '0.82rem', color: '#00c805', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                Total Address Terdeteksi: {addressCount} address
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem', display: 'block' }}>Select Network</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => !isAirdropping && setScanNetwork('BASE')}
                  disabled={isAirdropping}
                  style={{
                    flex: 1,
                    height: '42px',
                    boxSizing: 'border-box',
                    background: scanNetwork === 'BASE' ? 'rgba(0, 82, 255, 0.18)' : 'rgba(6, 10, 20, 0.85)',
                    border: scanNetwork === 'BASE' ? '1px solid #0052ff' : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: scanNetwork === 'BASE' ? '0 0 12px rgba(0, 82, 255, 0.3)' : 'none',
                    borderRadius: '8px',
                    color: scanNetwork === 'BASE' ? 'white' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: isAirdropping ? 'not-allowed' : 'pointer',
                    transition: 'all 0.25s',
                    opacity: isAirdropping ? 0.5 : 1
                  }}
                >
                  <span style={{ width: '9px', height: '9px', background: scanNetwork === 'BASE' ? '#0052ff' : 'transparent', border: scanNetwork === 'BASE' ? 'none' : '2px solid rgba(255,255,255,0.2)', boxShadow: scanNetwork === 'BASE' ? '0 0 8px #0052ff' : 'none', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}></span>
                  <span>BASE</span>
                </button>
                <button
                  type="button"
                  onClick={() => !isAirdropping && setScanNetwork('RBNHD')}
                  disabled={isAirdropping}
                  style={{
                    flex: 1,
                    height: '42px',
                    boxSizing: 'border-box',
                    background: scanNetwork === 'RBNHD' ? 'rgba(0, 200, 5, 0.16)' : 'rgba(6, 10, 20, 0.85)',
                    border: scanNetwork === 'RBNHD' ? '1px solid #00c805' : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: scanNetwork === 'RBNHD' ? '0 0 12px rgba(0, 200, 5, 0.25)' : 'none',
                    borderRadius: '8px',
                    color: scanNetwork === 'RBNHD' ? 'white' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: isAirdropping ? 'not-allowed' : 'pointer',
                    transition: 'all 0.25s',
                    opacity: isAirdropping ? 0.5 : 1
                  }}
                >
                  <span style={{ width: '9px', height: '9px', background: scanNetwork === 'RBNHD' ? '#00c805' : 'transparent', border: scanNetwork === 'RBNHD' ? 'none' : '2px solid rgba(255,255,255,0.2)', boxShadow: scanNetwork === 'RBNHD' ? '0 0 8px #00c805' : 'none', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}></span>
                  <span>RBNHD</span>
                </button>
              </div>
            </div>

            {!isAirdropping && !isConfirming ? (
              <button onClick={handleStartAirdrop} style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg, rgba(0, 82, 255, 0.35) 0%, rgba(0, 242, 254, 0.2) 100%)', color: 'white', border: '1px solid rgba(0, 242, 254, 0.45)', boxShadow: '0 4px 18px rgba(0, 82, 255, 0.25)', borderRadius: '8px', fontFamily: 'var(--font-display)', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>
                🎁 Mulai Airdrop
              </button>
            ) : isConfirming ? (
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={handleConfirmAirdrop} style={{ flex: 1, padding: '1rem', background: '#00c805', color: 'white', border: 'none', borderRadius: '8px', fontFamily: 'var(--font-display)', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 15px rgba(0, 200, 5, 0.4)' }}>
                  ✅ Konfirmasi Airdrop
                </button>
                <button onClick={handleStop} style={{ flex: 1, padding: '1rem', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontFamily: 'var(--font-display)', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>
                  ❌ Batal
                </button>
              </div>
            ) : (
              <button onClick={handleStop} style={{ width: '100%', padding: '1rem', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontFamily: 'var(--font-display)', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 0 15px rgba(225, 29, 72, 0.4)' }}>
                🛑 Hentikan Airdrop
              </button>
            )}
          </div>

          {/* Terminal Kanan */}
          <div className="mev-terminal" style={{ flex: 1, background: 'radial-gradient(circle at top right, rgba(0, 242, 254, 0.04), transparent 70%), #02040a', borderRadius: '8px', border: '1px solid rgba(0, 242, 254, 0.22)', boxShadow: 'inset 0 1px 18px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 242, 254, 0.04)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>Terminal Output:</span>
              <button onClick={() => setTerminalLog('')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>✖ Clear</button>
            </div>
            <div ref={terminalRef} style={{ flex: 1, padding: '1rem', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#00f2fe', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '1.5' }}>
              {terminalLog ? terminalLog.split('\n').map((line, i) => {
                let color = 'inherit';
                if (line.includes('* TOTAL GAS FEE') || line.includes('★ TOTAL GAS FEE')) color = 'orange';
                else if (line.includes('❌') || line.includes('ERROR')) color = '#ef4444';
                else if (line.includes('✅')) color = '#00d180';

                return (
                  <div key={i} style={{ color, minHeight: '1.5em' }}>
                    {(line.includes('https://') || /\$\d[\d.,]*\s*USD/.test(line)) ? (
                      <>
                        {line.split(/(https:\/\/\S+|\$\d[\d.,]*\s*USD)/).map((part, j) => {
                          if (part.startsWith('https://')) {
                            return <a key={j} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>{part}</a>;
                          }
                          if (/^\$\d[\d.,]*\s*USD$/.test(part)) {
                            return <span key={j} style={{ color: '#ef4444', fontWeight: 700 }}>{part}</span>;
                          }
                          return part;
                        })}
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
