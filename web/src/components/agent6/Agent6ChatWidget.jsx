'use client';
import { useState, useRef, useEffect } from 'react';
import './agent6.css';
import ElementInspector from './ElementInspector';

export default function Agent6ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInspectorActive, setIsInspectorActive] = useState(false);

  const initialWelcome = {
    role: 'assistant',
    content: `👋 **Halo! Saya Agent 6 (Sentinel)** — AI Web Architect & Full-Stack Live Coding Copilot.

Saya terhubung langsung ke seluruh source code proyek ini dengan **Sistem Multi-Model Otomatis** (Anti Rate-Limit & Auto Failover). Saya bisa:
- 🔍 **Audit & Membaca Seluruh File / Script Web**
- 🖼️ **Membaca Gambar / Screenshot** (Bisa Upload atau **Paste \`Ctrl+V\`**)
- 🎯 **Inspect Elemen**: Klik tombol target di atas untuk memilih kotak/tombol yang ingin diubah
- ⚡ **Auto-Coding Langsung**: Minta perubahan ukuran/warna/fitur, kode di VSCode langsung berubah!

Apa yang ingin Anda tanyakan atau modifikasi hari ini?`
  };

  const [messages, setMessages] = useState([initialWelcome]);
  const [inputVal, setInputVal] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [patchStatus, setPatchStatus] = useState({});

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const handleResetChat = () => {
    if (confirm('Bersihkan riwayat percakapan dengan Agent 6?')) {
      setMessages([initialWelcome]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Handle Paste from Clipboard (Images & Text)
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          setAttachedImage(event.target.result);
        };
        reader.readAsDataURL(blob);
        e.preventDefault();
        break;
      }
    }
  };

  // Handle File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Auto-capture screen snapshot (Client-side Canvas Render)
  const handleCaptureScreen = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(window.innerWidth, 1280);
      canvas.height = Math.min(window.innerHeight, 800);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 250, canvas.height); // Sidebar

      ctx.fillStyle = '#007bff';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText('SATSET VIDUAL', 30, 48);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '16px Inter, sans-serif';
      ctx.fillText(`Layar Aktif: ${window.location.pathname}`, 280, 50);

      const dataUrl = canvas.toDataURL('image/png');
      setAttachedImage(dataUrl);
    } catch (err) {
      console.warn('Capture error:', err);
    }
  };

  // Send message to Agent 6
  const handleSendMessage = async (customPrompt, imageOverride) => {
    const promptToSend = customPrompt || inputVal;
    const imgToSend = imageOverride || attachedImage;

    if (!promptToSend.trim() && !imgToSend) return;

    const userMessage = {
      role: 'user',
      content: promptToSend,
      image: imgToSend
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputVal('');
    setAttachedImage(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/agent6/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages
        })
      });

      const data = await res.json();
      if (data.success) {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages([...newMessages, {
          role: 'assistant',
          content: `⚠️ Terjadi kendala: ${data.error || 'Gagal menghubungi Agent 6.'}`
        }]);
      }
    } catch (err) {
      setMessages([...newMessages, {
        role: 'assistant',
        content: `⚠️ Terjadi kesalahan jaringan saat berkomunikasi dengan Agent 6.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Element Selected from Inspector
  const handleSelectElement = (elInfo) => {
    setIsInspectorActive(false);
    setIsOpen(true);
    const prompt = `Saya memilih elemen UI:
- Selector: \`${elInfo.selector}\`
- Tag: \`<${elInfo.tagName}>\`
- Dimensi saat ini: ${elInfo.width} × ${elInfo.height}px
- Teks/Konten: "${elInfo.innerSnippet}"

Tolong modifikasi elemen ini (misal sesuaikan ukuran atau warnanya) dan berikan patch kodenya.`;
    handleSendMessage(prompt);
  };

  // Apply Patch to Local Files
  const handleApplyPatch = async (patchJson, patchId) => {
    setPatchStatus(prev => ({ ...prev, [patchId]: 'applying' }));
    try {
      const res = await fetch('/api/agent6/apply-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchJson)
      });

      const data = await res.json();
      if (data.success) {
        setPatchStatus(prev => ({ ...prev, [patchId]: 'success' }));
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `✅ **Kode Berhasil Diterapkan ke File Disk!**\n- File: \`${data.filePath}\`\n- Status: Berhasil diperbarui\n\n*Next.js & VSCode otomatis melakukan Hot-Reload saat ini juga.*`
          }
        ]);
      } else {
        setPatchStatus(prev => ({ ...prev, [patchId]: 'error' }));
        alert(`Gagal menerapkan patch: ${data.error}`);
      }
    } catch (err) {
      setPatchStatus(prev => ({ ...prev, [patchId]: 'error' }));
      alert('Terjadi kesalahan jaringan saat menerapkan patch.');
    }
  };

  // Helper to parse patch blocks from markdown
  const parseMessageContent = (content, msgIndex) => {
    if (!content.includes('```agent6-patch')) {
      return (
        <div style={{ whiteSpace: 'pre-wrap' }}>
          {content}
        </div>
      );
    }

    const parts = content.split(/```agent6-patch([\s\S]*?)```/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        let patchData = null;
        try {
          patchData = JSON.parse(part.trim());
        } catch {
          patchData = null;
        }

        const patchId = `${msgIndex}_${i}`;
        const currentStatus = patchStatus[patchId];

        return (
          <div key={i} className="agent6-patch-card">
            <div className="agent6-patch-header">
              <span>⚡ AUTO-CODE PATCH TERSEDIA</span>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{patchData?.filePath || 'File'}</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginBottom: '6px' }}>
              {patchData?.description || 'Modifikasi kode sumber'}
            </div>
            <pre style={{
              background: 'rgba(0,0,0,0.5)',
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '0.68rem',
              overflowX: 'auto',
              color: '#38bdf8'
            }}>
              {patchData?.replacement || part.trim()}
            </pre>
            <button
              onClick={() => handleApplyPatch(patchData, patchId)}
              disabled={currentStatus === 'applying' || currentStatus === 'success'}
              className={`agent6-patch-btn ${currentStatus === 'success' ? 'applied' : ''}`}
            >
              {currentStatus === 'applying' ? '⏳ Menerapkan ke VSCode...' :
               currentStatus === 'success' ? '✅ Berhasil Diterapkan ke File' :
               '🚀 Terapkan Patch Otomatis ke VSCode'}
            </button>
          </div>
        );
      }
      return <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</div>;
    });
  };

  const quickBarRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftPos, setScrollLeftPos] = useState(0);

  const handleMouseDown = (e) => {
    if (!quickBarRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - quickBarRef.current.offsetLeft);
    setScrollLeftPos(quickBarRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !quickBarRef.current) return;
    e.preventDefault();
    const x = e.pageX - quickBarRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    quickBarRef.current.scrollLeft = scrollLeftPos - walk;
  };

  const scrollQuickBar = (direction) => {
    if (quickBarRef.current) {
      quickBarRef.current.scrollBy({ left: direction === 'left' ? -160 : 160, behavior: 'smooth' });
    }
  };

  return (
    <>
      <ElementInspector
        isActive={isInspectorActive}
        onSelectElement={handleSelectElement}
        onCancel={() => setIsInspectorActive(false)}
      />

      {/* Floating Launcher Bubble */}
      {!isOpen && (
        <div
          className="agent6-floating-bubble"
          onClick={() => setIsOpen(true)}
          title="Buka Chat AI Agent 6 (Sentinel Copilot)"
        >
          <span>🤖</span>
          <span className="agent6-bubble-dot"></span>
          <span className="agent6-bubble-badge">Agent 6</span>
        </div>
      )}

      {/* Expanded Chat Panel Window */}
      {isOpen && (
        <div className={`agent6-panel-window ${isFullscreen ? 'fullscreen' : ''}`}>
          {/* Header */}
          <div className="agent6-header">
            <div className="agent6-header-info">
              <div className="agent6-avatar-box">
                🤖
              </div>
              <div>
                <h3 className="agent6-header-title">
                  Agent 6 <span style={{ color: '#c084fc', fontSize: '0.7rem' }}>● Sentinel Copilot</span>
                </h3>
                <p className="agent6-header-sub">Full-Stack AI Architect & Live Auto-Coder</p>
              </div>
            </div>

            <div className="agent6-header-actions">
              <button
                className={`agent6-action-icon-btn ${isInspectorActive ? 'active' : ''}`}
                onClick={() => {
                  setIsInspectorActive(!isInspectorActive);
                  if (!isInspectorActive) setIsOpen(false);
                }}
                title="Inspect Elemen di Layar Web"
              >
                🎯
              </button>

              <button
                className="agent6-action-icon-btn"
                onClick={handleCaptureScreen}
                title="Ambil Screenshot Layar Web"
              >
                📸
              </button>

              <button
                className="agent6-action-icon-btn"
                onClick={handleResetChat}
                title="Bersihkan Percakapan Chat"
              >
                🗑️
              </button>

              <button
                className="agent6-action-icon-btn"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? 'Kecilkan Window' : 'Perbesar Window'}
              >
                {isFullscreen ? '🗗' : '⛶'}
              </button>

              <button
                className="agent6-action-icon-btn"
                onClick={() => setIsOpen(false)}
                title="Tutup Chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Action Chips with Smooth Horizontal Scroll & Drag */}
          <div className="agent6-quick-bar-wrapper">
            <button
              onClick={() => scrollQuickBar('left')}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: 'none',
                color: '#94a3b8',
                padding: '0 6px',
                height: '100%',
                cursor: 'pointer',
                fontSize: '0.75rem',
                zIndex: 2
              }}
              title="Geser Kiri"
            >
              ◀
            </button>

            <div
              ref={quickBarRef}
              className="agent6-quick-bar"
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeaveOrUp}
              onMouseUp={handleMouseLeaveOrUp}
              onMouseMove={handleMouseMove}
              onWheel={(e) => {
                if (e.deltaY !== 0) {
                  e.currentTarget.scrollLeft += e.deltaY;
                }
              }}
            >
              <div className="agent6-quick-chip" onClick={() => handleSendMessage('Tolong audit struktur keseluruhan web SATSET VIDUAL dan PumpFun Agent ini!')}>
                🔍 Audit Full Web
              </div>
              <div className="agent6-quick-chip" onClick={() => handleSendMessage('Tampilkan struktur folder dan file-file utama di proyek ini.')}>
                📁 Struktur Folder
              </div>
              <div className="agent6-quick-chip" onClick={() => handleSendMessage('Periksa apakah ada potensi bug, layout misalign, atau error pada script web.')}>
                ⚡ Cek Bug & Error
              </div>
              <div className="agent6-quick-chip" onClick={handleCaptureScreen}>
                📸 Foto Layar
              </div>
              <div className="agent6-quick-chip" onClick={() => handleSendMessage('Bantu saya membuat fitur baru atau memodifikasi layout komponen web.')}>
                🛠️ Request Fitur / Layout
              </div>
              <div className="agent6-quick-chip" onClick={() => handleSendMessage('Tolong jelaskan cara kerja script trading di proyek ini.')}>
                💡 Penjelasan Script
              </div>
            </div>

            <button
              onClick={() => scrollQuickBar('right')}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: 'none',
                color: '#94a3b8',
                padding: '0 6px',
                height: '100%',
                cursor: 'pointer',
                fontSize: '0.75rem',
                zIndex: 2
              }}
              title="Geser Kanan"
            >
              ▶
            </button>
          </div>

          {/* Messages Area */}
          <div className="agent6-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`agent6-msg-row ${msg.role === 'user' ? 'user' : 'agent'}`}>
                <div className="agent6-msg-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="agent6-msg-bubble">
                  {msg.image && (
                    <img src={msg.image} alt="Attachment" className="agent6-msg-image" />
                  )}
                  {parseMessageContent(msg.content, index)}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="agent6-msg-row agent">
                <div className="agent6-msg-avatar">🤖</div>
                <div className="agent6-msg-bubble" style={{ color: '#c084fc', fontStyle: 'italic' }}>
                  ⏳ Agent 6 sedang menganalisis kode dan menyiapkan solusi...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="agent6-input-container">
            {attachedImage && (
              <div className="agent6-image-preview-bar">
                <img src={attachedImage} alt="Preview" className="agent6-preview-thumb" />
                <span style={{ fontSize: '0.72rem', color: '#00e676', flex: 1 }}>Gambar / Screenshot Terlampir</span>
                <button
                  onClick={() => setAttachedImage(null)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  ✕
                </button>
              </div>
            )}

            <div className="agent6-input-row">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />

              <button
                className="agent6-action-icon-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload Gambar / Screenshot"
              >
                📁
              </button>

              <textarea
                ref={textareaRef}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                onPaste={handlePaste}
                placeholder="Ketik pesan atau Paste Screenshot (Ctrl+V)..."
                className="agent6-textarea"
                rows={1}
              />

              <button
                className="agent6-send-btn"
                onClick={() => handleSendMessage()}
                disabled={isLoading}
                title="Kirim Instruksi"
              >
                🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
