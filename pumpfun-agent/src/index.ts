import { Connection } from '@solana/web3.js';
import { config, validateConfig } from './config';
import { logger } from './utils/logger';
import { eventBus } from './utils/eventBus';
import { ScannerAgent } from './agents/ScannerAgent';
import { AuditorAgent } from './agents/AuditorAgent';
import { ExecutionAgent } from './agents/ExecutionAgent';
import { TrackerAgent } from './agents/TrackerAgent';
import { ExitAgent } from './agents/ExitAgent';
import { copyTradeAgent } from './agents/CopyTradeAgent';
import { WebServer } from './server';

class MultiAgentTradingBotOrchestrator {
  private connection: Connection;
  private scannerAgent: ScannerAgent;
  private auditorAgent: AuditorAgent;
  private executionAgent: ExecutionAgent;
  private trackerAgent: TrackerAgent;
  private exitAgent: ExitAgent;
  private webServer: WebServer;
  private isShuttingDown = false;

  constructor() {
    logger.info('================================================================');
    logger.info('   SOLANA PUMP.FUN 5-AGENT AUTOMATED TRADING BOT INITIALIZING   ');
    logger.info('================================================================');

    validateConfig();

    this.connection = new Connection(config.rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: config.wsUrl,
    });

    logger.info(`[System] RPC Endpoint:       ${config.rpcUrl}`);
    logger.info(`[System] WebSocket Endpoint:  ${config.wsUrl}`);
    logger.info(`[System] Pump.fun Feed:       ${config.pumpfunWsUrl}`);
    logger.info(`[System] Execution Mode:      ${config.dryRunMode ? '>>> DRY-RUN (SIMULATION) <<<' : '>>> LIVE REAL TRADING <<<'}`);
    logger.info(`[System] Buy Amount:          ${config.buyAmountSol} SOL`);
    logger.info(`[System] Slippage Tolerance:  ${config.slippageBps} bps (${config.slippageBps / 100}%)`);
    logger.info(`[System] Take Profit Target:  ${config.takeProfitMultiplier}x`);
    logger.info(`[System] Stop Loss Limit:     -${config.stopLossPercent}%`);
    logger.info(`[System] Min Narrative Score: ${config.minNarrativeScore}`);
    logger.info(`[System] Jito Engine:         ${config.jitoEngineUrl}`);
    logger.info('----------------------------------------------------------------');

    // Instantiate 5 Specialist Agents
    this.scannerAgent = new ScannerAgent();
    this.auditorAgent = new AuditorAgent(this.connection);
    this.executionAgent = new ExecutionAgent(this.connection);
    this.trackerAgent = new TrackerAgent(this.connection);
    this.exitAgent = new ExitAgent(this.connection);

    // Initialize Web & Socket.io Server
    this.webServer = new WebServer();

    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers(): void {
    // Process signal handlers for graceful shutdown
    const handleShutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      logger.warn(`\n[System] Received ${signal}. Initiating graceful shutdown...`);

      try {
        this.webServer.stop();
        this.scannerAgent.stop();
        this.trackerAgent.stopTracking();
        copyTradeAgent.stop();
        eventBus.removeAllListeners();
        logger.info('[System] All agent loops, web server, and listeners cleanly terminated.');
      } catch (err: unknown) {
        logger.error(`[System] Error during shutdown: ${err}`);
      } finally {
        logger.info('[System] Goodbye!');
        process.exit(0);
      }
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

    // Zero-Crash global unhandled safeguards
    process.on('uncaughtException', (err: Error) => {
      logger.error(`[System] [CRITICAL] Uncaught Exception: ${err.stack || err.message}`);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error(`[System] [CRITICAL] Unhandled Promise Rejection: ${reason}`);
    });
  }

  public async start(): Promise<void> {
    logger.info('[System] Activating Agent Pipeline & Web Server...');
    await this.webServer.start();

    logger.info('[System] Agent 1 (Scanner)  : [ONLINE]');
    logger.info('[System] Agent 2 (Auditor)  : [ONLINE]');
    logger.info('[System] Agent 3 (Execution): [ONLINE]');
    logger.info('[System] Agent 4 (Tracker)  : [ONLINE]');
    logger.info('[System] Agent 5 (Risk/Exit): [ONLINE]');
    logger.info('[System] Agent 6 (Sentinel) : [ONLINE]');
    logger.info('[System] Agent 7 (CopyTrade): [ONLINE]');
    logger.info('================================================================\n');

    this.scannerAgent.start();
    copyTradeAgent.start();
  }
}

// Start the trading bot
const bot = new MultiAgentTradingBotOrchestrator();
bot.start().catch((err) => {
  logger.error(`[System] Fatal startup failure: ${err}`);
});
