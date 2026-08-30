import { NextResponse } from 'next/server';
import { globalStats } from '@/lib/bot/globalStats';
import { botProcesses } from '@/lib/bot/store';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const stats = globalStats.getStats();
    
    // Check if any bot is running
    const activeBots = Object.keys(botProcesses).filter(k => botProcesses[k].isRunning);
    const isRunning = activeBots.length > 0;
    
    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        isRunning
      }
    });
  } catch (error) {
    console.error('Error fetching global stats:', error);
    return NextResponse.json({ error: 'Failed to fetch global stats' }, { status: 500 });
  }
}
