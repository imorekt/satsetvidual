import { getDataUserPath } from '@/lib/getDataUserPath';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { botProcesses } from '@/lib/bot/store';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userName = searchParams.get('userName');
    
    if (!userName) return NextResponse.json({ error: 'userName required' }, { status: 400 });
    
    const userBaseDir = path.join(getDataUserPath(), userName);
    const globalLogPath = path.join(userBaseDir, 'global_bot.log');
    const globalStatusPath = path.join(userBaseDir, 'global_status.txt');
    
    let isRunning = false;
    
    try {
      const statusText = await fs.readFile(globalStatusPath, 'utf-8');
      if (statusText.trim() === 'RUNNING') {
        // Check if ANY process for this user is actually running in memory
        let anyRunning = false;
        for (const key in botProcesses) {
          if (key.startsWith(`${userName}_`)) {
            anyRunning = true;
            break;
          }
        }
        
        if (anyRunning) {
          isRunning = true;
        } else {
          await fs.writeFile(globalStatusPath, 'STOPPED', 'utf-8').catch(() => {});
          isRunning = false;
        }
      }
    } catch (e) {
      // If file doesn't exist, assume not running
    }
    
    try {
      const logs = await fs.readFile(globalLogPath, 'utf-8');
      return NextResponse.json({ logs, isRunning });
    } catch {
      return NextResponse.json({ logs: '', isRunning });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read global logs' }, { status: 500 });
  }
}
