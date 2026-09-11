import { getDataUserPath } from '@/lib/getDataUserPath';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function POST(req) {
  try {
    const { userName } = await req.json();

    if (!userName) {
      return NextResponse.json({ error: 'userName is required' }, { status: 400 });
    }

    const userBaseDir = path.join(getDataUserPath(), userName);
    const globalLogPath = path.join(userBaseDir, 'global_bot.log');

    try {
      await fs.writeFile(globalLogPath, '', 'utf-8');
    } catch (e) {
      // Ignored if file doesn't exist
    }

    return NextResponse.json({ success: true, message: 'Global log cleared' });
  } catch (error) {
    console.error('Error clearing global logs:', error);
    return NextResponse.json({ error: 'Failed to clear global logs' }, { status: 500 });
  }
}
