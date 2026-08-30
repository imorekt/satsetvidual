import { getDataUserPath } from '@/lib/getDataUserPath';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { botProcesses } from '@/lib/bot/store';

export async function POST(req) {
  try {
    const { userName, profileName, developerStop } = await req.json();
    if (!userName || !profileName) return NextResponse.json({ error: 'userName and profileName required' }, { status: 400 });

    const userDir = path.join(getDataUserPath(), userName, profileName);
    const logPath = path.join(userDir, 'bot.log');

    let stopped = true; // Assume success via status file

    // Stop JS Bot
    const processKey = `${userName}_${profileName}`;
    if (botProcesses[processKey]) {
      try {
        if (botProcesses[processKey].stop) {
          botProcesses[processKey].stop(developerStop);
        }
      } catch (e) {
        console.error("Error stopping JS bot:", e);
      }
      delete botProcesses[processKey];
    }
    
    // Write STOPPED to status file so orphaned bot processes stop themselves
    try {
      const statusPath = path.join(userDir, 'status.txt');
      await fs.writeFile(statusPath, developerStop ? 'DEVELOPER_STOP' : 'STOPPED', 'utf-8');
      await fs.appendFile(logPath, `\nSYSTEM: Bot stopped by user (JS Native)\n`, 'utf-8');
    } catch (e) {}

    return NextResponse.json({ success: true, message: 'Bot stopped' });
  } catch (error) {
    console.error('Error stopping bot:', error);
    return NextResponse.json({ error: 'Failed to stop bot' }, { status: 500 });
  }
}
