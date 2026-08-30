import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)"
];

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ca = searchParams.get('ca');
    const rpcParam = searchParams.get('rpc') || 'https://mainnet.base.org';
    
    if (!ca || ca.length !== 42 || !ca.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid CA' }, { status: 400 });
    }

    const rpcs = rpcParam.split(',').map(url => url.trim()).filter(url => url.length > 0);

    for (let i = 0; i < rpcs.length; i++) {
      try {
        const fetchReq = new ethers.FetchRequest(rpcs[i]);
        fetchReq.retryCount = 0;
        const provider = new ethers.JsonRpcProvider(fetchReq, 8453, { staticNetwork: true });
        const contract = new ethers.Contract(ca, ERC20_ABI, provider);

        const [name, symbol] = await Promise.all([
          contract.name(),
          contract.symbol()
        ]);
        
        return NextResponse.json({ name, symbol });
      } catch (e) {
        console.error(`Failed to fetch from ${rpcs[i]}:`, e.message);
        // Continue to the next RPC if this one failed
      }
    }
    
    return NextResponse.json({ name: 'Unknown', symbol: 'Unknown' });
  } catch (error) {
    console.error('Error fetching token info:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
