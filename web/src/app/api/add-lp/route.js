import { ethers } from 'ethers';
import fs from 'fs';

// Constants V4
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const ETH = "0x0000000000000000000000000000000000000000";
const HOOKS = "0x0000000000000000000000000000000000000000";

// V4 Math
function getSqrtPriceX96(ethPerToken) {
    const p = 1.0 / ethPerToken;
    const val = Math.sqrt(p) * Math.pow(2, 96);
    return BigInt(Math.trunc(val));
}

function getTickAtPrice(ethPerToken) {
    const p = 1.0 / ethPerToken;
    return Math.trunc(Math.log(p) / Math.log(1.0001));
}

function snapToSpacing(tick, spacing) {
    const maxValid = Math.floor(887272 / spacing) * spacing;
    tick = Math.max(-maxValid, Math.min(maxValid, tick));
    return Math.round(tick / spacing) * spacing;
}

function snapToSpacingFloor(tick, spacing) {
    const maxValid = Math.floor(887272 / spacing) * spacing;
    tick = Math.max(-maxValid, Math.min(maxValid, tick));
    return Math.floor(tick / spacing) * spacing;
}

function getSqrtAtTick(tick) {
    const val = Math.sqrt(Math.pow(1.0001, tick)) * Math.pow(2, 96);
    return BigInt(Math.trunc(val));
}

export async function POST(request) {
  const body = await request.json();
  const { network, tokenAddress, privateKey, tokenAmount, initialPrice } = body;

  // Setup SSE stream
  const encoder = new TextEncoder();
  let controllerRef = null;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
    }
  });

  const send = (msg) => {
    if (controllerRef) {
      controllerRef.enqueue(encoder.encode(`data: ${JSON.stringify({ log: msg })}\n\n`));
    }
  };

  const finish = (payload) => {
    if (controllerRef) {
      controllerRef.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, ...payload })}\n\n`));
      controllerRef.close();
    }
  };

  // Run async process in background (non-blocking so SSE starts immediately)
  (async () => {
    try {
      if (!tokenAddress) {
        finish({ success: false, error: "Token Contract Address wajib diisi" });
        return;
      }

      if (privateKey) {
        try { fs.writeFileSync('D:\\SEMUABOT\\deploy\\privatekey.txt', privateKey, 'utf8'); } catch (err) {}
      }

      const rpcUrl = network === 'BASE' ? 'https://mainnet.base.org' : 'https://rpc.mainnet.chain.robinhood.com';

      const POSITION_MANAGER = network === 'BASE'
        ? "0x7C5f5A4bBd8fD63184577525326123B519429bDc"
        : "0x58daec3116aae6D93017bAAea7749052E8a04fA7";

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const FEE_TIER = network === 'BASE' ? 2500 : 100;
      const TICK_SPACING = network === 'BASE' ? 50 : 1;

      let wallet;
      try {
        wallet = new ethers.Wallet(privateKey, provider);
      } catch (err) {
        finish({ success: false, error: "Private Key tidak valid" });
        return;
      }

      const amountTokenStr = tokenAmount || "750000000";
      const amountTokenWei = ethers.parseUnits(amountTokenStr, 18);
      const initialPriceEth = parseFloat(initialPrice || "0.000000004");

      const currency0 = ETH;
      const currency1 = ethers.getAddress(tokenAddress);

      const poolKey = [currency0, currency1, FEE_TIER, TICK_SPACING, HOOKS];

      const currentTick = getTickAtPrice(initialPriceEth);
      const tickLower = snapToSpacing(-887272, TICK_SPACING);
      const tickUpper = snapToSpacingFloor(currentTick, TICK_SPACING);

      const sqrtLower = getSqrtAtTick(tickLower);
      const sqrtUpper = getSqrtAtTick(tickUpper);

      const liquidity = (amountTokenWei * (2n ** 96n)) / (sqrtUpper - sqrtLower);

      const amount0Max = 0n;
      const amount1Max = 1000000000n * (10n ** 18n);

      const sqrtPriceX96 = getSqrtPriceX96(initialPriceEth);

      const coder = ethers.AbiCoder.defaultAbiCoder();
      const poolKeyType = 'tuple(address,address,uint24,int24,address)';

      const p0 = coder.encode(
        [poolKeyType, 'int24', 'int24', 'uint256', 'uint128', 'uint128', 'address', 'bytes'],
        [poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, wallet.address, "0x"]
      );
      const p1 = coder.encode(['address', 'address'], [currency1, currency0]);
      const p2 = coder.encode(['address', 'address'], [currency1, wallet.address]);
      const p3 = coder.encode(['address', 'address'], [currency0, wallet.address]);
      const p4 = coder.encode(['address', 'address'], [ETH, wallet.address]);

      const actions = new Uint8Array([0x02, 0x0d, 0x14, 0x14, 0x14]);
      const unlockData = coder.encode(['bytes', 'bytes[]'], [actions, [p0, p1, p2, p3, p4]]);
      const deadline = Math.floor(Date.now() / 1000) + 1200;

      const initData = ethers.concat([
        "0xf7020405",
        coder.encode([poolKeyType, 'uint160'], [poolKey, sqrtPriceX96])
      ]);

      const modifyData = ethers.concat([
        "0xdd46508f",
        coder.encode(['bytes', 'uint256'], [unlockData, deadline])
      ]);

      const erc20Abi = ["function approve(address spender, uint256 amount) returns (bool)"];
      const tokenContract = new ethers.Contract(currency1, erc20Abi, wallet);

      const permit2Abi = ["function approve(address token, address spender, uint160 amount, uint48 expiration)"];
      const permit2Contract = new ethers.Contract(PERMIT2, permit2Abi, wallet);

      const managerAbi = ["function multicall(bytes[] data) payable returns (bytes[])"];
      const managerContract = new ethers.Contract(POSITION_MANAGER, managerAbi, wallet);

      const feeData = await provider.getFeeData();
      const maxFeePerGas = feeData.maxFeePerGas ? (feeData.maxFeePerGas * 120n) / 100n : undefined;
      const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas > 0n)
        ? (feeData.maxPriorityFeePerGas * 120n) / 100n
        : undefined;

      const txConfig = { maxFeePerGas, maxPriorityFeePerGas };

      send(`[*] Memulai Add LP di ${network} untuk CA: ${tokenAddress}`);

      // 1a. Approve
      send("    [1/3] Approve Token ke Permit2...");
      let tx1 = await tokenContract.approve(PERMIT2, ethers.MaxUint256, txConfig);
      await tx1.wait();
      send("    [+] Approve Permit2 Sukses.");

      // 1b. Permit2 Manager
      send("    [2/3] Approve Permit2 -> PositionManager...");
      let tx2 = await permit2Contract.approve(
        currency1, POSITION_MANAGER, (1n << 160n) - 1n, Math.floor(Date.now()/1000) + 86400*30,
        txConfig
      );
      await tx2.wait(network === 'BASE' ? 2 : 1);

      send("    [+] Menunggu sinkronisasi RPC (4 detik)...");
      await new Promise(r => setTimeout(r, 4000));

      send("    [+] Permit2-Manager Approve Sukses.");

      // 2. Multicall
      send("    [3/3] Mengirim Multicall Add LP...");

      let poolInitialized = false;
      try {
        await managerContract.multicall.staticCall([initData]);
      } catch(e) {
        if (e.message.includes('0x3b99b53d') || e.message.includes('AlreadyInitialized')) {
          poolInitialized = true;
          send("    [~] Pool sudah ada, skip initializePool.");
        }
      }

      const calls = poolInitialized ? [modifyData] : [initData, modifyData];

      let estimatedGas;
      try {
        estimatedGas = await managerContract.multicall.estimateGas(calls, { value: 0 });
        estimatedGas = (estimatedGas * 120n) / 100n;
      } catch(e) {
        throw new Error("Simulasi Add LP Gagal (Revert). Cek Parameter! Error: " + (e.data || e.message || e.toString()));
      }

      let tx3 = await managerContract.multicall(calls, {
        ...txConfig,
        gasLimit: estimatedGas,
        value: 0
      });

      send(`    [*] Tx Terkirim: ${tx3.hash}`);
      await tx3.wait();
      send("    [+] SUKSES! Add LP berhasil!");

      const explorerUrl = network === 'BASE'
        ? `https://basescan.org/tx/${tx3.hash}`
        : `https://explorer.mainnet.chain.robinhood.com/tx/${tx3.hash}`;
      send(`    [+] Link Explorer: ${explorerUrl}`);

      let poolUrl = '';
      try {
        const poolKeyEncoded = coder.encode([poolKeyType], [poolKey]);
        const poolId = ethers.keccak256(poolKeyEncoded);
        poolUrl = network === 'BASE'
          ? `https://app.uniswap.org/explore/pools/base/${poolId}`
          : `https://app.uniswap.org/explore/pools/robinhood/${poolId}`;
        send(`    [+] Link Pool: ${poolUrl}`);
      } catch (err) {}

      finish({ success: true, txHash: tx3.hash, poolUrl });

    } catch (e) {
      const errorMessage = typeof e.message === 'string' ? e.message : e.toString();
      finish({ success: false, error: errorMessage });
    }
  })();

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
