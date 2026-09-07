export const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
export const AERODROME_FACTORY_ADDRESS = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da";
export const UNISWAP_V3_FACTORY_ADDRESS = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
export const UNISWAP_V2_FACTORY_ADDRESS = "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6";

export const DEX_CONFIG = {
  aerodrome: {
    name: "Aerodrome V2",
    router: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
    factory: AERODROME_FACTORY_ADDRESS
  },
  uniswap_v3: {
    name: "Uniswap V3",
    router: "0x2626664c2603336E57B271c5C0b26F421741e481",
    factory: UNISWAP_V3_FACTORY_ADDRESS
  },
  uniswap_v2: {
    name: "SushiSwap / Uniswap V2 Clone (Base)",
    router: "0x6BDDef4241De2659c4900f224e76a5c2f9011eFa",
    factory: UNISWAP_V2_FACTORY_ADDRESS
  },
  uniswap_v4: {
    name: "Uniswap V4",
    router: "0xFdf682F51FE81Aa4898F0AE2163d8A55c127fbC7", // Official Base Uniswap V4 Universal Router
    factory: "0x498581fF718922c3f8e6A244956aF099B2652b2b" // PoolManager
  }
};

export const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, bool stable) view returns (address pool)"
];

export const UNISWAP_V3_FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)"
];

export const UNISWAP_V2_FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)"
];

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

export const AERODROME_ROUTER_ABI = [
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, tuple(address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) returns (uint256[] amounts)",
  "function getAmountsOut(uint256 amountIn, tuple(address from, address to, bool stable, address factory)[] routes) view returns (uint256[] amounts)"
];

export const UNISWAP_V3_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)"
];

export const UNISWAP_V2_ROUTER_ABI = [
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)",
  "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)"
];

export const SIG_V3   = "0xc42079f94a6350d7e6230537752229158a419725d8434caefa575191e70c2d45";
export const SIG_V2   = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130140159d82c";
export const SIG_AERO = "0xb3e2773606ab6c0e55790051613b32f1d2850a1b8d5a1085002df3570690029b";
export const SIG_V4   = "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f";

export const UNISWAP_V4_POOL_MANAGER = "0x498581fF718922c3f8e6A244956aF099B2652b2b";
