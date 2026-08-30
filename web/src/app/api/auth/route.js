import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();

    // Mengambil URL Server Pusat (Laptop Bos) dari file .env
    // Jika tidak ada di .env, kita pakai link Cloudflare
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.sweepepesol.bond';

    // Kita tembak (proxy) request ini ke Server Pusat di Laptop Bos
    const response = await fetch(`${API_URL}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'Server Pusat menolak request' }, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Auth API Proxy Error:', error);
    return NextResponse.json({ error: 'Gagal terhubung ke Server Pusat (Laptop Bos mungkin sedang mati/offline).' }, { status: 500 });
  }
}

