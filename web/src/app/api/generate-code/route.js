import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const { email } = await request.json();
    
    // Validasi sederhana
    if (!email) {
      return NextResponse.json({ success: false, error: 'Email wajib diisi.' }, { status: 400 });
    }

    // Jika di Vercel atau ada URL API eksternal, proxy ke Server Pusat
    if (process.env.VERCEL || process.env.IS_SAAS || process.env.NEXT_PUBLIC_API_URL) {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.sweepepesol.bond';
      const response = await fetch(`${API_URL}/api/generate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
         return NextResponse.json({ success: false, error: 'Server Pusat (Laptop) menolak request atau belum diupdate ke versi terbaru (.exe lama). Silakan build .exe baru di Github Actions.' }, { status: response.status });
      }
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    // Eksekusi Lokal (di dalam .exe)
    // Generate random code format PREMIUM-XXXX-XXXX
    const randomPart1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const randomPart2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const newCode = `PREMIUM-${randomPart1}-${randomPart2}`;

    const codesPath = path.join(process.cwd(), 'codes.json');
    let validCodes = [];

    // Baca codes.json (jika ada)
    try {
      const cData = await fs.readFile(codesPath, 'utf8');
      if (cData) validCodes = JSON.parse(cData);
    } catch (err) {
      // Jika file belum ada, biarkan array kosong
    }

    // Masukkan kode baru ke array
    validCodes.push(newCode);
    
    // Simpan ke codes.json
    await fs.writeFile(codesPath, JSON.stringify(validCodes, null, 2), 'utf8');

    return NextResponse.json({ success: true, code: newCode });

  } catch (error) {
    console.error('Generate Code API Error:', error);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan: ' + (error.message || String(error)) }, { status: 500 });
  }
}
