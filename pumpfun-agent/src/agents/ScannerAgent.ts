import WebSocket from 'ws';
import axios from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';
import { ITokenData } from '../types';
import { eventBus } from '../utils/eventBus';
import { logger } from '../utils/logger';
import { config } from '../config';
import { simulator } from '../utils/simulator';
import { aiService } from '../services/aiService';

export class ScannerAgent {
  private ws: WebSocket | null = null;
  private isRunning = false;
  private isEnabled = false; // Master toggle from user
  private isPaused = false; // Temporary position lock
  private reconnectAttempt = 0;
  private maxReconnectDelay = 30000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private apiPollingInterval: NodeJS.Timeout | null = null;
  private idleSimulationTimer: NodeJS.Timeout | null = null;
  private seenMints: Set<string> = new Set();

  // Curated keyword dictionaries with weights for narrative scoring
  private readonly viralKeywords: Record<string, number> = {
    ai: 0.35,
    agent: 0.35,
    autonomous: 0.25,
    gpt: 0.25,
    neural: 0.2,
    quantum: 0.2,
    cyber: 0.2,
    doge: 0.25,
    elon: 0.3,
    musk: 0.25,
    trump: 0.3,
    president: 0.25,
    solana: 0.25,
    sol: 0.2,
    pepe: 0.3,
    cat: 0.25,
    cto: 0.2,
    giga: 0.25,
    chad: 0.25,
    based: 0.2,
    pump: 0.25,
    fun: 0.15,
    meme: 0.2,
    moon: 0.25,
    terminal: 0.25,
    degen: 0.25,
    alpha: 0.25,
    shib: 0.25,
    inu: 0.25,
    stonk: 0.25,
    bull: 0.2,
  };

  private readonly blacklistKeywords: string[] = [
    'presale',
    'airdrop claim',
    'airdrop',
    'claim',
    'test',
    'free mint',
    'send sol to',
    'send sol',
    'whitelist only',
    'dev sold',
    'scam',
    'honeypot',
  ];

  constructor() {
    this.isEnabled = Boolean(config.autoStartScanning);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.on('START_SCANNER_ENGINE', () => {
      this.isEnabled = true;
      this.isPaused = false;
      logger.info('[ScannerAgent] Master Scanner ACTIVATED by user.');
    });

    eventBus.on('STOP_SCANNER_ENGINE', () => {
      this.isEnabled = false;
      this.isPaused = true;
      logger.info('[ScannerAgent] Master Scanner DEACTIVATED by user.');
    });

    eventBus.on('PAUSE_SCAN', () => {
      this.isPaused = true;
      logger.info('[ScannerAgent] Scanner PAUSED (Active position opened).');
    });

    eventBus.on('RESUME_SCAN', () => {
      if (this.isEnabled) {
        this.isPaused = false;
        logger.info('[ScannerAgent] Scanner RESUMED (Ready for next token).');
      }
    });
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isEnabled = Boolean(config.autoStartScanning);
    this.isPaused = !this.isEnabled;
    logger.info(`[ScannerAgent] Starting Scanner Agent (Initial State: ${this.isEnabled ? 'ACTIVE' : 'PAUSED/STANDBY'})...`);
    this.connectWebSocket();
    this.startApiPolling();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.apiPollingInterval) clearInterval(this.apiPollingInterval);
    if (this.idleSimulationTimer) clearInterval(this.idleSimulationTimer);
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch (err: unknown) {
        logger.error(`[ScannerAgent] Error closing WebSocket: ${err}`);
      }
      this.ws = null;
    }
    logger.info('[ScannerAgent] Scanner Agent stopped.');
  }

  private startApiPolling(): void {
    if (this.apiPollingInterval) clearInterval(this.apiPollingInterval);
    // Node 1: Trigger Every 2s & Node 2: Fetch Live pump.fun API
    this.apiPollingInterval = setInterval(async () => {
      if (!this.isEnabled || this.isPaused || !this.isRunning) return;

      try {
        const response = await axios.get(
          'https://frontend-api.pump.fun/coins?sort=created_timestamp&order=DESC&limit=10',
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            timeout: 5000,
          }
        );

        const coins = Array.isArray(response.data)
          ? response.data
          : response.data?.data
          ? response.data.data
          : [response.data];

        for (const coin of coins) {
          if (!coin || !coin.mint || this.seenMints.has(coin.mint)) continue;

          // Check token age (seconds)
          const now = Date.now();
          const createdTime = coin.created_timestamp
            ? (coin.created_timestamp > 1e12 ? coin.created_timestamp : coin.created_timestamp * 1000)
            : now;
          const ageSec = Math.max(0, Math.floor((now - createdTime) / 1000));

          this.seenMints.add(coin.mint);
          if (this.seenMints.size > 1000) {
            const first = this.seenMints.values().next().value;
            if (first) this.seenMints.delete(first);
          }

          // Extract holders count (pump.fun num_holders or reply_count / simulated fallback)
          const holders = Number(coin.num_holders || coin.holders || coin.reply_count || 0);

          // Process real live token
          this.processNewToken({
            mint: coin.mint,
            name: coin.name || 'Unknown',
            symbol: coin.symbol || 'TOKEN',
            description: coin.description || '',
            image: coin.image_uri || '',
            creator: coin.creator || '',
            virtual_sol_reserves: coin.virtual_sol_reserves || 30000000000,
            virtual_token_reserves: coin.virtual_token_reserves || 1073000000000000,
            usd_market_cap: coin.usd_market_cap || 5000,
            bondingCurve: coin.bonding_curve || '',
            associatedBondingCurve: coin.associated_bonding_curve || '',
            createdTimestamp: createdTime,
            ageSeconds: ageSec,
            holdersCount: holders,
          });
        }
      } catch (err: unknown) {
        // Polling retry on next interval
      }
    }, 2000);
  }

  private connectWebSocket(): void {
    if (!this.isRunning) return;

    try {
      logger.info(`[ScannerAgent] Connecting to pump.fun WebSocket feed at ${config.pumpfunWsUrl}...`);
      this.ws = new WebSocket(config.pumpfunWsUrl);

      this.ws.on('open', () => {
        logger.info('[ScannerAgent] WebSocket connected successfully.');
        this.reconnectAttempt = 0;

        // Subscribe to pump.fun new token creation events
        const subscribePayload = JSON.stringify({ method: 'subscribeNewToken' });
        this.ws?.send(subscribePayload);
        logger.info('[ScannerAgent] Subscribed to "subscribeNewToken" stream.');

        // Start ping/pong heartbeat
        this.startHeartbeat();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const rawMessage = data.toString('utf-8');
          const parsed = JSON.parse(rawMessage);
          this.handleIncomingMessage(parsed);
        } catch (err: unknown) {
          logger.debug(`[ScannerAgent] Non-JSON or malformed WebSocket message: ${err}`);
        }
      });

      this.ws.on('error', (err: Error) => {
        logger.warn(`[ScannerAgent] WebSocket encountered error: ${err.message}`);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        logger.warn(`[ScannerAgent] WebSocket disconnected (Code: ${code}, Reason: ${reason.toString()}).`);
        this.scheduleReconnect();
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`[ScannerAgent] Exception while creating WebSocket: ${errorMsg}`);
      this.scheduleReconnect();
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 20000);
  }

  private scheduleReconnect(): void {
    if (!this.isRunning) return;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.reconnectAttempt++;
    // Exponential backoff with jitter: 1s, 2s, 4s, 8s, up to maxReconnectDelay
    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.maxReconnectDelay);
    const jitter = Math.floor(Math.random() * 1000);
    const delay = baseDelay + jitter;

    logger.info(`[ScannerAgent] Reconnecting in ${(delay / 1000).toFixed(1)}s (Attempt #${this.reconnectAttempt})...`);
    setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  private handleIncomingMessage(payload: Record<string, unknown>): void {
    if (!this.isEnabled || this.isPaused) return;

    // Verify if message is a new token creation payload
    // PumpPortal schema typically returns: mint, name, symbol, uri, traderPublicKey, txType == 'create'
    if (payload.txType === 'create' || (payload.mint && payload.name && payload.symbol)) {
      this.processNewToken(payload);
    }
  }

  public async processNewToken(rawPayload: Record<string, unknown>): Promise<void> {
    if (!this.isEnabled || this.isPaused) return;

    try {
      const mint = String(rawPayload.mint || '');
      const name = String(rawPayload.name || '');
      const symbol = String(rawPayload.symbol || '');
      const description = String(rawPayload.description || rawPayload.uri || '');
      let image = String(rawPayload.image || rawPayload.image_uri || '');
      if (!image && typeof rawPayload.uri === 'string' && !rawPayload.uri.endsWith('.json') && !rawPayload.uri.includes('/metadata')) {
        image = rawPayload.uri;
      }
      if (image.startsWith('ipfs://')) {
        image = image.replace('ipfs://', 'https://cf-ipfs.com/ipfs/');
      } else if (image.includes('ipfs.io/ipfs/')) {
        image = image.replace('ipfs.io/ipfs/', 'cf-ipfs.com/ipfs/');
      }
      if (image.endsWith('.json') || image.includes('/metadata')) {
        image = '';
      }
      const bondingCurve = String(rawPayload.bondingCurve || '');
      const associatedBondingCurve = String(rawPayload.associatedBondingCurve || '');
      const creator = String(rawPayload.traderPublicKey || rawPayload.creator || '');

      if (!mint || !symbol) return;

      let { score, keywordsFound } = this.evaluateNarrative(name, symbol, description);
      let aiReasoning = 'Heuristic keyword match';
      let aiModel = aiService.getSelectedAgent1Option().model;

      // Agen 1: Evaluate with selected AI Model (only for high potential tokens to conserve quota for Agent 6)
      if (score >= 0.50) {
        try {
          const aiEvaluation = await aiService.evaluateNarrativeWithAI({ name, symbol, description });
          if (aiEvaluation) {
            aiReasoning = aiEvaluation.reasoning;
            aiModel = aiEvaluation.model;
            if (aiEvaluation.is_blacklisted) {
              score = 0.0;
              keywordsFound.push('AI_BLACKLIST');
            } else {
              // Adopt AI narrative score
              score = Math.max(score, aiEvaluation.narrative_score);
              if (aiEvaluation.viral_hooks.length > 0) {
                keywordsFound = Array.from(new Set([...keywordsFound, ...aiEvaluation.viral_hooks]));
              }
            }
            logger.info(`[ScannerAgent:AI:${aiModel}] AI Score: ${aiEvaluation.narrative_score.toFixed(2)} | Reason: "${aiReasoning}"`);
          }
        } catch (aiErr) {
          logger.debug(`[ScannerAgent:AI] Using heuristic fallback: ${aiErr}`);
        }
      }

      // Extract or estimate holdersCount & ageSeconds
      let ageSeconds = typeof rawPayload.ageSeconds === 'number' ? rawPayload.ageSeconds : 0;
      if (!ageSeconds && rawPayload.createdTimestamp) {
        const created = Number(rawPayload.createdTimestamp);
        ageSeconds = Math.max(0, Math.floor((Date.now() - (created > 1e12 ? created : created * 1000)) / 1000));
      }

      let holdersCount = typeof rawPayload.holdersCount === 'number' ? rawPayload.holdersCount : 0;
      if (!holdersCount) {
        holdersCount = Number(rawPayload.num_holders || rawPayload.holders || rawPayload.reply_count || 0);
      }
      if (holdersCount <= 0) {
        holdersCount = 1; // Any deployed token on pump.fun has at least 1 initial holder (the creator)
      }

      if (mint.startsWith('sim_')) {
        // Fallback realistic metrics for simulated test tokens
        if (!holdersCount) holdersCount = 42;
        if (!ageSeconds) ageSeconds = 60;
      }

      // If token has promising narrative score, fetch real live on-chain holders count from Rugcheck/RPC
      if (score >= config.minNarrativeScore && holdersCount < config.minHoldersCount && !mint.startsWith('sim_')) {
        try {
          const liveHolders = await this.fetchLiveHoldersCount(mint);
          if (liveHolders > holdersCount) {
            holdersCount = liveHolders;
          }
        } catch {
          // Fallback to initial count
        }
      }

      const tokenData: ITokenData = {
        mint,
        name,
        symbol,
        description,
        image,
        bondingCurve,
        associatedBondingCurve,
        creator,
        timestamp: Date.now(),
        narrativeScore: score,
        keywordsFound,
        rawPayload,
        aiReasoning,
        aiModel,
        holdersCount,
        ageSeconds,
      };

      logger.info(
        `[ScannerAgent] Scanned [${symbol}] "${name}" | Score: ${score.toFixed(2)} (Min: ${config.minNarrativeScore}) | Holders: ${holdersCount} (Min: ${config.minHoldersCount}) | Age: ${ageSeconds}s (Max: ${config.maxTokenAgeSeconds}s) | Model: ${aiModel}`
      );

      // ALWAYS emit TOKEN_SCANNED so UI live token stream shows every incoming coin live
      eventBus.emit('TOKEN_SCANNED', tokenData);

      // 1. Min Narrative Score Check
      if (score < config.minNarrativeScore) {
        logger.info(
          `[ScannerAgent] Rejected: [${symbol}] Score ${score.toFixed(2)} < ${config.minNarrativeScore.toFixed(2)} (Insufficient viral narrative)`
        );
        return;
      }

      // 2. Min Unique Holders Count Check (Holders Min: 30)
      if (holdersCount < config.minHoldersCount) {
        logger.info(
          `[ScannerAgent] Rejected: [${symbol}] Holders count ${holdersCount} < ${config.minHoldersCount} (Holders Min: 30 requirement not met - insufficient market participation)`
        );
        return;
      }

      // 3. Max Token Age Limit Check (Max Age: 5m / 300s)
      if (ageSeconds > config.maxTokenAgeSeconds) {
        logger.info(
          `[ScannerAgent] Rejected: [${symbol}] Token age ${ageSeconds}s > ${config.maxTokenAgeSeconds}s (Exceeds Max Age 5m limit)`
        );
        return;
      }

      // All filters PASSED -> Forward to Agen 2 Auditor
      logger.info(
        `[ScannerAgent] >>> TOKEN_DETECTED [${symbol}] (${mint.slice(0, 8)}...) qualified (Score: ${score.toFixed(2)} >= ${config.minNarrativeScore.toFixed(2)}, Holders: ${holdersCount} >= ${config.minHoldersCount}, Age: ${ageSeconds}s <= ${config.maxTokenAgeSeconds}s)! Emitting to Auditor.`
      );
      eventBus.emit('TOKEN_DETECTED', tokenData);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
      logger.error(`[ScannerAgent] Error processing new token: ${errorMsg}`);
    }
  }

  public evaluateNarrative(
    name: string,
    symbol: string,
    description: string
  ): { score: number; keywordsFound: string[] } {
    const combinedText = `${name} ${symbol} ${description}`.toLowerCase();
    const keywordsFound: string[] = [];

    // Check blacklist first
    for (const badWord of this.blacklistKeywords) {
      if (combinedText.includes(badWord)) {
        logger.warn(`[ScannerAgent] Blacklisted phrase '${badWord}' detected in token narrative. Score set to 0.`);
        return { score: 0.0, keywordsFound: [`BLACKLISTED:${badWord}`] };
      }
    }

    let rawScore = 0.2; // Base baseline score for valid format

    // Symbol sanity bonus
    if (symbol.length >= 2 && symbol.length <= 8 && /^[A-Za-z0-9$]+$/.test(symbol)) {
      rawScore += 0.1;
    }

    // Keyword matching
    for (const [kw, weight] of Object.entries(this.viralKeywords)) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(combinedText)) {
        rawScore += weight;
        keywordsFound.push(kw);
      }
    }

    // Cap score at 1.00
    const finalScore = Math.min(Math.max(parseFloat(rawScore.toFixed(2)), 0.0), 1.0);
    return { score: finalScore, keywordsFound };
  }

  private async fetchLiveHoldersCount(mint: string): Promise<number> {
    if (!mint || mint.startsWith('sim_')) return 42;
    try {
      const resp = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, { timeout: 2500 });
      if (resp.data && typeof resp.data.totalHolders === 'number' && resp.data.totalHolders > 0) {
        return resp.data.totalHolders;
      }
      if (resp.data && Array.isArray(resp.data.topHolders) && resp.data.topHolders.length > 0) {
        return resp.data.topHolders.length;
      }
    } catch {
      // Rugcheck query skipped/rate-limited
    }

    try {
      const conn = new Connection(config.rpcUrl, 'confirmed');
      const largest = await conn.getTokenLargestAccounts(new PublicKey(mint));
      if (largest.value && largest.value.length > 0) {
        return largest.value.length;
      }
    } catch {
      // RPC fallback
    }

    return 1;
  }
}
