import { getDataUserPath } from '@/lib/getDataUserPath';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userName = searchParams.get('userName');
    const profileName = searchParams.get('profileName');
    
    if (!userName || !profileName) {
      return NextResponse.json({ error: 'userName and profileName required' }, { status: 400 });
    }

    const envPath = path.join(getDataUserPath(), userName, profileName, '.env');
    
    try {
      const envContent = await fs.readFile(envPath, 'utf-8');
      
      let ca = '';
      let lp = '';
      
      envContent.split('\n').forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key && rest.length > 0) {
          const val = rest.join('=').trim();
          if (key.trim() === 'DEFAULT_TOKEN_CA') ca = val;
          if (key.trim() === 'LP_POOL_ADDRESS') lp = val;
        }
      });
      
      return NextResponse.json({ ca, lp });
    } catch (e) {
      // File doesn't exist or can't be read
      return NextResponse.json({ ca: '', lp: '' });
    }
  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
