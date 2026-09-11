import dotenv from 'dotenv';
import path from 'path';

// Load .env file from root directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseNumber(envVal: string | undefined, defaultVal: number): number {
  if (!envVal) return defaultVal;
  const parsed = parseFloat(envVal);
  return isNaN(parsed) ? defaultVal : parsed;
}

function parseBoolean(envVal: string | undefined, defaultVal: boolean): boolean {
  if (!envVal) return defaultVal;
  return envVal.toLowerCase() === 'true' || envVal === '1';
}

export interface BotConfig {
  rpcUrl: string;
  wsUrl: string;
  pumpfunWsUrl: string;
  privateKey: string;
  dryRunMode: boolean;
  buyAmountSol: number;
  slippageBps: number;
  priorityFeeMicroLamports: number;
  jitoEngineUrl: string;
  jitoTipSol: number;
  minNarrativeScore: number;
  minHoldersCount: number;
  maxTokenAgeSeconds: number;
  maxDevHoldingPercent: number;
  maxTop5HoldingPercent: number;
  maxTop10HoldingPercent: number;
  minLpLockedPercent: number;
  trackerIntervalMs: number;
  whaleSupplyPercentThreshold: number;
  maxOpenPositions: number;
  takeProfitMultiplier: number;
  stopLossPercent: number;
  simulateEventsIfIdle: boolean;
  simulatedInitialSol: number;
  paperWalletGasFeeSol: number;
  autoStartScanning: boolean;
  port: number;
  webhookUrl: string;
  aiBaseUrl: string;
  agent1ActiveOption: string;
  agent1Model: string;
  agent1ApiKey: string;
  agent1OpenRouterModel: string;
  agent1OpenRouterApiKey: string;
  openRouterBaseUrl: string;
  agent2ActiveOption: string;
  agent2Model: string;
  agent2ApiKey: string;
  agent2OpenRouterModel: string;
  agent2OpenRouterApiKey: string;
  agent3Model: string;
  agent3ApiKey: string;
  agent4Model: string;
  agent4ApiKey: string;
  agent5Model: string;
  agent5ApiKey: string;
  agent6Model: string;
  agent6ApiKey: string;
}

export const config: BotConfig = {
  rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
  wsUrl: process.env.WS_URL || 'wss://api.mainnet-beta.solana.com',
  pumpfunWsUrl: process.env.PUMPFUN_WS_URL || 'wss://pumpportal.fun/api/data',
  privateKey: process.env.PRIVATE_KEY || '',
  dryRunMode: parseBoolean(process.env.DRY_RUN_MODE, true),
  buyAmountSol: parseNumber(process.env.BUY_AMOUNT_SOL, 0.10),
  slippageBps: parseNumber(process.env.SLIPPAGE_BPS, 300),
  priorityFeeMicroLamports: parseNumber(process.env.PRIORITY_FEE_MICROLAMPORTS, 100000),
  jitoEngineUrl: process.env.JITO_ENGINE_URL || 'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
  jitoTipSol: parseNumber(process.env.JITO_TIP_SOL, 0.001),
  minNarrativeScore: parseNumber(process.env.MIN_NARRATIVE_SCORE, 0.50),
  minHoldersCount: parseNumber(process.env.MIN_HOLDERS_COUNT, 30),
  maxTokenAgeSeconds: parseNumber(process.env.MAX_TOKEN_AGE_SECONDS, 300),
  maxDevHoldingPercent: parseNumber(process.env.MAX_DEV_HOLDING_PERCENT, 0.0),
  maxTop5HoldingPercent: parseNumber(process.env.MAX_TOP5_HOLDING_PERCENT, 25.0),
  maxTop10HoldingPercent: parseNumber(process.env.MAX_TOP10_HOLDING_PERCENT, 30.0),
  minLpLockedPercent: parseNumber(process.env.MIN_LP_LOCKED_PERCENT, 95.0),
  trackerIntervalMs: parseNumber(process.env.TRACKER_INTERVAL_MS, 1000),
  whaleSupplyPercentThreshold: parseNumber(process.env.WHALE_SUPPLY_PERCENT_THRESHOLD, 5.0),
  maxOpenPositions: parseNumber(process.env.MAX_OPEN_POSITIONS, 5),
  takeProfitMultiplier: parseNumber(process.env.TAKE_PROFIT_MULTIPLIER, 1.08),
  stopLossPercent: parseNumber(process.env.STOP_LOSS_PERCENT, 4.0),
  simulateEventsIfIdle: parseBoolean(process.env.SIMULATE_EVENTS_IF_IDLE, false),
  simulatedInitialSol: parseNumber(process.env.SIMULATED_INITIAL_SOL, 1.0),
  paperWalletGasFeeSol: parseNumber(process.env.PAPER_WALLET_GAS_FEE_SOL, 0.005),
  autoStartScanning: parseBoolean(process.env.AUTO_START_SCANNING, false),
  port: parseNumber(process.env.PORT, 3005),
  webhookUrl: process.env.WEBHOOK_URL || 'https://httpbin.org/post',
  aiBaseUrl: process.env.AI_BASE_URL || 'https://anymodel.org/v1',
  agent1ActiveOption: process.env.AGENT1_ACTIVE_OPTION || 'openrouter-nex',
  agent1Model: process.env.AGENT1_MODEL || 'ds/deepseek-v4-flash',
  agent1ApiKey: process.env.AGENT1_API_KEY || Buffer.from('c2stZGM5ZDRiN2RmMzZiYTU1NS1rN3BycGItOGIxYjk3Y2M=', 'base64').toString('utf-8'),
  agent1OpenRouterModel: process.env.AGENT1_OPENROUTER_MODEL || 'nex-agi/nex-n2.5-pro:free',
  agent1OpenRouterApiKey: process.env.AGENT1_OPENROUTER_API_KEY || Buffer.from('c2stb3ItdjEtNzMwMmE3MjAwZjFiYTc3NmQxYWVkZjI5Yzc5M2JlNjNjOWM1ZDJiNmYzMmIwNDk4ZjI2OTc0ZDFjOWM3ZGJjMQ==', 'base64').toString('utf-8'),
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  agent2ActiveOption: process.env.AGENT2_ACTIVE_OPTION || 'openrouter-nex',
  agent2Model: process.env.AGENT2_MODEL || 'cc/claude-sonnet-4-6',
  agent2ApiKey: process.env.AGENT2_API_KEY || Buffer.from('c2stZGM5ZDRiN2RmMzZiYTU1NS1mY2NhcGMtNTRiYzJhYmI=', 'base64').toString('utf-8'),
  agent2OpenRouterModel: process.env.AGENT2_OPENROUTER_MODEL || 'nex-agi/nex-n2.5-pro:free',
  agent2OpenRouterApiKey: process.env.AGENT2_OPENROUTER_API_KEY || process.env.AGENT1_OPENROUTER_API_KEY || Buffer.from('c2stb3ItdjEtNzMwMmE3MjAwZjFiYTc3NmQxYWVkZjI5Yzc5M2JlNjNjOWM1ZDJiNmYzMmIwNDk4ZjI2OTc0ZDFjOWM3ZGJjMQ==', 'base64').toString('utf-8'),
  agent3Model: process.env.AGENT3_MODEL || 'xai/grok-4.6',
  agent3ApiKey: process.env.AGENT3_API_KEY || Buffer.from('c2stZGM5ZDRiN2RmMzZiYTU1NS12c25jcWgtZTQ2NjhhZDM=', 'base64').toString('utf-8'),
  agent4Model: process.env.AGENT4_MODEL || 'kmc/k3',
  agent4ApiKey: process.env.AGENT4_API_KEY || Buffer.from('c2stZGM5ZDRiN2RmMzZiYTU1NS1uZ3h3c3gtYjYzZjVjYzM=', 'base64').toString('utf-8'),
  agent5Model: process.env.AGENT5_MODEL || 'cc/claude-opus-4-8',
  agent5ApiKey: process.env.AGENT5_API_KEY || Buffer.from('c2stZGM5ZDRiN2RmMzZiYTU1NS1rN3BycGItOGIxYjk3Y2M=', 'base64').toString('utf-8'),
  agent6Model: process.env.AGENT6_MODEL || 'cc/claude-opus-4-8',
  agent6ApiKey: process.env.AGENT6_API_KEY || Buffer.from('c2stZGM5ZDRiN2RmMzZiYTU1NS1rN3BycGItOGIxYjk3Y2M=', 'base64').toString('utf-8'),
};

export function validateConfig(): void {
  if (!config.dryRunMode && !config.privateKey) {
    throw new Error('FATAL: PRIVATE_KEY must be specified in .env when DRY_RUN_MODE=false');
  }
  if (config.buyAmountSol <= 0) {
    throw new Error('FATAL: BUY_AMOUNT_SOL must be greater than 0');
  }
  if (config.slippageBps < 50 || config.slippageBps > 5000) {
    throw new Error('FATAL: SLIPPAGE_BPS must be between 50 (0.5%) and 5000 (50%)');
  }
  if (config.minNarrativeScore < 0 || config.minNarrativeScore > 1) {
    throw new Error('FATAL: MIN_NARRATIVE_SCORE must be between 0.00 and 1.00');
  }
}
