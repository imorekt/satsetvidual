import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const { email, code } = await request.json();
    
    if (!email || !code) {
      return NextResponse.json({ success: false, error: 'Email dan Kode wajib diisi.' }, { status: 400 });
    }

    // Jika di Vercel, proxy ke Server Pusat
    if (process.env.VERCEL || process.env.IS_SAAS) {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.sweepepesol.bond';
      const response = await fetch(`${API_URL}/api/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (!response.ok) {
         return NextResponse.json({ success: false, error: 'Server Pusat (Laptop) menolak request atau belum diupdate ke versi terbaru (.exe lama). Silakan build .exe baru di Github Actions.' }, { status: response.status });
      }
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    // Eksekusi Lokal (di dalam .exe)
    const codesPath = path.join(process.cwd(), 'codes.json');
    const premiumPath = path.join(process.cwd(), 'premium.json');
    const userPath = path.join(process.cwd(), 'user.json');
    
    let codesData = [];
    let premiumData = {};
    let users = [];

    // Baca codes.json (1x use universal codes)
    try {
      const cData = await fs.readFile(codesPath, 'utf8');
      if (cData) codesData = JSON.parse(cData);
    } catch (err) {
      // Abaikan jika tidak ada file
    }

    // Baca premium.json (email-specific codes)
    try {
      const pData = await fs.readFile(premiumPath, 'utf8');
      if (pData) premiumData = JSON.parse(pData);
    } catch (err) {
      // Abaikan jika belum ada
    }

    // Baca user.json
    try {
      const uData = await fs.readFile(userPath, 'utf8');
      if (uData) users = JSON.parse(uData);
    } catch (err) {
      return NextResponse.json({ success: false, error: 'Database pengguna tidak ditemukan.' }, { status: 500 });
    }

    let codeMatched = false;
    let isUniversalCode = false;

    // Cek universal code 1x pakai
    const codeIndex = codesData.indexOf(code);
    if (codeIndex !== -1) {
      codeMatched = true;
      isUniversalCode = true;
      // Hapus kode dari array agar hangus
      codesData.splice(codeIndex, 1);
    } else if (premiumData[email] === code) {
      // Cek email-specific code
      codeMatched = true;
    }

    // Cek kecocokan kode
    if (!codeMatched) {
      return NextResponse.json({ success: false, error: 'Kode Salah atau sudah terpakai' }, { status: 400 });
    }

    // Update role user
    const userIndex = users.findIndex(u => u.walletAddress === email);
    if (userIndex === -1) {
      return NextResponse.json({ success: false, error: 'Akun tidak ditemukan.' }, { status: 400 });
    }

    users[userIndex].role = 'Premium';
    
    // Simpan perubahan ke user.json
    await fs.writeFile(userPath, JSON.stringify(users, null, 2), 'utf8');

    // Jika menggunakan universal code, simpan perubahan codes.json
    if (isUniversalCode) {
      await fs.writeFile(codesPath, JSON.stringify(codesData, null, 2), 'utf8');
    }

    return NextResponse.json({ success: true, message: 'Kode berhasil di Gunakan' });

  } catch (error) {
    console.error('Upgrade API Error:', error);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
