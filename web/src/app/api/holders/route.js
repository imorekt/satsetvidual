import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  if (!token) return NextResponse.json({ error: 'Token address required' }, { status: 400 });

  try {
    const url = `https://basescan.org/token/generic-tokenholders2?a=${token}&m=light`;
    
    // Simulate a real browser to bypass basic anti-bot
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://basescan.org/'
      }
    });
    
    if (!res.ok) {
      throw new Error(`Basescan responded with status ${res.status}`);
    }

    const html = await res.text();
    
    // Simple Regex Parsing for table rows
    // Basescan token holder table usually has rows like <tr><td>1</td><td><a href="...">0xabc...</a></td><td>1000</td><td>10%</td></tr>
    const rows = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    
    while ((match = trRegex.exec(html)) !== null) {
      const rowHtml = match[1];
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let tdMatch;
      const cells = [];
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(tdMatch[1]);
      }
      if (cells.length >= 4) {
        rows.push(cells);
      }
    }

    // Clean up HTML tags from cells
    const cleanText = (htmlStr) => htmlStr.replace(/<[^>]+>/g, '').trim();

    const holders = rows.slice(1).map(row => { // Skip header row
      return {
        rank: cleanText(row[0]),
        wallet: cleanText(row[1]),
        balance: cleanText(row[2]),
        percentage: cleanText(row[3])
      };
    }).filter(h => h.rank && !isNaN(parseInt(h.rank))); // ensure valid rows

    return NextResponse.json({ holders: holders.slice(0, 50) });
  } catch (error) {
    console.error("Scraping error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
