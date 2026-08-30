"use client";
import { useState } from "react";

export default function LoginModal({ isOpen, onClose, showNotification }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  const [showPassword, setShowPassword] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotOtp, setShowForgotOtp] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  if (!isOpen) return null;

  const handleAction = async () => {
    try {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (activeTab === 'register') {
        if (!name || !email || !password) {
          if (showNotification) showNotification('Semua kolom harus diisi.', 'error');
          return;
        }
        
        const validDomains = ['@gmail.com', '@yahoo.com', '@hotmail.com'];
        const isValidEmail = validDomains.some(domain => email.toLowerCase().endsWith(domain));
        
        if (!isValidEmail) {
          if (showNotification) showNotification('Format email salah. Gunakan @gmail.com, @yahoo.com, atau @hotmail.com', 'error');
          return;
        }

        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'request_otp', name, email, password })
        });
        const data = await res.json();
        
        if (res.ok) {
          if (showNotification) showNotification('OTP telah dikirim ke email Anda!', 'success');
          setShowOtp(true);
        } else {
          if (showNotification) showNotification(data.error || 'Pendaftaran gagal.', 'error');
        }
      } else {
        if (!email || !password) {
          if (showNotification) showNotification('Email dan Password harus diisi.', 'error');
          return;
        }

        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', email, password })
        });
        const data = await res.json();
        
        if (res.ok) {
          localStorage.setItem('walletAddress', data.user.email);
          localStorage.setItem('userName', data.user.name);
          localStorage.setItem('userRole', data.user.role || 'Member');
          if (data.user.sessionId) {
            localStorage.setItem('sessionId', data.user.sessionId);
          }
          setShowAgreement(true);
        } else {
          if (showNotification) showNotification(data.error || 'Login gagal.', 'error');
        }
      }
    } catch (err) {
      if (showNotification) showNotification('Terjadi kesalahan koneksi.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      if (showNotification) showNotification('Masukkan kode OTP.', 'error');
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', email, otp })
      });
      const data = await res.json();
      
      // Artificial delay 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (res.ok) {
        if (showNotification) showNotification('Pendaftaran berhasil! Silakan Masuk.', 'success');
        setShowOtp(false);
        setActiveTab('login');
        setPassword('');
        setOtp('');
      } else {
        if (showNotification) showNotification(data.error || 'Verifikasi gagal.', 'error');
      }
    } catch (err) {
      if (showNotification) showNotification('Terjadi kesalahan koneksi.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestResetOtp = async () => {
    if (!email) {
      if (showNotification) showNotification('Masukkan email Anda.', 'error');
      return;
    }
    try {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_reset_otp', email })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (showNotification) showNotification('OTP reset password terkirim!', 'success');
        setShowForgotOtp(true);
      } else {
        if (showNotification) showNotification(data.error || 'Gagal meminta OTP.', 'error');
      }
    } catch (err) {
      if (showNotification) showNotification('Terjadi kesalahan koneksi.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    if (!otp || !newPassword) {
      if (showNotification) showNotification('Masukkan OTP dan Password Baru.', 'error');
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_reset_otp', email, otp, newPassword })
      });
      const data = await res.json();
      
      // Artificial delay 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (res.ok) {
        if (showNotification) showNotification('Password berhasil diubah! Silakan Masuk.', 'success');
        setShowForgotOtp(false);
        setActiveTab('login');
        setPassword('');
        setNewPassword('');
        setOtp('');
      } else {
        if (showNotification) showNotification(data.error || 'Verifikasi gagal.', 'error');
      }
    } catch (err) {
      if (showNotification) showNotification('Terjadi kesalahan koneksi.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* ========================================== */}
      {/* DESKTOP VIEW                               */}
      {/* ========================================== */}
      <div className="modal-overlay desktop-only-modal" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 8, 20, 0.8)', backdropFilter: 'blur(10px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      {showAgreement ? (
        <div className="login-modal-wrapper agreement-modal" onClick={e => e.stopPropagation()} style={{
          background: 'var(--bg-card)', width: '90%', maxWidth: '500px', borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)', padding: '2rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative'
        }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#ff3d5e', cursor: 'pointer', fontSize: '1.2rem', zIndex: 10 }}>✖</button>
          <h2 style={{color: '#f8fafc', fontSize: '1.5rem', fontWeight: 600, textAlign: 'center', margin: 0}}>📜 SYARAT & KETENTUAN</h2>
          <div style={{
            background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)',
            maxHeight: '300px', overflowY: 'auto', fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.6'
          }}>
            <p style={{marginBottom: '1rem'}}>
              Selamat datang di <strong>SATSET Vidual Auto-Sell Bot</strong>. Dengan menggunakan platform ini, Anda menyetujui seluruh ketentuan di bawah ini:
            </p>
            <ol style={{paddingLeft: '1.2rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem'}}>
              <li>
                <strong style={{color: '#f8fafc'}}>Tidak Ada Penyimpanan Data Rahasia:</strong> Kami menjamin 100% bahwa kami <strong>tidak pernah menyimpan Private Key</strong>, frasa pemulihan, atau data rahasia dompet Anda di server kami. Sistem memproses Private Key Anda secara langsung (on-the-fly) murni di dalam memori yang bersifat sementara.
              </li>
              <li>
                <strong style={{color: '#facc15'}}>Risiko Kehilangan Aset (Tanggung Jawab Penuh Pengguna):</strong> Dunia <i>cryptocurrency</i> dan <i>smart contract</i> memiliki risiko yang sangat tinggi. Segala bentuk kerugian finansial, hilangnya aset, salah urus token, *rug pull*, atau eksploitasi peretasan/kebocoran pada perangkat pribadi Anda adalah <strong>tanggung jawab Anda sepenuhnya</strong>.
              </li>
              <li>
                <strong style={{color: '#f8fafc'}}>Pelepasan Tuntutan (Disclaimer):</strong> Developer dan platform SATSET Vidual <strong>sama sekali tidak bertanggung jawab</strong> dan dibebaskan dari segala macam tuntutan hukum atas kerugian materiel maupun imateriel yang terjadi akibat kelalaian Anda atau kegagalan sistem terdesentralisasi (blockchain).
              </li>
              <li>
                <strong style={{color: '#4ade80'}}>Privasi & Isolasi Data Terjamin:</strong> Data masing-masing profil pengguna terisolasi 100% secara ketat di sistem kami. Kami menjamin bahwa tidak akan ada kebocoran data (*data leak*) atau persilangan akses data Anda ke *user* lain mana pun di platform ini. Kerahasiaan Anda terjamin sepenuhnya.
              </li>
            </ol>
            <p>
              Dengan mencentang kotak di bawah ini, Anda menyatakan bahwa Anda telah membaca, memahami risiko, dan membebaskan kami dari segala tuntutan hukum yang berlaku.
            </p>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer'}} onClick={() => setAgreed(!agreed)}>
            <div style={{
              width: '24px', height: '24px', border: '2px solid', borderColor: agreed ? '#00C853' : 'rgba(255,255,255,0.3)',
              borderRadius: '6px', display: 'flex', justifyContent: 'center', alignItems: 'center',
              background: agreed ? '#00C853' : 'transparent', transition: 'all 0.2s'
            }}>
              {agreed && <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
            </div>
            <span style={{color: '#94a3b8', fontSize: '0.9rem', userSelect: 'none'}}>Saya setuju dengan semua persyaratan di atas.</span>
          </div>
          <button 
            disabled={!agreed || isLoading}
            onClick={async () => {
              setIsLoading(true);
              await new Promise(r => setTimeout(r, 3000));
              sessionStorage.setItem('loginSuccess', 'true');
              window.location.href = '/dashboard';
            }}
            style={{
              padding: '1rem', width: '100%', borderRadius: '8px', border: 'none',
              background: agreed ? 'linear-gradient(135deg, #0052ff, #00C853)' : 'rgba(255,255,255,0.05)',
              color: agreed ? 'white' : 'rgba(255,255,255,0.3)', fontWeight: 600, fontSize: '1rem',
              cursor: (!agreed || isLoading) ? 'not-allowed' : 'pointer', transition: 'all 0.3s',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 11-6.219-8.56"></path>
                </svg>
                Memuat...
              </span>
            ) : 'SETUJU & MASUK 🚀'}
          </button>
        </div>
      ) : showOtp ? (
        <div className="login-modal-wrapper" onClick={e => e.stopPropagation()} style={{
          background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)',
          width: '90%', maxWidth: '400px', padding: '2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', position: 'relative', boxSizing: 'border-box'
        }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#ff3d5e', cursor: 'pointer', fontSize: '1.2rem', zIndex: 10 }}>✖</button>
          <h2 style={{color: 'white', textAlign: 'center', marginBottom: '1rem'}}>Verifikasi OTP</h2>
          <p style={{color: '#94a3b8', textAlign: 'center', fontSize: '0.9rem', marginBottom: '2rem'}}>
            Kode OTP telah dikirim ke <strong>{email}</strong>. Silakan periksa kotak masuk (Inbox) atau <strong>folder Spam</strong> Anda.
          </p>
          <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box', marginBottom: '1.5rem' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              🔑
            </span>
            <input 
              type="text" 
              placeholder="Masukkan 6 Digit OTP" 
              value={otp}
              onChange={e => setOtp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
              maxLength={6}
              style={{
                width: '100%', height: '52px', padding: '0 1rem 0 3rem', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          <button 
            disabled={isLoading}
            onClick={handleVerifyOtp}
            style={{
            width: '100%', height: '52px', background: 'linear-gradient(135deg, var(--accent-purple-light), var(--accent-purple))', color: 'white',
            border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '1rem',
            cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
            marginBottom: '1rem', transition: 'background 0.3s ease', boxSizing: 'border-box',
            opacity: isLoading ? 0.7 : 1
          }}>
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 11-6.219-8.56"></path>
                </svg>
                Memverifikasi...
              </span>
            ) : 'Verifikasi & Buat Akun'}
          </button>
          <p style={{ textAlign: 'center', margin: 0 }}>
            <span onClick={() => setShowOtp(false)} style={{color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline'}}>Kembali</span>
          </p>
        </div>
      ) : (
        <div className="login-modal-wrapper" onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        width: '90%',
        maxWidth: '400px',
        padding: '2rem',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#ff3d5e', cursor: 'pointer', fontSize: '1.2rem', zIndex: 10 }}>✖</button>
        {activeTab !== 'forgot' && (
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem', width: '100%', boxSizing: 'border-box' }}>
          <button 
            onClick={() => setActiveTab('login')}
            style={{ 
              flex: 1, padding: '1rem', background: 'transparent', border: 'none', 
              color: activeTab === 'login' ? 'var(--accent-purple-light)' : '#94a3b8',
              borderBottom: activeTab === 'login' ? '2px solid #0052ff' : '2px solid transparent',
              cursor: 'pointer', fontWeight: '500', fontSize: '1rem',
              transition: 'all 0.3s ease', boxSizing: 'border-box'
            }}
          >
            Masuk
          </button>
          <button 
            onClick={() => setActiveTab('register')}
            style={{ 
              flex: 1, padding: '1rem', background: 'transparent', border: 'none', 
              color: activeTab === 'register' ? 'var(--accent-purple-light)' : '#94a3b8',
              borderBottom: activeTab === 'register' ? '2px solid #0052ff' : '2px solid transparent',
              cursor: 'pointer', fontWeight: '500', fontSize: '1rem',
              transition: 'all 0.3s ease', boxSizing: 'border-box'
            }}
          >
            Mendaftar
          </button>
        </div>
        )}

        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
          {activeTab === 'forgot' && !showForgotOtp && (
            <>
              <h2 style={{color: 'white', textAlign: 'center', margin: '0 0 0.5rem 0'}}>Lupa Password</h2>
              <p style={{color: '#94a3b8', textAlign: 'center', fontSize: '0.9rem', marginBottom: '1.5rem'}}>Masukkan email Anda untuk menerima OTP.</p>
            </>
          )}

          {activeTab === 'forgot' && showForgotOtp && (
            <>
              <h2 style={{color: 'white', textAlign: 'center', margin: '0 0 0.5rem 0'}}>Reset Password</h2>
              <p style={{color: '#94a3b8', textAlign: 'center', fontSize: '0.9rem', marginBottom: '1.5rem'}}>Masukkan OTP dari email (cek folder Spam jika tidak ada) dan password baru.</p>
              
              <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔑</span>
                <input 
                  type="text" placeholder="6 Digit OTP" 
                  value={otp} onChange={e => setOtp(e.target.value)}
                  maxLength={6}
                  style={{ width: '100%', height: '52px', padding: '0 1rem 0 3rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔒</span>
                <input 
                  type={showPassword ? "text" : "password"} placeholder="Password Baru" 
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  style={{ width: '100%', height: '52px', padding: '0 3rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white', outline: 'none', boxSizing: 'border-box' }}
                />
                <button onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>👁️</button>
              </div>
            </>
          )}

          {activeTab === 'register' && (
            <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                👤
              </span>
              <input 
                type="text" 
                placeholder="Nama Lengkap" 
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                style={{
                  width: '100%', height: '52px', padding: '0 1rem 0 3rem', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          )}
          
          {(!showForgotOtp) && (
          <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              ✉️
            </span>
            <input 
              type="text" 
              placeholder="Email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAction()}
              style={{
                width: '100%', height: '52px', padding: '0 1rem 0 3rem', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          )}
          
          {activeTab !== 'forgot' && (
          <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              🔒
            </span>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Kata Sandi" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAction()}
              style={{
                width: '100%', height: '52px', padding: '0 3rem', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
            <button 
              onClick={() => setShowPassword(!showPassword)}
              style={{ 
                position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', 
                background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer',
                boxSizing: 'border-box', padding: 0
              }}
            >
              👁️
            </button>
          </div>
          )}

          {activeTab === 'login' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem', width: '100%' }}>
              <span onClick={() => { setActiveTab('forgot'); setShowForgotOtp(false); setOtp(''); setNewPassword(''); }} style={{color: 'var(--accent-purple-light)', cursor: 'pointer', fontSize: '0.85rem'}}>Lupa Password?</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button 
          disabled={isLoading}
          onClick={activeTab === 'forgot' ? (showForgotOtp ? handleVerifyResetOtp : handleRequestResetOtp) : handleAction}
          style={{
          width: '100%', height: '52px', background: 'linear-gradient(135deg, var(--accent-purple-light), var(--accent-purple))', color: 'white',
          border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '1rem',
          cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
          marginBottom: '1.5rem', transition: 'background 0.3s ease', boxSizing: 'border-box',
          opacity: isLoading ? 0.7 : 1
        }}>
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 11-6.219-8.56"></path>
              </svg>
              Memuat...
            </span>
          ) : (activeTab === 'forgot' ? (showForgotOtp ? 'Reset Password' : 'Kirim OTP Reset') : (activeTab === 'login' ? 'Masuk →' : 'Mendaftar →'))}
        </button>

        {activeTab !== 'forgot' && (
          <>
        {/* Or Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Atau</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
        </div>

        {/* Telegram Button */}
        <button 
          onClick={(e) => {
            e.preventDefault();
            if (showNotification) showNotification('Metode Masuk ini belum tersedia', 'warning');
          }}
          style={{
          width: '100%', height: '52px', background: 'transparent', color: 'var(--accent-purple-light)',
          border: '1px solid rgba(157, 78, 221, 0.3)', borderRadius: '8px', fontWeight: '500',
          cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
          textDecoration: 'none', marginBottom: '2rem', transition: 'all 0.3s ease', boxSizing: 'border-box'
        }}>
          <span style={{fontSize: '1.2rem', display: 'flex', alignItems: 'center'}}>✈️</span> Masuk dengan Telegram
        </button>

        {/* Footer Text */}
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', margin: 0, width: '100%', boxSizing: 'border-box' }}>
          {activeTab === 'login' ? (
            <>Belum punya akun? <span onClick={() => setActiveTab('register')} style={{color: 'var(--accent-purple-light)', cursor: 'pointer'}}>Mendaftar</span></>
          ) : (
            <>Sudah punya akun? <span onClick={() => setActiveTab('login')} style={{color: 'var(--accent-purple-light)', cursor: 'pointer'}}>Masuk</span></>
          )}
        </p>
        </>
        )}

        {activeTab === 'forgot' && (
          <p style={{ textAlign: 'center', margin: '1rem 0 0 0' }}>
            <span onClick={() => { setActiveTab('login'); setShowForgotOtp(false); }} style={{color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline'}}>Kembali ke Login</span>
          </p>
        )}
        </div>
      )}
    </div>

      {/* ========================================== */}
      {/* MOBILE VIEW                                */}
      {/* ========================================== */}
      <div className="modal-overlay mobile-only-modal" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 8, 20, 0.8)', backdropFilter: 'blur(10px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem', boxSizing: 'border-box'
    }}>
      {showAgreement ? (
        <div className="login-modal-wrapper agreement-modal" onClick={e => e.stopPropagation()} style={{
          background: 'var(--bg-card)', width: '90%', maxWidth: '500px', borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)', padding: '1.25rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative'
        }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#ff3d5e', cursor: 'pointer', fontSize: '1.2rem', zIndex: 10 }}>✖</button>
          <h2 style={{color: '#f8fafc', fontSize: '1.5rem', fontWeight: 600, textAlign: 'center', margin: 0}}>📜 SYARAT & KETENTUAN</h2>
          <div style={{
            background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)',
            maxHeight: '300px', overflowY: 'auto', fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.6'
          }}>
            <p style={{marginBottom: '1rem'}}>
              Selamat datang di <strong>SATSET Vidual Auto-Sell Bot</strong>. Dengan menggunakan platform ini, Anda menyetujui seluruh ketentuan di bawah ini:
            </p>
            <ol style={{paddingLeft: '1.2rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem'}}>
              <li>
                <strong style={{color: '#f8fafc'}}>Tidak Ada Penyimpanan Data Rahasia:</strong> Kami menjamin 100% bahwa kami <strong>tidak pernah menyimpan Private Key</strong>, frasa pemulihan, atau data rahasia dompet Anda di server kami. Sistem memproses Private Key Anda secara langsung (on-the-fly) murni di dalam memori yang bersifat sementara.
              </li>
              <li>
                <strong style={{color: '#facc15'}}>Risiko Kehilangan Aset (Tanggung Jawab Penuh Pengguna):</strong> Dunia <i>cryptocurrency</i> dan <i>smart contract</i> memiliki risiko yang sangat tinggi. Segala bentuk kerugian finansial, hilangnya aset, salah urus token, *rug pull*, atau eksploitasi peretasan/kebocoran pada perangkat pribadi Anda adalah <strong>tanggung jawab Anda sepenuhnya</strong>.
              </li>
              <li>
                <strong style={{color: '#f8fafc'}}>Pelepasan Tuntutan (Disclaimer):</strong> Developer dan platform SATSET Vidual <strong>sama sekali tidak bertanggung jawab</strong> dan dibebaskan dari segala macam tuntutan hukum atas kerugian materiel maupun imateriel yang terjadi akibat kelalaian Anda atau kegagalan sistem terdesentralisasi (blockchain).
              </li>
              <li>
                <strong style={{color: '#4ade80'}}>Privasi & Isolasi Data Terjamin:</strong> Data masing-masing profil pengguna terisolasi 100% secara ketat di sistem kami. Kami menjamin bahwa tidak akan ada kebocoran data (*data leak*) atau persilangan akses data Anda ke *user* lain mana pun di platform ini. Kerahasiaan Anda terjamin sepenuhnya.
              </li>
            </ol>
            <p>
              Dengan mencentang kotak di bawah ini, Anda menyatakan bahwa Anda telah membaca, memahami risiko, dan membebaskan kami dari segala tuntutan hukum yang berlaku.
            </p>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer'}} onClick={() => setAgreed(!agreed)}>
            <div style={{
              width: '24px', height: '24px', border: '2px solid', borderColor: agreed ? '#00C853' : 'rgba(255,255,255,0.3)',
              borderRadius: '6px', display: 'flex', justifyContent: 'center', alignItems: 'center',
              background: agreed ? '#00C853' : 'transparent', transition: 'all 0.2s'
            }}>
              {agreed && <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
            </div>
            <span style={{color: '#94a3b8', fontSize: '0.9rem', userSelect: 'none'}}>Saya setuju dengan semua persyaratan di atas.</span>
          </div>
          <button 
            disabled={!agreed || isLoading}
            onClick={async () => {
              setIsLoading(true);
              await new Promise(r => setTimeout(r, 3000));
              sessionStorage.setItem('loginSuccess', 'true');
              window.location.href = '/dashboard';
            }}
            style={{
              padding: '1rem', width: '100%', borderRadius: '8px', border: 'none',
              background: agreed ? 'linear-gradient(135deg, #0052ff, #00C853)' : 'rgba(255,255,255,0.05)',
              color: agreed ? 'white' : 'rgba(255,255,255,0.3)', fontWeight: 600, fontSize: '1rem',
              cursor: (!agreed || isLoading) ? 'not-allowed' : 'pointer', transition: 'all 0.3s',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 11-6.219-8.56"></path>
                </svg>
                Memuat...
              </span>
            ) : 'SETUJU & MASUK 🚀'}
          </button>
        </div>
      ) : showOtp ? (
        <div className="login-modal-wrapper" onClick={e => e.stopPropagation()} style={{
          background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)',
          width: '90%', maxWidth: '400px', padding: '1.25rem', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', position: 'relative', boxSizing: 'border-box'
        }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#ff3d5e', cursor: 'pointer', fontSize: '1.2rem', zIndex: 10 }}>✖</button>
          <h2 style={{color: 'white', textAlign: 'center', marginBottom: '1rem'}}>Verifikasi OTP</h2>
          <p style={{color: '#94a3b8', textAlign: 'center', fontSize: '0.9rem', marginBottom: '2rem'}}>
            Kode OTP telah dikirim ke <strong>{email}</strong>. Silakan periksa kotak masuk (Inbox) atau <strong>folder Spam</strong> Anda.
          </p>
          <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box', marginBottom: '1.5rem' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              🔑
            </span>
            <input 
              type="text" 
              placeholder="Masukkan 6 Digit OTP" 
              value={otp}
              onChange={e => setOtp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
              maxLength={6}
              style={{
                width: '100%', height: '48px', padding: '0 1rem 0 3rem', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          <button 
            disabled={isLoading}
            onClick={handleVerifyOtp}
            style={{
            width: '100%', height: '48px', background: 'linear-gradient(135deg, var(--accent-purple-light), var(--accent-purple))', color: 'white',
            border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '1rem',
            cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
            marginBottom: '1rem', transition: 'background 0.3s ease', boxSizing: 'border-box',
            opacity: isLoading ? 0.7 : 1
          }}>
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 11-6.219-8.56"></path>
                </svg>
                Memverifikasi...
              </span>
            ) : 'Verifikasi & Buat Akun'}
          </button>
          <p style={{ textAlign: 'center', margin: 0 }}>
            <span onClick={() => setShowOtp(false)} style={{color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline'}}>Kembali</span>
          </p>
        </div>
      ) : (
        <div className="login-modal-wrapper" onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        width: '90%',
        maxWidth: '400px',
        padding: '1.25rem',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        position: 'relative',
        boxSizing: 'border-box'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#ff3d5e', cursor: 'pointer', fontSize: '1.2rem', zIndex: 10 }}>✖</button>
        {activeTab !== 'forgot' && (
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem', width: '100%', boxSizing: 'border-box' }}>
          <button 
            onClick={() => setActiveTab('login')}
            style={{ 
              flex: 1, padding: '0.75rem', background: 'transparent', border: 'none', 
              color: activeTab === 'login' ? 'var(--accent-purple-light)' : '#94a3b8',
              borderBottom: activeTab === 'login' ? '2px solid #0052ff' : '2px solid transparent',
              cursor: 'pointer', fontWeight: '500', fontSize: '1rem',
              transition: 'all 0.3s ease', boxSizing: 'border-box'
            }}
          >
            Masuk
          </button>
          <button 
            onClick={() => setActiveTab('register')}
            style={{ 
              flex: 1, padding: '0.75rem', background: 'transparent', border: 'none', 
              color: activeTab === 'register' ? 'var(--accent-purple-light)' : '#94a3b8',
              borderBottom: activeTab === 'register' ? '2px solid #0052ff' : '2px solid transparent',
              cursor: 'pointer', fontWeight: '500', fontSize: '1rem',
              transition: 'all 0.3s ease', boxSizing: 'border-box'
            }}
          >
            Mendaftar
          </button>
        </div>
        )}

        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
          {activeTab === 'forgot' && !showForgotOtp && (
            <>
              <h2 style={{color: 'white', textAlign: 'center', margin: '0 0 0.5rem 0'}}>Lupa Password</h2>
              <p style={{color: '#94a3b8', textAlign: 'center', fontSize: '0.9rem', marginBottom: '1.5rem'}}>Masukkan email Anda untuk menerima OTP.</p>
            </>
          )}

          {activeTab === 'forgot' && showForgotOtp && (
            <>
              <h2 style={{color: 'white', textAlign: 'center', margin: '0 0 0.5rem 0'}}>Reset Password</h2>
              <p style={{color: '#94a3b8', textAlign: 'center', fontSize: '0.9rem', marginBottom: '1.5rem'}}>Masukkan OTP dari email (cek folder Spam jika tidak ada) dan password baru.</p>
              
              <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔑</span>
                <input 
                  type="text" placeholder="6 Digit OTP" 
                  value={otp} onChange={e => setOtp(e.target.value)}
                  maxLength={6}
                  style={{ width: '100%', height: '48px', padding: '0 1rem 0 3rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔒</span>
                <input 
                  type={showPassword ? "text" : "password"} placeholder="Password Baru" 
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  style={{ width: '100%', height: '48px', padding: '0 3rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white', outline: 'none', boxSizing: 'border-box' }}
                />
                <button onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>👁️</button>
              </div>
            </>
          )}

          {activeTab === 'register' && (
            <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                👤
              </span>
              <input 
                type="text" 
                placeholder="Nama Lengkap" 
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                style={{
                  width: '100%', height: '48px', padding: '0 1rem 0 3rem', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          )}
          
          {(!showForgotOtp) && (
          <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              ✉️
            </span>
            <input 
              type="text" 
              placeholder="Email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAction()}
              style={{
                width: '100%', height: '48px', padding: '0 1rem 0 3rem', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          )}
          
          {activeTab !== 'forgot' && (
          <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              🔒
            </span>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Kata Sandi" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAction()}
              style={{
                width: '100%', height: '48px', padding: '0 3rem', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: 'white',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
            <button 
              onClick={() => setShowPassword(!showPassword)}
              style={{ 
                position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', 
                background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer',
                boxSizing: 'border-box', padding: 0
              }}
            >
              👁️
            </button>
          </div>
          )}

          {activeTab === 'login' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem', width: '100%' }}>
              <span onClick={() => { setActiveTab('forgot'); setShowForgotOtp(false); setOtp(''); setNewPassword(''); }} style={{color: 'var(--accent-purple-light)', cursor: 'pointer', fontSize: '0.85rem'}}>Lupa Password?</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button 
          disabled={isLoading}
          onClick={activeTab === 'forgot' ? (showForgotOtp ? handleVerifyResetOtp : handleRequestResetOtp) : handleAction}
          style={{
          width: '100%', height: '48px', background: 'linear-gradient(135deg, var(--accent-purple-light), var(--accent-purple))', color: 'white',
          border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '1rem',
          cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
          marginBottom: '1.5rem', transition: 'background 0.3s ease', boxSizing: 'border-box',
          opacity: isLoading ? 0.7 : 1
        }}>
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 11-6.219-8.56"></path>
              </svg>
              Memuat...
            </span>
          ) : (activeTab === 'forgot' ? (showForgotOtp ? 'Reset Password' : 'Kirim OTP Reset') : (activeTab === 'login' ? 'Masuk →' : 'Mendaftar →'))}
        </button>

        {activeTab !== 'forgot' && (
          <>
        {/* Or Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Atau</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
        </div>

        {/* Telegram Button */}
        <button 
          onClick={(e) => {
            e.preventDefault();
            if (showNotification) showNotification('Metode Masuk ini belum tersedia', 'warning');
          }}
          style={{
          width: '100%', height: '48px', background: 'transparent', color: 'var(--accent-purple-light)',
          border: '1px solid rgba(157, 78, 221, 0.3)', borderRadius: '8px', fontWeight: '500',
          cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
          textDecoration: 'none', marginBottom: '2rem', transition: 'all 0.3s ease', boxSizing: 'border-box'
        }}>
          <span style={{fontSize: '1.2rem', display: 'flex', alignItems: 'center'}}>✈️</span> Masuk dengan Telegram
        </button>

        {/* Footer Text */}
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', margin: 0, width: '100%', boxSizing: 'border-box' }}>
          {activeTab === 'login' ? (
            <>Belum punya akun? <span onClick={() => setActiveTab('register')} style={{color: 'var(--accent-purple-light)', cursor: 'pointer'}}>Mendaftar</span></>
          ) : (
            <>Sudah punya akun? <span onClick={() => setActiveTab('login')} style={{color: 'var(--accent-purple-light)', cursor: 'pointer'}}>Masuk</span></>
          )}
        </p>
        </>
        )}

        {activeTab === 'forgot' && (
          <p style={{ textAlign: 'center', margin: '1rem 0 0 0' }}>
            <span onClick={() => { setActiveTab('login'); setShowForgotOtp(false); }} style={{color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline'}}>Kembali ke Login</span>
          </p>
        )}
        </div>
      )}
    </div>
    </>
  );
}