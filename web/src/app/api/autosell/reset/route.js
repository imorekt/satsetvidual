import { getDataUserPath } from '@/lib/getDataUserPath';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req) {
  try {
    const body = await req.json();
    const { userName, profileName } = body;
    
    if (!userName || !profileName) {
      return NextResponse.json({ error: 'userName and profileName are required' }, { status: 400 });
    }

    const userDir = path.join(getDataUserPath(), userName, profileName);
    
    try {
      await fs.rm(userDir, { recursive: true, force: true });
    } catch (err) {
      // If folder doesn't exist, it's fine
      console.log(`Directory ${userDir} might not exist or could not be removed.`);
    }

    return NextResponse.json({ success: true, message: 'Reset successfully' });
  } catch (error) {
    console.error('Error resetting config:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
