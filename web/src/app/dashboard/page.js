"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const REAL_LOGOS = {
  'BRETT': 'https://dd.dexscreener.com/ds-data/tokens/base/0x532f27101965dd16442e59d40670faf5ebb142e4.png?size=lg',
  'DEGEN': 'https://dd.dexscreener.com/ds-data/tokens/base/0x4ed4e862860bed51a9570b96d89af5e1b0efefed.png?size=lg',
  'TOSHI': 'https://dd.dexscreener.com/ds-data/tokens/base/0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4.png?size=lg',
  'AERO': 'https://dd.dexscreener.com/ds-data/tokens/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631.png?size=lg',
  'MOCHI': 'https://dd.dexscreener.com/ds-data/tokens/base/0xf6e932ca12abad2605008f5127b1406244f0ce17.png?size=lg',
  'HIGHER': 'https://dd.dexscreener.com/ds-data/tokens/base/0x0578d8a44db98b23bf096a382e016e29a5ce0ffe.png?size=lg',
  'PEPE': 'https://dd.dexscreener.com/ds-data/tokens/ethereum/0x6982508145454ce325ddbe47a25d4ec3d2311933.png?size=lg',
  'SHIB': 'https://dd.dexscreener.com/ds-data/tokens/ethereum/0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce.png?size=lg',
  'DOGE': 'https://cryptologos.cc/logos/dogecoin-doge-logo.png?v=029'
};

const BASE_ADDRESSES = [
  '0x532f27101965dd16442e59d40670faf5ebb142e4', // BRETT
  '0x4ed4e862860bed51a9570b96d89af5e1b0efefed', // DEGEN
  '0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4', // TOSHI
  '0x940181a94a35a4569e4529a3cdfb74e38fd98631', // AERO
  '0x9a26f5433671751c3276a065f57e5a02d2817973', // KEYCAT
  '0x0578d8a44db98b23bf096a382e016e29a5ce0ffe', // HIGHER
  '0xf6e932ca12abad2605008f5127b1406244f0ce17', // MOCHI
  '0x7f12d13b34f5f4f0a9449c16bcbd4aa2bb51caa3', // NORMIE
  '0xe3086852a4b125803c815a158249ae468a3254ca', // MFER
  '0x0d97f261b1e88845184f678e2d1e7a98d9fd38d8', // TYBG
  '0xE1aBD004250AC8D1F199421d647e01d094FAa180', // ROOST (NEW CA)
  '0x82f254190c1f6d0f62bca6df9d4d8ef82e2c4c47', // ROCKY
  '0xbc45647ea894030a4e9801ec03479739fa2485f0', // BENJI
  '0x2ae181b5e5898d975d4eacb2df136f3851532cb1'  // NIGEL
];

const RH_ADDRESSES = [
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  '3psH1Mj1f7yUfaD5gh6Zj7epE8hhrMkMETgv5TshQA4o', // BODEN
  'FU1q8vJpZNUrmqsciSjp8bAKKidGsLmouB8CBdf8TKQv', // TREMP
  '7GCihgDB8fe6KNjn2TWtk52CEs24ccbfc2PE33aU5C2j', // POPCAT
  'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', // MEW
  'WENWENvqqNya429ubCdR81ZmD69brwQaaVNKKv29Qpq', // WEN
  '7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx7LoiVkM3', // SLERF
  '0x6982508145454Ce325dDbE47a25d4ec3d2311933', // PEPE
  '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', // SHIB
  '0xcf0C122c6b73ff809C693CE761CAA2fD6B5ec4B8', // FLOKI
  'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82'  // BOME
];

export default function DashboardHome() {
  const router = useRouter();
  const [tokens, setTokens] = useState([]);
  const [copiedToken, setCopiedToken] = useState(null);
  const [activeTimeframe, setActiveTimeframe] = useState('24H');
  const [activeChain, setActiveChain] = useState('base');
  
  const [savedTokenLists, setSavedTokenLists] = useState({ base: [], rh: [] });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newCaInput, setNewCaInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [botStats, setBotStats] = useState({
    isRunning: false,
    uptimeMs: 0,
    totalProfit: 0,
    totalSells: 0,
    successRate: 0,
    profit24h: 0,
    history24h: []
  });

  const formatUptime = (ms) => {
    if (ms === 0) return '0d';
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) return `${h}j ${m}m ${s}d`;
    if (m > 0) return `${m}m ${s}d`;
    return `${s}d`;
  };

  const handleAddToken = async () => {
    if (!newCaInput.trim()) return;
    setIsSaving(true);
    try {
      const userName = localStorage.getItem("userName");
      if (!userName) return; // return early if not logged in
      const res = await fetch(`/api/tokentrend?user=${encodeURIComponent(userName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ca: newCaInput.trim(), chain: activeChain })
      });
      if (res.ok) {
        setNewCaInput('');
        setShowAddModal(false);
        fetchRealData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteToken = async (ca) => {
    try {
      const userName = localStorage.getItem("userName");
      if (!userName) return; // return early if not logged in
      await fetch(`/api/tokentrend?user=${encodeURIComponent(userName)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ca, chain: activeChain })
      });
      fetchRealData();
    } catch (e) {
      console.error(e);
    }
  };

  const renderChart = () => {
    const data = botStats.history24h;
    if (!data || data.length === 0) {
      return <path d="M0,30 L100,30" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />;
    }
    if (data.length === 1) {
      return (
        <>
          <path d="M0,15 L100,15" fill="none" stroke="#0052ff" strokeWidth="2"/>
          <circle cx="50" cy="15" r="2" fill="#00C853"/>
        </>
      );
    }
    const minP = Math.min(...data.map(d => d.profit), 0);
    const maxP = Math.max(...data.map(d => d.profit), 0.1);
    const range = maxP - minP;
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 28 - ((d.profit - minP) / range) * 26;
      return { x, y };
    });
    const dStr = "M" + points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");
    return (
      <>
        <path d={dStr} fill="none" stroke="#0052ff" strokeWidth="2"/>
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#0052ff"/>
        ))}
      </>
    );
  };

  const handleCopyCA = (e, ca, index) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ca);
    setCopiedToken(index);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/autosell/stats');
        const data = await res.json();
        if (data.success) {
          setBotStats(data.stats);
        }
      } catch (e) {
        console.error('Failed to fetch bot stats', e);
      }
    };
    fetchStats();
    const intv = setInterval(fetchStats, 10000); // 10 seconds to avoid Dexscreener rate limit
    return () => clearInterval(intv);
  }, []);

  const fetchRealData = async () => {
    try {
      const userName = localStorage.getItem("userName");
      if (!userName) return; // return early if not logged in
      const trendRes = await fetch(`/api/tokentrend?user=${encodeURIComponent(userName)}`);
      const trendData = await trendRes.json();
      
      const baseAddresses = trendData.tokens?.base || [];
      const rhAddresses = trendData.tokens?.rh || [];
      setSavedTokenLists({ base: baseAddresses, rh: rhAddresses });
      
      const allAddresses = [...baseAddresses, ...rhAddresses];
      if (allAddresses.length === 0) {
        setTokens([]);
        return;
      }
      
      // Split into chunks of 5 (Dexscreener limits response to 30 pairs total)
      // If we use 25, the first 10 tokens might use up all 30 pairs, leaving the rest "Unknown"
      const chunkSize = 5;
      const chunks = [];
      for (let i = 0; i < allAddresses.length; i += chunkSize) {
        chunks.push(allAddresses.slice(i, i + chunkSize).join(','));
      }
      
      const responses = await Promise.all(
        chunks.map(chunk => fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk}`))
      );
      
      const allData = await Promise.all(responses.map(r => r.json()));
      const allPairs = allData.flatMap(d => d.pairs || []);
      
      // Create a map of CA -> pair data
      const pairMap = new Map();
      for (const pair of allPairs) {
        const ca = pair.baseToken.address.toLowerCase();
        if (!pairMap.has(ca)) {
          pairMap.set(ca, pair);
        }
      }
      
      // Now map over the actual saved lists so ALL tokens show up, even if DexScreener has no data
      const finalTokens = [];
      
      const processAddresses = (addresses, defaultChain) => {
        for (const rawCa of addresses) {
          const ca = rawCa.toLowerCase();
          const pair = pairMap.get(ca);
          
          if (pair) {
            const isBase = pair.chainId === 'base';
            finalTokens.push({
              symbol: pair.baseToken.symbol,
              name: pair.baseToken.name,
              priceNum: parseFloat(pair.priceUsd) || 0,
              vol: `$${((pair.volume?.h24 || 0) / 1000000).toFixed(2)}M`,
              chain: isBase ? 'base' : 'robinhood',
              ca: pair.baseToken.address,
              tf: {
                m5: pair.priceChange?.m5 || 0,
                h1: pair.priceChange?.h1 || 0,
                h6: pair.priceChange?.h6 || 0,
                h24: pair.priceChange?.h24 || 0
              },
              logo: pair.info?.imageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${pair.baseToken.symbol}&backgroundColor=0052ff,00c853,e91e63,ff9800,9c27b0&textColor=ffffff`
            });
          } else {
            // Missing data fallback
            finalTokens.push({
              symbol: 'Unknown',
              name: 'No data',
              priceNum: 0,
              vol: '$0.00M',
              chain: defaultChain,
              ca: rawCa,
              tf: { m5: 0, h1: 0, h6: 0, h24: 0 },
              logo: `https://api.dicebear.com/7.x/initials/svg?seed=${rawCa}&backgroundColor=475569&textColor=ffffff`
            });
          }
        }
      };
      
      processAddresses(baseAddresses, 'base');
      processAddresses(rhAddresses, 'robinhood');
      
      setTokens(finalTokens);
    } catch (err) {
      console.error("Failed to fetch Dexscreener data:", err);
    }
  };

  useEffect(() => {
    fetchRealData();
    const interval = setInterval(fetchRealData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Top Grid */}
      <div className="dashboard-grid">
        {/* Trending Tokens Board */}
        <div className="dashboard-card trending-board" style={{display: 'flex', flexDirection: 'column', padding: '1.5rem', background: 'linear-gradient(135deg, rgba(0, 82, 255, 0.05), rgba(0, 200, 83, 0.05))'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem'}}>
            <h2 style={{margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span className="live-pulse" style={{width: 8, height: 8, background: '#00C853', borderRadius: '50%', boxShadow: '0 0 8px #00C853', display: 'inline-block'}}></span>
              Token Tren
            </h2>

            <div style={{display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px'}}>
              <button 
                onClick={() => setActiveChain('base')}
                style={{
                  background: activeChain === 'base' ? '#0052FF' : 'transparent',
                  color: activeChain === 'base' ? '#fff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: '0.2s'
                }}
              >
                Base
              </button>
              <button 
                onClick={() => setActiveChain('robinhood')}
                style={{
                  background: activeChain === 'robinhood' ? '#00C853' : 'transparent',
                  color: activeChain === 'robinhood' ? '#fff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: '0.2s'
                }}
              >
                Robinhood
              </button>
            </div>
            
            <div style={{display: 'flex', alignItems: 'center', background: 'transparent', borderRadius: '8px', padding: '4px', gap: '8px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '8px', color: '#94a3b8', fontWeight: 700, fontSize: '0.85rem'}}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M11.6,2.2c-0.3,0.2-0.5,0.6-0.5,0.9c0,1.3,0.9,2.5,1.9,3.5C14.1,7.5,15,8.8,15,10.2c0,1.7-1,3.2-2.5,4c-0.1-0.7-0.4-1.3-0.8-1.9c-0.7-0.9-1.8-1.5-2.9-1.5c-0.4,0-0.7,0.1-1.1,0.2c-0.3,0.1-0.7,0-0.9-0.2C6.5,10.6,6.2,10.2,6.2,9.8c0-0.2,0.1-0.5,0.2-0.7c-0.3,0.5-0.5,1-0.5,1.6c0,2.5,1.9,4.6,4.3,5c0.2,0.4,0.5,0.8,0.9,1.1c-0.8,0.2-1.7,0-2.3-0.5c-0.2-0.2-0.6-0.2-0.8,0c-0.2,0.2-0.2,0.6,0,0.8c1,1.1,2.6,1.6,4.1,1.1c1.3-0.4,2.3-1.4,2.8-2.6c0.8-2,0.1-4.3-1.5-5.6c-0.7-0.6-1.4-1.3-1.4-2.2c0-0.4,0.2-0.8,0.4-1.1C12,6.3,12,6,11.8,5.7C11.7,5.5,11.4,5.4,11.2,5.5z M12,22c-5.5,0-10-4.5-10-10c0-2,0.6-3.9,1.7-5.5c0.2-0.3,0.6-0.4,0.9-0.2c0.3,0.2,0.4,0.6,0.2,0.9C3.8,8.6,3.3,10.3,3.3,12c0,4.8,3.9,8.7,8.7,8.7c4.8,0,8.7-3.9,8.7-8.7c0-2-0.7-3.9-1.9-5.4c-0.2-0.3-0.1-0.7,0.2-0.9c0.3-0.2,0.7-0.1,0.9,0.2C21.2,7.7,22,9.8,22,12C22,17.5,17.5,22,12,22z"/></svg>
                Trending
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{marginLeft: '2px'}}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              </div>
              
              <div style={{display: 'flex', gap: '4px'}}>
                {['5M', '1H', '6H', '24H'].map(tf => (
                  <button 
                    key={tf}
                    onClick={() => setActiveTimeframe(tf)}
                    style={{
                      background: activeTimeframe === tf ? '#5A67D8' : 'transparent',
                      color: activeTimeframe === tf ? '#FFF' : '#94a3b8',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="table-list" style={{maxHeight: '480px', overflowY: 'auto', paddingRight: '5px', marginRight: '-1rem'}}>
            <div className="table-row header-row" style={{gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', position: 'sticky', top: 0, background: '#121A2F', zIndex: 10}}>
              <div>TOKEN</div>
              <div>PRICE</div>
              <div>5M</div>
              <div>1H</div>
              <div>6H</div>
              <div>24H</div>
              <div style={{textAlign: 'right'}}>VOLUME</div>
              <div style={{textAlign: 'right'}}>CHAIN</div>
            </div>
            {[...tokens].filter(t => t.chain === activeChain).sort((a, b) => {
              const tfMap = { '5M': 'm5', '1H': 'h1', '6H': 'h6', '24H': 'h24' };
              const key = tfMap[activeTimeframe] || 'h24';
              return (b.tf[key] || 0) - (a.tf[key] || 0);
            }).map((token, i) => (
              <div key={i} className="table-row hover-card" onClick={() => router.push(`/dashboard/monitoring?ca=${token.ca}`)} style={{gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', alignItems: 'center', transition: 'background 0.3s ease', cursor: 'pointer'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <img src={token.logo} alt={token.symbol} style={{width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)'}} />
                  <div style={{display: 'flex', flexDirection: 'column'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <span style={{fontWeight: 700, fontSize: '0.9rem'}}>{token.symbol}</span>
                      <div className="copy-ca-btn" onClick={(e) => handleCopyCA(e, token.ca, i)} title="Copy CA">
                        {copiedToken === i ? (
                          <span style={{fontSize: '0.65rem', color: '#00C853', fontWeight: 'bold'}}>Copied!</span>
                        ) : (
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="#94a3b8"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                        )}
                      </div>
                    </div>
                    <span style={{fontSize: '0.7rem', color: '#94a3b8'}}>{token.name}</span>
                  </div>
                </div>
                <div style={{fontWeight: 600, fontSize: '0.9rem'}}>${token.priceNum.toFixed(token.priceNum < 0.01 ? 5 : 4)}</div>
                {['m5', 'h1', 'h6', 'h24'].map(k => {
                  const val = token.tf[k];
                  const isPos = val >= 0;
                  return <div key={k} style={{color: isPos ? '#00C853' : '#ef4444', fontWeight: 600, fontSize: '0.85rem'}}>{isPos ? '+' : ''}{val.toFixed(2)}%</div>;
                })}
                <div style={{color: '#94a3b8', fontSize: '0.85rem', textAlign: 'right'}}>{token.vol}</div>
                <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                  {token.chain === 'base' ? (
                    <img src="https://github.com/base-org.png" width="20" height="20" alt="Base" title="Base" style={{borderRadius: '50%'}} />
                  ) : (
                    <img src="https://github.com/robinhood.png" width="20" height="20" alt="Robinhood" title="Robinhood" style={{borderRadius: '50%'}} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons below Token Trend */}
          <hr style={{border: 'none', borderTop: '1px solid var(--border-glass)', margin: '0 0 1rem 0'}} />
          <div style={{display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '-0.5rem'}}>
            <button onClick={() => setShowAddModal(true)} style={{
              background: '#0052FF',
              color: 'white',
              border: 'none',
              padding: '8px 24px',
              minWidth: '150px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}>
              Tambahkan CA
            </button>
            <button onClick={() => setShowDeleteModal(true)} style={{
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '8px 24px',
              minWidth: '150px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}>
              Hapus
            </button>
          </div>
        </div>

        {/* Status Panel */}
        <div className="dashboard-card bot-status-panel">
          <div className="status-header">
            <span className="status-title">Status Bot</span>
            <span className={`status-badge ${botStats.isRunning ? 'running' : 'stopped'}`}>
              {botStats.isRunning ? 'Berjalan' : 'Berhenti'}
            </span>
          </div>
          <div className="status-list">
            <div className="status-item">
              <span className="status-label">Waktu Aktif</span>
              <span className="status-value">{formatUptime(botStats.uptimeMs)}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Total Keuntungan</span>
              <span className="status-value green">${botStats.totalProfit.toFixed(2)}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Token Terjual</span>
              <span className="status-value">{botStats.totalSells}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Tingkat Keberhasilan</span>
              <span className="status-value green">{botStats.successRate.toFixed(1)}%</span>
            </div>
          </div>
          <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>
            Keuntungan 24H 
            <span className="green" style={{float: 'right', color: botStats.profit24h >= 0 ? '#00C853' : '#ef4444'}}>
              {botStats.profit24h >= 0 ? '+' : ''}${botStats.profit24h.toFixed(2)}
            </span>
          </div>
          <div className="chart-placeholder">
            <svg viewBox="0 0 100 30" width="100%" height="100%" preserveAspectRatio="none">
              {renderChart()}
            </svg>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="dashboard-card stats-row" style={{padding: 0}}>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <span className="stat-label">Total Saldo</span>
            <span className="stat-value">$8,256.34</span>
            <span className="stat-sub">≈ 5.2142 ETH</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background: 'rgba(0, 200, 83, 0.1)', color: '#00C853'}}>🤖</div>
          <div className="stat-info">
            <span className="stat-label">Bot Aktif</span>
            <span className="stat-value">3</span>
            <a href="#" className="stat-link">Lihat Semua &gt;</a>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{background: 'rgba(156, 39, 176, 0.1)', color: '#9c27b0'}}>📊</div>
          <div className="stat-info">
            <span className="stat-label">Token Dipantau</span>
            <span className="stat-value">12</span>
            <a href="#" className="stat-link">Lihat Semua &gt;</a>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🌐</div>
          <div className="stat-info">
            <span className="stat-label">Jaringan</span>
            <span className="stat-value" style={{display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0', minHeight: '34px'}}>
              <img src="https://github.com/base-org.png" width="22" height="22" alt="Base" style={{borderRadius: '50%'}} />
              <img src="https://github.com/robinhood.png" width="22" height="22" alt="Robinhood" style={{borderRadius: '50%'}} />
            </span>
            <span className="stat-sub">
              <span style={{color: '#0052FF', fontWeight: 600}}>Base</span> <span style={{color: '#ffffff'}}>&</span> <span style={{color: '#00C853', fontWeight: 600}}>Robinhood</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="tables-row">
        <div className="dashboard-card">
          <h3 className="table-header">Bot Aktif</h3>
          <div className="table-list">
            <div className="table-row header-row">
              <div>Token</div>
              <div>Jaringan</div>
              <div>Jual Otomatis</div>
              <div>Progres</div>
              <div>Status</div>
              <div>Aksi</div>
            </div>
            
            <div className="table-row">
              <div className="token-cell">
                <div style={{width: 20, height: 20, borderRadius: '50%', background: '#0052ff'}}></div> BSETOKEN
              </div>
              <div className="network-cell">
                <div className="chain-logo base-logo" style={{width: 14, height: 14}}></div> <span style={{color: '#0052ff'}}>Base</span>
              </div>
              <div>50%</div>
              <div className="progress-cell">
                <div className="progress-bar-container"><div className="progress-bar" style={{width: '78%'}}></div></div> 78%
              </div>
              <div style={{color: '#00C853', fontSize: '0.8rem'}}>● Berjalan</div>
              <div><button className="action-btn">Detail</button></div>
            </div>

            <div className="table-row">
              <div className="token-cell">
                <div style={{width: 20, height: 20, borderRadius: '50%', background: '#00C853'}}></div> RHBTOKEN
              </div>
              <div className="network-cell">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="#00C853"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5c-2.48 0-4.5-2.02-4.5-4.5s2.02-4.5 4.5-4.5 4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5z"/></svg> <span style={{color: '#00C853'}}>Robinhood</span>
              </div>
              <div>100%</div>
              <div className="progress-cell">
                <div className="progress-bar-container"><div className="progress-bar" style={{width: '64%', background: '#00C853'}}></div></div> 64%
              </div>
              <div style={{color: '#00C853', fontSize: '0.8rem'}}>● Berjalan</div>
              <div><button className="action-btn">Detail</button></div>
            </div>

            <div className="table-row" style={{borderBottom: 'none'}}>
              <div className="token-cell">
                <div style={{width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #0052ff, #00C853)'}}></div> MIXTOKEN
              </div>
              <div className="network-cell">
                <div className="chain-logo base-logo" style={{width: 14, height: 14}}></div>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="#00C853"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5c-2.48 0-4.5-2.02-4.5-4.5s2.02-4.5 4.5-4.5 4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5z"/></svg>
              </div>
              <div>75%</div>
              <div className="progress-cell">
                <div className="progress-bar-container"><div className="progress-bar" style={{width: '45%'}}></div></div> 45%
              </div>
              <div style={{color: '#00C853', fontSize: '0.8rem'}}>● Berjalan</div>
              <div><button className="action-btn">Detail</button></div>
            </div>
          </div>
          <a href="#" className="view-all-link">Lihat Semua Bot &gt;</a>
        </div>

        <div className="dashboard-card">
          <h3 className="table-header">Aktivitas Terbaru</h3>
          <div className="activity-list">
            <div className="activity-item">
              <div className="activity-icon green">✓</div>
              <div className="activity-details">
                <div className="activity-title">Jual otomatis selesai</div>
                <div className="activity-desc">RHBTOKEN di Robinhood</div>
              </div>
              <div className="activity-time">2m lalu</div>
            </div>
            
            <div className="activity-item">
              <div className="activity-icon blue">→</div>
              <div className="activity-details">
                <div className="activity-title">Jual otomatis terpicu</div>
                <div className="activity-desc">BSETOKEN di Base</div>
              </div>
              <div className="activity-time">5m lalu</div>
            </div>

            <div className="activity-item">
              <div className="activity-icon green">+</div>
              <div className="activity-details">
                <div className="activity-title">Likuiditas ditambahkan</div>
                <div className="activity-desc">RHBTOKEN di Robinhood</div>
              </div>
              <div className="activity-time">18m lalu</div>
            </div>

            <div className="activity-item">
              <div className="activity-icon blue">🚀</div>
              <div className="activity-details">
                <div className="activity-title">Bot baru diterapkan</div>
                <div className="activity-desc">MIXTOKEN di Base & Robinhood</div>
              </div>
              <div className="activity-time">32m lalu</div>
            </div>
          </div>
          <a href="#" className="view-all-link">Lihat Semua Aktivitas &gt;</a>
        </div>
      </div>

      {showAddModal && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div className="dashboard-card" style={{width: '400px', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
            <h3 style={{margin: 0}}>Tambahkan CA Baru ({activeChain === 'base' ? 'Base' : 'Robinhood'})</h3>
            <input 
              type="text" 
              value={newCaInput} 
              onChange={e => setNewCaInput(e.target.value)} 
              placeholder="Masukkan CA..." 
              style={{padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', color: 'white', width: '100%'}} 
            />
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
              <button onClick={() => setShowAddModal(false)} style={{padding: '8px 16px', borderRadius: '6px', background: 'transparent', color: 'white', border: '1px solid var(--border-glass)', cursor: 'pointer'}}>Batal</button>
              <button onClick={handleAddToken} disabled={isSaving} style={{padding: '8px 16px', borderRadius: '6px', background: '#0052FF', color: 'white', border: 'none', cursor: 'pointer'}}>{isSaving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div className="dashboard-card" style={{width: '400px', maxHeight: '500px', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
            <h3 style={{margin: 0}}>Hapus Token ({activeChain === 'base' ? 'Base' : 'Robinhood'})</h3>
            <div style={{overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '5px'}}>
              {tokens.filter(t => t.chain === activeChain).map((t, idx) => (
                <div key={idx} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <img src={t.logo} alt="" style={{width: 24, height: 24, borderRadius: '50%'}} />
                    <span>{t.symbol}</span>
                  </div>
                  <button onClick={() => handleDeleteToken(t.ca)} style={{padding: '4px 12px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Hapus</button>
                </div>
              ))}
            </div>
            <div style={{display: 'flex', justifyContent: 'flex-end'}}>
              <button onClick={() => setShowDeleteModal(false)} style={{padding: '8px 16px', borderRadius: '6px', background: 'transparent', color: 'white', border: '1px solid var(--border-glass)', cursor: 'pointer'}}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
