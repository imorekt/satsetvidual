import { getDataUserPath } from '@/lib/getDataUserPath';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { BaseAutoSellBot } from '@/lib/bot/BaseAutoSellBot';
import { botProcesses } from '@/lib/bot/store';

export async function POST(req) {
  try {
    const { userName, profileName, privateKey } = await req.json();
    
    if (!userName || !profileName) {
      return NextResponse.json({ error: 'userName and profileName are required' }, { status: 400 });
    }

    const userDir = path.join(getDataUserPath(), userName, profileName);
    const envPath = path.join(userDir, '.env');
    const logPath = path.join(userDir, 'bot.log');
    const errorLogPath = path.join(userDir, 'error.log');
    const statusPath = path.join(userDir, 'status.txt');

    try {
      await fs.access(envPath);
    } catch {
      return NextResponse.json({ error: '.env not found. Please click SAVE first.' }, { status: 404 });
    }

    // Stop existing JS bot if any
    const processKey = `${userName}_${profileName}`;
    if (botProcesses[processKey]) {
      try {
        if (botProcesses[processKey].stop) {
          botProcesses[processKey].stop();
        }
      } catch (e) {
        console.error("Error stopping previous bot instance:", e);
      }
      delete botProcesses[processKey];
    }

    // Initialize fresh logs and status
    await fs.writeFile(logPath, '', 'utf-8');
    await fs.writeFile(errorLogPath, '=== BOT ERROR LOG ===\n', 'utf-8');
    await fs.writeFile(statusPath, 'RUNNING', 'utf-8');

    // Parse .env
    const envContent = await fs.readFile(envPath, 'utf-8');
    const config = { userId: userName, profileName: profileName };
    envContent.split('\n').forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length > 0) {
        const val = rest.join('=').trim();
        if (key.trim() === 'RPC_URL') config.rpcUrl = val;
        if (key.trim() === 'PRIVATE_KEY') config.privateKey = val;
        if (key.trim() === 'DEFAULT_TOKEN_CA') config.tokenCa = val;
        if (key.trim() === 'LP_POOL_ADDRESS') config.lpPool = val;
        if (key.trim() === 'SLIPPAGE') config.slippage = parseFloat(val);
        if (key.trim() === 'SELL_RATIO_PERCENT') config.sellRatio = parseFloat(val);
      }
    });

    if (privateKey) {
      config.privateKey = privateKey;
    }

    // Determine DEX choice (simplified, you can expand this based on your UI)
    config.dexChoice = "aerodrome"; 
    
    // === REMOTE KILL SWITCH CHECK (API) ===
    // TODO: Ganti URL ini dengan URL RAW JSON GitHub Bos
    // Contoh isi file di GitHub: {"active": true}
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
      } else {
        return NextResponse.json({ error: 'Gagal memverifikasi lisensi (Repo tidak ditemukan)' }, { status: 403 });
      }
    } catch (err) {
      return NextResponse.json({ error: 'Koneksi ke server lisensi terputus' }, { status: 403 });
    }
    // ======================================

    // Start JS Bot
    const bot = new BaseAutoSellBot(config);
    botProcesses[processKey] = bot;
    
    // Run it asynchronously without awaiting
    bot.start().catch(err => {
      console.error(`[${userName}] Bot error:`, err);
      bot.errorLog(`Crash: ${err.message}`);
    });

    return NextResponse.json({ success: true, message: 'JS Bot started' });
  } catch (error) {
    console.error('Error starting bot:', error);
    return NextResponse.json({ error: 'Failed to start bot' }, { status: 500 });
  }
}
