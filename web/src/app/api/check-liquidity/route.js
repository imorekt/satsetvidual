import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const RPC_CONFIG = {
  BASE: "https://mainnet.base.org",
  ROBINHOOD: "https://rpc.mainnet.chain.robinhood.com"
};

const POSITION_MANAGER_BASE = "0x7C5f5A4bBd8fD63184577525326123B519429bDc"; // V4 Position Manager
const POSITION_MANAGER_ROBINHOOD = "0x58daec3116aae6D93017bAAea7749052E8a04fA7";

export async function POST(request) {
  try {
    const { network, walletAddress } = await request.json();

    if (!network || !walletAddress) {
      return NextResponse.json({ success: false, error: 'Missing network or wallet' });
    }

    const rpcUrl = RPC_CONFIG[network];
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const positionManagerAddress = network === 'BASE' ? POSITION_MANAGER_BASE : POSITION_MANAGER_ROBINHOOD;
    
    // ABI for balanceOf
    const erc721Abi = ["function balanceOf(address owner) view returns (uint256)"];
    const positionContract = new ethers.Contract(positionManagerAddress, erc721Abi, provider);

    const balance = await positionContract.balanceOf(walletAddress);
    
    if (balance > 0n) {
      return NextResponse.json({ success: true, balance: balance.toString() });
    } else {
      return NextResponse.json({ success: false });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
