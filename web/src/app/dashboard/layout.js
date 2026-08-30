"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import "./dashboard.css";
import ProfileModal from "@/components/ProfileModal";
import InfoModal from "@/components/InfoModal";


const BackgroundCandles = ({ position }) => {
  const candles = [
    { h: 40, w: 70, up: false }, { h: 55, w: 80, up: true }, { h: 30, w: 50, up: false },
    { h: 65, w: 90, up: true }, { h: 45, w: 70, up: true }, { h: 80, w: 100, up: false },
    { h: 35, w: 60, up: true }, { h: 50, w: 80, up: false }, { h: 70, w: 90, up: true },
    { h: 40, w: 65, up: false }, { h: 60, w: 85, up: true }, { h: 85, w: 100, up: false }
  ];

  return (
    <div style={{
      position: 'fixed', top: '15%', height: '400px', width: '250px',
      [position]: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      opacity: 0.15, zIndex: 0, pointerEvents: 'none', padding: '0 2rem'
    }}>
      {candles.map((c, i) => (
        <div key={i} style={{
          width: '8px', height: `${c.h}%`, background: c.up ? 'var(--accent-purple-light)' : 'var(--accent-purple)',
          position: 'relative', display: 'flex', justifyContent: 'center'
        }}>
          <div style={{ width: '1px', height: `${c.w}%`, position: 'absolute', bottom: `-${(c.w - c.h) / 2}%`, background: 'inherit' }}></div>
        </div>
      ))}
    </div>
  );
};

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [walletAddress, setWalletAddress] = useState(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [userName, setUserName] = useState("SATSET VIDUAL");
  const [userAvatar, setUserAvatar] = useState(null);
  const [userRole, setUserRole] = useState("Member");
  const [isDevMode, setIsDevMode] = useState(false);
  const [premiumCode, setPremiumCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [codeMessage, setCodeMessage] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFiturLainnyaOpen, setIsFiturLainnyaOpen] = useState(false);
  const [isAutoSellOpen, setIsAutoSellOpen] = useState(false);
  const [isMonitoringOpen, setIsMonitoringOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [lastSeenNotifCount, setLastSeenNotifCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);
  const [isPentingOpen, setIsPentingOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (pathname.startsWith('/dashboard/autosell')) {
      setIsAutoSellOpen(true);
    }
    if (pathname.startsWith('/dashboard/monitoring')) {
      setIsMonitoringOpen(true);
    }
    if (pathname.startsWith('/dashboard/fiturlainnya')) {
      setIsFiturLainnyaOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    // Check authentication
    const savedAddress = localStorage.getItem('walletAddress');
    if (!savedAddress) {
      router.push('/');
      return;
    } else {
      setWalletAddress(savedAddress);
    }

    // Polling for user deletion
    const checkUserExists = async () => {
      const email = localStorage.getItem('walletAddress');
      const name = localStorage.getItem('userName');
      if (email && name) {
        try {
          const res = await fetch(`/api/checkUser?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
          });
          const data = await res.json();
          if (data.exists === false) {
            // User was deleted from user.json
            // Menonaktifkan fitur tendang paksa karena menyebabkan bug di Vercel/SaaS
            // localStorage.clear();
            // window.location.href = '/'; // force full refresh back to home
          } else if (data.role) {
            const currentRole = localStorage.getItem('userRole');
            if (currentRole !== data.role) {
              localStorage.setItem('userRole', data.role);
              window.dispatchEvent(new Event('profileUpdated'));
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
    };

    checkUserExists();
    const pollInterval = setInterval(checkUserExists, 3000); // Check every 3 seconds

    // Load User Name and Avatar
    const loadProfile = () => {
      const savedName = localStorage.getItem("userName");
      const savedAvatar = localStorage.getItem("userAvatar");
      const savedLastSeen = localStorage.getItem("lastSeenNotifCount");
      const savedRole = localStorage.getItem("userRole");
      const devMode = localStorage.getItem("isDevMode") === 'true';

      if (savedName) setUserName(savedName);
      if (savedAvatar) setUserAvatar(savedAvatar);
      if (savedRole) setUserRole(savedRole);
      if (savedLastSeen) setLastSeenNotifCount(parseInt(savedLastSeen, 10));
      setIsDevMode(devMode);
    };
    loadProfile();

    if (sessionStorage.getItem('loginSuccess') === 'true') {
      setToastMessage("✅ Berhasil masuk ke Dashboard");
      sessionStorage.removeItem('loginSuccess');
      setTimeout(() => setToastMessage(null), 3000);
    }

    window.addEventListener('profileUpdated', loadProfile);
    return () => {
      window.removeEventListener('profileUpdated', loadProfile);
      clearInterval(pollInterval);
    };
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('walletAddress');
    sessionStorage.setItem('logoutSuccess', 'true');
    router.push('/');
  };

  const formatAddress = (address) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setIsProfileMenuOpen(false);
      setIsNotifMenuOpen(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleToggleNotifMenu = () => {
    if (!isNotifMenuOpen) {
      // User is opening the notification menu
      setLastSeenNotifCount(notificationCount);
      localStorage.setItem('lastSeenNotifCount', notificationCount);
    }
    setIsNotifMenuOpen(!isNotifMenuOpen);
  };

  const handleApplyCode = async () => {
    if (!premiumCode.trim()) return;

    setIsApplying(true);
    setCodeMessage("");

    // Animasi memuat 2 detik
    await new Promise(resolve => setTimeout(resolve, 2000));

    const email = localStorage.getItem("walletAddress");

    try {
      const res = await fetch('/api/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: premiumCode })
      });

      const data = await res.json();
      if (data.success) {
        setCodeMessage("Kode berhasil di Gunakan");
        localStorage.setItem("userRole", "Premium");
        setUserRole("Premium");
        window.dispatchEvent(new Event('profileUpdated'));
        // Clear message after 3 seconds
        setTimeout(() => setCodeMessage(""), 3000);
      } else {
        setCodeMessage(data.error || "Kode Salah");
      }
    } catch (err) {
      setCodeMessage("Terjadi kesalahan koneksi.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleGenerateCode = async () => {
    setIsGeneratingCode(true);
    setGeneratedCode('');
    try {
      const email = localStorage.getItem("walletAddress");
      const res = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }) // Pass email as basic check
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedCode(data.code);
        navigator.clipboard.writeText(data.code);
        showToast("Kode berhasil digenerate & dicopy!");
      } else {
        showToast("Gagal: " + data.error);
      }
    } catch (err) {
      showToast("Terjadi kesalahan sistem.");
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Poll notifications
  useEffect(() => {
    if (!userName || userName === "SATSET VIDUAL") return;

    const fetchNotifications = async () => {
      try {
        const res = await fetch(`/api/autosell/notifications?userName=${encodeURIComponent(userName)}`);
        if (res.ok) {
          const data = await res.json();
          setNotificationCount(data.count);
          if (data.history) setNotifications(data.history);
        }
      } catch (err) { }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [userName]);

  // Scroll to top on route change or reload
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    // Force immediate scroll to top
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const mainContent = document.querySelector('.dashboard-main');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
  }, [pathname]);

  if (!walletAddress) return null; // Prevent hydration flash

  return (
    <div className={`dashboard-container ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      <BackgroundCandles position="left" />
      <BackgroundCandles position="right" />
      <div className="glowing-arc"></div>
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${!isSidebarOpen ? 'collapsed' : ''}`} style={{ background: '#131722' }}>
        {/* Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="sidebar-toggle-btn"
          title={isSidebarOpen ? "Tutup Menu" : "Buka Menu"}
        >
          {isSidebarOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.5))' }}>
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.5))' }}>
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          )}
        </button>

        <div style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="sidebar-logo">
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span className="jtr" style={{ fontSize: '1.8rem', color: '#007bff', fontWeight: 800, fontStyle: 'italic', marginRight: 6 }}>SATSET</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 600, textTransform: 'uppercase', color: '#00e676' }}>Vidual</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <Link href="/dashboard" className={pathname === '/dashboard' ? 'active' : ''} title="Dashboard"><span className="icon">🏠</span> Dashboard</Link>
            <Link href="/dashboard/scan-alamat" className={pathname === '/dashboard/scan-alamat' ? 'active' : ''} title="Scan Alamat"><span className="icon">🔍</span> Scan Alamat</Link>
            <Link href="/dashboard/deploy" className={pathname === '/dashboard/deploy' ? 'active' : ''} title="Deploy Token"><span className="icon">🚀</span> Deploy Token</Link>
            <Link href="/dashboard/add-lp" className={pathname === '/dashboard/add-lp' ? 'active' : ''} title="Add single LP"><span className="icon">💧</span> Add single LP</Link>
            <Link href="/dashboard/airdrop" className={pathname === '/dashboard/airdrop' ? 'active' : ''} title="Airdrop"><span className="icon">🎁</span> Airdrop</Link>


            <a href="#" onClick={(e) => { e.preventDefault(); if (!isSidebarOpen) { setIsSidebarOpen(true); setIsMonitoringOpen(true); } else { setIsMonitoringOpen(!isMonitoringOpen); } }} className={pathname === '/dashboard/monitoring/index' ? 'active' : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} title="Monitoring">
              <div style={{ display: 'flex', alignItems: 'center' }}><span className="icon">📊</span> Monitoring</div>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{isMonitoringOpen ? '▲' : '▼'}</span>
            </a>
            {isMonitoringOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '0', gap: '0.1rem', marginBottom: '0.5rem' }}>
                <Link href="/dashboard/monitoring/screenerv2" className={pathname === '/dashboard/monitoring/screenerv2' ? 'active' : ''} style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                  <span className="icon"><img src="https://dexscreener.com/favicon.png" width="14" height="14" alt="DS" style={{ borderRadius: '50%' }} /></span> Screener V2
                </Link>
                <Link href="/dashboard/monitoring/portofolio" className={pathname === '/dashboard/monitoring/portofolio' ? 'active' : ''} style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                  <span className="icon" style={{ fontSize: '1rem' }}>💰</span> Portofolio
                </Link>
              </div>
            )}

            <a href="#" onClick={(e) => { e.preventDefault(); if (!isSidebarOpen) { setIsSidebarOpen(true); setIsFiturLainnyaOpen(true); } else { setIsFiturLainnyaOpen(!isFiturLainnyaOpen); } }} className={pathname === '/dashboard/fiturlainnya/index' ? 'active' : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} title="Fitur Lainnya">
              <div style={{ display: 'flex', alignItems: 'center' }}><span className="icon">➕</span> Fitur Lainnya</div>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{isFiturLainnyaOpen ? '▲' : '▼'}</span>
            </a>
            {isFiturLainnyaOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '0', gap: '0.1rem', marginBottom: '0.5rem' }}>
                <Link href="/dashboard/fiturlainnya/wallet-generator" className={pathname === '/dashboard/fiturlainnya/wallet-generator' ? 'active' : ''} style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                  <span className="icon" style={{ fontSize: '1rem' }}>👛</span> Wallet Generator
                </Link>
                <Link href="/dashboard/fiturlainnya/bulk-transfer" className={pathname === '/dashboard/fiturlainnya/bulk-transfer' ? 'active' : ''} style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                  <span className="icon" style={{ fontSize: '1rem' }}>💸</span> Bulk Transfer
                </Link>
                <Link href="/dashboard/fiturlainnya/os-eligible-checker" className={pathname === '/dashboard/fiturlainnya/os-eligible-checker' ? 'active' : ''} style={{ padding: '0.5rem 1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                  <span className="icon" style={{ fontSize: '1rem' }}>⛵</span> OS Eligible Checker
                </Link>
              </div>
            )}

            <a href="#" onClick={(e) => { e.preventDefault(); setIsPentingOpen(true); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }} title="PENTING">
              <div style={{ display: 'flex', alignItems: 'center' }}><span className="icon" style={{ color: '#facc15' }}>⚠️</span> <span style={{ color: '#facc15', fontWeight: 600 }}>PENTING</span></div>
            </a>

            {userRole === 'Developer' && (
              <div style={{ padding: '0.8rem 1rem', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <span style={{ fontSize: '0.75rem', color: isDevMode ? '#00C853' : '#94a3b8', fontWeight: 'bold', flex: 1 }}>DEV MODE</span>
                  <input type="checkbox" checked={isDevMode} onChange={e => {
                    const newVal = e.target.checked;
                    setIsDevMode(newVal);
                    localStorage.setItem('isDevMode', newVal);
                    window.dispatchEvent(new Event('devModeToggled'));
                  }} style={{ display: 'none' }} />
                  <div style={{ width: '30px', height: '16px', background: isDevMode ? '#00C853' : '#334155', borderRadius: '16px', position: 'relative', transition: '0.3s' }}>
                    <div style={{ width: '12px', height: '12px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: isDevMode ? '16px' : '2px', transition: '0.3s' }}></div>
                  </div>
                </label>
                
                <div style={{ marginTop: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.5rem', fontWeight: 600 }}>Generate Kode Premium</div>
                  <button
                    onClick={handleGenerateCode}
                    disabled={isGeneratingCode}
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.6rem',
                      background: 'linear-gradient(135deg, #FF3366, #FF9933)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                      cursor: isGeneratingCode ? 'not-allowed' : 'pointer',
                      opacity: isGeneratingCode ? 0.7 : 1
                    }}
                  >
                    {isGeneratingCode ? 'Loading...' : 'Generate Kode'}
                  </button>
                  {generatedCode && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#00e676', textAlign: 'center', wordBreak: 'break-all' }}>
                      {generatedCode}
                    </div>
                  )}
                </div>
              </div>
            )}
          </nav>

          <div className="sidebar-footer">
            <div className="user-badge" style={{ flexDirection: 'row', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); if (!isSidebarOpen) setIsSidebarOpen(true); else setIsProfileModalOpen(true); }}>
              <div className="user-avatar" style={{ overflow: 'hidden' }}>
                {userAvatar ? (
                  <img src={userAvatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  userName.substring(0, 2).toUpperCase()
                )}
              </div>
              <div className="user-info-text" style={{ alignItems: 'flex-start' }}>
                <span className="user-name">{userName}</span>
                {userRole && userRole !== 'Member' ? (
                  <span style={{
                    fontSize: '0.65rem',
                    background: userRole === 'Developer' ? 'linear-gradient(135deg, #FF3366, #FF9933)' : 'linear-gradient(135deg, #007bff, #00C853)',
                    color: 'white',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    marginTop: '2px',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    display: 'inline-block'
                  }}>
                    {userRole}
                  </span>
                ) : (
                  <span className={`user-role ${userRole?.toLowerCase() || ''}`}>{userRole || 'Member'}</span>
                )}
              </div>
            </div>

            {(userRole !== 'Premium' && userRole !== 'Developer') && (
              <div style={{ marginTop: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.5rem', fontWeight: 600 }}>Tingkatkan ke Premium</div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    type="text"
                    value={premiumCode}
                    onChange={(e) => setPremiumCode(e.target.value)}
                    placeholder="Kode Akses..."
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-glass)',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'white',
                      outline: 'none',
                      fontSize: '0.75rem',
                      minWidth: 0
                    }}
                  />
                  <button
                    onClick={handleApplyCode}
                    disabled={isApplying}
                    style={{
                      padding: '0 0.6rem',
                      background: 'var(--accent-purple)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: isApplying ? 'not-allowed' : 'pointer',
                      opacity: isApplying ? 0.7 : 1,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isApplying ? 'Memuat...' : 'Apply'}
                  </button>
                </div>
                {codeMessage && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: codeMessage === 'Kode berhasil di Gunakan' ? '#00d180' : '#ef4444' }}>
                    {codeMessage}
                  </div>
                )}
              </div>
            )}

            {isSidebarOpen && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>Kontak Bantuan</span>
                <div className="social-icons" style={{ gap: '0.5rem' }}>
                  <a href="https://wa.me/6283195799726" target="_blank" rel="noopener noreferrer" title="WhatsApp" style={{ fontSize: '1.1rem', color: '#25D366', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.66-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  </a>
                  <a href="https://t.me/neslite_sol" target="_blank" rel="noopener noreferrer" title="Telegram" style={{ fontSize: '1.1rem', color: '#0088cc', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.94z" /></svg>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          {pathname === '/dashboard' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
                Selamat datang, <span style={{ color: '#007bff' }}>{userName}</span>! 👋
              </h2>
            </div>
          )}
          <div id="header-search-slot" style={{ flex: pathname === '/dashboard' ? 'none' : 1, paddingRight: '1.5rem' }}></div>
          <div className="header-actions">
            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button className="notification-btn" onClick={handleToggleNotifMenu} style={{ position: 'relative' }}>
                🔔
                {notificationCount - lastSeenNotifCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#ef4444',
                    color: 'white',
                    borderRadius: '50%',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    width: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #1a1e29'
                  }}>
                    {notificationCount - lastSeenNotifCount > 99 ? '99+' : (notificationCount - lastSeenNotifCount)}
                  </span>
                )}
              </button>
              {isNotifMenuOpen && (
                <div className="profile-menu" style={{ width: '350px', right: 0, top: '100%', marginTop: '0.5rem', maxHeight: '400px', overflowY: 'auto', background: '#1e2333', border: '1px solid #334155' }}>
                  <div style={{ padding: '0.75rem', borderBottom: '1px solid #334155', fontWeight: 'bold', fontSize: '0.9rem', color: 'white' }}>
                    Notifikasi Penjualan ({notificationCount})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {notifications.length > 0 ? (
                      notifications.map((notif, i) => (
                        <div key={i} style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: '#94a3b8' }}>
                          <span dangerouslySetInnerHTML={{ __html: notif.replace('✅', '<span style="color:#4ade80">✅</span>').replace(/SUKSES sell/g, '<span style="color:#facc15; font-weight:bold;">SUKSES sell</span>') }}></span>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>Belum ada penjualan sukses.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button
                className="profile-dropdown-btn"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                style={{ border: '1px solid var(--border-glass)', borderRadius: '30px', padding: '0.3rem 0.8rem 0.3rem 0.3rem', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)' }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #007bff, #00C853)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.7rem', overflow: 'hidden' }}>
                  {userAvatar ? (
                    <img src={userAvatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    userName.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="user-info-text" style={{ alignItems: 'flex-start' }}>
                  <span className="user-name" style={{ color: 'white', fontWeight: 600, fontSize: '0.85rem' }}>{userName}</span>
                  {userRole && userRole !== 'Member' && (
                    <span style={{
                      fontSize: '0.65rem',
                      background: userRole === 'Developer' ? 'linear-gradient(135deg, #FF3366, #FF9933)' : 'linear-gradient(135deg, #007bff, #00C853)',
                      color: 'white',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      marginTop: '2px',
                      textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                    }}>
                      {userRole}
                    </span>
                  )}
                </div>
                <span style={{ marginLeft: '0.2rem', fontSize: '0.7rem', color: '#94a3b8' }}>▼</span>
              </button>

              {isProfileMenuOpen && (
                <div className="profile-menu">
                  <button onClick={() => { setIsProfileModalOpen(true); setIsProfileMenuOpen(false); }}>
                    👤 Profil
                  </button>
                  <button onClick={handleLogout} style={{ color: '#ef4444' }}>
                    🚪 Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {children}
      </main>

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />

      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', background: '#00C853',
          color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontWeight: 600, animation: 'fadeIn 0.3s'
        }}>
          {toastMessage}
        </div>
      )}

      {isPentingOpen && (
        <div className="modal-overlay" onClick={() => setIsPentingOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ color: '#f8fafc', marginBottom: '1rem', fontWeight: 600 }}>KEAMANAN & KEPERCAYAAN</h2>
            <p style={{ color: '#cbd5e1', lineHeight: '1.6', fontSize: '0.95rem', marginBottom: '1rem', textAlign: 'justify' }}>
              Sebagai wujud dedikasi kami terhadap integritas sistem dan keamanan aset Anda, kami secara tegas menginformasikan bahwa <strong>kami tidak pernah menyimpan <i>Private Key</i> atau data rahasia <i>user</i> dalam bentuk apapun di <i>server</i> kami</strong>.
            </p>
            <p style={{ color: '#94a3b8', lineHeight: '1.6', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'justify' }}>
              Setiap kali Anda menekan tombol START, <i>Private Key</i> yang Anda masukkan hanya diproses satu kali di dalam memori saat itu juga, dan akan langsung menguap lenyap tanpa jejak. Kami menjunjung tinggi desentralisasi: <strong>Kami tidak dapat mencuri apa yang tidak kami simpan!</strong>
            </p>
            <button
              onClick={() => setIsPentingOpen(false)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #007bff, #00C853)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Mantap! Saya Mengerti
            </button>
          </div>
        </div>
      )}

      {isComingSoonOpen && (
        <div className="modal-overlay" onClick={() => setIsComingSoonOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '350px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚀</div>
            <h2 style={{ color: '#f8fafc', marginBottom: '1rem', fontWeight: 600 }}>Coming Soon!</h2>
            <p style={{ color: '#cbd5e1', lineHeight: '1.6', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              Fitur ini sedang dalam tahap pengembangan dan akan segera hadir di pembaruan selanjutnya.
            </p>
            <button
              onClick={() => setIsComingSoonOpen(false)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #007bff, #00C853)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Oke, Ditunggu!
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
