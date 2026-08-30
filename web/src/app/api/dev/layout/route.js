import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request) {
  try {
    const filePath = path.join(process.cwd(), 'layout-config.json');
    let config = { screenerV2: { rightColumnWidth: 380, leftColumnWidth: null, labels: { autoSellSetup: "AUTO SELL SETUP", profilSetup: "PROFIL SETUP", logTerminal: "LOG TERMINAL" } } };
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      if (data) config = JSON.parse(data);
    } catch (err) {
      // If file doesn't exist, we return default and create it.
      await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
    }
    
    return NextResponse.json(config);
  } catch (error) {
    console.error('Dev Layout API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const updates = await request.json();
    const filePath = path.join(process.cwd(), 'layout-config.json');
    let config = {};
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      if (data) config = JSON.parse(data);
    } catch (err) {}

    // Merge updates
    config = { ...config, ...updates };

    await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
    
    return NextResponse.json({ success: true, message: 'Layout config updated!' });
  } catch (error) {
    console.error('Dev Layout API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
