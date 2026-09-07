import { ethers } from "ethers";
import { 
  WETH_ADDRESS, DEX_CONFIG, 
  FACTORY_ABI, UNISWAP_V3_FACTORY_ABI, UNISWAP_V2_FACTORY_ABI, 
  ERC20_ABI, AERODROME_ROUTER_ABI, UNISWAP_V3_ROUTER_ABI, UNISWAP_V2_ROUTER_ABI,
  SIG_V3, SIG_V2, SIG_AERO, SIG_V4, UNISWAP_V4_POOL_MANAGER
} from "./constants.js";
import fs from "fs";
import path from "path";
import { globalStats } from "./globalStats.js";

export class BaseAutoSellBot {
  constructor(config) {
    this.userId = config.userId;
    this.profileName = config.profileName || 'Profil1';
    this.rpcUrl = config.rpcUrl;
    this.privateKey = config.privateKey;
    this.tokenCa = config.tokenCa;
    this.lpPool = config.lpPool;
    this.slippage = config.slippage || 2.5;
    this.sellRatio = config.sellRatio || 98.0;
    this.dexChoice = config.dexChoice || "aerodrome";

    // Auto-detect Uniswap V4 based on Pool ID
    if (this.lpPool.length === 66 || this.lpPool.toLowerCase().startsWith("0x1ab15fdc")) {
      this.dexChoice = "uniswap_v4";
    }
    
    this.totalSells = 0;
    this.recentSales = [];
    
    this.isRunning = false;
    this.provider = null;
    this.wallet = null;
    this.tokenContract = null;
    this.routerContract = null;
    this.logFile = path.join(process.cwd(), "..", "data_user", this.userId, this.profileName, "bot.log");
    this.errorFile = path.join(process.cwd(), "..", "data_user", this.userId, this.profileName, "error.log");
    this.statusFile = path.join(process.cwd(), "..", "data_user", this.userId, this.profileName, "status.txt");
    
    try {
      if (fs.existsSync(this.logFile)) fs.writeFileSync(this.logFile, '');
    } catch {}
    this.logBuffer = [];
  }

  log(msg, inline = false) {
    if (!this.logFile) return;
    const wibTime = new Date(Date.now() + 7 * 3600 * 1000);
    const timeStr = wibTime.toISOString().replace('T', ' ').substring(0, 19);
    const line = msg === "" ? "" : `[${timeStr}] ${msg}`;
    
    if (inline && this.logBuffer.length > 0 && this._wasInline) {
      this.logBuffer[this.logBuffer.length - 1] = line;
    } else {
      this.logBuffer.push(line);
    }
    this._wasInline = inline;
    
    if (this.logBuffer.length > 500) {
      this.logBuffer.shift();
    }
    
    try {
      fs.writeFileSync(this.logFile, this.logBuffer.join('\n') + '\n', 'utf-8');
    } catch (e) {}
  }

  errorLog(msg) {
    const wibTime = new Date(Date.now() + 7 * 3600 * 1000);
    const timeStr = wibTime.toISOString().replace('T', ' ').substring(0, 19);
    fs.appendFileSync(this.errorFile, `[${timeStr}] ERROR: ${msg}\n`);
    this.log(`❌ ERROR: ${msg}`);
  }

  async init() {
    try {
      this.rpcUrls = this.rpcUrl.split(",").map(url => url.trim()).filter(url => url.length > 0);
      this.currentRpcIndex = 0;
      
      const req = new ethers.FetchRequest(this.rpcUrls[this.currentRpcIndex]);
      req.retryCount = 0;
      this.provider = new ethers.JsonRpcProvider(req, 8453, { staticNetwork: true }); 
      this.wallet = new ethers.Wallet(this.privateKey, this.provider);
      
      const checksumCa = ethers.getAddress(this.tokenCa);
      this.tokenContract = new ethers.Contract(checksumCa, ERC20_ABI, this.wallet);
      
      const dex = DEX_CONFIG[this.dexChoice];
      if (!dex) throw new Error("Invalid DEX choice");
      
      let routerAbi;
      if (this.dexChoice === "aerodrome") routerAbi = AERODROME_ROUTER_ABI;
      else if (this.dexChoice === "uniswap_v3") routerAbi = UNISWAP_V3_ROUTER_ABI;
      else routerAbi = UNISWAP_V2_ROUTER_ABI;

      this.routerContract = new ethers.Contract(dex.router, routerAbi, this.wallet);
      
      this.log(`✅ Terhubung ke RPC: ${this.rpcUrls[this.currentRpcIndex]}`);
      this.log(`✅ Dompet: ${this.wallet.address}`);
      
      return true;
    } catch (err) {
      this.errorLog(`Gagal inisialisasi: ${err.message}`);
      return false;
    }
  }

  async rotateRpc() {
    if (!this.rpcUrls || this.rpcUrls.length <= 1) {
      this.log(`⚠️ Tidak ada RPC cadangan untuk dirotasi.`);
      return false;
    }
    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
    const newRpc = this.rpcUrls[this.currentRpcIndex];
    this.log(`🔄 RPC Error terdeteksi! Merotasi ke RPC: ${newRpc}`);
    
    try {
      const req = new ethers.FetchRequest(newRpc);
      req.retryCount = 0;
      this.provider = new ethers.JsonRpcProvider(req, 8453, { staticNetwork: true }); 
      this.wallet = new ethers.Wallet(this.privateKey, this.provider);
      const checksumCa = ethers.getAddress(this.tokenCa);
      this.tokenContract = new ethers.Contract(checksumCa, ERC20_ABI, this.wallet);
      const dex = DEX_CONFIG[this.dexChoice];
      let routerAbi;
      if (this.dexChoice === "aerodrome") routerAbi = AERODROME_ROUTER_ABI;
      else if (this.dexChoice === "uniswap_v3") routerAbi = UNISWAP_V3_ROUTER_ABI;
      else routerAbi = UNISWAP_V2_ROUTER_ABI;
      this.routerContract = new ethers.Contract(dex.router, routerAbi, this.wallet);
      this.log(`✅ Berhasil terhubung ke RPC baru.`);
      return true;
    } catch (e) {
      this.errorLog(`Gagal merotasi RPC: ${e.message}`);
      return false;
    }
  }

  async handleRpcError(err) {
    const errMsg = err.message || "";
    if (errMsg.includes("503") || errMsg.includes("429") || errMsg.includes("SERVER_ERROR") || errMsg.includes("no backend is currently healthy") || errMsg.includes("TIMEOUT")) {
      this.errorLog(`Koneksi RPC terputus (${errMsg.substring(0, 50)}...).`);
      await this.rotateRpc();
      await new Promise(r => setTimeout(r, 2000));
    } else {
      this.errorLog(`Kesalahan saat memantau: ${err.message}`);
    }
  }

  async preApproveToken() {
    try {
      const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
      const PERMIT2_ABI = [
        "function approve(address token, address spender, uint160 amount, uint48 expiration) external",
        "function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)"
      ];

      if (this.dexChoice === "uniswap_v4") {
        const routerAddress = DEX_CONFIG["uniswap_v4"].router;
        
        // 1. Cek & Approve ERC-20 Token ke Permit2
        const p2Allowance = await this.tokenContract.allowance(this.wallet.address, PERMIT2_ADDRESS);
        if (p2Allowance < ethers.MaxUint256 / 2n) {
          this.log("⏳ Melakukan approve token ke Permit2...");
          const tx1 = await this.tokenContract.approve(PERMIT2_ADDRESS, ethers.MaxUint256);
          await tx1.wait();
          this.log(`✅ Token berhasil di-approve ke Permit2! (Tx: ${tx1.hash})`);
        } else {
          this.log("✅ Token sudah memiliki allowance ke Permit2.");
        }

        // 2. Cek & Approve Permit2 ke Universal Router V4
        const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, this.wallet);
        const [p2Amt, p2Exp] = await permit2Contract.allowance(this.wallet.address, this.tokenCa, routerAddress);
        const nowTs = Math.floor(Date.now() / 1000);
        
        if (p2Amt < 1000000000000000000n || p2Exp < nowTs + 86400) {
          this.log("🔄 Mengirim transaksi persetujuan (Approve) Permit2 untuk Universal Router V4...");
          const maxUint160 = 2n**160n - 1n;
          const maxUint48 = 2n**48n - 1n; // Never expires
          const tx2 = await permit2Contract.approve(this.tokenCa, routerAddress, maxUint160, maxUint48);
          await tx2.wait();
          this.log(`✅ Token berhasil di-approve Permit2 ke Universal Router V4! (Tx: ${tx2.hash})`);
        } else {
          this.log("✅ Token sudah memiliki izin Permit2 (Universal Router V4).");
        }
      } else {
        const routerAddress = DEX_CONFIG[this.dexChoice].router;
        const allowance = await this.tokenContract.allowance(this.wallet.address, routerAddress);
        
        if (allowance < ethers.MaxUint256 / 2n) { 
          this.log(`⏳ Melakukan approve token ke Router (${DEX_CONFIG[this.dexChoice].name})...`);
          const tx = await this.tokenContract.approve(routerAddress, ethers.MaxUint256);
          await tx.wait();
          this.log(`✅ Token berhasil di-approve! (Tx: ${tx.hash})`);
        } else {
          this.log("✅ Token sudah memiliki allowance.");
        }
      }
    } catch (err) {
      this.errorLog(`Gagal approve token: ${err.message}`);
    }
  }

  async getEthPrice(fallbackPrice = 3500.0) {
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
      if (res.ok) {
        const data = await res.json();
        return parseFloat(data.ethereum.usd);
      }
    } catch (e) {}
    return fallbackPrice;
  }

  async sellToken(targetAmountToSell, sellPct) {
    try {
      const balance = await this.tokenContract.balanceOf(this.wallet.address);
      if (balance === 0n) return false;

      const amountToSell = targetAmountToSell ? targetAmountToSell : (balance * BigInt(Math.floor(sellPct * 100))) / 10000n;
      if (amountToSell === 0n) return false;

      const decimals = await this.tokenContract.decimals();
      const symbol = await this.tokenContract.symbol();
      const readableAmount = Number(amountToSell) / (10 ** Number(decimals));

      this.log(`🛒 Mempersiapkan penjualan ${readableAmount.toFixed(6)} ${symbol} (${sellPct}% dari total saldo)...`);

      let tx;
      if (this.dexChoice === "aerodrome" || this.dexChoice === "uniswap_v2") {
        const routerAddress = DEX_CONFIG[this.dexChoice].router;
        const factoryAddress = DEX_CONFIG[this.dexChoice].factory;
        const deadline = Math.floor(Date.now() / 1000) + 600;
        
        let path = [this.tokenCa, WETH_ADDRESS];
        
        if (this.dexChoice === "aerodrome") {
          // Routes: (address from, address to, bool stable, address factory)[]
          const routes = [[this.tokenCa, WETH_ADDRESS, false, factoryAddress]];
          tx = await this.routerContract.swapExactTokensForETHSupportingFeeOnTransferTokens.populateTransaction(
            amountToSell,
            0,
            routes,
            this.wallet.address,
            deadline
          );
        } else {
          tx = await this.routerContract.swapExactTokensForETHSupportingFeeOnTransferTokens.populateTransaction(
            amountToSell,
            0,
            path,
            this.wallet.address,
            deadline
          );
        }
      } else if (this.dexChoice === "uniswap_v3") {
        // V3 exactInputSingle
        const params = {
          tokenIn: this.tokenCa,
          tokenOut: WETH_ADDRESS,
          fee: 3000, // Hardcoded or dynamic
          recipient: this.wallet.address,
          amountIn: amountToSell,
          amountOutMinimum: 0n,
          sqrtPriceLimitX96: 0n
        };
        tx = await this.routerContract.exactInputSingle.populateTransaction(params);
      } else if (this.dexChoice === "uniswap_v4") {
        const routerAddress = DEX_CONFIG["uniswap_v4"].router;
        const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
        const hooks = "0x0000000000000000000000000000000000000000";
        
        // Use a generic fee if not provided, assume 3000
        const fee = 3000;
        const tickSpacing = 60;
        
        const poolKey = [
          ETH_ADDRESS,
          this.tokenCa,
          fee,
          tickSpacing,
          hooks
        ];
        
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        
        // 1. SWAP_EXACT_IN_SINGLE (0x06)
        // In V4, token0 is the smaller address. ETH (0x0...) is always smaller than any token.
        // So we are swapping token1 (token) -> token0 (ETH), hence zeroForOne is false
        const zeroForOne = false;
        
        const p0 = abiCoder.encode(
          ["tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)"],
          [[poolKey, zeroForOne, amountToSell, 0n, "0x"]]
        );
        
        // 2. SETTLE_ALL (0x0c)
        const p1 = abiCoder.encode(
          ["address", "uint256"],
          [this.tokenCa, ethers.MaxUint256]
        );
        
        // 3. TAKE_ALL (0x0f)
        const p2 = abiCoder.encode(
          ["address", "uint256"],
          [ETH_ADDRESS, 0n]
        );
        
        const actions = "0x060c0f";
        const params = [p0, p1, p2];
        const v4Input = abiCoder.encode(["bytes", "bytes[]"], [actions, params]);
        
        // PERMIT2_TRANSFER_FROM = 0x02, V4_SWAP = 0x10, SWEEP = 0x04
        const pPermit = abiCoder.encode(
          ["address", "address", "uint160"], 
          [this.tokenCa, routerAddress, amountToSell]
        );
        const pSweep = abiCoder.encode(
          ["address", "address", "uint256"], 
          [ETH_ADDRESS, this.wallet.address, 0n]
        );
        
        const commands = "0x021004";
        const inputs = [pPermit, v4Input, pSweep];
        const deadline = Math.floor(Date.now() / 1000) + 600;
        
        const payload = abiCoder.encode(["bytes", "bytes[]", "uint256"], [commands, inputs, deadline]);
        
        // Function selector for execute(bytes commands, bytes[] inputs, uint256 deadline) is 0x3593564c
        const data = "0x3593564c" + payload.substring(2);
        
        tx = {
          to: routerAddress,
          data: data,
          value: 0n
        };
      }

      const gasPrice = await this.provider.getFeeData();
      const txParams = {
        to: tx.to,
        data: tx.data,
        gasPrice: (gasPrice.gasPrice * 120n) / 100n, // 1.2x gas multiplier
      };

      try {
        const estimatedGas = await this.provider.estimateGas({ ...txParams, from: this.wallet.address });
        txParams.gasLimit = (estimatedGas * 120n) / 100n;
      } catch (e) {
        this.log("⚠️ Estimasi gas gagal. Menggunakan default gas limit.");
        txParams.gasLimit = 350000n;
      }

      this.log("🚀 Mengirim transaksi swap...");
      const sendTx = await this.wallet.sendTransaction(txParams);
      this.log(`💸 Transaksi swap dikirim! Hash: ${sendTx.hash}`);
      this.log("⏳ Menunggu konfirmasi...");

      const receipt = await sendTx.wait();
      if (receipt.status === 1) {
        this.log(`🎉 SUKSES! Berhasil menjual ${readableAmount.toFixed(6)} ${symbol}.`);
        return true;
      } else {
        this.log("❌ Transaksi swap GAGAL (reverted).");
        return false;
      }
    } catch (e) {
      this.errorLog(`Terjadi kesalahan saat memproses swap: ${e.message}`);
      return false;
    }
  }

  async start() {
    this.isRunning = true;
    if (this.statusFile) fs.writeFileSync(this.statusFile, 'RUNNING');
    
    const initSuccess = await this.init();
    if (!initSuccess) {
      this.isRunning = false;
      if (this.statusFile) fs.writeFileSync(this.statusFile, 'STOPPED');
      return;
    }

    try {
      const [name, symbol, decimals, ethBalWei, tokenBalWei] = await Promise.all([
        this.tokenContract.name().catch(() => 'Unknown'),
        this.tokenContract.symbol().catch(() => 'Unknown'),
        this.tokenContract.decimals().catch(() => 18n),
        this.provider.getBalance(this.wallet.address).catch(() => 0n),
        this.tokenContract.balanceOf(this.wallet.address).catch(() => 0n)
      ]);

      const ethBal = Number(ethers.formatEther(ethBalWei));
      const tokenBal = Number(ethers.formatUnits(tokenBalWei, decimals));
      
      const shortWallet = `${this.wallet.address.substring(0, 8)}...${this.wallet.address.substring(this.wallet.address.length - 6)}`;
      const shortPool = this.lpPool.length > 24 ? `${this.lpPool.substring(0, 12)}...${this.lpPool.substring(this.lpPool.length - 8)}` : this.lpPool;
      
      let dexName = "Uniswap V2";
      if (this.dexChoice === "aerodrome") dexName = "Aerodrome";
      else if (this.dexChoice === "uniswap_v3") dexName = "Uniswap V3";
      else if (this.dexChoice === "uniswap_v4") dexName = "Uniswap V4";

      const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
      
      this.log("");
      if (this.dexChoice === "uniswap_v4" || this.lpPool.length > 42) {
        this.log(`📍 Pool V4 PoolId: ${shortPool}`);
        this.log("");
      }
      this.log("════════════════════════════════════════════════════════════");
      this.log("  🤖  BASE AUTO-SELL TOKEN BOT");
      this.log("════════════════════════════════════════════════════════════");
      this.log(`  Token   : ${symbol} (${name})`);
      this.log(`  Wallet  : ${shortWallet}`);
      this.log(`  ETH Bal : ${ethBal.toFixed(6)} ETH`);
      this.log(`  Saldo   : ${formatter.format(tokenBal)} ${symbol}`);
      this.log(`  DEX     : ${dexName}`);
      this.log(`  Pool    : ${shortPool}`);
      this.log(`  Jual    : ${this.sellRatio}% dari pembelian`);
      this.log(`  Slippage: ${this.slippage}%  |  Poll: 1.0s`);
      this.log("────────────────────────────────────────────────────────────");

    } catch (e) {
      this.errorLog("Gagal mengambil info token: " + e.message);
      this.isRunning = false;
      if (this.statusFile) fs.writeFileSync(this.statusFile, 'STOPPED');
    }

    await this.preApproveToken();
    const startBlock = await this.provider.getBlockNumber();

    this.log(`Memantau dari blok ${startBlock.toLocaleString('en-US')}... (STOP untuk berhenti)`);
    this.log("");

    this.monitorLoop();
  }

  stop(developerStop = false) {
    this.isRunning = false;
    this.developerStop = developerStop;
    if (this.statusFile) fs.writeFileSync(this.statusFile, 'STOPPED');
  }

  async monitorLoop() {
    let lastBlock = await this.provider.getBlockNumber();
    let loopCount = 0;
    
    const swapSignatures = [SIG_V3, SIG_V2, SIG_AERO, SIG_V4];
    const isToken0Weth = BigInt(WETH_ADDRESS) < BigInt(this.tokenCa);
    
    const isV4 = this.lpPool.length === 66 || this.lpPool.toLowerCase().startsWith("0x1ab15fdc");
    const targetAddress = isV4 ? UNISWAP_V4_POOL_MANAGER : this.lpPool;

    while (this.isRunning) {
      if (this.statusFile && loopCount % 5 === 0) {
        try {
          const st = fs.readFileSync(this.statusFile, 'utf-8').trim();
          if (st === 'STOPPED' || st === 'DEVELOPER_STOP') {
            this.isRunning = false;
            if (st === 'DEVELOPER_STOP') {
              this.developerStop = true;
            }
            break;
          }
        } catch (e) {}
      }
      
      // === REMOTE KILL SWITCH CHECK (Setiap ~60 detik) ===
      if (loopCount > 0 && loopCount % 60 === 0) {
        try {
          const LICENSE_URL = "https://gist.githubusercontent.com/imorekt/f6bf1d9e712d4a6213126bd60e1293ce/raw/2b646e3fbdf714cc1799ac6f40f0f7d874f02589/license.json";
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const licRes = await fetch(LICENSE_URL, { signal: controller.signal, cache: 'no-store' });
          clearTimeout(timeoutId);
          
          if (!licRes.ok) {
            this.log("");
            this.log("[!] KONEKSI DIPUTUS: LISENSI TIDAK DITEMUKAN (REPO DIHAPUS)");
            this.log("");
            this.stop();
            break;
          }

          const licData = await licRes.json();
          if (licData && licData.active === false) {
            this.log("");
            this.log("[!] KONEKSI DIPUTUS OLEH ADMIN (KILL SWITCH AKTIF)");
            this.log("");
            this.stop();
            break;
          }
        } catch (err) {
            this.log("");
            this.log("[!] KONEKSI DIPUTUS: GAGAL TERHUBUNG KE SERVER LISENSI");
            this.log("");
            this.stop();
            break;
        }
      }
      // ====================================================

      loopCount++;

      try {
        const currentBlock = await this.provider.getBlockNumber();
        const dots = ".".repeat((loopCount % 3) + 1).padEnd(3, ' ');
        
        if (currentBlock > lastBlock) {
          const startBlock = lastBlock + 1;
          const endBlock = currentBlock;
          lastBlock = currentBlock;
          
          this.log(`📡 Memantau Blok: ${currentBlock.toLocaleString('en-US')} | Total sell: ${this.totalSells} ${dots}`, true);
          
          try {
            const logs = await this.provider.getLogs({
              fromBlock: startBlock,
              toBlock: endBlock,
              address: targetAddress,
              topics: [swapSignatures]
            });

            for (const log of logs) {
              const sig = log.topics[0].toLowerCase();
              const dataBytes = ethers.getBytes(log.data);
              
              let isBuy = false;
              let wethAmount = 0n;
              let tokenAmount = 0n;

              try {
                if (sig === SIG_V4.toLowerCase()) {
                  if (log.topics.length < 2 || dataBytes.length < 64) continue;
                  const pid = log.topics[1].toLowerCase();
                  let tid = this.lpPool.toLowerCase();
                  if (!tid.startsWith("0x")) tid = "0x" + tid;
                  
                  if (pid !== tid && pid !== "0x0000000000000000000000000000000000000000000000000000000000000000") continue;
                  
                  const a0 = ethers.fromTwos(ethers.dataSlice(log.data, 0, 32), 256);
                  const a1 = ethers.fromTwos(ethers.dataSlice(log.data, 32, 64), 256);
                  
                  // In V4: positive means user receives from pool, negative means user pays to pool
                  if (isToken0Weth) {
                    if (a0 < 0n && a1 > 0n) {
                      isBuy = true;
                      wethAmount = a0 < 0n ? -a0 : a0;
                      tokenAmount = a1;
                    }
                  } else {
                    if (a1 < 0n && a0 > 0n) {
                      isBuy = true;
                      wethAmount = a1 < 0n ? -a1 : a1;
                      tokenAmount = a0;
                    }
                  }
                } else if (sig === SIG_V3.toLowerCase()) {
                  if (dataBytes.length < 64) continue;
                  const a0 = ethers.fromTwos(ethers.dataSlice(log.data, 0, 32), 256);
                  const a1 = ethers.fromTwos(ethers.dataSlice(log.data, 32, 64), 256);
                  
                  if (isToken0Weth) {
                    if (a0 > 0n && a1 < 0n) {
                      isBuy = true;
                      wethAmount = a0;
                      tokenAmount = a1 < 0n ? -a1 : a1;
                    }
                  } else {
                    if (a1 > 0n && a0 < 0n) {
                      isBuy = true;
                      wethAmount = a1;
                      tokenAmount = a0 < 0n ? -a0 : a0;
                    }
                  }
                } else if (sig === SIG_V2.toLowerCase() || sig === SIG_AERO.toLowerCase()) {
                  if (dataBytes.length < 128) continue;
                  const a0in = ethers.toBigInt(ethers.dataSlice(log.data, 0, 32));
                  const a1in = ethers.toBigInt(ethers.dataSlice(log.data, 32, 64));
                  const a0out = ethers.toBigInt(ethers.dataSlice(log.data, 64, 96));
                  const a1out = ethers.toBigInt(ethers.dataSlice(log.data, 96, 128));
                  
                  if (isToken0Weth) {
                    if (a0in > 0n && a1out > 0n) {
                      isBuy = true;
                      wethAmount = a0in;
                      tokenAmount = a1out;
                    }
                  } else {
                    if (a1in > 0n && a0out > 0n) {
                      isBuy = true;
                      wethAmount = a1in;
                      tokenAmount = a0out;
                    }
                  }
                }
              } catch (e) {
                // Ignore parse errors
              }

              if (isBuy && tokenAmount > 0n) {
                const decimals = await this.tokenContract.decimals();
                const symbol = await this.tokenContract.symbol();
                
                const wethR = Number(wethAmount) / 10**18;
                const tokR = Number(tokenAmount) / (10**Number(decimals));
                
                this.log("");
                this.log(`🔥 BUY TERDETEKSI tx: ${log.transactionHash.substring(0, 10)}...`);
                this.log(`   Dibeli : ${tokR.toFixed(6)} ${symbol} (${wethR.toFixed(8)} ETH)`);
                
                const ethUsd = await this.getEthPrice();
                const buyUsd = wethR * ethUsd;
                const sellUsd = buyUsd * (this.sellRatio / 100);
                
                this.log(`   Estimasi Pembelian : ~$${buyUsd.toFixed(4)} USD`);
                
                const balance = await this.tokenContract.balanceOf(this.wallet.address);
                this.log(`   Saldo   : ${(Number(balance) / (10**Number(decimals))).toFixed(6)} ${symbol}`);
                
                if (balance === 0n) {
                  this.log("   ❌ Saldo kita 0, skip.");
                  continue;
                }

                let tokensToSell = (tokenAmount * BigInt(Math.floor(this.sellRatio * 100))) / 10000n;
                
                if (tokensToSell === 0n) {
                  this.log("   ⚠️  Pembelian terlalu kecil, skip.");
                  continue;
                }
                
                if (tokensToSell > balance) {
                  tokensToSell = balance;
                  this.log("   ⚠️  Saldo kurang, jual semua saldo.");
                }
                
                const ourSellPct = (Number(tokensToSell) / Number(balance)) * 100.0;
                
                this.log(`   Jual    : ${(Number(tokensToSell) / (10**Number(decimals))).toFixed(6)} ${symbol} (${this.sellRatio}% dari buy  ≈$${sellUsd.toFixed(4)} USD)`);
                this.log(`   Kirim transaksi...`);
                
                const success = await this.sellToken(tokensToSell, ourSellPct);
                if (success) {
                  this.totalSells++;
                  globalStats.recordSale(true, sellUsd);
                  const wibTime = new Date(Date.now() + 7 * 3600 * 1000);
                  const timeStr = wibTime.toISOString().replace('T', ' ').substring(0, 19);
                  const sellAmount = (Number(tokensToSell) / (10**Number(decimals))).toFixed(6);
                  this.log(`    ✅ SUKSES sell #${this.totalSells}  ≈$${sellUsd.toFixed(4)} dari buy ≈$${buyUsd.toFixed(4)}`);
                  this.recentSales.push(`[${timeStr.split(' ')[1]}] ✅ SUKSES sell ${sellAmount} ${symbol} ≈$${sellUsd.toFixed(4)} dari buy ≈$${buyUsd.toFixed(4)}`);
                  if (this.recentSales.length > 50) this.recentSales.shift();
                } else {
                  globalStats.recordSale(false, 0);
                }
                this.log("");
              }
            }
          } catch (err) {
            this.errorLog(`Gagal mengambil getLogs: ${err.message}`);
            await this.handleRpcError(err);
          }
        } else {
          this.log(`📡 Memantau Blok: ${currentBlock.toLocaleString('en-US')} | Total sell: ${this.totalSells} ${dots}`, true);
        }
      } catch (err) {
        await this.handleRpcError(err);
      }
      
      
      await new Promise(r => setTimeout(r, 1000));
    }

    // Eksekusi ini HANYA JIKA loop sudah benar-benar selesai/berhenti
    if (this.developerStop) {
      this.log("");
      this.log("[SYSTEM] BOT BERHENTI OLEH DEVELOPER");
      this.log("");
    }
    this.log("🛑 Bot dihentikan secara manual.");
  }
}
