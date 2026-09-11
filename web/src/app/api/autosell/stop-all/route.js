import { getDataUserPath } from '@/lib/getDataUserPath';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { botProcesses } from '@/lib/bot/store';

export async function POST(req) {
  try {
    const { userName } = await req.json();

    if (!userName) {
      return NextResponse.json({ error: 'userName is required' }, { status: 400 });
    }

    const userBaseDir = path.join(getDataUserPath(), userName);
    const globalStatusPath = path.join(userBaseDir, 'global_status.txt');

    let stoppedCount = 0;

    for (const key in botProcesses) {
      if (key.startsWith(`${userName}_`)) {
        try {
          if (botProcesses[key].stop) {
            botProcesses[key].stop();
          }
        } catch (e) {
          console.error(`Error stopping bot ${key}:`, e);
        }
        delete botProcesses[key];
        
        // Also update local status so Screener V2 knows it stopped
        const profileName = key.split('_')[1];
        if (profileName) {
           const localStatusPath = path.join(userBaseDir, profileName, 'status.txt');
           await fs.writeFile(localStatusPath, 'STOPPED', 'utf-8').catch(() => {});
        }
        stoppedCount++;
      }
    }

    await fs.writeFile(globalStatusPath, 'STOPPED', 'utf-8').catch(() => {});

    return NextResponse.json({ success: true, message: `Berhasil menghentikan ${stoppedCount} profil` });
  } catch (error) {
    console.error('Error stopping all bots:', error);
    return NextResponse.json({ error: 'Failed to stop bots globally' }, { status: 500 });
  }
}
