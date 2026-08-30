// Blockchain Utility for fetching balances via Public RPCs
// Using native fetch to avoid heavy library dependencies on the client side

const RPC_URLS = {
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
  sei: 'https://evm.sei-apis.com',
  solana: 'https://api.mainnet-beta.solana.com',
  sui: 'https://fullnode.mainnet.sui.io:443',
  robinhood: 'https://rpc.mainnet.chain.robinhood.com'
};

const TOKENS = {
  ethereum: {
    native: { symbol: 'ETH', name: 'Ethereum', icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
    erc20: [
      { address: '0x6982508145454ce325ddbe47a25d4ec3d2311933', symbol: 'PEPE', name: 'Pepe', decimals: 18, icon: 'https://cryptologos.cc/logos/pepe-pepe-logo.png' }
    ]
  },
  base: {
    native: { symbol: 'ETH', name: 'Base ETH', icon: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png' },
    erc20: [
      { address: '0x4ed4E862860bef6f78e4125b2f216260ab99f438', symbol: 'DEGEN', name: 'Degen', decimals: 18, icon: 'https://assets.coingecko.com/coins/images/34515/standard/degen-logo.png' }
    ]
  },
  sei: {
    native: { symbol: 'SEI', name: 'Sei', icon: 'https://cryptologos.cc/logos/sei-sei-logo.png' },
    erc20: []
  },
  solana: {
    native: { symbol: 'SOL', name: 'Solana', icon: 'https://cryptologos.cc/logos/solana-sol-logo.png' }
  },
  sui: {
    native: { symbol: 'SUI', name: 'Sui', icon: 'https://cryptologos.cc/logos/sui-sui-logo.png' }
  },
  robinhood: {
    native: { symbol: 'ETH', name: 'Robinhood ETH', icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
    erc20: []
  }
};

const chainIcons = {
  ethereum: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
  base: 'https://avatars.githubusercontent.com/u/108554348?s=200&v=4',
  sei: 'https://cryptologos.cc/logos/sei-sei-logo.png',
  solana: 'https://cryptologos.cc/logos/solana-sol-logo.png',
  sui: 'https://cryptologos.cc/logos/sui-sui-logo.png',
  robinhood: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Robinhood_Logo.svg/1024px-Robinhood_Logo.svg.png'
};

// Generic JSON-RPC POST
async function rpcCall(url, method, params = []) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const data = await res.json();
    return data.result;
  } catch (e) {
    console.error(`RPC Call failed for ${url} / ${method}`, e);
    return null;
  }
}

// EVM Fetcher
async function fetchEvmBalances(walletAddress, chainId) {
  const url = RPC_URLS[chainId];
  const balances = [];
  
  // Fetch native balance
  const nativeHex = await rpcCall(url, 'eth_getBalance', [walletAddress, 'latest']);
  if (nativeHex && nativeHex !== '0x') {
    const amount = parseInt(nativeHex, 16) / 1e18;
    if (amount > 0) {
      balances.push({
        id: `${chainId}-native`,
        symbol: TOKENS[chainId].native.symbol,
        name: TOKENS[chainId].native.name,
        amount,
        chainId,
        icon: TOKENS[chainId].native.icon,
        chainIcon: chainIcons[chainId]
      });
    }
  }

  // Fetch ERC20 balances
  for (const token of TOKENS[chainId].erc20) {
    // balanceOf(address) signature is 0x70a08231 + pad(address)
    const data = '0x70a08231' + walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const tokenHex = await rpcCall(url, 'eth_call', [{ to: token.address, data }, 'latest']);
    if (tokenHex && tokenHex !== '0x') {
      const amount = parseInt(tokenHex, 16) / Math.pow(10, token.decimals);
      if (amount > 0) {
        balances.push({
          id: `${chainId}-${token.symbol.toLowerCase()}`,
          symbol: token.symbol,
          name: token.name,
          amount,
          chainId,
          icon: token.icon,
          chainIcon: chainIcons[chainId]
        });
      }
    }
  }

  return balances;
}

// Solana Fetcher
async function fetchSolanaBalances(walletAddress) {
  const url = RPC_URLS.solana;
  const balances = [];
  
  const result = await rpcCall(url, 'getBalance', [walletAddress]);
  if (result && result.value > 0) {
    balances.push({
      id: `solana-native`,
      symbol: TOKENS.solana.native.symbol,
      name: TOKENS.solana.native.name,
      amount: result.value / 1e9,
      chainId: 'solana',
      icon: TOKENS.solana.native.icon,
      chainIcon: chainIcons.solana
    });
  }

  return balances;
}

// Sui Fetcher
async function fetchSuiBalances(walletAddress) {
  const url = RPC_URLS.sui;
  const balances = [];
  
  const result = await rpcCall(url, 'suix_getAllBalances', [walletAddress]);
  if (result && Array.isArray(result)) {
    for (const b of result) {
      if (b.coinType === '0x2::sui::SUI' && parseInt(b.totalBalance) > 0) {
        balances.push({
          id: `sui-native`,
          symbol: TOKENS.sui.native.symbol,
          name: TOKENS.sui.native.name,
          amount: parseInt(b.totalBalance) / 1e9,
          chainId: 'sui',
          icon: TOKENS.sui.native.icon,
          chainIcon: chainIcons.sui
        });
      }
    }
  }

  return balances;
}

// Main fetcher function
export async function fetchWalletBalances(address) {
  const isEvm = address.startsWith('0x') && address.length === 42;
  const isSui = address.startsWith('0x') && (address.length === 66 || address.length === 64);
  const isSolana = !address.startsWith('0x') && address.length >= 32 && address.length <= 44;

  let results = [];

  if (isEvm) {
    const [eth, base, sei, robinhood] = await Promise.all([
      fetchEvmBalances(address, 'ethereum'),
      fetchEvmBalances(address, 'base'),
      fetchEvmBalances(address, 'sei'),
      fetchEvmBalances(address, 'robinhood')
    ]);
    results = [...eth, ...base, ...sei, ...robinhood];
  } else if (isSui) {
    results = await fetchSuiBalances(address);
  } else if (isSolana) {
    results = await fetchSolanaBalances(address);
  }

  return results;
}

export async function fetchTokenPrices() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,solana,sui,sei-network,pepe,degen-base&vs_currencies=usd');
    const data = await res.json();
    return {
      ETH: data.ethereum?.usd || 0,
      SOL: data.solana?.usd || 0,
      SUI: data.sui?.usd || 0,
      SEI: data['sei-network']?.usd || 0,
      PEPE: data.pepe?.usd || 0,
      DEGEN: data['degen-base']?.usd || 0
    };
  } catch (e) {
    console.error('Error fetching prices from CoinGecko', e);
    // Fallback prices in case of rate limit
    return {
      ETH: 2600, SOL: 140, SUI: 0.8, SEI: 0.3, PEPE: 0.000008, DEGEN: 0.01
    };
  }
}
