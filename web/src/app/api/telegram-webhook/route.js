import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const TELEGRAM_BOT_TOKEN = '8980094049:AAHKEWIVkhe3L8ysgBPHQq81hCteFA2tMFQ';
const ALLOWED_CHAT_ID = 740497999;

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
  } catch (error) {
    console.error('Failed to send telegram message:', error);
  }
}

export async function POST(request) {
  try {
    // Webhook receive
    const body = await request.json();
    
    // Ignore if no message
    if (!body || !body.message || !body.message.text) {
      return NextResponse.json({ success: true });
    }

    const chatId = body.message.chat.id;
    const text = body.message.text.trim();

    // Security check: only allow Admin's Chat ID
    if (chatId !== ALLOWED_CHAT_ID) {
      return NextResponse.json({ success: true }); // Acknowledge to stop Telegram from retrying
    }

    if (text === '/generate') {
      // Sama seperti di generate-code API
      const randomPart1 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const randomPart2 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const newCode = `PREMIUM-${randomPart1}-${randomPart2}`;

      const codesPath = path.join(process.cwd(), 'codes.json');
      let validCodes = [];

      try {
        const cData = await fs.readFile(codesPath, 'utf8');
        if (cData) validCodes = JSON.parse(cData);
      } catch (err) {
        // file belum ada
      }

      validCodes.push(newCode);
      await fs.writeFile(codesPath, JSON.stringify(validCodes, null, 2), 'utf8');

      const message = `✅ **Kode Premium Berhasil Dibuat!**\n\n\`${newCode}\`\n\n_Kode ini hanya bisa digunakan 1 kali oleh user mana saja._`;
      await sendTelegramMessage(chatId, message);
    } 
    else if (text === '/start') {
      await sendTelegramMessage(chatId, "Halo Bos! Ketik `/generate` untuk membuat Kode Premium 1x pakai.");
    }
    else {
      await sendTelegramMessage(chatId, "Perintah tidak dikenali. Ketik `/generate`.");
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Telegram Webhook Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
