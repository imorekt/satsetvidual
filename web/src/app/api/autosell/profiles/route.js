import { getDataUserPath } from '@/lib/getDataUserPath';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userName = searchParams.get('userName');
    
    if (!userName) {
      return NextResponse.json({ profiles: [] });
    }

    const dataUserDir = path.join(getDataUserPath(), userName);
    
    // Check if data_user/userName exists
    try {
      await fs.access(dataUserDir);
    } catch {
      // If it doesn't exist, return empty array
      return NextResponse.json({ profiles: [] });
    }

    // Read all contents of data_user
    const items = await fs.readdir(dataUserDir, { withFileTypes: true });
    
    // Filter out only directories and exclude 'tokentren'
    const profiles = items
      .filter(item => item.isDirectory() && item.name.toLowerCase() !== 'tokentren')
      .map(item => item.name);

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
