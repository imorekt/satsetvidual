import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const { changes } = await request.json();
    
    if (!changes || !Array.isArray(changes)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const baseDir = process.cwd();
    let updatedFiles = 0;

    for (const change of changes) {
      if (!change.file || !change.target || !change.replacement) continue;
      
      const filePath = path.join(baseDir, change.file);
      
      try {
        let content = await fs.readFile(filePath, 'utf8');
        let newContent = content;

        if (change.isRegex) {
          const regex = new RegExp(change.target, 'g');
          newContent = content.replace(regex, change.replacement);
        } else {
          // simple string replacement
          newContent = content.split(change.target).join(change.replacement);
        }

        if (content !== newContent) {
          await fs.writeFile(filePath, newContent, 'utf8');
          updatedFiles++;
        }
      } catch (err) {
        console.error(`Failed to modify file ${filePath}`, err);
      }
    }

    return NextResponse.json({ success: true, message: `Updated ${updatedFiles} files successfully.` });
  } catch (error) {
    console.error('Write Source API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
