import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'layout.json');

// Default layout configuration
const DEFAULT_LAYOUT = {
    colWidth: { info: 330, left: 1384, right: 330, search: 1000, btnCari: 120 },
    colPos: { info: { x: 0, y: 4 }, left: { x: 337, y: 4 }, right: { x: 1729, y: 4 }, search: { x: 337, y: 22 }, btnCari: { x: 1350, y: 22 } },
    colHeight: { info: 938, left: 938, right: 938, search: 45, btnCari: 45 },
    cardOrder: { controlPanel: 1, terminal: 2 }
};

export async function GET() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        try {
            const data = await fs.readFile(FILE_PATH, 'utf8');
            return NextResponse.json(JSON.parse(data));
        } catch (e) {
            if (e.code === 'ENOENT') {
                // File does not exist, save and return default
                await fs.writeFile(FILE_PATH, JSON.stringify(DEFAULT_LAYOUT, null, 2), 'utf8');
                return NextResponse.json(DEFAULT_LAYOUT);
            }
            throw e;
        }
    } catch (error) {
        console.error('API Layout GET Error:', error);
        return NextResponse.json({ error: 'Failed to read layout', details: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        
        // Basic validation
        if (!body.colWidth || !body.colPos || !body.colHeight || !body.cardOrder) {
            return NextResponse.json({ error: 'Invalid layout data structure' }, { status: 400 });
        }

        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(FILE_PATH, JSON.stringify(body, null, 2), 'utf8');
        
        return NextResponse.json({ success: true, message: 'Layout updated successfully' });
    } catch (error) {
        console.error('API Layout POST Error:', error);
        return NextResponse.json({ error: 'Failed to save layout', details: error.message }, { status: 500 });
    }
}
