import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const RPC_CONFIG = {
  BASE: "https://mainnet.base.org",
  ROBINHOOD: "https://rpc.mainnet.chain.robinhood.com"
};

const HOOKS = "0x0000000000000000000000000000000000000000";
const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";

// Router Uniswap V4 yang benar (Universal Router Base)
const ROUTER_BASE = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";
const ROUTER_ROBINHOOD = "0x8876789976dEcBfCbBbe364623C63652db8C0904";

export async function POST(request) {
  let stdoutData = "";
  try {
    const { network, privateKey, tokenAddress } = await request.json();

    if (!network || !privateKey || !tokenAddress) {
      return NextResponse.json({ success: false, error: 'Data tidak lengkap' }, { status: 400 });
    }

    const rpcUrl = RPC_CONFIG[network];
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const currency1 = ethers.getAddress(tokenAddress);
    
    // Fee dan TickSpacing harus cocok dengan pool yang dibuat oleh Add LP
    const fee = network === 'BASE' ? 2500 : 100;
    const tickSpacing = network === 'BASE' ? 50 : 1;

    let ethPrice = 2500;
    try {
      const pRes = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT");
      const pData = await pRes.json();
      if (pData.price) ethPrice = parseFloat(pData.price);
    } catch (e) {}

    const ethAmount = (0.3 / ethPrice).toFixed(18);
    stdoutData += `\n    [*] Memulai Eksekusi Auto-Buy $0.3 (${ethAmount} ETH)...\n`;
    
    const routerAddress = network === 'BASE' 
      ? ROUTER_BASE
      : ROUTER_ROBINHOOD;
      
    const amountIn = ethers.parseEther(ethAmount);

    // ========================================================
    // Build V4 payload
    // SWAP_EXACT_IN (0x07) + SETTLE_ALL (0x0b) + TAKE_ALL (0x0e)
    // ========================================================

    // -- param[0]: SWAP_EXACT_IN --
    const p0_buy = coder.encode(
      [
        "address",                                              // currencyIn
        "tuple(address,uint24,int24,address,bytes)[]",         // path (PathKey[])
        "uint256[]",                                           // minHopPriceX36 (UR V2.1.1+)
        "uint128",                                             // amountIn
        "uint128"                                              // amountOutMinimum
      ],
      [
        ETH_ADDRESS,                                           // currencyIn = native ETH
        [[currency1, fee, tickSpacing, HOOKS, "0x"]],          // path[0] = PathKey to token
        [],                                                    // minHopPriceX36 = empty array
        amountIn,                                              // amountIn
        0n                                                     // amountOutMinimum = 0
      ]
    );

    // -- param[1]: SETTLE_ALL (0x0c) --
    // address currency, uint256 maxAmount
    const p1_buy = coder.encode(
      ["address", "uint256"],
      [ETH_ADDRESS, ethers.MaxUint256]
    );

    // -- param[2]: TAKE_ALL (0x0f) --
    // address currency, uint256 minAmount
    const p2_buy = coder.encode(
      ["address", "uint256"],
      [currency1, 0n]
    );

    const actions = "0x070c0f"; // SWAP_EXACT_IN (0x07) + SETTLE_ALL (0x0c) + TAKE_ALL (0x0f)
    const v4Input = coder.encode(["bytes", "bytes[]"], [actions, [p0_buy, p1_buy, p2_buy]]);
    
    const commands = "0x10"; // V4_SWAP
    const deadline_buy = Math.floor(Date.now() / 1000) + 600;
    
    const payload_buy = coder.encode(["bytes", "bytes[]", "uint256"], [commands, [v4Input], deadline_buy]);
    const data_buy = "0x3593564c" + payload_buy.substring(2);

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice 
      ? (feeData.gasPrice * 120n) / 100n 
      : ethers.parseUnits("0.01", "gwei");

    let txBuy = await wallet.sendTransaction({
      to: routerAddress,
      data: data_buy,
      value: amountIn,
      gasLimit: 800000n,
      gasPrice: gasPrice
    });
    
    const buyExplorerUrl = network === 'BASE' 
      ? `https://basescan.org/tx/${txBuy.hash}`
      : `https://explorer.mainnet.chain.robinhood.com/tx/${txBuy.hash}`;
      
    stdoutData += `    [*] Tx Beli Terkirim: ${buyExplorerUrl}\n`;
    await txBuy.wait();
    stdoutData += "    [+] Auto-Buy SUKSES!\n";
    stdoutData += "    [+] Token Aktif silahkan cek Menu Screener V2 ✔\n";

    return NextResponse.json({ success: true, stdout: stdoutData });

  } catch (error) {
    stdoutData += `    [-] Auto-Buy Gagal: ${error.message}\n`;
    return NextResponse.json({ success: false, stdout: stdoutData, error: error.message }, { status: 500 });
  }
}
