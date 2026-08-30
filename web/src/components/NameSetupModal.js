"use client";
import { useState } from "react";

export default function NameSetupModal({ isOpen, walletAddress, onComplete }) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama tidak boleh kosong.");
      return;
    }

    setIsLoading(true);
    setError("");

    // Animasi memuat 2 detik
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Panggil API untuk merekam data ke user.json
      const response = await fetch('/api/saveUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, walletAddress })
      });

      if (!response.ok) {
        throw new Error("Gagal menyimpan data pengguna.");
      }

      // Simpan di local storage
      localStorage.setItem('userName', name);
      localStorage.setItem('walletAddress', walletAddress);

      // Selesai
      onComplete(name);
    } catch (err) {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="login-modal-wrapper">
        <div className="modal-content glass-container login-card" style={{padding: '2.5rem', maxWidth: '400px', width: '90%'}}>
          
          <div className="modal-icon-circle" style={{background: 'rgba(0, 82, 255, 0.1)', borderColor: 'rgba(0, 82, 255, 0.3)', marginBottom: '1.5rem'}}>
            <span style={{fontSize: '1.8rem'}}>👋</span>
          </div>
          
          <h2 className="modal-title" style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>Selamat Datang!</h2>
          <p className="modal-subtitle" style={{marginBottom: '1.5rem'}}>Silakan masukkan nama Anda untuk menyelesaikan pendaftaran.</p>
          
          <form onSubmit={handleSubmit} style={{width: '100%'}}>
            <div style={{marginBottom: '1.5rem', textAlign: 'left'}}>
              <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Nama Tampilan</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Misal: John Doe"
                disabled={isLoading}
                style={{
                  width: '100%', 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-glass)', 
                  background: 'rgba(0,0,0,0.2)', 
                  color: 'white',
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontSize: '1rem'
                }}
              />
              {error && <div style={{color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem'}}>{error}</div>}
            </div>

            <button 
              type="submit" 
              className="btn btn-primary-tele" 
              style={{width: '100%', padding: '1rem', fontSize: '1rem'}}
              disabled={isLoading}
            >
              {isLoading ? "Menyimpan..." : "Simpan & Lanjutkan"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
