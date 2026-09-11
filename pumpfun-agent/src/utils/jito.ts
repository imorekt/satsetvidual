import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  VersionedTransaction,
} from '@solana/web3.js';
import axios from 'axios';
import bs58 from 'bs58';
import { logger } from './logger';
import { config } from '../config';

// Official Jito Tip Accounts
export const JITO_TIP_ACCOUNTS: string[] = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7CrncAhfdzsZ832GLCa8W6Au9AZys',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pWHLnjvnxyd9AUJa2DaK',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

export function getRandomTipAccount(): PublicKey {
  const randomIndex = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
  return new PublicKey(JITO_TIP_ACCOUNTS[randomIndex]);
}

/**
 * Creates an instruction to transfer tip lamports to a Jito tip account
 */
export function createJitoTipInstruction(
  payer: PublicKey,
  tipLamports: bigint
): TransactionInstruction {
  const tipAccount = getRandomTipAccount();
  return SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: tipAccount,
    lamports: tipLamports,
  });
}

/**
 * Sends a bundle of serialized versioned transactions to the Jito Block Engine
 */
export async function sendJitoBundle(
  transactions: VersionedTransaction[],
  retries = 3
): Promise<string | null> {
  const encodedTransactions = transactions.map((tx) =>
    bs58.encode(tx.serialize())
  );

  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'sendBundle',
    params: [encodedTransactions],
  };

  let attempt = 0;
  while (attempt < retries) {
    attempt++;
    try {
      logger.info(`[JitoMEV] Submitting bundle to ${config.jitoEngineUrl} (Attempt ${attempt}/${retries})...`);
      const response = await axios.post(config.jitoEngineUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 7000,
      });

      if (response.data && response.data.result) {
        const bundleId = response.data.result;
        logger.info(`[JitoMEV] Bundle accepted with ID: ${bundleId}`);
        return bundleId;
      } else if (response.data && response.data.error) {
        logger.warn(`[JitoMEV] Block engine responded with error: ${JSON.stringify(response.data.error)}`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn(`[JitoMEV] Failed to send bundle attempt ${attempt}: ${errorMsg}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }
  }

  logger.error('[JitoMEV] All Jito bundle submission attempts failed.');
  return null;
}
