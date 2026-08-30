import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const { oldName, newName, walletAddress } = await request.json();
    
    if (!oldName || !newName || !walletAddress) {
      return NextResponse.json({ error: 'oldName, newName, and walletAddress are required' }, { status: 400 });
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
      if (err.code !== 'ENOENT') {
        console.error('Error reading user.json:', err);
      }
    }

    // Find and update user in user.json
    const userIndex = users.findIndex(u => u.walletAddress === walletAddress && u.name === oldName);
    
    if (userIndex >= 0) {
      users[userIndex].name = newName;
      await fs.writeFile(filePath, JSON.stringify(users, null, 2), 'utf8');
    }

    // Rename the folder in data_user
    try {
      const oldFolderPath = path.join(process.cwd(), '..', 'data_user', oldName);
      const newFolderPath = path.join(process.cwd(), '..', 'data_user', newName);
      
      if (fsSync.existsSync(oldFolderPath)) {
        await fs.rename(oldFolderPath, newFolderPath);
      } else {
        // If it doesn't exist, just create the new one
        await fs.mkdir(newFolderPath, { recursive: true });
        const envPath = path.join(newFolderPath, '.env');
        if (!fsSync.existsSync(envPath)) {
          await fs.writeFile(envPath, `PRIVATE_KEY=\nRPC_URL=https://mainnet.base.org\n`, 'utf8');
        }
        const tokentrenPath = path.join(newFolderPath, 'tokentren');
        if (!fsSync.existsSync(tokentrenPath)) {
          await fs.mkdir(tokentrenPath, { recursive: true });
        }
        const globalListPath = path.join(process.cwd(), 'globallist.json');
        const listJsonPath = path.join(tokentrenPath, 'list.json');
        if (fsSync.existsSync(globalListPath) && !fsSync.existsSync(listJsonPath)) {
          await fs.copyFile(globalListPath, listJsonPath);
        }
      }
    } catch (folderErr) {
      console.error('Error renaming user folder:', folderErr);
      return NextResponse.json({ error: 'Failed to rename folder' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Name updated successfully' });
  } catch (error) {
    console.error('Update name error:', error);
    return NextResponse.json({ error: 'Failed to update name' }, { status: 500 });
  }
}
