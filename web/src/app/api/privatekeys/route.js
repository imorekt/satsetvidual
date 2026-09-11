import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const targetPath = 'D:\\SEMUABOT\\NEWBOT\\privatekey.txt';
    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ accounts: [] });
    }

    const content = fs.readFileSync(targetPath, 'utf8');
    const lines = content.split('\n');
    const accounts = [];
    
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine || cleanLine.startsWith('#')) continue;
      
      if (cleanLine.includes(':')) {
        const parts = cleanLine.split(':');
        const label = parts[0].trim();
        const key = parts.slice(1).join(':').trim();
        accounts.push({ label, key });
      } else {
        accounts.push({ label: `Akun ${accounts.length + 1}`, key: cleanLine });
      }
    }

    return NextResponse.json({ accounts });
  } catch (err) {
    console.error('Error reading private keys:', err);
    return NextResponse.json({ accounts: [] }, { status: 500 });
  }
}
