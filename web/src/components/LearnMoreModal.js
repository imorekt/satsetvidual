"use client";

export default function LearnMoreModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="login-modal-wrapper">
        <div className="modal-content glass-container login-card" onClick={e => e.stopPropagation()} style={{padding: '2rem', maxWidth: '600px', width: '90%', maxHeight: '85vh', overflowY: 'auto'}}>
          <button className="close-btn-absolute" style={{background: 'rgba(0,0,0,0.5)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={onClose}>✕</button>
          
          <div style={{textAlign: 'left', width: '100%'}}>
            <h2 style={{fontSize: '1.8rem', color: 'var(--accent-purple-light)', marginBottom: '0.5rem'}}>🚀 Powerful Tools for Token Creators</h2>
            <p style={{color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6'}}>Semua fitur yang Anda butuhkan untuk membuat, meluncurkan, mengelola, dan mengotomatisasi proyek token dalam satu platform.</p>
            
            <div style={{background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.05)'}}>
              <h3 style={{fontSize: '1.2rem', marginBottom: '0.5rem', color: '#fff'}}>🚀 Auto Deploy</h3>
              <p style={{color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem'}}>Deploy smart contract hanya dalam beberapa klik.</p>
              <ul style={{listStyle: 'none', padding: 0, fontSize: '0.9rem', color: '#cbd5e1'}}>
                <li style={{marginBottom: '0.5rem'}}>🔹 <strong>Remix Deploy:</strong> Deploy kontrak langsung menggunakan Remix dengan proses yang lebih cepat dan praktis.</li>
                <li>🔹 <strong>Thirdweb Deploy:</strong> Deploy melalui Thirdweb dengan kompatibilitas tinggi serta dukungan berbagai template smart contract.</li>
              </ul>
            </div>

            <div style={{background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.05)'}}>
              <h3 style={{fontSize: '1.2rem', marginBottom: '0.5rem', color: '#fff'}}>💧 Auto Add Single LP</h3>
              <p style={{color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem'}}>Tambahkan Liquidity Pool secara otomatis tanpa perlu melakukan proses manual.</p>
              <ul style={{listStyle: 'none', padding: 0, fontSize: '0.9rem', color: '#cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem'}}>
                <li>✅ Otomatis menambah LP</li>
                <li>✅ Mengurangi risiko error</li>
                <li>✅ Proses lebih cepat</li>
                <li>✅ Support Base & Robinhood</li>
              </ul>
            </div>

            <div style={{background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.05)'}}>
              <h3 style={{fontSize: '1.2rem', marginBottom: '0.5rem', color: '#fff'}}>🔍 Scanner Address</h3>
              <p style={{color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem'}}>Analisis alamat wallet secara instan.</p>
              <ul style={{listStyle: 'none', padding: 0, fontSize: '0.9rem', color: '#cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem'}}>
                <li>📜 Riwayat transaksi</li>
                <li>🪙 Informasi token</li>
                <li>💳 Aktivitas wallet</li>
                <li>🟢 Deteksi wallet aktif</li>
                <li>📊 Monitoring pergerakan</li>
              </ul>
            </div>

            <div style={{background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.05)'}}>
              <h3 style={{fontSize: '1.2rem', marginBottom: '0.5rem', color: '#fff'}}>🎁 Airdrop</h3>
              <p style={{color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem'}}>Distribusikan token ke banyak wallet dalam satu proses.</p>
              <ul style={{listStyle: 'none', padding: 0, fontSize: '0.9rem', color: '#cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem'}}>
                <li>💼 Multi Wallet</li>
                <li>📦 Batch Transfer</li>
                <li>⛽ Estimasi Gas</li>
                <li>⏱️ Progress Real-time</li>
              </ul>
            </div>

            <div style={{background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.05)'}}>
              <h3 style={{fontSize: '1.2rem', marginBottom: '0.5rem', color: '#fff'}}>📊 Monitoring</h3>
              <p style={{color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem'}}>Pantau proyek Anda secara real-time.</p>
              <ul style={{listStyle: 'none', padding: 0, fontSize: '0.9rem', color: '#cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem'}}>
                <li>💲 Harga Token</li>
                <li>💧 Liquidity</li>
                <li>📈 Volume</li>
                <li>👥 Jumlah Holder</li>
                <li>🔄 Aktivitas Trading</li>
                <li>✅ Status Kontrak</li>
              </ul>
            </div>

            <div style={{background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'}}>
              <h3 style={{fontSize: '1.2rem', marginBottom: '0.5rem', color: '#fff'}}>🤖 Auto Sell</h3>
              <p style={{color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem'}}>Otomatis menjual token berdasarkan aturan yang Anda tentukan.</p>
              <ul style={{listStyle: 'none', padding: 0, fontSize: '0.9rem', color: '#cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem'}}>
                <li>🎯 Target Profit</li>
                <li>🛑 Stop Loss</li>
                <li>📉 Trailing Sell</li>
                <li>⏱️ Monitoring 24/7</li>
                <li>⚡ Eksekusi Otomatis</li>
                <li>🔗 Support Base & Robinhood</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
