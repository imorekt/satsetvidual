import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const body = await request.json();
    const { network, name, symbol, privateKey, supply } = body;

    if (!network || !name || !symbol) {
      return NextResponse.json({ success: false, error: "Network, Name, dan Symbol wajib diisi" }, { status: 400 });
    }

    if (privateKey) {
      try {
        fs.writeFileSync('D:\\SEMUABOT\\deploy\\privatekey.txt', privateKey, 'utf8');
      } catch (err) {
        // Abaikan jika folder tidak ada
      }
    }

    const rpcUrl = network === 'BASE' ? 'https://mainnet.base.org' : 'https://rpc.mainnet.chain.robinhood.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    let wallet;
    try {
      wallet = new ethers.Wallet(privateKey, provider);
    } catch (err) {
      return NextResponse.json({ success: false, error: "Private Key tidak valid" }, { status: 400 });
    }

    const tokenDataPath = path.join(process.cwd(), 'src', 'app', 'api', 'deploy', 'TokenData.json');
    let tokenData;
    try {
      tokenData = JSON.parse(fs.readFileSync(tokenDataPath, 'utf8'));
    } catch (err) {
      return NextResponse.json({ success: false, error: "Gagal membaca TokenData.json" }, { status: 500 });
    }

    const factory = new ethers.ContractFactory(tokenData.abi, tokenData.bytecode, wallet);
    const feeData = await provider.getFeeData();

    // Gunakan supply dari input user, jika kosong gunakan default 1,000,000,000
    const initialSupply = supply ? parseInt(supply) : 1000000000;
    
    const deployTx = await factory.deploy(
      name, symbol, initialSupply, "", "", "", "", "",
      {
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas > 0n ? feeData.maxPriorityFeePerGas : undefined
      }
    );

    const contract = await deployTx.waitForDeployment();
    const contractAddress = await contract.getAddress();
    
    // Ambil hash transaksi dari objek Contract (Ethers v6)
    const txHash = contract.deploymentTransaction().hash;

    const explorerUrl = network === 'BASE' 
      ? `https://basescan.org/tx/${txHash}`
      : `https://explorer.mainnet.chain.robinhood.com/tx/${txHash}`;

    let stdoutData = `[*] Mendeploy Token ${name} (${symbol}) ke jaringan ${network}...\n`;
    stdoutData += `[*] Tx Terkirim: ${txHash}\n`;
    stdoutData += `    (Menunggu konfirmasi block...)\n`;
    stdoutData += `[+] SUKSES! Token Contract Address: ${contractAddress}\n`;
    stdoutData += `[+] Link Explorer: ${explorerUrl}`;

    return NextResponse.json({
      success: true,
      stdout: stdoutData,
      contractAddress: contractAddress
    });

  } catch (error) {
    console.error("[API] Error saat deploy:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Kesalahan saat memproses deploy.",
      details: error.message || String(error)
    }, { status: 500 });
  }
}
