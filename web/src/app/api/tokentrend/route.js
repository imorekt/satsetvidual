import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Helper to get the token list path for a user
function getTokensFilePath(username) {
  const dataUserDir = path.join(process.cwd(), '..', 'data_user', username, 'tokentren');
  
  // Ensure directory exists
  if (!fs.existsSync(dataUserDir)) {
    fs.mkdirSync(dataUserDir, { recursive: true });
  }
  
  return path.join(dataUserDir, 'list.json');
}

const DEFAULT_TOKENS = {
  base: [
    '0x532f27101965dd16442e59d40670faf5ebb142e4',
    '0x4ed4e862860bed51a9570b96d89af5e1b0efefed',
    '0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4',
    '0x940181a94a35a4569e4529a3cdfb74e38fd98631',
    '0x9a26f5433671751c3276a065f57e5a02d2817973',
    '0x0578d8a44db98b23bf096a382e016e29a5ce0ffe',
    '0xf6e932ca12abad2605008f5127b1406244f0ce17',
    '0x7f12d13b34f5f4f0a9449c16bcbd4aa2bb51caa3',
    '0xe3086852a4b125803c815a158249ae468a3254ca',
    '0x0d97f261b1e88845184f678e2d1e7a98d9fd38d8',
    '0xE1aBD004250AC8D1F199421d647e01d094FAa180',
    '0x82f254190c1f6d0f62bca6df9d4d8ef82e2c4c47',
    '0xbc45647ea894030a4e9801ec03479739fa2485f0',
    '0x2ae181b5e5898d975d4eacb2df136f3851532cb1'
  ],
  rh: [
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    '3psH1Mj1f7yUfaD5gh6Zj7epE8hhrMkMETgv5TshQA4o',
    'FU1q8vJpZNUrmqsciSjp8bAKKidGsLmouB8CBdf8TKQv',
    '7GCihgDB8fe6KNjn2TWtk52CEs24ccbfc2PE33aU5C2j',
    'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
    'WENWENvqqNya429ubCdR81ZmD69brwQaaVNKKv29Qpq',
    '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx7LoiVkM3',
    '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    '0xcf0C122c6b73ff809C693CE761CAA2fD6B5ec4B8',
    'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82'
  ]
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('user');
  
  if (!username) {
    return NextResponse.json({ success: false, message: 'User parameter is required' }, { status: 400 });
  }
  
  const filePath = getTokensFilePath(username);
  
  if (!fs.existsSync(filePath)) {
    // Seed default tokens
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_TOKENS, null, 2), 'utf-8');
    return NextResponse.json({ success: true, tokens: DEFAULT_TOKENS });
  }
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const tokens = JSON.parse(fileContent);
    return NextResponse.json({ success: true, tokens });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to parse token list' }, { status: 500 });
  }
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('user');
  
  if (!username) {
    return NextResponse.json({ success: false, message: 'User parameter is required' }, { status: 400 });
  }
  
  try {
    const { ca, chain } = await request.json();
    if (!ca || !chain) {
      return NextResponse.json({ success: false, message: 'CA and chain are required' }, { status: 400 });
    }

    const filePath = getTokensFilePath(username);
    let tokens = { base: [], rh: [] };
    
    if (fs.existsSync(filePath)) {
      tokens = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } else {
      tokens = DEFAULT_TOKENS;
    }
    
    if (!tokens[chain]) tokens[chain] = [];
    
    // Check if CA already exists
    if (!tokens[chain].includes(ca)) {
      tokens[chain].push(ca);
      fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf-8');
    }
    
    return NextResponse.json({ success: true, message: 'Token added', tokens });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('user');
  
  if (!username) {
    return NextResponse.json({ success: false, message: 'User parameter is required' }, { status: 400 });
  }
  
  try {
    const { ca, chain } = await request.json();
    if (!ca || !chain) {
      return NextResponse.json({ success: false, message: 'CA and chain are required' }, { status: 400 });
    }

    const filePath = getTokensFilePath(username);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ success: false, message: 'Token list not found' }, { status: 404 });
    }
    
    let tokens = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (tokens[chain] && tokens[chain].includes(ca)) {
      tokens[chain] = tokens[chain].filter(t => t !== ca);
      fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf-8');
    }
    
    return NextResponse.json({ success: true, message: 'Token removed', tokens });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
