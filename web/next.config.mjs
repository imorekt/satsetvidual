import fs from 'fs';
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  devIndicators: {
    buildActivity: false
  },
  async rewrites() {
    // Jika berjalan di server pusat atau desktop, jalankan lokal (Pintu belakang dihapus)
    return [];
  }
};

export default nextConfig;
