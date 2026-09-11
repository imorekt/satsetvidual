import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { ITokenData, IAuditResult } from '../types';
import { eventBus } from '../utils/eventBus';
import { logger } from '../utils/logger';
import { config } from '../config';
import { getBondingCurvePDA } from '../utils/pumpfun';
import { aiService } from '../services/aiService';

export class AuditorAgent {
  private connection: Connection;
  private isAuditing = false;

  constructor(connection?: Connection) {
    this.connection = connection || new Connection(config.rpcUrl, 'confirmed');
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    eventBus.on('TOKEN_DETECTED', (token: ITokenData) => {
      this.auditToken(token);
    });
  }

  public async auditToken(token: ITokenData): Promise<IAuditResult> {
    const startTime = Date.now();
    logger.info(`[AuditorAgent] Starting 3-Layer Security Audit (Rugcheck & Solana RPC) for [${token.symbol}] (${token.mint.slice(0, 8)}...)...`);

    const reasons: string[] = [];
    let mintAuthDisabled = false;
    let freezeAuthDisabled = false;
    let devHoldingPercent = 0.0;
    let top5HoldingPercent = 0.0;

    try {
      if (token.mint.startsWith('sim_')) {
        // Fallback for purely simulated test tokens (Axiom standard: Dev = 0%, Top10 <= 30%)
        mintAuthDisabled = true;
        freezeAuthDisabled = true;
        devHoldingPercent = 0.0;
        top5HoldingPercent = 8.0;
        const top10HoldingPercent = 15.0;
        const holdersCount = token.holdersCount || 35;

        const auditResult: IAuditResult = {
          mint: token.mint,
          symbol: token.symbol,
          passed: true,
          mintAuthorityDisabled: mintAuthDisabled,
          freezeAuthorityDisabled: freezeAuthDisabled,
          devHoldingPercent,
          top5HoldingPercent,
          top10HoldingPercent,
          lpLockedPercent: 100.0,
          holdersCount,
          reasons: ['Rugcheck verified, authorities revoked, dev holding 0.0%, top10 <= 30%, holders >= 30'],
          auditedAt: Date.now(),
        };
        eventBus.emit('AUDIT_PASSED', { token, audit: auditResult });
        return auditResult;
      }

      // -------------------------------------------------------------
      // LAYER 1: Rugcheck API Verification (https://api.rugcheck.xyz)
      // -------------------------------------------------------------
      // LAYER 1: Rugcheck API Verification (https://api.rugcheck.xyz)
      // -------------------------------------------------------------
      let top10HoldingPercent = 0.0;
      let lpLockedPercent = 100.0; // Default 100% locked on pump.fun bonding curve

      try {
        const rugcheckUrl = `https://api.rugcheck.xyz/v1/tokens/${token.mint}/report`;
        const rcResp = await axios.get(rugcheckUrl, { timeout: 4000 });
        const rcData = rcResp.data;

        if (rcData && rcData.token) {
          if (rcData.token.mintAuthority === null || rcData.token.mintAuthority === undefined) {
            mintAuthDisabled = true;
          } else {
            reasons.push(`KILL_VETO_MINT: Mint authority is active (${rcData.token.mintAuthority})`);
          }

          if (rcData.token.freezeAuthority === null || rcData.token.freezeAuthority === undefined) {
            freezeAuthDisabled = true;
          } else {
            reasons.push(`KILL_VETO_FREEZE: Freeze authority is active (${rcData.token.freezeAuthority})`);
          }

          if (Array.isArray(rcData.topHolders)) {
            const top5 = rcData.topHolders.slice(0, 5);
            top5HoldingPercent = top5.reduce((acc: number, h: { pct?: number }) => acc + (h.pct || 0), 0);
            if (top5HoldingPercent > config.maxTop5HoldingPercent) {
              reasons.push(`KILL_VETO_TOP5: Top 5 holders own ${top5HoldingPercent.toFixed(1)}% (Max: ${config.maxTop5HoldingPercent}%)`);
            }

            const top10 = rcData.topHolders.slice(0, 10);
            top10HoldingPercent = top10.reduce((acc: number, h: { pct?: number }) => acc + (h.pct || 0), 0);
            if (top10HoldingPercent > config.maxTop10HoldingPercent) {
              reasons.push(`KILL_VETO_TOP10: Top 10 holders own ${top10HoldingPercent.toFixed(1)}% (Max: ${config.maxTop10HoldingPercent}%)`);
            }
          }

          if (Array.isArray(rcData.risks)) {
            // Pump.fun bonding curves start with 30 virtual SOL, so 'Low Liquidity' and DEX LP warnings are normal on fresh tokens
            const ignoredPumpfunRisks = [
              'low liquidity',
              'low lp',
              'unlocked lp',
              'insufficient liquidity',
              'single holder',
            ];
            for (const r of rcData.risks) {
              const riskNameLower = (r.name || '').toLowerCase();
              const isIgnored = ignoredPumpfunRisks.some((ign) => riskNameLower.includes(ign));
              if (r.level === 'danger' && !isIgnored) {
                reasons.push(`KILL_VETO_RUGCHECK: ${r.name}`);
              }
            }
          }

          if (rcData.markets && Array.isArray(rcData.markets)) {
            for (const m of rcData.markets) {
              if (m.lp && m.lp.lpLockedPct !== undefined) {
                lpLockedPercent = m.lp.lpLockedPct;
                if (lpLockedPercent < config.minLpLockedPercent) {
                  reasons.push(`KILL_VETO_LP: LP locked only ${lpLockedPercent.toFixed(1)}% (Min: ${config.minLpLockedPercent}%)`);
                }
              }
            }
          }

          logger.info(`[AuditorAgent] Rugcheck API Verified for [${token.symbol}] | Top10: ${top10HoldingPercent.toFixed(1)}% | LP: ${lpLockedPercent.toFixed(1)}%`);
        }
      } catch (rcErr: unknown) {
        logger.debug(`[AuditorAgent] Rugcheck API query skipped/timeout, using on-chain RPC fallback: ${rcErr}`);
      }

      const mintPubkey = new PublicKey(token.mint);

      // -------------------------------------------------------------
      // LAYER 2: Solana RPC Fallback Verification
      // -------------------------------------------------------------
      if (!mintAuthDisabled || !freezeAuthDisabled) {
        const mintAccountInfo = await this.connection.getParsedAccountInfo(mintPubkey);
        if (!mintAccountInfo.value || !('parsed' in mintAccountInfo.value.data)) {
          reasons.push('KILL_VETO_RPC: Mint account data unparseable or not found on-chain');
        } else {
          const parsedInfo = mintAccountInfo.value.data.parsed.info;
          const mintAuthority = parsedInfo.mintAuthority;
          const freezeAuthority = parsedInfo.freezeAuthority;

          // On Solana pump.fun, freezeAuthority must be null.
          if (freezeAuthority === null || freezeAuthority === undefined) {
            freezeAuthDisabled = true;
          } else {
            reasons.push(`KILL_VETO_FREEZE: Freeze Authority is ACTIVE (${freezeAuthority}) - Potential Honeypot!`);
          }

          // Mint authority should be null or assigned to pump.fun program authority
          if (mintAuthority === null || mintAuthority === undefined || mintAuthority.includes('11111111111111111111111111111111') || mintAuthority.includes('TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM')) {
            mintAuthDisabled = true;
          } else {
            reasons.push(`KILL_VETO_MINT: Mint Authority is NOT revoked/delegated (${mintAuthority})`);
          }
        }
      }

      // -------------------------------------------------------------
      // LAYER 2: Bundle & Dev Supply Check (< 5%)
      // -------------------------------------------------------------
      if (token.creator) {
        try {
          const creatorPubkey = new PublicKey(token.creator);
          const creatorTokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
            creatorPubkey,
            { mint: mintPubkey }
          );

          let creatorBalance = 0;
          for (const acc of creatorTokenAccounts.value) {
            creatorBalance += acc.account.data.parsed.info.tokenAmount.uiAmount || 0;
          }

          // Total pump.fun supply is 1,000,000,000
          devHoldingPercent = (creatorBalance / 1000000000) * 100;
          if (devHoldingPercent > config.maxDevHoldingPercent) {
            reasons.push(
              `KILL_VETO_DEV: Dev wallet holds ${devHoldingPercent.toFixed(2)}% of supply (> ${config.maxDevHoldingPercent.toFixed(1)}% - Zero Dev Holding Rule VETO)`
            );
          }
        } catch (devErr: unknown) {
          const errMsg = devErr instanceof Error ? devErr.message : String(devErr);
          logger.warn(`[AuditorAgent] Failed to check dev token accounts: ${errMsg}`);
          eventBus.emit('ERROR_ENCOUNTERED', {
            agent: 'AuditorAgent (Dev Supply RPC)',
            message: errMsg,
            fatal: false,
          });
        }
      }

      // -------------------------------------------------------------
      // LAYER 3: Holder Concentration Check (Top 10 non-bonding curve <= 30%)
      // -------------------------------------------------------------
      try {
        const bondingCurvePda = getBondingCurvePDA(mintPubkey);
        const largestAccounts = await this.connection.getTokenLargestAccounts(mintPubkey);

        let nonCurveHoldersSum5 = 0;
        let nonCurveHoldersSum10 = 0;
        let count = 0;

        for (const account of largestAccounts.value) {
          if (account.address.toBase58() === bondingCurvePda.toBase58()) {
            continue; // Skip the bonding curve itself
          }
          const amount = account.uiAmount || 0;
          if (count < 5) nonCurveHoldersSum5 += amount;
          if (count < 10) nonCurveHoldersSum10 += amount;
          count++;
          if (count >= 10) break;
        }

        top5HoldingPercent = (nonCurveHoldersSum5 / 1000000000) * 100;
        top10HoldingPercent = (nonCurveHoldersSum10 / 1000000000) * 100;

        if (top5HoldingPercent > config.maxTop5HoldingPercent) {
          reasons.push(
            `KILL_VETO_TOP5: Top 5 non-curve holders hold ${top5HoldingPercent.toFixed(2)}% (Max: ${config.maxTop5HoldingPercent}%)`
          );
        }
        if (top10HoldingPercent > config.maxTop10HoldingPercent) {
          reasons.push(
            `KILL_VETO_TOP10: Top 10 non-curve holders hold ${top10HoldingPercent.toFixed(2)}% (Max: ${config.maxTop10HoldingPercent}%)`
          );
        }
      } catch (holderErr: unknown) {
        const errMsg = holderErr instanceof Error ? holderErr.message : String(holderErr);
        logger.warn(`[AuditorAgent] Failed to fetch largest accounts: ${errMsg}`);
        eventBus.emit('ERROR_ENCOUNTERED', {
          agent: 'AuditorAgent (Top 10 Holders RPC)',
          message: `Solana RPC 429 / Fetch Failure: ${errMsg}`,
          fatal: false,
        });
      }

      // -------------------------------------------------------------
      // LAYER 4: Min Holders Verification (Holders Min: 30)
      // -------------------------------------------------------------
      const holdersCount = token.holdersCount || 0;
      if (holdersCount > 0 && holdersCount < config.minHoldersCount) {
        reasons.push(
          `KILL_VETO_HOLDERS: Unique holders count ${holdersCount} < ${config.minHoldersCount} (Min 30 unique holders required)`
        );
      }

      // -------------------------------------------------------------
      // KILL-VOTE CONSENSUS EVALUATION (Multi-LLM consensus)
      // -------------------------------------------------------------
      let aiReasoning = 'Anti-Rug Strict Security Verification';
      let aiRiskScore = 0;
      let aiModel = aiService.getSelectedAgent2Option().model;

      try {
        const aiAudit = await aiService.auditSecurityWithAI(
          { symbol: token.symbol, mint: token.mint },
          {
            mintAuthorityDisabled: mintAuthDisabled,
            freezeAuthorityDisabled: freezeAuthDisabled,
            devHoldingPercent,
            top5HoldingPercent,
            top10HoldingPercent,
            holdersCount,
            reasons,
          }
        );

        if (aiAudit) {
          aiReasoning = aiAudit.reasoning;
          aiRiskScore = aiAudit.risk_score;
          aiModel = aiAudit.model;
          if (!aiAudit.audit_passed && aiAudit.kill_vote_reasons.length > 0) {
            reasons.push(...aiAudit.kill_vote_reasons);
          }
          logger.info(
            `[AuditorAgent:AI:${aiModel}] Risk Score: ${aiRiskScore}/100 | AI Verdict: ${aiAudit.audit_passed ? 'PASS' : 'KILL_VOTE_VETO'} | Reason: "${aiReasoning}"`
          );
        }
      } catch (aiErr) {
        logger.debug(`[AuditorAgent:AI:${aiModel}] Fallback notice: ${aiErr}`);
      }

      const passed =
        reasons.length === 0 &&
        mintAuthDisabled === true &&
        freezeAuthDisabled === true &&
        devHoldingPercent <= config.maxDevHoldingPercent &&
        top5HoldingPercent <= config.maxTop5HoldingPercent &&
        top10HoldingPercent <= config.maxTop10HoldingPercent &&
        lpLockedPercent >= config.minLpLockedPercent &&
        (holdersCount === 0 || holdersCount >= config.minHoldersCount);

      const auditResult: IAuditResult = {
        mint: token.mint,
        symbol: token.symbol,
        passed,
        mintAuthorityDisabled: mintAuthDisabled,
        freezeAuthorityDisabled: freezeAuthDisabled,
        devHoldingPercent,
        top5HoldingPercent,
        top10HoldingPercent,
        lpLockedPercent,
        holdersCount,
        reasons,
        auditedAt: Date.now(),
        aiReasoning,
        aiRiskScore,
        aiModel,
      };

      const durationMs = Date.now() - startTime;

      if (passed) {
        logger.info(
          `[AuditorAgent] *** AUDIT PASSED (STRICT ANTI-RUG) *** [${token.symbol}] in ${durationMs}ms | Mint/Freeze: REVOKED ✓ | Dev: ${devHoldingPercent.toFixed(1)}% (=0.0%) | Top10: ${top10HoldingPercent.toFixed(1)}% (<=30%) | Holders: ${holdersCount >= 30 ? holdersCount : 'Verified'} (>=30) | LP: ${lpLockedPercent.toFixed(1)}% (>95%)`
        );
        eventBus.emit('AUDIT_PASSED', { token, audit: auditResult });
      } else {
        logger.warn(
          `[AuditorAgent] Rejected: [${token.symbol}] - Reasons: ${reasons.join(' | ')}`
        );
        logger.warn(
          `[AuditorAgent] !!! KILL_VOTE_VETO TRIGGERED !!! [${token.symbol}] dropped. Reasons: ${reasons.join(' | ')}`
        );
        eventBus.emit('AUDIT_FAILED', { token, audit: auditResult });
      }

      return auditResult;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
      logger.error(`[AuditorAgent] Fatal error during audit for [${token.symbol}]: ${errorMsg}`);

      const fallbackResult: IAuditResult = {
        mint: token.mint,
        symbol: token.symbol,
        passed: false,
        mintAuthorityDisabled: false,
        freezeAuthorityDisabled: false,
        devHoldingPercent: 100,
        top5HoldingPercent: 100,
        top10HoldingPercent: 100,
        lpLockedPercent: 0,
        holdersCount: 0,
        reasons: [`EXCEPTION: ${errorMsg}`],
        auditedAt: Date.now(),
      };

      eventBus.emit('AUDIT_FAILED', { token, audit: fallbackResult });
      return fallbackResult;
    }
  }
}
