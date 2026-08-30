import { getDataUserPath } from '@/lib/getDataUserPath';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function POST(req) {
  try {
    const { userName, profileName } = await req.json();
    if (!userName || !profileName) return NextResponse.json({ error: 'userName and profileName required' }, { status: 400 });

    const logPath = path.join(getDataUserPath(), userName, profileName, 'bot.log');
    const errorLogPath = path.join(getDataUserPath(), userName, profileName, 'error.log');
    
    try {
      await fs.writeFile(logPath, '', 'utf-8');
      await fs.writeFile(errorLogPath, '=== BOT ERROR LOG ===\n', 'utf-8');
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ success: true }); // Ignore if file doesn't exist
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear logs' }, { status: 500 });
  }
}
