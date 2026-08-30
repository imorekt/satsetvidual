"use client";
import React, { useEffect, useState } from 'react';

// URL Gist hanya dipakai untuk mengecek 'active' (Killswitch)
const LICENSE_URL = "https://gist.githubusercontent.com/imorekt/f6bf1d9e712d4a6213126bd60e1293ce/raw/license.json";
// URL GitHub API untuk mengecek versi terbaru secara otomatis
const GITHUB_RELEASES_API = "https://api.github.com/repos/imorekt/satsetvidual/releases/latest";

const compareVersions = (v1, v2) => {
  const p1 = String(v1).replace('v','').split('.').map(Number);
  const p2 = String(v2).replace('v','').split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
};

export default function KillSwitchWrapper({ children }) {
  const [isLicensed, setIsLicensed] = useState(true);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [updateUrl, setUpdateUrl] = useState("");
  const [minVer, setMinVer] = useState("");
  const [updateStatus, setUpdateStatus] = useState('idle'); // idle, downloading, downloaded, error
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateError, setUpdateError] = useState("");

  useEffect(() => {
    let isMounted = true;
    
    // TUGAS 1: Cek Update Otomatis ke GitHub Releases (Hanya jalan 1x saat awal dibuka)
    const checkUpdateFromGitHub = async () => {
      try {
        const res = await fetch(GITHUB_RELEASES_API, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.tag_name) {
            const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";
            const latestVersion = data.tag_name; // misalnya "v1.5.0"
            
            if (compareVersions(currentVersion, latestVersion) < 0) {
              if (isMounted) {
                // Kecualikan popup update jika diakses lewat web Vercel
                if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
                  return; // Batal memunculkan popup
                }
                
                setNeedsUpdate(true);
                setUpdateUrl(data.html_url || "https://github.com/imorekt/satsetvidual/releases");
                setMinVer(latestVersion.replace('v', ''));
              }
            }
          }
        }
      } catch (err) {
        console.error("Gagal mengecek update dari GitHub", err);
      }
    };

    // TUGAS 2: Cek Killswitch ke Gist (Jalan setiap 10 detik) & Cek Session Anti-Tuyul
    const checkKillSwitch = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(LICENSE_URL, { 
          signal: controller.signal, 
          cache: 'no-store' 
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          if (isMounted) setIsLicensed(false);
          return;
        }

        const data = await res.json();
        if (data && data.active === true) {
          if (isMounted) setIsLicensed(true);
        } else {
          if (isMounted) setIsLicensed(false);
        }

        // --- CEK SESSION ANTI-TUYUL ---
        const email = localStorage.getItem('walletAddress');
        const sessionId = localStorage.getItem('sessionId');
        if (email && sessionId) {
          // Skip anti-tuyul on Electron (desktop app)
          if (typeof window !== 'undefined' && window.electronAPI) {
            // do nothing
          } else {
            try {
            const sessionRes = await fetch('/api/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'check_session', email, sessionId })
            });
            const sessionData = await sessionRes.json();
            if (sessionData && sessionData.valid === false) {
              // Sesi tidak valid (ditimpa device lain) -> LOGOUT PAKSA
              localStorage.removeItem('walletAddress');
              localStorage.removeItem('userName');
              localStorage.removeItem('userRole');
              localStorage.removeItem('sessionId');
              window.location.href = '/'; // Tendang ke halaman login
            }
          } catch (sessionErr) {
            // Abaikan jika error koneksi saat cek sesi
          }
         }
        }
        // ------------------------------

      } catch (err) {
        if (isMounted) setIsLicensed(false);
      }
    };

    // Jalankan cek update 1x saja
    checkUpdateFromGitHub();

    // Jalankan cek killswitch pertama kali dan setiap 10 detik
    checkKillSwitch();
    const interval = setInterval(checkKillSwitch, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.onUpdateProgress((progressObj) => {
        setUpdateStatus('downloading');
        setDownloadProgress(progressObj.percent);
      });
      window.electronAPI.onUpdateDownloaded(() => {
        setUpdateStatus('downloaded');
      });
      window.electronAPI.onUpdateError((err) => {
        setUpdateStatus('error');
        setUpdateError(err);
      });
    }
  }, []);

  if (needsUpdate) {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(10, 15, 30, 0.90)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999999,
      }}>
        <div style={{
          background: 'linear-gradient(145deg, #1e3a8a, #0f172a)',
          border: '1px solid rgba(59,130,246,0.5)',
          borderRadius: '16px',
          padding: '2.5rem',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
          color: 'white'
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🚀</div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', fontWeight: 'bold', color: '#60a5fa' }}>
            UPDATE WAJIB
          </h1>
          <p style={{ color: '#cbd5e1', marginBottom: '2rem', lineHeight: '1.6' }}>
            Versi aplikasi Anda saat ini (v{process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0"}) sudah tertinggal. 
            Silakan perbarui ke versi <b>v{minVer}</b> atau yang lebih baru untuk dapat menggunakan bot ini kembali.
          </p>
          {updateStatus === 'error' && (
            <div style={{ color: '#ff6b6b', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Gagal mengunduh update: {updateError}. Silakan coba manual.
            </div>
          )}
          
          {(updateStatus === 'downloading' || updateStatus === 'downloaded') && (
            <div style={{ marginBottom: '2rem', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{
                height: '12px',
                background: updateStatus === 'downloaded' ? '#10b981' : '#3b82f6',
                width: `${Math.max(5, downloadProgress)}%`,
                transition: 'width 0.3s ease'
              }} />
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                {updateStatus === 'downloaded' ? 'Selesai diunduh!' : `Mengunduh... ${Math.round(downloadProgress)}%`}
              </div>
            </div>
          )}

          {typeof window !== 'undefined' && window.electronAPI ? (
            <button 
              onClick={() => {
                if (updateStatus === 'idle' || updateStatus === 'error') {
                  setUpdateStatus('downloading');
                  setDownloadProgress(0);
                  window.electronAPI.startUpdate();
                } else if (updateStatus === 'downloaded') {
                  window.electronAPI.installUpdate();
                }
              }}
              disabled={updateStatus === 'downloading'}
              style={{
                display: 'inline-block',
                background: updateStatus === 'downloaded' ? '#10b981' : (updateStatus === 'downloading' ? '#475569' : '#2563eb'),
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 'bold',
                boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
                cursor: updateStatus === 'downloading' ? 'not-allowed' : 'pointer'
              }}
            >
              {updateStatus === 'downloaded' ? '♻️ Install & Restart' : (updateStatus === 'downloading' ? 'Harap Tunggu...' : '⬇️ Mulai Download')}
            </button>
          ) : (
            <a 
              href={updateUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                background: '#2563eb',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 'bold',
                boxShadow: '0 4px 14px rgba(37,99,235,0.4)'
              }}
            >
              ⬇️ Download Manual
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!isLicensed) {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(10, 10, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999999,
      }}>
        <div style={{
          background: '#13131a',
          border: '1px solid rgba(255,80,80,0.3)',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          color: 'white'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📡</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 'bold', color: '#ff6b6b' }}>
            Koneksi Terputus
          </h1>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            Aplikasi gagal terhubung ke server lisensi. Pastikan koneksi internet Anda stabil. Jika internet lancar namun pesan ini tetap muncul, kemungkinan akses Anda telah dinonaktifkan oleh Admin.
          </p>
          <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
            Menunggu koneksi kembali...
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

