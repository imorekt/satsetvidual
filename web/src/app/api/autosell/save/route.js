import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getDataUserPath } from '@/lib/getDataUserPath';

export async function POST(req) {
  try {
    const body = await req.json();
    const { userName, profileName, privateKey, inputCa, lpPool, rpc, gasMultiplier, slippage, sellRatio } = body;
    
    if (!userName || !profileName) {
      return NextResponse.json({ error: 'userName and profileName are required' }, { status: 400 });
    }

    // Path to data_user/[userName]/[profileName]
    const dataUserDir = getDataUserPath();
    const userDir = path.join(dataUserDir, userName, profileName);
    
    // Create directory if it doesn't exist
    await fs.mkdir(userDir, { recursive: true });

    // Build .env content
    const envContent = `# ==============================================================================
#  KONFIGURASI LINGKUNGAN BOT AUTO-SELL BASE
#  USER: ${userName}
# ==============================================================================
RPC_URL=${rpc || 'https://mainnet.base.org,https://base-mainnet.g.alchemy.com/public'}
SLIPPAGE=${slippage || '2.5'}
GAS_MULTIPLIER=${gasMultiplier || '1.2'}
DEFAULT_TOKEN_CA=${inputCa || ''}
LP_POOL_ADDRESS=${lpPool || ''}
SELL_RATIO_PERCENT=${sellRatio || '98'}
`;

    const envPath = path.join(userDir, '.env');
    await fs.writeFile(envPath, envContent, 'utf-8');

    // Create log files if they don't exist
    const logPath = path.join(userDir, 'bot.log');
    const errorLogPath = path.join(userDir, 'error.log');
    try { await fs.access(logPath); } catch { await fs.writeFile(logPath, '', 'utf-8'); }
    try { await fs.access(errorLogPath); } catch { await fs.writeFile(errorLogPath, '', 'utf-8'); }

    return NextResponse.json({ success: true, message: 'Saved successfully' });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
