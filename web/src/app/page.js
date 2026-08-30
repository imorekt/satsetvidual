"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from "next/navigation";
import LoginModal from "@/components/LoginModal";
import InfoModal from "@/components/InfoModal";
import LearnMoreModal from "@/components/LearnMoreModal";
import ProfileModal from "@/components/ProfileModal";
import NameSetupModal from "@/components/NameSetupModal";

const IconLightning = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
const IconChart = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>;
const IconTerminal = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>;
const IconShield = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
const IconLink = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>;
const IconHome = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
const IconSearch = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const IconUsers = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const IconCheckCircle = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
const IconCube = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);
const IconEthereum = () => (
  <svg viewBox="0 0 32 32" fill="currentColor">
    <path d="M15.925 23.969L15.89 24.004L7.545 19.096L15.925 31.001L24.28 19.096L15.925 23.969Z" opacity="0.6" />
    <path d="M15.925 0L7.521 13.882L15.925 18.847L24.316 13.882L15.925 0Z" opacity="0.8" />
  </svg>
);
const IconCrosshair = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><line x1="12" y1="2" x2="12" y2="7" /><line x1="12" y1="17" x2="12" y2="22" /><line x1="2" y1="12" x2="7" y2="12" /><line x1="17" y1="12" x2="22" y2="12" /></svg>;
const IconChevronDown = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>;
const IconNetwork = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" /><line x1="10.5" y1="7.5" x2="6.5" y2="16.5" /><line x1="13.5" y1="7.5" x2="17.5" y2="16.5" /></svg>;
const IconSettings = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;
const IconDrawLine = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5" cy="19" r="2" /><circle cx="19" cy="5" r="2" /><line x1="6.5" y1="17.5" x2="17.5" y2="6.5" /></svg>;
const IconPitchfork = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M4 10v-6h16v6M12 8h8M4 8h8" /></svg>;
const IconText = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>;
const IconBrush = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3v4M15 3v4M3 11h18v4H3zM5 15v4a2 2 0 002 2h10a2 2 0 002-2v-4" /></svg>;
const IconExpand = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>;

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

export default function Home() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isLearnMoreModalOpen, setIsLearnMoreModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNameSetupModalOpen, setIsNameSetupModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [deployNetwork, setDeployNetwork] = useState('BASE');
  const [openAudits, setOpenAudits] = useState({ goPlus: false, quickIntel: false });
  const [walletAddress, setWalletAddress] = useState(null);
  const [pendingWalletAddress, setPendingWalletAddress] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const router = useRouter();
  const notificationTimeoutRef = useRef(null);

  useEffect(() => {
    if (sessionStorage.getItem('logoutSuccess') === 'true') {
      showNotification("✅ Berhasil keluar dari akun", "success");
      sessionStorage.removeItem('logoutSuccess');
    }
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) setWalletAddress(savedAddress);
  }, [router]);

  const showNotification = (message, type = 'error') => {
    setNotification({ show: true, message, type });
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  const connectMetaMask = async () => {
    if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        if (accounts.length > 0) {
          const addr = accounts[0];
          setIsLoginModalOpen(false);
          const existingName = localStorage.getItem('userName');
          if (!existingName) {
            setPendingWalletAddress(addr);
            setIsNameSetupModalOpen(true);
          } else {
            setWalletAddress(addr);
            localStorage.setItem('walletAddress', addr);
            router.push('/dashboard');
          }
        }
      } catch (err) {
        showNotification("Gagal menghubungkan ke MetaMask: " + err.message, "error");
      }
    } else {
      showNotification("Ekstensi MetaMask tidak ditemukan.", "warning");
    }
  };

  const connectOKX = async () => {
    if (typeof window !== "undefined" && typeof window.okxwallet !== "undefined") {
      try {
        const accounts = await window.okxwallet.request({ method: "eth_requestAccounts" });
        if (accounts.length > 0) {
          const addr = accounts[0];
          setIsLoginModalOpen(false);
          const existingName = localStorage.getItem('userName');
          if (!existingName) {
            setPendingWalletAddress(addr);
            setIsNameSetupModalOpen(true);
          } else {
            setWalletAddress(addr);
            localStorage.setItem('walletAddress', addr);
            router.push('/dashboard');
          }
        }
      } catch (err) {
        showNotification("Gagal menghubungkan ke OKX Wallet: " + err.message, "error");
      }
    } else {
      showNotification("Ekstensi OKX Wallet tidak ditemukan.", "warning");
    }
  };

  const formatAddress = (address) => address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : "";

  const handleLogout = () => {
    setWalletAddress(null);
    localStorage.removeItem('walletAddress');
    setIsProfileMenuOpen(false);
  };

  const handleNameSetupComplete = (name) => {
    setWalletAddress(pendingWalletAddress);
    setIsNameSetupModalOpen(false);
    router.push('/dashboard');
  };

  useEffect(() => {
    const handleClickOutside = () => setIsProfileMenuOpen(false);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <>
      <main style={{ position: 'relative', overflow: 'hidden' }}>
        <BackgroundCandles position="left" />
        <BackgroundCandles position="right" />
        <div className="glowing-arc"></div>

        {/* Navbar */}
        <nav className="navbar">
          <div className="container flex-between">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '1.25rem', color: 'white' }}>
              <div style={{ color: 'var(--accent-purple-light)', display: 'flex' }}><IconCube /></div>
              SATSET Vidual
            </div>

            <div className="nav-links">
              <a href="#" className="nav-item"><IconHome /> Home</a>
              <a href="#" className="nav-item"><IconCube /> Features</a>
              <a href="#" className="nav-item"><IconTerminal /> How It Works</a>
              <a href="#" className="nav-item"><IconChart /> Pricing</a>
              <a href="#" className="nav-item"><IconShield /> Docs</a>
              <a href="#" className="nav-item"><IconSearch /> Contact</a>
            </div>

            {walletAddress ? (
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <button
                  className="btn-outline"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span className="address-text">{formatAddress(walletAddress)}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>▼</span>
                </button>
                {isProfileMenuOpen && (
                  <div className="profile-menu" style={{
                    position: 'absolute', top: '110%', right: '0', background: '#121A2F',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column',
                    overflow: 'hidden', zIndex: 100, minWidth: '150px'
                  }}>
                    <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: '0.8rem 1rem', textAlign: 'left', cursor: 'pointer', fontSize: '0.9rem' }}>
                      🚪 Keluar
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="btn-outline" onClick={() => setIsLoginModalOpen(true)}>
                <span style={{ fontSize: '1.1rem', marginRight: '0.25rem' }}>&#8594;</span> Login
              </button>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <section className="hero container">
          <div className="hero-pill">
            <IconLightning /> Smart Trading Automation
          </div>

          <h1>
            Automate. Monitor.<br />
            Trade <span className="text-gradient">Smarter.</span>
          </h1>

          <p>
            SATSET Vidual is your all-in-one trading automation platform.<br />
            Monitor tokens, manage liquidity, airdrop, auto sell and more &mdash; all in one dashboard.
          </p>

          <div className="flex-center" style={{ marginBottom: '3rem' }}>
            <button className="btn-primary" onClick={() => walletAddress ? router.push('/dashboard') : setIsLoginModalOpen(true)}>
              {walletAddress ? 'Go to Dashboard' : 'Login to Dashboard'} <span style={{ fontSize: '1.2rem', marginLeft: '0.25rem' }}>&#8594;</span>
            </button>
          </div>
        </section>

        {/* Dashboard Mockup */}
        <section className="container">
          <div className="mockup-wrapper" style={{ maxWidth: '1400px' }}>
            <div className="features-row" style={{ width: '100%', margin: '0 auto 3rem auto', paddingLeft: '22px', paddingRight: '17px', boxSizing: 'border-box' }}>
              <div className="feature-item" style={{ flex: 'none', padding: 0 }}><IconChart /> Real-time Data</div>
              <div className="feature-item" style={{ flex: 'none', padding: 0 }}><IconTerminal /> Python Terminal</div>
              <div className="feature-item" style={{ flex: 'none', padding: 0 }}><IconShield /> Secure & Private</div>
              <div className="feature-item" style={{ flex: 'none', padding: 0 }}><IconLink /> Multi-Chain Ready</div>
            </div>
            <div className="mockup-container" style={{ background: '#0a0a0f' }}>
              <div className="mockup-body" style={{ height: '700px' }}>

                {/* Sidebar */}
                <div className="mockup-sidebar" style={{ width: '220px', padding: '1rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="sidebar-logo">
                    <div style={{ color: 'var(--accent-purple-light)' }}><IconCube /></div> SATSET Vidual
                  </div>

                  <div className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`} style={{ marginBottom: '0.25rem', cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}><IconHome /> Dashboard</div>
                  <div className={`sidebar-item ${activeTab === 'auto-deploy' ? 'active' : ''}`} style={{ marginBottom: '0.25rem', cursor: 'pointer' }} onClick={() => setActiveTab('auto-deploy')}><IconNetwork /> Auto Deploy</div>
                  <div className={`sidebar-item ${activeTab === 'add-lp' ? 'active' : ''}`} style={{ marginBottom: '0.25rem', cursor: 'pointer' }} onClick={() => setActiveTab('add-lp')}><IconLink /> Add LP</div>
                  <div className={`sidebar-item ${activeTab === 'scan' ? 'active' : ''}`} style={{ marginBottom: '0.25rem', cursor: 'pointer' }} onClick={() => setActiveTab('scan')}><IconSearch /> Scan Address</div>
                  <div className={`sidebar-item ${activeTab === 'airdrop' ? 'active' : ''}`} style={{ marginBottom: '0.25rem', cursor: 'pointer' }} onClick={() => setActiveTab('airdrop')}><IconLightning /> Airdrop</div>
                  <div className={`sidebar-item ${activeTab === 'auto-sell' ? 'active' : ''}`} style={{ marginBottom: '0.25rem', cursor: 'pointer' }} onClick={() => setActiveTab('auto-sell')}><IconSettings /> Auto Sell</div>
                  <div className={`sidebar-item ${activeTab === 'monitoring' ? 'active' : ''}`} style={{ marginBottom: '0.25rem', cursor: 'pointer' }} onClick={() => setActiveTab('monitoring')}><IconShield /> Monitoring</div>
                </div>

                {/* Main Content Area */}
                <div className="mockup-main" style={{ flex: 1, padding: '1rem', display: 'flex', gap: '1rem' }}>
                  {activeTab === 'dashboard' && (
                    <>
                  {/* Chart Panel */}
                  <div className="chart-container" style={{ flex: 2, background: '#0d0d12', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>

                    {/* Chart Dashboard Header */}
                    <div className="flex-between" style={{ padding: '1rem' }}>
                      <div>
                        <div className="dashboard-title" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Dashboard</div>
                        <div className="dashboard-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Pantau pergerakan market dan kelola token dengan mudah.</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ padding: '0.25rem 0.5rem', background: '#1a1a24', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.8rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: '12px', height: '12px', background: '#0052ff', borderRadius: '50%', display: 'inline-block' }}></span>
                          Base <IconChevronDown />
                        </div>
                        <div style={{ padding: '0.25rem 0.5rem', background: '#1a1a24', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.8rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          USD <IconChevronDown />
                        </div>
                      </div>
                    </div>

                    {/* Token Details */}
                    <div style={{ background: '#12121a', margin: '0 1rem', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div className="flex-between" style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '40px', height: '40px', background: '#223249', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            <div style={{ width: '20px' }}><IconEthereum /></div>
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: 'white', fontSize: '1.1rem' }}>ETH <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>/ WETH</span></div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              Ethereum
                              <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '6px', height: '6px', background: 'var(--success)', borderRadius: '50%', display: 'inline-block' }}></span>
                                Updated 1m ago
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '700', fontSize: '1.4rem', color: 'white' }}>$2,735.42</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--success)' }}>+2.18%</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>24h</div>
                        </div>
                      </div>

                      {/* Chart Top Toolbar */}
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: '#3d8bff' }}><IconCrosshair /></span>
                        <span style={{ borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '1rem', display: 'flex', gap: '0.75rem' }}>
                          <span>1s</span><span>1m</span><span>5m</span><span style={{ color: '#3d8bff', fontWeight: 'bold' }}>15m</span><span>1h</span><span>4h</span><span>D</span><IconChevronDown />
                        </span>
                        <span style={{ borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <IconChart /> Indicators
                        </span>
                        <span style={{ color: '#3d8bff' }}>Price</span> <span style={{ opacity: 0.5 }}>/</span> <span>MCap</span>
                        <span style={{ color: '#3d8bff' }}>USD</span> <span style={{ opacity: 0.5 }}>/</span> <span>WETH</span>
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
                          <span>&#8634;</span><span>&#8635;</span><IconSettings />
                        </span>
                      </div>

                      {/* Chart Area */}
                      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                        {/* Left Drawing Tools */}
                        <div style={{ width: '32px', display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem', alignItems: 'center', color: 'var(--text-secondary)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                          <IconDrawLine />
                          <IconPitchfork />
                          <IconBrush />
                          <IconText />
                          <IconSearch />
                          <IconCheckCircle />
                        </div>

                        {/* Main Chart Graphic */}
                        <div style={{ flex: 1, position: 'relative', background: '#0a0a0f', overflow: 'hidden' }}>

                          {/* OHLC Overlay */}
                          <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', fontSize: '0.7rem', color: 'var(--success)', display: 'flex', gap: '0.5rem', zIndex: 5 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>O<span style={{ color: 'var(--success)' }}>2,701.12</span></span>
                            <span style={{ color: 'var(--text-secondary)' }}>H<span style={{ color: 'var(--success)' }}>2,738.90</span></span>
                            <span style={{ color: 'var(--text-secondary)' }}>L<span style={{ color: 'var(--success)' }}>2,700.45</span></span>
                            <span style={{ color: 'var(--text-secondary)' }}>C<span style={{ color: 'var(--success)' }}>2,735.42</span></span>
                            <span>+34.30 (+1.27%)</span>
                          </div>

                          {/* Fake Gridlines */}
                          <div style={{ position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none' }}>
                            <div style={{ width: '100%', height: '20%', borderBottom: '1px solid white' }}></div>
                            <div style={{ width: '100%', height: '20%', borderBottom: '1px solid white' }}></div>
                            <div style={{ width: '100%', height: '20%', borderBottom: '1px solid white' }}></div>
                            <div style={{ width: '100%', height: '20%', borderBottom: '1px solid white' }}></div>
                          </div>

                          {/* Candlesticks & Volume */}
                          <div style={{ position: 'absolute', left: '1rem', right: '3rem', top: '2rem', bottom: '2rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                            {/* Combining Candles and Volume visually */}
                            {[
                              { h: 30, v: 10, u: true }, { h: 35, v: 12, u: true }, { h: 25, v: 8, u: false },
                              { h: 40, v: 15, u: true }, { h: 50, v: 20, u: true }, { h: 65, v: 30, u: true },
                              { h: 55, v: 25, u: false }, { h: 45, v: 20, u: false }, { h: 30, v: 15, u: false },
                              { h: 25, v: 20, u: false }, { h: 35, v: 10, u: true }, { h: 45, v: 12, u: true },
                              { h: 60, v: 25, u: true }, { h: 70, v: 20, u: true }, { h: 55, v: 15, u: false },
                              { h: 50, v: 10, u: false }, { h: 40, v: 15, u: false }, { h: 45, v: 10, u: true },
                              { h: 55, v: 12, u: true }, { h: 65, v: 15, u: true }, { h: 80, v: 30, u: true },
                              { h: 75, v: 25, u: false }, { h: 85, v: 20, u: true }, { h: 95, v: 35, u: true },
                              { h: 85, v: 25, u: false }, { h: 90, v: 20, u: true }, { h: 70, v: 15, u: false },
                              { h: 80, v: 10, u: true }, { h: 75, v: 12, u: false }
                            ].map((c, i) => (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', width: '6px', justifyContent: 'flex-end' }}>
                                <div style={{ height: `${c.h}%`, width: '1px', background: c.u ? 'var(--success)' : 'var(--danger)', position: 'relative', display: 'flex', justifyContent: 'center' }}>
                                  <div style={{ height: '60%', width: '4px', background: c.u ? 'var(--success)' : 'var(--danger)', position: 'absolute', top: '20%', borderRadius: '1px' }}></div>
                                </div>
                                <div style={{ height: `${c.v}%`, width: '4px', background: c.u ? 'var(--success)' : 'var(--danger)', opacity: 0.4, marginTop: 'auto' }}></div>
                              </div>
                            ))}
                          </div>

                          {/* Right Axis Prices */}
                          <div style={{ position: 'absolute', right: '0.25rem', top: '2rem', bottom: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                            <span>2,760.00</span>
                            <span style={{ background: 'var(--success)', color: 'white', padding: '0 4px', borderRadius: '2px' }}>2,735.42</span>
                            <span>2,700.00</span>
                            <span>2,650.00</span>
                            <span>2,600.00</span>
                            <span>2,550.00</span>
                          </div>

                          {/* Bottom Axis Time */}
                          <div style={{ position: 'absolute', bottom: '0.25rem', left: '1rem', right: '3rem', display: 'flex', justifyContent: 'space-around', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            <span>06:00</span>
                            <span>12:00</span>
                            <span>18:00</span>
                            <span>14</span>
                            <span>06:00</span>
                            <span>12:00</span>
                          </div>
                        </div>
                      </div>

                      {/* Chart Bottom Toolbar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <span>5y</span><span>1y</span><span>6m</span><span>3m</span><span>1m</span><span>5d</span><span>1d</span>
                          <IconChart /> {/* Stand-in for calendar icon */}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <span>12:45:30 (UTC+7)</span>
                          <span>%</span><span>log</span><span>auto</span>
                        </div>
                      </div>

                      {/* Precise Footer Stats */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1rem', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div><div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>LIQUIDITY</div><div style={{ fontSize: '1rem', color: 'white', fontWeight: 'bold' }}>$1.24B</div></div>
                        <div><div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>VOLUME 24H</div><div style={{ fontSize: '1rem', color: 'white', fontWeight: 'bold' }}>$14.68B</div></div>
                        <div><div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>TXNS 24H</div><div style={{ fontSize: '1rem', color: 'white', fontWeight: 'bold' }}>317,654</div></div>
                        <div><div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>BUY 24H</div><div style={{ fontSize: '1rem', color: 'var(--success)', fontWeight: 'bold' }}>168,732</div></div>
                        <div><div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>SELL 24H</div><div style={{ fontSize: '1rem', color: 'var(--danger)', fontWeight: 'bold' }}>148,922</div></div>
                        <div><div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>BUY VOL</div><div style={{ fontSize: '1rem', color: 'var(--success)', fontWeight: 'bold' }}>$7.68B</div></div>
                        <div><div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>SELL VOL</div><div style={{ fontSize: '1rem', color: 'var(--danger)', fontWeight: 'bold' }}>$7.00B</div></div>
                      </div>
                    </div>
                  </div>

                  {/* Terminal Panel */}
                  <div className="terminal-container" style={{ flex: 1, background: '#050508', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', padding: '1rem' }}>
                    <div className="terminal-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#00d180' }}>
                        <IconTerminal /> <span style={{ color: 'white' }}>Terminal (Python)</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span style={{ cursor: 'pointer', width: '16px' }}><IconExpand /></span>
                        <span style={{ cursor: 'pointer' }}>&#10005;</span>
                      </div>
                    </div>

                    <div className="terminal-content">
                      <div className="terminal-line"><div className="terminal-text">Python 3.11.5 (main, Jun 15 2024, 10:23:42)</div></div>
                      <div className="terminal-line"><div className="terminal-text">[GCC 12.2.0] on linux</div></div>
                      <div className="terminal-line"><div className="terminal-text">Type "help", "copyright", "credits" or "license" for more information.</div></div>
                      <br />

                      <div className="terminal-line"><div className="terminal-text"><span className="code-prompt">&gt;&gt;&gt;</span> <span className="code-keyword">import</span> requests</div><div className="terminal-time">12:44:01</div></div>
                      <div className="terminal-line"><div className="terminal-text"><span className="code-prompt">&gt;&gt;&gt;</span> <span className="code-keyword">from</span> web3 <span className="code-keyword">import</span> Web3</div><div className="terminal-time">12:44:02</div></div>
                      <div className="terminal-line"><div className="terminal-text"><span className="code-prompt">&gt;&gt;&gt;</span> <span className="code-keyword">from</span> dotenv <span className="code-keyword">import</span> load_dotenv</div><div className="terminal-time">12:44:03</div></div>
                      <div className="terminal-line"><div className="terminal-text"><span className="code-prompt">&gt;&gt;&gt;</span> <span className="code-keyword">from</span> dotenv <span className="code-keyword">import</span> load_dotenv</div><div className="terminal-time">12:44:04</div></div>
                      <div className="terminal-line"><div className="terminal-text"><span className="code-prompt">&gt;&gt;&gt;</span> load_dotenv()</div><div className="terminal-time">12:44:05</div></div>
                      <div className="terminal-line"><div className="terminal-text">True</div></div>
                      <br />
                      <div className="terminal-line"><div className="terminal-text"><span className="code-prompt">&gt;&gt;&gt;</span> w3 = Web3(Web3.HTTPProvider</div><div className="terminal-time">12:44:06</div></div>
                      <div className="terminal-line"><div className="terminal-text">('<span className="code-string">https://mainnet.base.org</span>'))</div></div>
                      <div className="terminal-line"><div className="terminal-text"><span className="code-prompt">&gt;&gt;&gt;</span> w3.is_connected()</div><div className="terminal-time">12:44:07</div></div>
                      <div className="terminal-line"><div className="terminal-text">True</div></div>
                      <br />
                      <div className="terminal-line"><div className="terminal-text"><span className="code-prompt">&gt;&gt;&gt;</span> contract = w3.eth.contract(</div></div>
                      <div className="terminal-line"><div className="terminal-text">address='<span className="code-string">0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D</span>',</div><div className="terminal-time">12:44:08</div></div>
                      <div className="terminal-line"><div className="terminal-text">abi=abi)</div></div>
                      <div className="terminal-line"><div className="terminal-text">)</div></div>
                      <br />
                      <div className="terminal-line"><div className="terminal-text"><span className="code-prompt">&gt;&gt;&gt;</span> balance = contract.functions.balanceOf(</div><div className="terminal-time">12:44:10</div></div>
                      <div className="terminal-line"><div className="terminal-text">('<span className="code-string">0xYourWalletAddress</span>'</div></div>
                      <div className="terminal-line"><div className="terminal-text">).call()</div></div>
                      <div className="terminal-line"><div className="terminal-text"><span className="code-prompt">&gt;&gt;&gt;</span> <span style={{ color: '#00d180' }}>print</span>(balance)</div><div className="terminal-time">12:44:11</div></div>
                      <div className="terminal-line"><div className="terminal-text">123456789000000000000</div><div className="terminal-time">12:44:12</div></div>
                      <div className="terminal-line"><div className="terminal-text"><span className="code-prompt">&gt;&gt;&gt;</span> <span className="cursor-blink"></span></div><div className="terminal-time">12:44:13</div></div>
                    </div>

                    <div className="terminal-input-area" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <div style={{ flex: 1, background: '#0a0a0f', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem' }}>
                        <input type="text" className="terminal-input" placeholder="Type your command..." style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', outline: 'none', fontFamily: 'inherit', fontSize: '0.8rem' }} />
                      </div>
                      <button className="btn-run" style={{ background: 'var(--blue-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '0.5rem 1.5rem', fontWeight: 'bold', cursor: 'pointer' }}>Run</button>
                    </div>
                  </div>
                  </>
                  )}

                  {activeTab === 'auto-deploy' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
                      <div style={{ background: '#0d0d12', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', padding: '2.5rem', minHeight: '100%' }}>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'white' }}>Auto Deploy Token</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '0.95rem' }}>Deploy your smart contract securely across multiple networks with one click.</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: '500' }}>Select Network</label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                              <button 
                                onClick={() => setDeployNetwork('BASE')}
                                style={{ flex: 1, padding: '1rem', background: deployNetwork === 'BASE' ? 'rgba(0, 82, 255, 0.1)' : '#13131a', border: deployNetwork === 'BASE' ? '1px solid var(--blue-primary)' : '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: deployNetwork === 'BASE' ? 'white' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <span style={{ width: '18px', height: '18px', background: deployNetwork === 'BASE' ? 'var(--blue-primary)' : 'transparent', border: deployNetwork === 'BASE' ? 'none' : '2px solid rgba(255,255,255,0.2)', borderRadius: '50%', display: 'inline-block' }}></span> BASE
                              </button>
                              <button 
                                onClick={() => setDeployNetwork('ROBINHOOD')}
                                style={{ flex: 1, padding: '1rem', background: deployNetwork === 'ROBINHOOD' ? 'rgba(0, 190, 100, 0.1)' : '#13131a', border: deployNetwork === 'ROBINHOOD' ? '1px solid #00be64' : '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: deployNetwork === 'ROBINHOOD' ? 'white' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <span style={{ width: '18px', height: '18px', background: deployNetwork === 'ROBINHOOD' ? '#00be64' : 'transparent', border: deployNetwork === 'ROBINHOOD' ? 'none' : '2px solid rgba(255,255,255,0.2)', borderRadius: '50%', display: 'inline-block' }}></span> ROBINHOOD
                              </button>
                            </div>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: '500' }}>Security Audit</label>
                            <div style={{ display: 'flex', flexDirection: 'column', background: '#13131a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                              
                              <div>
                                <div onClick={() => setOpenAudits(prev => ({ ...prev, goPlus: !prev.goPlus }))} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                                  <div style={{ fontWeight: 'bold', color: 'white', fontSize: '1.05rem' }}>Go+ Security</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <span style={{ color: 'white', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>No issues <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', width: '20px' }}><IconCheckCircle /></span></span>
                                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', width: '20px', transform: openAudits.goPlus ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}><IconChevronDown /></span>
                                  </div>
                                </div>
                                {openAudits.goPlus && (
                                  <div style={{ padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.2)', fontSize: '0.85rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    ✅ Contract source code is verified.<br />
                                    ✅ No honeypot code detected.<br />
                                    ✅ Buy/Sell taxes are standard.
                                  </div>
                                )}
                              </div>

                              <div>
                                <div onClick={() => setOpenAudits(prev => ({ ...prev, quickIntel: !prev.quickIntel }))} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', cursor: 'pointer' }}>
                                  <div style={{ fontWeight: 'bold', color: 'white', fontSize: '1.05rem' }}>Quick Intel</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <span style={{ color: 'white', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>No issues <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', width: '20px' }}><IconCheckCircle /></span></span>
                                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', width: '20px', transform: openAudits.quickIntel ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}><IconChevronDown /></span>
                                  </div>
                                </div>
                                {openAudits.quickIntel && (
                                  <div style={{ padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.2)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    ✅ Ownership renounced.<br />
                                    ✅ Liquidity pool locked securely.<br />
                                    ✅ Creator wallet has clean history.
                                  </div>
                                )}
                              </div>

                            </div>
                          </div>

                          <button 
                            onClick={() => showNotification(`🚀 Deploying to ${deployNetwork}... (Simulasi)`, 'success')}
                            style={{ width: '100%', padding: '1.25rem', fontSize: '1.15rem', marginTop: '1rem', background: '#1a1a24', color: 'white', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', transition: 'all 0.3s' }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#222230'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = '#1a1a24'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                          >
                             <span style={{ fontSize: '1.2rem' }}>🚀</span> Deploy Token
                          </button>

                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Footer */}
        <footer className="container">
          <div className="stats-container" style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '1400px', margin: '0 auto', padding: '3rem 17px 5rem 22px', boxSizing: 'border-box' }}>
            <div className="stat-item">
              <div className="stat-icon" style={{ color: 'var(--accent-purple-light)' }}><IconUsers /></div>
              <div>
                <div className="stat-value">10K+</div>
                <div className="stat-label">Active Users</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon" style={{ color: 'var(--success)' }}><IconChart /></div>
              <div>
                <div className="stat-value">50K+</div>
                <div className="stat-label">Trades Automated</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon" style={{ color: 'var(--accent-blue)' }}><IconCube /></div>
              <div>
                <div className="stat-value">5+</div>
                <div className="stat-label">Chains Supported</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon" style={{ color: '#ffbd2e' }}><IconCheckCircle /></div>
              <div>
                <div className="stat-value">99.9%</div>
                <div className="stat-label">Uptime & Secure</div>
              </div>
            </div>
          </div>
        </footer>

      </main>
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        connectMetaMask={connectMetaMask}
        connectOKX={connectOKX}
        showNotification={showNotification}
      />
      <InfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />
      <LearnMoreModal isOpen={isLearnMoreModalOpen} onClose={() => setIsLearnMoreModalOpen(false)} />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      <NameSetupModal isOpen={isNameSetupModalOpen} onComplete={handleNameSetupComplete} />

      {notification.show && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          background: notification.type === 'error' ? '#ef4444' : notification.type === 'warning' ? '#f59e0b' : '#10b981',
          color: 'white', padding: '0.75rem 1.25rem', borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 9999, fontWeight: '500', fontSize: '0.85rem',
          width: '320px', boxSizing: 'border-box'
        }}>
          {notification.message}
        </div>
      )}
    </>
  );
}
