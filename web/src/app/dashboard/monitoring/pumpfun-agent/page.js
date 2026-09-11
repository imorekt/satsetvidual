'use client';
import { useState, useEffect } from 'react';

export default function PumpFunAgentPage() {
  const [iframeUrl] = useState('http://localhost:3005');
  const [isOnline, setIsOnline] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('http://localhost:3005/api/bot/status', { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        setIsOnline(true);
      } else {
        await fetch('http://localhost:3005', { method: 'GET', cache: 'no-store', mode: 'no-cors' });
        setIsOnline(true);
      }
    } catch {
      try {
        await fetch('http://localhost:3005', { mode: 'no-cors' });
        setIsOnline(true);
      } catch {
        setIsOnline(false);
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const timer = setInterval(checkStatus, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 105px)',
        width: '100%',
        background: '#070a14',
        boxSizing: 'border-box',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
      }}
    >
      {/* Main Full-Size Terminal Frame */}
      <div
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          background: '#070a14',
        }}
      >
        {isOnline ? (
          <iframe
            id="pumpfun-agent-frame"
            src={iframeUrl}
            title="PumpFun Multi-Agent Terminal"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              background: '#070a14',
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '16px',
              color: '#94a3b8',
              textAlign: 'center',
              padding: '30px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '20px',
                background: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
              }}
            >
              💊
            </div>

            <div>
              <h3 style={{ margin: '0 0 8px 0', color: '#f8fafc', fontSize: '1.25rem', fontWeight: 800 }}>
                PumpFun Multi-Agent Engine Sedang Offline
              </h3>
              <p style={{ margin: 0, maxWidth: '520px', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
                Engine backend PumpFun Agent di folder <code style={{ color: '#c084fc', background: 'rgba(192, 132, 252, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>pumpfun-agent</code> belum aktif pada port 3005.
              </p>
            </div>

            <button
              onClick={checkStatus}
              style={{
                marginTop: '6px',
                padding: '10px 22px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)',
              }}
            >
              🔄 Sambungkan Ulang
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
