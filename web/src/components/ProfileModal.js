"use client";
import { useState, useEffect, useRef } from "react";

export default function ProfileModal({ isOpen, onClose }) {
  const [name, setName] = useState("SATSET Vidual");
  const [previewName, setPreviewName] = useState("SATSET Vidual");
  const [avatar, setAvatar] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const fileInputRef = useRef(null);
  
  // Try to load saved name and avatar
  useEffect(() => {
    const savedName = localStorage.getItem("userName");
    const savedAvatar = localStorage.getItem("userAvatar");
    if (savedName) {
      setName(savedName);
      setPreviewName(savedName);
    }
    if (savedAvatar) {
      setAvatar(savedAvatar);
      setPreviewAvatar(savedAvatar);
    }
  }, [isOpen]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result);
        setPreviewAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Animasi memuat 2 detik
    await new Promise(resolve => setTimeout(resolve, 2000));

    const oldName = localStorage.getItem("userName");
    const walletAddress = localStorage.getItem("walletAddress");

    if (oldName && oldName !== name) {
      try {
        await fetch('/api/updateName', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldName, newName: name, walletAddress })
        });
      } catch (err) {
        console.error("Failed to update name backend", err);
      }
    }

    localStorage.setItem("userName", name);
    setPreviewName(name);
    if (avatar) {
      localStorage.setItem("userAvatar", avatar);
      setPreviewAvatar(avatar);
    }
    // Custom event to trigger navbar update
    window.dispatchEvent(new Event('profileUpdated'));
    
    setIsSaving(false);
    onClose();
  };



  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="login-modal-wrapper">
        <div className="modal-content glass-container login-card" onClick={e => e.stopPropagation()} style={{padding: '2rem', maxWidth: '400px', width: '90%'}}>
          <button className="close-btn-absolute" onClick={onClose}>✕</button>
          
          <h2 className="modal-title" style={{fontSize: '1.5rem', marginBottom: '1.5rem'}}>Pengaturan Profil</h2>
          
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem'}}>
            <div className="user-avatar" style={{width: '80px', height: '80px', fontSize: '2rem', marginBottom: '1rem', overflow: 'hidden'}}>
              {previewAvatar ? (
                <img src={previewAvatar} alt="Profile" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
              ) : (
                previewName.substring(0, 2).toUpperCase()
              )}
            </div>
            <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
            <button className="btn btn-outline" onClick={() => fileInputRef.current.click()} style={{padding: '0.4rem 0.8rem', fontSize: '0.8rem'}}>
              Ubah Foto Profil
            </button>
          </div>

          <div style={{marginBottom: '1.5rem'}}>
            <label style={{display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Nama Tampilan</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%', 
                padding: '0.8rem', 
                borderRadius: '8px', 
                border: '1px solid var(--border-glass)', 
                background: 'rgba(0,0,0,0.2)', 
                color: 'white',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <button 
            className="btn btn-primary-tele" 
            style={{width: '100%', padding: '0.8rem', opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer'}} 
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Memuat...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  );
}
