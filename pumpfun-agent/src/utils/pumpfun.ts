import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { BondingCurveAccount } from '../types';

export const PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
export const PUMP_FUN_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
export const PUMP_FUN_EVENT_AUTHORITY = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');

// Discriminators for Pump.fun Anchor instructions
export const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);
export const SELL_DISCRIMINATOR = Buffer.from([51, 230, 133, 164, 1, 127, 73, 173]);

/**
 * Derives the Bonding Curve PDA for a given token mint
 */
export function getBondingCurvePDA(mint: PublicKey): PublicKey {
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), mint.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return bondingCurve;
}

/**
 * Derives the Pump.fun Global State PDA
 */
export function getGlobalStatePDA(): PublicKey {
  const [globalState] = PublicKey.findProgramAddressSync(
    [Buffer.from('global')],
    PUMP_FUN_PROGRAM_ID
  );
  return globalState;
}

/**
 * Derives the Associated Token Account for the bonding curve
 */
export function getBondingCurveTokenAccount(mint: PublicKey, bondingCurve: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(
    mint,
    bondingCurve,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

/**
 * Parse the raw account data buffer of a pump.fun bonding curve account
 */
export function parseBondingCurveAccount(data: Buffer): BondingCurveAccount {
  if (data.length < 49) {
    throw new Error(`Invalid bonding curve account buffer length: ${data.length}`);
  }

  const discriminator = data.readBigUInt64LE(0);
  const virtualTokenReserves = data.readBigUInt64LE(8);
  const virtualSolReserves = data.readBigUInt64LE(16);
  const realTokenReserves = data.readBigUInt64LE(24);
  const realSolReserves = data.readBigUInt64LE(32);
  const tokenTotalSupply = data.readBigUInt64LE(40);
  const complete = data.readUInt8(48) === 1;

  return {
    discriminator,
    virtualTokenReserves,
    virtualSolReserves,
    realTokenReserves,
    realSolReserves,
    tokenTotalSupply,
    complete,
  };
}

/**
 * Calculate token output from SOL input on pump.fun bonding curve (constant product k = x * y)
 */
export function calculateTokensForSol(
  solAmountLamports: bigint,
  curve: BondingCurveAccount
): bigint {
  if (solAmountLamports <= 0n) return 0n;

  // Pump.fun fee is 1% (100 bps)
  const feeLamports = (solAmountLamports * 100n) / 10000n;
  const netSolLamports = solAmountLamports - feeLamports;

  const virtualSol = curve.virtualSolReserves;
  const virtualToken = curve.virtualTokenReserves;

  // Constant product invariant: k = virtualSol * virtualToken
  const k = virtualSol * virtualToken;
  const newSol = virtualSol + netSolLamports;
  const newToken = k / newSol;

  const tokensOut = virtualToken - newToken;
  return tokensOut > curve.realTokenReserves ? curve.realTokenReserves : tokensOut;
}

/**
 * Calculate SOL output from token input on pump.fun bonding curve
 */
export function calculateSolForTokens(
  tokenAmount: bigint,
  curve: BondingCurveAccount
): bigint {
  if (tokenAmount <= 0n) return 0n;

  const virtualSol = curve.virtualSolReserves;
  const virtualToken = curve.virtualTokenReserves;

  const k = virtualSol * virtualToken;
  const newToken = virtualToken + tokenAmount;
  const newSol = k / newToken;

  const grossSolOut = virtualSol - newSol;
  // Subtract 1% pump.fun fee
  const feeLamports = (grossSolOut * 100n) / 10000n;
  return grossSolOut - feeLamports;
}

/**
 * Calculates current price in SOL per token
 */
export function calculateTokenPriceSol(curve: BondingCurveAccount): number {
  const solReservesNum = Number(curve.virtualSolReserves) / 1e9;
  const tokenReservesNum = Number(curve.virtualTokenReserves) / 1e6;
  if (tokenReservesNum === 0) return 0;
  return solReservesNum / tokenReservesNum;
}

/**
 * Builds the Pump.fun Buy Instruction
 */
export function createPumpFunBuyInstruction(
  userPublicKey: PublicKey,
  mint: PublicKey,
  amountTokens: bigint,
  maxSolCostLamports: bigint
): TransactionInstruction {
  const bondingCurve = getBondingCurvePDA(mint);
  const associatedBondingCurve = getBondingCurveTokenAccount(mint, bondingCurve);
  const userTokenAccount = getAssociatedTokenAddressSync(
    mint,
    userPublicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const globalState = getGlobalStatePDA();

  const data = Buffer.alloc(8 + 8 + 8);
  BUY_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(amountTokens, 8);
  data.writeBigUInt64LE(maxSolCostLamports, 16);

  const keys = [
    { pubkey: globalState, isSigner: false, isWritable: false },
    { pubkey: PUMP_FUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: bondingCurve, isSigner: false, isWritable: true },
    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userPublicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: PUMP_FUN_EVENT_AUTHORITY, isSigner: false, isWritable: false },
    { pubkey: PUMP_FUN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId: PUMP_FUN_PROGRAM_ID,
    data,
  });
}

/**
 * Builds the Pump.fun Sell Instruction
 */
export function createPumpFunSellInstruction(
  userPublicKey: PublicKey,
  mint: PublicKey,
  amountTokens: bigint,
  minSolOutputLamports: bigint
): TransactionInstruction {
  const bondingCurve = getBondingCurvePDA(mint);
  const associatedBondingCurve = getBondingCurveTokenAccount(mint, bondingCurve);
  const userTokenAccount = getAssociatedTokenAddressSync(
    mint,
    userPublicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const data = Buffer.alloc(8 + 8 + 8);
  SELL_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(amountTokens, 8);
  data.writeBigUInt64LE(minSolOutputLamports, 16);

  const keys = [
    { pubkey: getGlobalStatePDA(), isSigner: false, isWritable: false },
    { pubkey: PUMP_FUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: bondingCurve, isSigner: false, isWritable: true },
    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userPublicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: PUMP_FUN_EVENT_AUTHORITY, isSigner: false, isWritable: false },
    { pubkey: PUMP_FUN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId: PUMP_FUN_PROGRAM_ID,
    data,
  });
}
