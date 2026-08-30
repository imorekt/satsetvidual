"use client";

export default function InfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="login-modal-wrapper">
        <div className="modal-content glass-container login-card" onClick={e => e.stopPropagation()} style={{padding: '2.5rem', maxWidth: '380px'}}>
          <button className="close-btn-absolute" onClick={onClose}>✕</button>
          
          <div className="modal-icon-circle" style={{background: 'rgba(0, 200, 83, 0.1)', borderColor: 'rgba(0, 200, 83, 0.3)'}}>
            <span style={{fontSize: '1.8rem'}}>📞</span>
          </div>
          
          <h2 className="modal-title" style={{fontSize: '1.5rem'}}>Hubungi Kami</h2>
          <p className="modal-subtitle" style={{marginBottom: '1.5rem', textAlign: 'center'}}>Silakan hubungi kontak di bawah ini untuk bantuan lebih lanjut.</p>
          
          <div className="wallet-options">
            <a href="https://wa.me/6283195799726" target="_blank" rel="noopener noreferrer" className="wallet-btn" style={{background: '#25D366', color: 'white', border: 'none', textDecoration: 'none'}}>
              <div className="wallet-btn-left">
                <span style={{fontSize: '1.2rem', display: 'flex'}}>📱</span>
                <span>WA: 083195799726</span>
              </div>
              <span className="arrow-icon">→</span>
            </a>
            <a href="https://t.me/korongsiabau" target="_blank" rel="noopener noreferrer" className="wallet-btn" style={{background: '#24A1DE', color: 'white', border: 'none', textDecoration: 'none'}}>
              <div className="wallet-btn-left">
                <span style={{fontSize: '1.2rem', display: 'flex'}}>✈️</span>
                <span>Telegram</span>
              </div>
              <span className="arrow-icon">→</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
