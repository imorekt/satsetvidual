"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import "./monitoring.css";

const DEFAULT_TOKEN = "0x4200000000000000000000000000000000000006"; // WETH on Base
const DEFAULT_POOL = "0x72AB388E2E2F6FaceF59E3C3FA2C4E29011c2D38"; // USDC/WETH Pool on Base

export default function Monitoring() {
  const searchParams = useSearchParams();

  const [ca, setCa] = useState("");
  const [currentToken, setCurrentToken] = useState(DEFAULT_TOKEN);
  const [currentPool, setCurrentPool] = useState(DEFAULT_POOL);
  const [isSearching, setIsSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isLive, setIsLive] = useState(true);

  // Search API States
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearchingAPI, setIsSearchingAPI] = useState(false);
  const [headerSlot, setHeaderSlot] = useState(null);
  const [copiedStates, setCopiedStates] = useState({});

  useEffect(() => {
    setHeaderSlot(document.getElementById('header-search-slot'));
  }, []);

  useEffect(() => {
    const resolveCa = async () => {
        const caToResolve = ca;
        if (!caToResolve) {
            setCurrentPool("0x5441c4c5cc00d33bd9409f742d511ee01db1667b"); // Soneium WETH/USDC.e
            setCurrentToken("0x4200000000000000000000000000000000000006"); // WETH
            return;
        }
    };
    resolveCa();
  }, [ca]);

  // Real Data States (DexScreener API)
  const [tokenInfo, setTokenInfo] = useState({
    priceUsd: 0,
    priceNative: 0,
    marketCap: 0,
    liquidity: 0,
    liquidityBase: 0,
    liquidityQuote: 0,
    volume24h: 0,
    fdv: 0,
    symbol: 'ETH',
    quoteSymbol: 'USDC',
    pair: '0x1234...abcd5678',
    baseTokenAddr: '',
    quoteTokenAddr: '',
    dexId: 'uniswap',
    priceChange: { m5: 0, h1: 0, h6: 0, h24: 0 },
    txns: { buys: 0, sells: 0 },
    pairCreatedAt: Date.now()
  });

  const [priceClass, setPriceClass] = useState("");

  const fetchData = async () => {
    return; // DISABLED: Feature hidden and disabled to save quota
    try {
      setIsLive(true);
      // Fetch Token Info from DexScreener
      const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${currentToken}`);
      const dsData = await dsRes.json();
      const pair = dsData.pairs?.find(p => p.pairAddress.toLowerCase() === currentPool.toLowerCase()) || dsData.pairs?.[0];

      if (pair) {
        if (currentPool !== pair.pairAddress) {
          setCurrentPool(pair.pairAddress);
        }

        setTokenInfo(prev => {
          if (prev.priceUsd && Number(pair.priceUsd) !== prev.priceUsd) {
            setPriceClass(Number(pair.priceUsd) > prev.priceUsd ? 'price-up' : 'price-down');
            setTimeout(() => setPriceClass(""), 1000);
          }
          return {
            priceUsd: Number(pair.priceUsd) || 0,
            priceNative: Number(pair.priceNative) || 0,
            marketCap: pair.marketCap || pair.fdv || 0,
            liquidity: pair.liquidity?.usd || 0,
            liquidityBase: pair.liquidity?.base || 0,
            liquidityQuote: pair.liquidity?.quote || 0,
            volume24h: pair.volume?.h24 || 0,
            fdv: pair.fdv || 0,
            symbol: pair.baseToken?.symbol || '?',
            quoteSymbol: pair.quoteToken?.symbol || '?',
            pair: pair.pairAddress || '',
            baseTokenAddr: pair.baseToken?.address || '',
            quoteTokenAddr: pair.quoteToken?.address || '',
            dexId: pair.dexId || 'uniswap',
            priceChange: {
              m5: pair.priceChange?.m5 || 0,
              h1: pair.priceChange?.h1 || 0,
              h6: pair.priceChange?.h6 || 0,
              h24: pair.priceChange?.h24 || 0
            },
            txns: {
              buys: pair.txns?.h24?.buys || 0,
              sells: pair.txns?.h24?.sells || 0
            },
            pairCreatedAt: pair.pairCreatedAt || Date.now()
          };
        });
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setIsLive(false);
    }
  };

  // Setup Polling
  useEffect(() => {
    fetchData(); // Initial fetch
    const pollInterval = setInterval(() => {
      fetchData();
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [currentToken, currentPool]);

  // Search API logic
  useEffect(() => {
    if (ca.length > 2) {
      setShowDropdown(true);
      const timer = setTimeout(async () => {
        setIsSearchingAPI(true);
        try {
          const uniqueTokens = [];
          /* DISABLED: Feature hidden and disabled to save quota
          const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${ca}`);
          const data = await res.json();
          // Filter unique base tokens to only show the "authentic" one
          const seenAddresses = new Set();
          if (data.pairs) {
            for (const pair of data.pairs) {
              if (!seenAddresses.has(pair.baseToken.address.toLowerCase())) {
                seenAddresses.add(pair.baseToken.address.toLowerCase());
                uniqueTokens.push(pair);
              }
            }
          }
          */
          setSearchResults(uniqueTokens.slice(0, 6));
        } catch (e) {
          console.error(e);
        }
        setIsSearchingAPI(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [ca]);

  const selectToken = (pair) => {
    setCurrentToken(pair.baseToken.address);
    setCurrentPool(pair.pairAddress);
    setCa("");
    setShowDropdown(false);
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 800);
  };

  const handleSearch = () => {
    if (!ca) return;
    setIsSearching(true);
    setNotFound(false);
    setTimeout(() => {
      setIsSearching(false);
      if (ca.length < 40) {
        setNotFound(true);
      }
    }, 1500);
  };

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setCa(text);
    } catch (err) {
      console.error('Failed to read clipboard');
    }
  };

  const formatNumber = (num) => {
    if (!num) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  };

  const truncateAddress = (addr) => {
    if (!addr) return '';
    if (addr.length <= 10) return addr;
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const formatNumberCompact = (num) => {
    if (!num) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return Number(num).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const diffMs = Date.now() - timestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (diffDays > 0) return `${diffDays}d ${diffHours}h ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  const searchBarComponent = (
    <div className="monitoring-search-bar">
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', width: '100%', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 15, top: 12, color: '#94a3b8' }}>🔍</span>
          <input
            type="text"
            className="monitoring-search-input"
            style={{ paddingLeft: '40px', width: '100%' }}
            placeholder="Pencarian Contract Address (CA) atau Nama Token"
            value={ca}
            onChange={(e) => setCa(e.target.value)}
            onFocus={() => ca.length > 2 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn btn-outline" style={{ position: 'absolute', right: 0, height: '100%', borderRadius: '0 8px 8px 0', border: 'none', background: 'rgba(255,255,255,0.1)' }} onClick={handlePaste}>Paste</button>
        </div>

        {showDropdown && (
          <div className="search-dropdown">
            {isSearchingAPI ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>Mencari...</div>
            ) : searchResults.length > 0 ? (
              searchResults.map((pair, idx) => (
                <div key={idx} className="search-dropdown-item" onClick={() => selectToken(pair)}>
                  <div className="search-item-left">
                    <span className="search-item-symbol">{pair.baseToken.symbol}</span>
                    <span className="search-item-name">{pair.baseToken.name}</span>
                  </div>
                  <div className="search-item-right">
                    <span className="search-item-chain">{pair.chainId}</span>
                    <span className="search-item-price">${Number(pair.priceUsd).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#ef4444' }}>Tidak ada hasil ditemukan</div>
            )}
          </div>
        )}
      </div>
      <button className="btn btn-primary-tele" onClick={handleSearch}>Cari</button>
    </div>
  );

  return (
    <div className="monitoring-container">
      {headerSlot && createPortal(searchBarComponent, headerSlot)}

      {isSearching ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <div className="spinner" style={{ marginBottom: '1rem' }}>⏳</div>
          Loading token data...
        </div>
      ) : notFound ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#ef4444' }}>
          Token not found.<br />Please check the Contract Address.
        </div>
      ) : (
        <>
          <div className="monitoring-header">
            <div className="token-identity">
              <h2>{tokenInfo.symbol} / USDC <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>dexscreener.com</span></h2>
              <div className="token-network-badge">
                <div className="chain-logo base-logo" style={{ width: 12, height: 12 }}></div> Base
              </div>
              <div className={isLive ? "live-indicator" : "live-indicator reconnecting"}>
                <div className="live-dot"></div> {isLive ? 'Live' : 'Polling API...'}
              </div>
            </div>
            <div className="token-stats-quick">
              <div className="stat-quick-item">
                <span className="stat-quick-label">Price</span>
                <span className={`stat-quick-value ${priceClass}`}>${tokenInfo.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
              </div>
              <div className="stat-quick-item">
                <span className="stat-quick-label">Market Cap</span>
                <span className="stat-quick-value">{formatNumber(tokenInfo.marketCap)}</span>
              </div>
              <div className="stat-quick-item">
                <span className="stat-quick-label">Liquidity</span>
                <span className="stat-quick-value">{formatNumber(tokenInfo.liquidity)}</span>
              </div>
              <div className="stat-quick-item">
                <span className="stat-quick-label">Volume 24h</span>
                <span className="stat-quick-value">{formatNumber(tokenInfo.volume24h)}</span>
              </div>
            </div>
          </div>

          <div className="monitoring-main-layout">
            <div className="chart-section" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <iframe
                src={`https://dexscreener.com/${searchResults.find(p => p.pairAddress === currentPool)?.chainId || 'base'}/${currentPool}?embed=1&theme=dark&info=0`}
                style={{ width: '100%', flex: 1, minHeight: '600px', border: 'none' }}
                title="DexScreener Embed"
              ></iframe>

              <div className="dex-watermark-overlay">
                <div className="live-dot" style={{ width: 8, height: 8, marginRight: 6 }}></div>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>Connected</span>
              </div>
            </div>
            <div className="info-section">
              <div className="dex-sidebar">
                <div className="dex-sidebar-header">
                  <div className="dex-title">{tokenInfo.symbol} <span className="copy-icon">📋</span> / {tokenInfo.quoteSymbol} <span className="dex-fire">🔥 #1</span></div>
                  <div className="dex-badges">
                    <span className="dex-badge blue"><div className="chain-logo base-logo" style={{ width: 10, height: 10, display: 'inline-block', marginRight: 4 }}></div>Base</span>
                    <span className="dex-badge pink">{tokenInfo.dexId}</span>
                  </div>
                </div>

                <div className="dex-price-cards">
                  <div className="dex-price-card">
                    <span className="label">PRICE USD</span>
                    <span className={`value usd ${priceClass}`}>${tokenInfo.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                  </div>
                  <div className="dex-price-card">
                    <span className="label">PRICE</span>
                    <span className="value native">
                      {tokenInfo.priceNative.toLocaleString(undefined, { maximumFractionDigits: 6 })} <span style={{ fontSize: '0.75rem', color: '#7b8696' }}>{tokenInfo.quoteSymbol}</span>
                    </span>
                  </div>
                </div>

                <div className="dex-metrics-row">
                  <div className="dex-metric">
                    <span className="label">LIQUIDITY</span>
                    <span className="value">${formatNumberCompact(tokenInfo.liquidity)}</span>
                  </div>
                  <div className="dex-metric">
                    <span className="label">FDV</span>
                    <span className="value">${formatNumberCompact(tokenInfo.fdv)}</span>
                  </div>
                  <div className="dex-metric">
                    <span className="label">MKT CAP</span>
                    <span className="value">${formatNumberCompact(tokenInfo.marketCap)}</span>
                  </div>
                </div>

                <div className="dex-timeframes">
                  {[{ label: '5M', key: 'm5' }, { label: '1H', key: 'h1' }, { label: '6H', key: 'h6' }, { label: '24H', key: 'h24' }].map(tf => {
                    const val = tokenInfo.priceChange[tf.key] || 0;
                    const color = val >= 0 ? '#26a69a' : '#ef5350';
                    return (
                      <div className="dex-tf" key={tf.key}>
                        <span className="label">{tf.label}</span>
                        <span className="value" style={{ color }}>{val}%</span>
                      </div>
                    )
                  })}
                </div>

                <div className="dex-trading-stats">
                  <div className="stat-row">
                    <div className="stat-col">
                      <span className="label">TXNS</span>
                      <span className="value">{tokenInfo.txns.buys + tokenInfo.txns.sells}</span>
                    </div>
                    <div className="stat-col-wide">
                      <div className="bar-labels">
                        <span className="label">BUYS <span className="val">{tokenInfo.txns.buys}</span></span>
                        <span className="label">SELLS <span className="val">{tokenInfo.txns.sells}</span></span>
                      </div>
                      <div className="buy-sell-bar">
                        <div className="buy-bar" style={{ width: `${(tokenInfo.txns.buys / Math.max(1, tokenInfo.txns.buys + tokenInfo.txns.sells)) * 100}%` }}></div>
                        <div className="sell-bar" style={{ width: `${(tokenInfo.txns.sells / Math.max(1, tokenInfo.txns.buys + tokenInfo.txns.sells)) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="stat-row">
                    <div className="stat-col">
                      <span className="label">VOLUME</span>
                      <span className="value">${formatNumberCompact(tokenInfo.volume24h)}</span>
                    </div>
                    <div className="stat-col-wide">
                      <div className="bar-labels">
                        <span className="label">BUY VOL <span className="val">-</span></span>
                        <span className="label">SELL VOL <span className="val">-</span></span>
                      </div>
                      <div className="buy-sell-bar">
                        <div className="buy-bar" style={{ width: `50%` }}></div>
                        <div className="sell-bar" style={{ width: `50%` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="stat-row">
                    <div className="stat-col">
                      <span className="label">TRADERS</span>
                      <span className="value">-</span>
                    </div>
                    <div className="stat-col-wide">
                      <div className="bar-labels">
                        <span className="label">BUYERS <span className="val">-</span></span>
                        <span className="label">SELLERS <span className="val">-</span></span>
                      </div>
                      <div className="buy-sell-bar">
                        <div className="buy-bar" style={{ width: `50%` }}></div>
                        <div className="sell-bar" style={{ width: `50%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>



                <div className="dex-info-list">

                  <div className="info-item">
                    <span className="label">Pooled {tokenInfo.symbol}</span>
                    <span className="value">{formatNumberCompact(tokenInfo.liquidityBase)} <span className="sub-val">${formatNumberCompact(tokenInfo.liquidityQuote / 2)}</span></span>
                  </div>
                  <div className="info-item">
                    <span className="label">Pooled {tokenInfo.quoteSymbol}</span>
                    <span className="value">{formatNumberCompact(tokenInfo.liquidityQuote)} <span className="sub-val">${formatNumberCompact(tokenInfo.liquidityQuote / 2)}</span></span>
                  </div>

                  <div className="info-item-copy">
                    <span className="label">Pair</span>
                    <div className="address-pill" onClick={() => handleCopy(tokenInfo.pair, 'pair')} style={{ cursor: 'pointer' }}>
                      <button className="copy-btn">{copiedStates['pair'] ? '✓' : '📋'}</button>
                      <span style={{ color: copiedStates['pair'] ? '#4ade80' : 'inherit' }}>{copiedStates['pair'] ? 'Copied!' : truncateAddress(tokenInfo.pair)}</span>
                    </div>
                    <span className="link-icon">EXP ↗</span>
                  </div>
                  <div className="info-item-copy">
                    <span className="label">{tokenInfo.symbol}</span>
                    <div className="address-pill" onClick={() => handleCopy(tokenInfo.baseTokenAddr, 'base')} style={{ cursor: 'pointer' }}>
                      <button className="copy-btn">{copiedStates['base'] ? '✓' : '📋'}</button>
                      <span style={{ color: copiedStates['base'] ? '#4ade80' : 'inherit' }}>{copiedStates['base'] ? 'Copied!' : truncateAddress(tokenInfo.baseTokenAddr)}</span>
                    </div>
                    <span className="link-icon">HLD ↗</span>
                    <span className="link-icon">EXP ↗</span>
                  </div>
                  <div className="info-item-copy">
                    <span className="label">{tokenInfo.quoteSymbol}</span>
                    <div className="address-pill" onClick={() => handleCopy(tokenInfo.quoteTokenAddr, 'quote')} style={{ cursor: 'pointer' }}>
                      <button className="copy-btn">{copiedStates['quote'] ? '✓' : '📋'}</button>
                      <span style={{ color: copiedStates['quote'] ? '#4ade80' : 'inherit' }}>{copiedStates['quote'] ? 'Copied!' : truncateAddress(tokenInfo.quoteTokenAddr)}</span>
                    </div>
                    <span className="link-icon">HLD ↗</span>
                    <span className="link-icon">EXP ↗</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
