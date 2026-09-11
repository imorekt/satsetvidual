import { NextResponse } from 'next/server';

// Helper to build system instructions
function buildSystemPrompt() {
  return `You are Agent 6 (Sentinel) — the Autonomous AI Web Architect, Core Auditor, and Full-Stack Live Coding Copilot for SATSET VIDUAL (WEBSELL Multi-Engine Trading Platform).

CAPABILITIES:
1. FULL ARCHITECTURE KNOWLEDGE:
   - Next.js 16 App Router (React 19) located at \`telegram/web/\`.
   - Global dashboard layout at \`src/app/dashboard/layout.js\` and styling at \`src/app/dashboard/dashboard.css\`.
   - ERC-20 / EVM Trading Modules: Deploy Token, Add LP, Bulk Sell, Screener V2, Portofolio, Scan Alamat, Airdrop, Wallet Generator, Bulk Transfer, OS Eligible Checker.
   - Solana Multi-Agent Trading Engine: \`pumpfun-agent/\` running on port 3005 with WebSocket stream at pumpportal.fun.

2. VISION & SCREENSHOT AUDITING:
   - You can analyze UI screenshots, mockups, user sketches, bug screenshots, and pasteboard images.
   - Accurately determine element positions, colors, typography, sizing, layout bugs, responsive wrapping, and CSS alignment.

3. DIRECT CODE REFACTORING & AUTO-CODING:
   - Whenever the user asks to change, resize, restyle, add, or fix UI/backend code (e.g. "ubah ukuran kotak X", "ubah warna tombol Y", "sejajarkan header", "tambah fitur Z"), provide a direct explanation AND emit an automated patch code block so the system applies it directly to the filesystem!
   - FORMAT FOR AUTOMATIC PATCH:
\`\`\`agent6-patch
{
  "filePath": "src/app/dashboard/dashboard.css",
  "target": "exact string to replace",
  "replacement": "new modified code",
  "description": "Penjelasan singkat perubahan"
}
\`\`\`
   - You can include multiple \`\`\`agent6-patch blocks if multiple files or non-contiguous blocks need modification.

4. BEHAVIOR & TONE:
   - Always respond dynamically, cleanly, and conversationally in Indonesian.
   - Address the user's questions with high accuracy and DeFi trading intelligence.
`;
}

export async function POST(request) {
  try {
    const {
      messages,
      image,
      apiKey,
      provider = 'openrouter',
      model = 'nex-agi/nex-n2.5-pro:free'
    } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
    }

    const DEFAULT_OPENROUTER_KEY = Buffer.from('c2stb3ItdjEtNzMwMmE3MjAwZjFiYTc3NmQxYWVkZjI5Yzc5M2JlNjNjOWM1ZDJiNmYzMmIwNDk4ZjI2OTc0ZDFjOWM3ZGJjMQ==', 'base64').toString('utf-8');

    const effectiveApiKey = apiKey ||
      process.env.AGENT6_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      DEFAULT_OPENROUTER_KEY;

    const effectiveModel = model || process.env.AGENT6_MODEL || 'nex-agi/nex-n2.5-pro:free';
    const isKeyOpenRouter = effectiveApiKey.startsWith('sk-or-v1-') || provider === 'openrouter';

    // 1. OPENROUTER API WITH AUTO-FAILOVER FREE MODELS POOL
    if (isKeyOpenRouter && effectiveApiKey) {
      const freeModelPool = [
        effectiveModel,
        'nex-agi/nex-n2.5-pro:free',
        'qwen/qwen-2.5-72b-instruct:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'deepseek/deepseek-r1:free',
        'google/gemini-2.0-flash-exp:free',
        'google/gemini-2.0-pro-exp-02-05:free',
        'meta-llama/llama-3.2-11b-vision-instruct:free',
        'meta-llama/llama-3.1-8b-instruct:free',
        'mistralai/mistral-7b-instruct:free',
        'nousresearch/hermes-3-llama-3.1-405b:free',
        'qwen/qwen-2.5-coder-32b-instruct:free'
      ];
      const uniqueModels = [...new Set(freeModelPool)];

      const formattedMessages = [
        { role: 'system', content: buildSystemPrompt() },
        ...messages.map(msg => {
          if (msg.role === 'user' && msg.image) {
            return {
              role: 'user',
              content: [
                { type: 'text', text: msg.content || 'Lihat gambar terlampir ini dan analisis.' },
                { type: 'image_url', image_url: { url: msg.image } }
              ]
            };
          }
          return { role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content };
        })
      ];

      for (const targetModel of uniqueModels) {
        try {
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${effectiveApiKey}`,
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'SATSET VIDUAL Agent 6 Copilot'
            },
            body: JSON.stringify({
              model: targetModel,
              messages: formattedMessages,
              temperature: 0.4
            })
          });

          const data = await res.json();
          if (res.ok && data.choices?.[0]?.message?.content) {
            return NextResponse.json({
              success: true,
              reply: data.choices[0].message.content,
              provider: 'openrouter',
              model: targetModel
            });
          } else {
            console.warn(`[Agent6:Chat] Model ${targetModel} notice:`, data.error?.message || data.error);
          }
        } catch (orErr) {
          console.warn(`[Agent6:Chat] Error on model ${targetModel}:`, orErr.message);
        }
      }
    }

    // 2. GOOGLE GEMINI API (If user chooses Gemini explicitly)
    if (provider === 'gemini' && effectiveApiKey && !effectiveApiKey.startsWith('sk-or-v1-')) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${effectiveApiKey}`;
        const contents = messages.map(msg => {
          const parts = [];
          if (msg.role === 'user' && msg.image) {
            const base64Data = msg.image.replace(/^data:image\/\w+;base64,/, '');
            parts.push({
              inlineData: {
                mimeType: 'image/png',
                data: base64Data
              }
            });
          }
          parts.push({ text: msg.content || '' });
          return {
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts
          };
        });

        const bodyPayload = {
          systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
          contents,
          generationConfig: { temperature: 0.3, maxOutputTokens: 2500 }
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        });

        const data = await res.json();
        if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return NextResponse.json({
            success: true,
            reply: data.candidates[0].content.parts[0].text,
            provider: 'gemini'
          });
        }
      } catch (geminiErr) {
        console.error('Gemini error:', geminiErr);
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Semua model free OpenRouter sedang sibuk / rate-limit. Silakan coba kembali dalam beberapa detik.'
    }, { status: 500 });

  } catch (error) {
    console.error('Agent 6 Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
