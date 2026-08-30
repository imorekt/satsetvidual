import { NextResponse } from 'next/server';
import { botProcesses } from '@/lib/bot/store';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userName = searchParams.get('userName');
  
  if (!userName) {
    return NextResponse.json({ count: 0 });
  }

  let totalSells = 0;
  let history = [];
  
  for (const [key, bot] of Object.entries(botProcesses)) {
    if (key.startsWith(userName + '_')) {
      if (bot.totalSells) {
        totalSells += bot.totalSells;
      }
      if (bot.recentSales && bot.recentSales.length > 0) {
        // Add profile name to history
        const profile = key.replace(userName + '_', '');
        history = history.concat(bot.recentSales.map(msg => `[${profile}] ${msg}`));
      }
    }
  }

  // Sort history by time assuming format [HH:MM:SS] (roughly alphabetical works for same day)
  history.sort((a, b) => b.localeCompare(a));
  
  return NextResponse.json({ count: totalSells, history: history.slice(0, 50) });
}
