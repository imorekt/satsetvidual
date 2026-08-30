import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const name = searchParams.get('name');
    
    if (!email || !name) {
      return NextResponse.json({ exists: false, error: 'Email and name are required' });
    }

    const filePath = path.join(process.cwd(), 'user.json');
    let users = [];

    if (fsSync.existsSync(filePath)) {
      const data = await fs.readFile(filePath, 'utf8');
      if (data) {
        try {
          users = JSON.parse(data);
        } catch (e) {
          // Ignore parse errors for empty files
        }
      }
    }

    const user = users.find(u => u.walletAddress === email && u.name === name);
    const userExists = !!user;

    // If user does not exist in user.json, but their folder exists, delete their folder!
    if (!userExists) {
      const dataUserPath = path.join(process.cwd(), '..', 'data_user', name);
      if (fsSync.existsSync(dataUserPath)) {
        try {
          // Use rmSync to avoid Windows asynchronous lock EPERM bugs
          fsSync.rmSync(dataUserPath, { recursive: true, force: true });
          console.log(`Deleted user folder for ${name} because they were removed from user.json`);
        } catch (err) {
          console.error(`Failed to delete folder for ${name}:`, err);
        }
      }
    }

    return NextResponse.json({ exists: userExists, role: user ? user.role : 'Member' });
  } catch (error) {
    console.error('Check user error:', error);
    return NextResponse.json({ exists: true }); // Default to true on error to avoid false logouts
  }
}
