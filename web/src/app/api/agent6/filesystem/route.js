import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  '.system_generated',
  '.agents',
  'dist',
  'build',
  '.turbo'
]);

async function getDirectoryTree(dirPath, maxDepth = 4, currentDepth = 0) {
  if (currentDepth >= maxDepth) return null;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const children = await getDirectoryTree(fullPath, maxDepth, currentDepth + 1);
        items.push({
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children: children || []
        });
      } else {
        items.push({
          name: entry.name,
          path: relativePath,
          type: 'file'
        });
      }
    }
    return items;
  } catch (err) {
    return [];
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'tree';
    const filePath = searchParams.get('path');
    const baseDir = process.cwd();

    if (action === 'read' && filePath) {
      const targetPath = path.resolve(baseDir, filePath);
      // Prevent directory traversal
      if (!targetPath.startsWith(baseDir)) {
        return NextResponse.json({ error: 'Access denied: Path out of bounds' }, { status: 403 });
      }
      const content = await fs.readFile(targetPath, 'utf8');
      return NextResponse.json({ success: true, path: filePath, content });
    }

    if (action === 'tree') {
      const tree = await getDirectoryTree(baseDir, 4);
      return NextResponse.json({
        success: true,
        root: baseDir,
        tree,
        framework: 'Next.js App Router',
        features: [
          'Live Code Modification',
          'Full-Stack Web Audit',
          'Vision / Image OCR & Inspector',
          'Self-Verifying Hot-Reload'
        ]
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Agent 6 Filesystem API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
