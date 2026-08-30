import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const { name, walletAddress } = await request.json();
    
    if (!name || !walletAddress) {
      return NextResponse.json({ error: 'Name and walletAddress are required' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'user.json');
    let users = [];

    // Try to read existing file
    try {
      const data = await fs.readFile(filePath, 'utf8');
      if (data) {
        users = JSON.parse(data);
      }
    } catch (err) {
      // If file doesn't exist, we start with empty array
      if (err.code !== 'ENOENT') {
        console.error('Error reading user.json:', err);
      }
    }

    // Check if user already exists
    const existingIndex = users.findIndex(u => u.walletAddress === walletAddress);
    
    if (existingIndex >= 0) {
      // Update existing user
      users[existingIndex].name = name;
      users[existingIndex].lastLogin = new Date().toISOString();
    } else {
      // Add new user
      users.push({
        name,
        walletAddress,
        firstLogin: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });

    }

    // --- AUTO FOLDER CREATION ---
    try {
      const dataUserPath = path.join(process.cwd(), '..', 'data_user', name);
      
      // 1. Create data_user/Name folder
      if (!fsSync.existsSync(dataUserPath)) {
        await fs.mkdir(dataUserPath, { recursive: true });
      }

      // 2. Create .env file
      const envPath = path.join(dataUserPath, '.env');
      if (!fsSync.existsSync(envPath)) {
        await fs.writeFile(envPath, `PRIVATE_KEY=\nRPC_URL=https://mainnet.base.org\n`, 'utf8');
      }

      // 3. Create tokentren folder
      const tokentrenPath = path.join(dataUserPath, 'tokentren');
      if (!fsSync.existsSync(tokentrenPath)) {
        await fs.mkdir(tokentrenPath, { recursive: true });
      }

      // 4. Copy globallist.json to list.json
      const globalListPath = path.join(process.cwd(), 'globallist.json');
      const listJsonPath = path.join(tokentrenPath, 'list.json');
      
      if (fsSync.existsSync(globalListPath) && !fsSync.existsSync(listJsonPath)) {
        await fs.copyFile(globalListPath, listJsonPath);
      }
    } catch (folderErr) {
      console.error('Error creating user folders:', folderErr);
    }
    // ----------------------------

    // Write back to file
    await fs.writeFile(filePath, JSON.stringify(users, null, 2), 'utf8');

    return NextResponse.json({ success: true, message: 'User saved successfully' });
  } catch (error) {
    console.error('Save user error:', error);
    return NextResponse.json({ error: 'Failed to save user data' }, { status: 500 });
  }
}
