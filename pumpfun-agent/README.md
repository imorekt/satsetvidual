# Solana pump.fun Multi-Agent AI Trading Bot

Production-Grade, Zero-Crash 5-Agent Automated Trading Bot for [pump.fun](https://pump.fun) on Solana. Built with **Node.js + TypeScript (ES2022)**, featuring **Jito MEV Bundle Protection**, an internal typed **EventBus**, and a comprehensive **Dry-Run Simulator Engine**.

---

## 🏛 Architecture Overview

```
+---------------------------------------------------------------------------------+
|                                 PUMP.FUN STREAM                                 |
|                  (WebSocket: wss://pumpportal.fun/api/data)                     |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
| AGENT 1: SCANNER AGENT (src/agents/ScannerAgent.ts)                             |
| - Real-time token creation listener with Auto-Reconnect & Exponential Backoff    |
| - Narrative & Viral Score Evaluator (0.00 - 1.00)                               |
| - Emits: TOKEN_DETECTED                                                         |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
| AGENT 2: AUDITOR AGENT (src/agents/AuditorAgent.ts)                             |
| - Layer 1: Mint Authority & Freeze Authority Revoked (Anti-Honeypot)            |
| - Layer 2: Dev & Bundle Supply Check (Dev <= 10%)                               |
| - Layer 3: Top 5 Holders Concentration (Excluding Bonding Curve <= 25%)         |
| - Kill-Vote Consensus: Emits AUDIT_PASSED or Drops Token                        |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
| AGENT 3: EXECUTION AGENT (src/agents/ExecutionAgent.ts)                         |
| - Computes optimal buy size from BUY_AMOUNT_SOL and slippage tolerance          |
| - Builds on-chain Pump.fun Buy Instruction + ATA Creation                       |
| - Submits via Jito MEV Bundle API (Anti-Sandwich / Frontrun Protection)         |
| - Emits: POSITION_OPENED & Signals Scanner to PAUSE                             |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
| AGENT 4: ON-CHAIN TRACKER AGENT (src/agents/TrackerAgent.ts)                    |
| - High-precision 200ms polling loop on bonding curve reserves & price           |
| - Calculates live PnL %, gain multipliers (+100%, +800%, +5000%)                |
| - Whale Activity Detection: Tracks wallets holding > 3% supply                  |
| - Emits: POSITION_UPDATE (Continuous) & WHALE_DUMP_WARNING (Emergency)          |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
| AGENT 5: RISK & EXIT AGENT (src/agents/ExitAgent.ts)                            |
| - Exit Trigger 1: Take Profit (TP) -> Multiplier reached (e.g. 2.0x, 10x, 60x) |
| - Exit Trigger 2: Stop Loss (SL)   -> PnL drops below limit (e.g. -15%)         |
| - Exit Trigger 3: Whale Dump Flash Exit -> Front-run whale dump cascade         |
| - Instant Sell ALL via Jito MEV                                                 |
| - Emits: POSITION_CLOSED, resets state, and signals Scanner to RESUME           |
+---------------------------------------------------------------------------------+
```

---

## 📁 Project Structure

```
E:\BOT\PUMFUNAGENT\
├── .env.example                     # Environment template
├── .env                             # Active configuration
├── .gitignore                       # Ignored files (node_modules, logs, .env)
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript ES2022 configuration
├── README.md                        # Documentation
├── logs/                            # Winston log outputs
│   ├── combined.log
│   ├── error.log
│   └── trades.log
└── src/
    ├── config.ts                    # Type-safe environment configuration & validator
    ├── index.ts                     # Main Orchestrator & lifecycle manager
    ├── types/
    │   └── index.ts                 # Full TypeScript interfaces & event maps
    ├── utils/
    │   ├── logger.ts                # Winston logger with millisecond precision
    │   ├── eventBus.ts              # Typed EventEmitter with leak prevention
    │   ├── pumpfun.ts               # Pump.fun PDA derivation, pricing math & instructions
    │   ├── jito.ts                  # Jito MEV block engine bundle submitter
    │   └── simulator.ts             # Dry-Run engine for paper trading
    └── agents/
        ├── ScannerAgent.ts          # Agent 1: Stream monitor & narrative scoring
        ├── AuditorAgent.ts          # Agent 2: 3-Layer security audit & kill-vote
        ├── ExecutionAgent.ts        # Agent 3: Buy execution & Jito MEV bundling
        ├── TrackerAgent.ts          # Agent 4: 200ms price & whale tracker
        └── ExitAgent.ts             # Agent 5: Risk management, TP/SL & sell all
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Verify Type Safety
```bash
npm run typecheck
```

### 3. Run in Simulation (Dry-Run Mode)
The default `.env` is configured with `DRY_RUN_MODE=true`. This allows you to test the entire 5-agent pipeline safely without risking real SOL:
```bash
npm run dev
```

In dry-run mode:
- Initial simulated wallet balance: `5.0 SOL`.
- Listens to real-time pump.fun token launches or generates simulated tokens if idle.
- Simulates realistic bonding curve math, price movements, and simulated whale sales.
- Logs all actions, PnL, and transaction receipts to console and `logs/`.

---

## ⚙️ Configuration (`.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `RPC_URL` | Solana JSON-RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `WS_URL` | Solana WebSocket endpoint | `wss://api.mainnet-beta.solana.com` |
| `PUMPFUN_WS_URL` | PumpPortal WebSocket feed | `wss://pumpportal.fun/api/data` |
| `PRIVATE_KEY` | Base58 Solana wallet private key | *(Required only for live mode)* |
| `DRY_RUN_MODE` | Enable Paper Trading simulation | `true` |
| `BUY_AMOUNT_SOL` | SOL amount per buy order | `0.1` |
| `SLIPPAGE_BPS` | Slippage tolerance (100 = 1%) | `500` (5%) |
| `PRIORITY_FEE_MICROLAMPORTS`| Compute unit price in microLamports | `100000` |
| `JITO_ENGINE_URL` | Jito Block Engine Bundle API | `https://mainnet.block-engine.jito.wtf/api/v1/bundles` |
| `JITO_TIP_SOL` | Validator tip in SOL | `0.001` |
| `MIN_NARRATIVE_SCORE` | Threshold to pass Scanner (0.00 - 1.00) | `0.65` |
| `MAX_DEV_HOLDING_PERCENT` | Max allowed creator supply holding | `10.0` |
| `MAX_TOP5_HOLDING_PERCENT`| Max allowed top 5 holders holding | `25.0` |
| `TRACKER_INTERVAL_MS` | Position tracking interval | `200` |
| `WHALE_SUPPLY_PERCENT_THRESHOLD` | Threshold to classify as whale | `3.0` |
| `TAKE_PROFIT_MULTIPLIER` | Target gain multiplier (e.g. 2.0x) | `2.0` |
| `STOP_LOSS_PERCENT` | Stop loss tolerance percentage | `15.0` |

---

## 🔒 Switching to Live Trading Mode

> [!CAUTION]
> Trading memecoins carries extreme risk. Never trade with funds you cannot afford to lose.

When you are satisfied with dry-run results:
1. Obtain a dedicated Solana private key (Base58 encoded).
2. Fund the wallet with SOL for buys and transaction fees.
3. Use a private, high-performance RPC (e.g. Helius, QuickNode, Triton) for minimal latency.
4. In `.env`:
   ```env
   DRY_RUN_MODE=false
   PRIVATE_KEY=your_base58_private_key_here
   RPC_URL=https://your-dedicated-rpc-endpoint.com
   WS_URL=wss://your-dedicated-rpc-endpoint.com
   ```
5. Start the bot:
   ```bash
   npm start
   ```

---

## 🛡 Robustness & Zero-Crash Guarantees
- **Isolated try/catch blocks**: No single failed API call or RPC error can crash the Node.js event loop.
- **Auto-Reconnect with Exponential Backoff & Jitter**: Automatically reconnects if WebSocket feeds disconnect.
- **Memory Leak Protection**: Unsubscribes event listeners upon position completion and enforces listener maximums.
- **MEV Sandwich Protection**: Bypasses public mempool using Jito MEV Bundles.
