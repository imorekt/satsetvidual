import { getDataUserPath } from '@/lib/getDataUserPath';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { BaseAutoSellBot } from '@/lib/bot/BaseAutoSellBot';
import { botProcesses } from '@/lib/bot/store';

export async function POST(req) {
  try {
    const { userName, pks } = await req.json();
    
    if (!userName) {
      return NextResponse.json({ error: 'userName is required' }, { status: 400 });
    }

    const userBaseDir = path.join(getDataUserPath(), userName);
    const globalStatusPath = path.join(userBaseDir, 'global_status.txt');
    const globalLogPath = path.join(userBaseDir, 'global_bot.log');

    // === REMOTE KILL SWITCH CHECK ===
    const LICENSE_URL = "https://gist.githubusercontent.com/imorekt/f6bf1d9e712d4a6213126bd60e1293ce/raw/2b646e3fbdf714cc1799ac6f40f0f7d874f02589/license.json";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const licRes = await fetch(LICENSE_URL, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      
      if (licRes.ok) {
        const licData = await licRes.json();
        if (licData && licData.active === false) {
          return NextResponse.json({ error: 'Aplikasi dinonaktifkan oleh Admin (Kill Switch)' }, { status: 403 });
        }
      }
    } catch (err) {}
    // ======================================

    // Clear global log
    await fs.writeFile(globalLogPath, '', 'utf-8').catch(() => {});

    // Read profiles
    let profiles = [];
    try {
      const entries = await fs.readdir(userBaseDir, { withFileTypes: true });
      profiles = entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch (e) {
      return NextResponse.json({ error: 'No profiles found' }, { status: 404 });
    }

    let startedCount = 0;

    for (const profileName of profiles) {
      const userDir = path.join(userBaseDir, profileName);
      const envPath = path.join(userDir, '.env');

      try {
        await fs.access(envPath);
      } catch {
        continue; // Skip if no .env
      }

      // Stop existing bot if any
      const processKey = `${userName}_${profileName}`;
      if (botProcesses[processKey]) {
        try {
          if (botProcesses[processKey].stop) {
            botProcesses[processKey].stop();
          }
        } catch (e) {}
        delete botProcesses[processKey];
      }

      // Parse .env
      const envContent = await fs.readFile(envPath, 'utf-8');
      const config = { userId: userName, profileName: profileName };
      envContent.split('\n').forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key && rest.length > 0) {
          const val = rest.join('=').trim();
          if (key.trim() === 'RPC_URL') config.rpcUrl = val;
          if (key.trim() === 'DEFAULT_TOKEN_CA') config.tokenCa = val;
          if (key.trim() === 'LP_POOL_ADDRESS') config.lpPool = val;
          if (key.trim() === 'SLIPPAGE') config.slippage = parseFloat(val);
          if (key.trim() === 'SELL_RATIO_PERCENT') config.sellRatio = parseFloat(val);
        }
      });

      // Inject private key from frontend
      config.privateKey = (pks && pks[profileName]) ? pks[profileName] : null;

      // To run without passing privateKey from client, we rely purely on .env!
      if (!config.privateKey) {
        continue; // Cannot run without PK
      }

      config.dexChoice = "aerodrome"; 

      // Start JS Bot
      const bot = new BaseAutoSellBot(config);
      botProcesses[processKey] = bot;
      
      // Update local status for individual Screener V2 monitoring
      const statusPath = path.join(userDir, 'status.txt');
      await fs.writeFile(statusPath, 'RUNNING', 'utf-8').catch(() => {});

      // Run
      bot.start().catch(err => {
        console.error(`[${userName}_${profileName}] Bot error:`, err);
        bot.errorLog(`Crash: ${err.message}`);
      });

      startedCount++;
    }

    if (startedCount === 0) {
       return NextResponse.json({ error: 'Tidak ada profil valid (pastikan sudah disave/memiliki Private Key)' }, { status: 400 });
    }

    await fs.writeFile(globalStatusPath, 'RUNNING', 'utf-8').catch(() => {});

    return NextResponse.json({ success: true, message: `Berhasil memulai ${startedCount} profil` });
  } catch (error) {
    console.error('Error starting all bots:', error);
    return NextResponse.json({ error: 'Failed to start bots globally' }, { status: 500 });
  }
}
