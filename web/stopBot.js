const path = require('path');

async function main() {
  const arg1 = process.argv[2];
  const arg2 = process.argv[3];

  if (!arg1) {
    console.error('❌ Harap masukkan argumen. Contoh: node stopBot.js IMO JURAGAN');
    process.exit(1);
  }

  let userName = '';
  let profileName = '';

  if (arg2) {
    userName = arg1;
    profileName = arg2;
  } else {
    const cleanPath = path.normalize(arg1.replace(/['"]/g, ''));
    const parts = cleanPath.split(path.sep).filter(p => p.trim() !== '');
    if (parts.length < 2) {
      console.error('❌ Path tidak valid.');
      process.exit(1);
    }
    profileName = parts.pop();
    userName = parts.pop();
  }

  console.log(`Menghentikan bot untuk User: [${userName}] | Profil: [${profileName}]...`);

  try {
    const res = await fetch('http://localhost:3000/api/autosell/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, profileName, developerStop: true })
    });

    const data = await res.json();
    
    if (res.ok && data.success) {
      console.log('✅ Bot berhasil dihentikan dari memori server!');
      console.log('✅ Log "BOT BERHENTI OLEH DEVELOPER" telah disuntikkan ke dalam bot.log');
    } else {
      console.warn('⚠️ API merespon dengan peringatan (mungkin bot sudah mati):', data.error || data.message);
    }
  } catch (error) {
    console.error('❌ Gagal menghubungi server web lokal. Pastikan "npm run dev" atau "npm run start" sedang berjalan di port 3000.');
    console.error(error.message);
  }
}

main();
