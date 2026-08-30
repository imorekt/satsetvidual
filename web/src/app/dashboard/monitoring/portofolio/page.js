'use client';
import { useState, useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import './portofolio.css';

import { fetchWalletBalances, fetchTokenPrices } from './blockchain';

export default function PortofolioPage() {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [wallets, setWallets] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pkInput, setPkInput] = useState('');
  const [walletNameInput, setWalletNameInput] = useState('');

  const [activeTokens, setActiveTokens] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [dailyAsset, setDailyAsset] = useState(0);
  const [dailyPercentage, setDailyPercentage] = useState(0);
  const [chartData, setChartData] = useState([]);

  // Load wallets from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tracked_wallets');
    if (saved) {
      try {
        setWallets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse wallets from local storage');
      }
    }
  }, []);

  // Fetch real balances when wallets change
  useEffect(() => {
    async function loadData() {
      if (wallets.length === 0) {
        setActiveTokens([]);
        setTotalBalance(0);
        setChartData([]);
        return;
      }
      setIsFetching(true);
      try {
        const prices = await fetchTokenPrices();
        let allTokens = [];
        
        // Fetch for all tracked wallets concurrently
        const fetchPromises = wallets.map(w => fetchWalletBalances(w.address));
        const results = await Promise.all(fetchPromises);
        
        results.forEach((balances, idx) => {
          // Update individual wallet balance in state
          let walletTotal = 0;
          balances.forEach(b => {
            const price = prices[b.symbol] || 0;
            walletTotal += (b.amount * price);
          });
          wallets[idx].balance = walletTotal;
          allTokens = [...allTokens, ...balances];
        });

        setWallets([...wallets]); // Force re-render with new balances
        localStorage.setItem('tracked_wallets', JSON.stringify(wallets));

        // Aggregate by token id
        const aggregated = {};
        allTokens.forEach(t => {
          if (!aggregated[t.id]) {
            aggregated[t.id] = { ...t };
          } else {
            aggregated[t.id].amount += t.amount;
          }
        });
        
        let grandTotal = 0;
        const finalTokens = Object.values(aggregated).map(t => {
          const price = prices[t.symbol] || 0;
          const valueUsd = t.amount * price;
          grandTotal += valueUsd;
          return { ...t, valueUsd };
        }).filter(t => t.valueUsd > 0.01); 
        
        setActiveTokens(finalTokens.sort((a,b) => b.valueUsd - a.valueUsd));
        setTotalBalance(grandTotal);

        // Generate dynamic chart data ending at grandTotal
        let initialBalance = grandTotal * 0.7; // Mock past data starting at 70% of current
        const data = [];
        const now = new Date();
        for (let i = 30; i >= 0; i--) {
          const time = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          initialBalance = initialBalance + (Math.random() * (grandTotal*0.05) - (grandTotal*0.02));
          data.push({
            time: time.toISOString().split('T')[0],
            value: parseFloat(initialBalance.toFixed(2))
          });
        }
        data[data.length - 1].value = grandTotal; 
        setChartData(data);
        
        // Mock daily change
        const dailyChange = grandTotal * 0.03;
        setDailyAsset(dailyChange);
        setDailyPercentage((dailyChange / (grandTotal - dailyChange)) * 100);

      } catch (e) {
        console.error('Fetch error:', e);
      } finally {
        setIsFetching(false);
      }
    }
    loadData();
  }, [wallets.length, wallets.map(w => w.address).join(',')]); // Only re-run when wallet addresses change

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  const handleAddWallet = (e) => {
    e.preventDefault();
    if (pkInput.trim()) {
      // Mock wallet profile generation based on input
      const newWallet = { 
        id: Date.now(), 
        address: pkInput.trim(),
        name: walletNameInput.trim() || 'Wallet',
        balance: 0, // Will be updated by loadData
        avatar: 'https://avatars.githubusercontent.com/u/108554348?s=200&v=4'

      };
      const updatedWallets = [...wallets, newWallet];
      setWallets(updatedWallets);
      localStorage.setItem('tracked_wallets', JSON.stringify(updatedWallets));
      setPkInput('');
      setWalletNameInput('');
      setIsAddModalOpen(false);
    }
  };

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0B0E14' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: {
        mode: 1,
        vertLine: { width: 1, color: 'rgba(224, 227, 235, 0.2)', style: 0 },
        horzLine: { visible: false },
      },
    });

    chartInstanceRef.current = chart;

    const areaSeries = chart.addAreaSeries({
      lineColor: '#60a5fa', // Blue line
      topColor: 'rgba(96, 165, 250, 0.4)',
      bottomColor: 'rgba(96, 165, 250, 0.0)',
      lineWidth: 2,
    });

    // Only show chart data if there's a wallet and data is loaded
    if (chartData.length > 0) {
      areaSeries.setData(chartData);
    } else {
      // Empty/flat chart
      const now = new Date();
      areaSeries.setData([
        { time: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], value: 0 },
        { time: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], value: 0 },
        { time: now.toISOString().split('T')[0], value: 0 }
      ]);
    }
    
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [chartData]); // Re-render chart when data changes

  return (
    <div className="portofolio-container" style={{ flexDirection: 'column' }}>
      
      {/* Top Header Section */}
      <div className="portfolio-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.5rem 2rem', background: '#11141E', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', fontWeight: 600 }}>Total Asset</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {isFetching ? 'Loading...' : formatCurrency(totalBalance)}
            {!isFetching && wallets.length > 0 && (
              <span style={{ fontSize: '1rem', color: dailyAsset >= 0 ? '#4ade80' : '#f87171', background: dailyAsset >= 0 ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                {dailyAsset >= 0 ? '+' : ''}{formatCurrency(dailyAsset)} ({dailyPercentage.toFixed(2)}%) Today
              </span>
            )}
          </div>
        </div>
        
        {/* Track Wallet Button */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.8rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600, marginRight: '1rem' }}>Track Wallets</div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            style={{ background: '#60a5fa', color: '#000', fontWeight: 600, border: 'none', padding: '0.5rem 1.2rem', borderRadius: '6px', cursor: 'pointer' }}
          >
            + ADD
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Column - Token List */}
        <div className="portofolio-left-col" style={{ width: '400px', minWidth: '400px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="token-list-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Holdings Across Chains</div>
          <div className="token-list">
            {isFetching ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#60a5fa', fontSize: '0.9rem' }}>
                Fetching on-chain balances...
              </div>
            ) : activeTokens.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                No wallets tracked or no balances found.
              </div>
            ) : (
              activeTokens.map(token => (
                <div key={token.id} className="token-item" style={{ cursor: 'default' }}>
                <div className="token-left">
                  <div style={{ position: 'relative' }}>
                    <img src={token.icon} alt={token.symbol} style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                    <img src={token.chainIcon} alt={token.chainId} style={{ width: '14px', height: '14px', borderRadius: '50%', position: 'absolute', bottom: -2, right: -2, border: '1px solid #11141E' }} />
                  </div>
                  <div className="token-info">
                    <span className="token-symbol">{token.symbol}</span>
                    <span className="token-amount">{token.amount.toLocaleString()} {token.symbol}</span>
                  </div>
                </div>
                <div className="token-right">
                  <span className="token-value">{formatCurrency(token.valueUsd)}</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'capitalize' }}>{token.chainId}</span>
                </div>
              </div>
            ))
            )}
          </div>

          {/* Wallet Profile Display at bottom of left column */}
          {wallets.length > 0 && (
            <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '0.8rem' }}>Tracked Wallets</div>
              {wallets.map(w => (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '0.8rem', borderRadius: '8px', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      {w.address.substring(2, 4).toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>{w.name} ({w.address})</span>
                      <span style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 600 }}>Connected</span>
                    </div>
                  </div>
                  <div style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 700 }}>
                    {formatCurrency(w.balance)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Content - Chart */}
        <div className="portofolio-right-col">
          <div className="chart-area" style={{ flex: 1, height: '100%', minHeight: 'unset', background: '#0B0E14', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '1.5rem', left: '2rem', zIndex: 10, pointerEvents: 'none' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#94a3b8', margin: 0 }}>Total Asset Overview</h2>
            </div>
            <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>

      </div>

      {/* Add Wallet Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#11141E', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', width: '400px', maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#fff', fontSize: '1.2rem' }}>Import Wallet</h3>
            <form onSubmit={handleAddWallet} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Private Key or Address</label>
                <input 
                  type="text" 
                  value={pkInput}
                  onChange={(e) => setPkInput(e.target.value)}
                  placeholder="Paste PK or Address here..." 
                  style={{ width: '100%', background: '#0B0E14', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.8rem 1rem', borderRadius: '6px', outline: 'none' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Wallet Name</label>
                <input 
                  type="text" 
                  value={walletNameInput}
                  onChange={(e) => setWalletNameInput(e.target.value)}
                  placeholder="e.g. Main Wallet" 
                  style={{ width: '100%', background: '#0B0E14', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.8rem 1rem', borderRadius: '6px', outline: 'none' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)', padding: '0.8rem', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, background: '#60a5fa', color: '#000', fontWeight: 600, border: 'none', padding: '0.8rem', borderRadius: '6px', cursor: 'pointer' }}
                >
                  ADD WALLET
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
