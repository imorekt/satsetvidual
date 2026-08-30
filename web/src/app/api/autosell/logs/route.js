import { getDataUserPath } from '@/lib/getDataUserPath';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { botProcesses } from '@/lib/bot/store';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userName = searchParams.get('userName');
    const profileName = searchParams.get('profileName');
    
    if (!userName || !profileName) return NextResponse.json({ error: 'userName and profileName required' }, { status: 400 });
    const userDir = path.join(getDataUserPath(), userName, profileName);
    const logPath = path.join(userDir, 'bot.log');
    
    const statusPath = path.join(userDir, 'status.txt');
    
    let isRunning = false;
    const processKey = `${userName}_${profileName}`;
    try {
      const statusText = await fs.readFile(statusPath, 'utf-8');
      if (statusText.trim() === 'RUNNING') {
        if (botProcesses[processKey]) {
          isRunning = true;
        } else {
          // Bot is not in memory! The Next.js server was restarted.
          // Correct the status.txt file.
          await fs.writeFile(statusPath, 'STOPPED', 'utf-8').catch(() => {});
          isRunning = false;
        }
      }
    } catch (e) {
      // If file doesn't exist, assume not running
    }
    
    try {
      const logs = await fs.readFile(logPath, 'utf-8');
      return NextResponse.json({ logs, isRunning });
    } catch {
      return NextResponse.json({ logs: '', isRunning });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read logs' }, { status: 500 });
  }
}
