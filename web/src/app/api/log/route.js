import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const data = await request.json();
    
    // Format and print log to the Node terminal
    const time = new Date().toISOString();
    const type = data.type ? data.type.toUpperCase() : 'INFO';
    
    let colorStart = '';
    let colorEnd = '\x1b[0m';
    
    if (type === 'ERROR') colorStart = '\x1b[31m'; // Red
    else if (type === 'WARN') colorStart = '\x1b[33m'; // Yellow
    else if (type === 'INTERACTION') colorStart = '\x1b[36m'; // Cyan
    else colorStart = '\x1b[32m'; // Green

    console.log(`${colorStart}[${time}] [CLIENT ${type}]${colorEnd}`, data.message);
    if (data.details) {
      console.log(`${colorStart}Details:${colorEnd}`, data.details);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to parse client log:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
