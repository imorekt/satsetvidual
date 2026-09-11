import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const { filePath, target, replacement, fullContent, mode, isRegex } = await request.json();

    if (!filePath) {
      return NextResponse.json({ error: 'filePath is required' }, { status: 400 });
    }

    const baseDir = process.cwd();
    const absolutePath = path.resolve(baseDir, filePath);

    if (!absolutePath.startsWith(baseDir)) {
      return NextResponse.json({ error: 'Path traversal is forbidden' }, { status: 403 });
    }

    // Read current content if file exists
    let originalContent = '';
    let fileExisted = true;
    try {
      originalContent = await fs.readFile(absolutePath, 'utf8');
    } catch {
      fileExisted = false;
    }

    // Save backup for undo
    try {
      const backupDir = path.join(baseDir, '.agent6_backup');
      await fs.mkdir(backupDir, { recursive: true });
      const backupFilename = `${Date.now()}_${path.basename(filePath)}.bak`;
      if (fileExisted) {
        await fs.writeFile(path.join(backupDir, backupFilename), originalContent, 'utf8');
      }
    } catch (bErr) {
      console.warn('Backup warning:', bErr);
    }

    let updatedContent = '';

    if (mode === 'overwrite' || fullContent !== undefined) {
      updatedContent = fullContent;
    } else if (target !== undefined && replacement !== undefined) {
      if (!fileExisted) {
        return NextResponse.json({ error: `File not found: ${filePath}` }, { status: 404 });
      }

      if (isRegex) {
        const regex = new RegExp(target, 'g');
        updatedContent = originalContent.replace(regex, replacement);
      } else {
        if (!originalContent.includes(target)) {
          return NextResponse.json({
            error: 'Target code snippet was not found in the file. Please verify the exact text to replace.',
            filePath
          }, { status: 422 });
        }
        updatedContent = originalContent.split(target).join(replacement);
      }
    } else {
      return NextResponse.json({ error: 'Invalid patch payload. Provide target/replacement or fullContent.' }, { status: 400 });
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, updatedContent, 'utf8');

    return NextResponse.json({
      success: true,
      filePath,
      action: fileExisted ? 'modified' : 'created',
      bytes: updatedContent.length,
      timestamp: new Date().toISOString(),
      message: `File ${filePath} berhasil diperbarui oleh Agent 6!`
    });
  } catch (error) {
    console.error('Apply Patch API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
