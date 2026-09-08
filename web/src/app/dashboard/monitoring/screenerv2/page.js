"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { useFormCache } from '@/lib/useFormCache';
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import "../monitoring.css";
import "./screenerv2.css";

const DEFAULT_TOKEN = "0x4200000000000000000000000000000000000006"; // WETH on Base
const DEFAULT_POOL = "0x72AB388E2E2F6FaceF59E3C3FA2C4E29011c2D38"; // USDC/WETH Pool on Base

export default function ScreenerV2() {
    const searchParams = useSearchParams();

    // --- Auto Sell States ---
    const [logs, setLogs] = useState([]);
    const [rawLogs, setRawLogs] = useState("");
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [isDevMode, setIsDevMode] = useState(false);
    const [hasPendingLayout, setHasPendingLayout] = useState(false);
    const [colOrder, setColOrder] = useState({ info: 1, left: 2, right: 3 });
    const [colWidth, setColWidth] = useState({ info: 330, left: 1384, right: 330, search: 1000, btnCari: 120 });
    const [colPos, setColPos] = useState({ info: { x: 0, y: 4 }, left: { x: 337, y: 4 }, right: { x: 1729, y: 4 }, search: { x: 337, y: 22 }, btnCari: { x: 1350, y: 22 } });
    const [colHeight, setColHeight] = useState({ info: 938, left: 938, right: 938, search: 45, btnCari: 45 });
    const [cardOrder, setCardOrder] = useState({ controlPanel: 1, terminal: 2 });
    const [userRole, setUserRole] = useState('Member');
    const [isLayoutLoaded, setIsLayoutLoaded] = useState(false);
    const [isLayoutAnimated, setIsLayoutAnimated] = useState(false);
    const logsEndRef = useRef(null);

    const hasPendingLayoutRef = useRef(false);
    useEffect(() => {
        hasPendingLayoutRef.current = hasPendingLayout;
    }, [hasPendingLayout]);

    useEffect(() => {
        let isMounted = true;
        let lastLayoutStr = '';

        const fetchLayout = async () => {
            if (hasPendingLayoutRef.current) return;

            try {
                const res = await fetch('/api/layout');
                if (res.ok) {
                    const data = await res.json();
                    const currentStr = JSON.stringify(data);
                    if (isMounted && currentStr !== lastLayoutStr) {
                        lastLayoutStr = currentStr;
                        setColWidth(data.colWidth);
                        setColPos(data.colPos);
                        setColHeight(data.colHeight);
                        setCardOrder(data.cardOrder);
                    }
                }
            } catch (err) {}
            if (isMounted) {
                setIsLayoutLoaded(true);
                setTimeout(() => { if (isMounted) setIsLayoutAnimated(true); }, 50);
            }
        };
        
        fetchLayout();
        const interval = setInterval(fetchLayout, 3000);
        
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const [profiles, setProfiles] = useState([]);
    const [selectedProfile, setSelectedProfile] = useState("");
    const [selectedProfileCa, setSelectedProfileCa] = useState("");

    const [tokenName, setTokenName] = useState("");
    const [tokenSymbol, setTokenSymbol] = useState("");

    const [privateKey, setPrivateKey] = useState("");
    const [inputCa, setInputCa] = useState("");
    const [lpPool, setLpPool] = useState("");
    const [rpc, setRpc] = useState("https://");
    const [slippage, setSlippage] = useState("30");
    const [sellRatio, setSellRatio] = useState("100");
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [profileName, setProfileName] = useState("");

    const formStates = useMemo(() => ({
        privateKey, inputCa, lpPool, rpc, slippage, sellRatio
    }), [privateKey, inputCa, lpPool, rpc, slippage, sellRatio]);

    const setFormStates = useMemo(() => ({
        privateKey: setPrivateKey,
        inputCa: setInputCa,
        lpPool: setLpPool,
        rpc: setRpc,
        slippage: setSlippage,
        sellRatio: setSellRatio
    }), []);

    useFormCache('screenerv2', privateKey, formStates, setFormStates);

    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [profileToDelete, setProfileToDelete] = useState("");

    // --- Monitoring States ---
    const [ca, setCa] = useState("");
    const [currentToken, setCurrentToken] = useState(DEFAULT_TOKEN);
    const [currentPool, setCurrentPool] = useState(DEFAULT_POOL);
    const [isSearching, setIsSearching] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [isLive, setIsLive] = useState(true);

    const [isGoPlusOpen, setIsGoPlusOpen] = useState(false);
    const [isQuickIntelOpen, setIsQuickIntelOpen] = useState(false);

    const [searchResults, setSearchResults] = useState([]);
    const [searchHistory, setSearchHistory] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isSearchingAPI, setIsSearchingAPI] = useState(false);
    const [headerSlot, setHeaderSlot] = useState(null);
    const [copiedStates, setCopiedStates] = useState({});
    const securityRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (securityRef.current && !securityRef.current.contains(event.target)) {
                setIsGoPlusOpen(false);
                setIsQuickIntelOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [tokenInfo, setTokenInfo] = useState({
        priceUsd: 0, priceNative: 0, marketCap: 0, liquidity: 0, liquidityBase: 0, liquidityQuote: 0,
        volume24h: 0, fdv: 0, symbol: 'ETH', quoteSymbol: 'USDC', pair: '0x1234...abcd5678',
        baseTokenAddr: '', quoteTokenAddr: '', dexId: 'uniswap',
        priceChange: { m5: 0, h1: 0, h6: 0, h24: 0 }, txns: { buys: 0, sells: 0 }, pairCreatedAt: Date.now()
    });
    const [priceClass, setPriceClass] = useState("");

    useEffect(() => {
        try {
            const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
            setSearchHistory(history);
        } catch (e) {}

        const slot = document.getElementById('header-search-slot');
        setHeaderSlot(slot);
        const actions = document.querySelector('.header-actions');
        if (slot && actions) {
            slot.style.flex = 'none';
            slot.style.width = '100%';
            slot.style.paddingRight = '0';
            slot.style.position = 'relative';
            slot.style.height = '90px';
            actions.style.position = 'absolute';
            actions.style.right = '1.5rem';
        }
        
        const role = localStorage.getItem('userRole') || 'Member';
        setUserRole(role);
        setIsDevMode(localStorage.getItem('isDevMode') === 'true');

        const handleProfileUpdate = () => {
            setUserRole(localStorage.getItem('userRole') || 'Member');
        };
        const handleDevModeToggle = () => {
            setIsDevMode(localStorage.getItem('isDevMode') === 'true');
        };

        window.addEventListener('profileUpdated', handleProfileUpdate);
        window.addEventListener('devModeToggled', handleDevModeToggle);
        
        return () => {
            window.removeEventListener('profileUpdated', handleProfileUpdate);
            window.removeEventListener('devModeToggled', handleDevModeToggle);
            if (slot && actions) {
                slot.style.flex = '';
                slot.style.width = '';
                slot.style.paddingRight = '1.5rem';
                actions.style.position = '';
                actions.style.right = '';
            }
        };
    }, []);

    const getExplorerUrl = (chainId, address) => {
        const c = (chainId || 'base').toLowerCase();
        switch (c) {
            case 'ethereum':
            case 'eth': return `https://etherscan.io/address/${address}`;
            case 'bsc': return `https://bscscan.com/address/${address}`;
            case 'polygon': return `https://polygonscan.com/address/${address}`;
            case 'arbitrum': return `https://arbiscan.io/address/${address}`;
            case 'optimism': return `https://optimistic.etherscan.io/address/${address}`;
            case 'solana': return `https://solscan.io/account/${address}`;
            case 'avalanche': return `https://snowtrace.io/address/${address}`;
            case 'fantom': return `https://ftmscan.com/address/${address}`;
            case 'base': return `https://basescan.org/address/${address}`;
            case 'robinhood': return `https://robinhoodchain.blockscout.com/address/${address}`;
            default: return `https://dexscreener.com/${c}/${address}`; // Fallback to dexscreener for unknown chains
        }
    };

    useEffect(() => {
        const queryCa = searchParams.get('ca');
        if (queryCa) {
            setCurrentToken(queryCa);
            setCurrentPool("");
            setCa(queryCa);
        }
    }, [searchParams]);


    // --- Auto Sell Logic ---
    const scrollToBottom = () => {
        const terminalBody = document.querySelector('.terminal-body');
        if (terminalBody) terminalBody.scrollTop = terminalBody.scrollHeight;
    };

    const fetchProfiles = async () => {
        const telegramUser = localStorage.getItem('userName') || 'default_user';
        try {
            const response = await fetch(`/api/autosell/profiles?userName=${telegramUser}`, { cache: 'no-store' });
            const data = await response.json();
            if (response.ok && data.profiles) {
                setProfiles(data.profiles);
                const savedProfile = localStorage.getItem('activeProfile');
                if (savedProfile && data.profiles.includes(savedProfile)) {
                    setSelectedProfile(savedProfile);
                } else if (data.profiles.length > 0) {
                    setSelectedProfile(data.profiles[0]);
                    localStorage.setItem('activeProfile', data.profiles[0]);
                } else {
                    setSelectedProfile("");
                }
            }
        } catch (err) { }
    };

    useEffect(() => {
        fetchProfiles();
        const interval = setInterval(fetchProfiles, 2000);
        return () => clearInterval(interval);
    }, []);

    const filteredProfiles = profiles.filter(p => {
        if (!privateKey) return false;
        const telegramUser = localStorage.getItem('userName') || 'default_user';
        const savedPk = localStorage.getItem(`pk_${telegramUser}_${p}`);
        return savedPk === privateKey;
    });

    useEffect(() => {
        if (!privateKey) {
            // Biarkan user mengosongkan private key tanpa mereset seluruh form
            return;
        }
        const telegramUser = localStorage.getItem('userName') || 'default_user';
        const valid = profiles.filter(p => localStorage.getItem(`pk_${telegramUser}_${p}`) === privateKey);
        
        // Jika PK yg di-paste ternyata milik profile lain, otomatis switch ke profile tsb
        if (valid.length > 0 && !valid.includes(selectedProfile)) {
            setSelectedProfile(valid[0]);
            localStorage.setItem('activeProfile', valid[0]);
        }
        // Jangan paksa selectedProfile jadi "" jika PK baru (belum disave), biarkan user mengedit profile saat ini!
    }, [privateKey, profiles, selectedProfile]);

    useEffect(() => {
        const fetchConfig = async () => {
            if (!selectedProfile) {
                setSelectedProfileCa("");
                setInputCa("");
                setLpPool("");
                setRpc("");
                setSlippage("");
                setSellRatio("");
                return;
            }
            const telegramUser = localStorage.getItem('userName') || 'default_user';
            const savedPk = localStorage.getItem(`pk_${telegramUser}_${selectedProfile}`);
            setPrivateKey(savedPk || "");

            try {
                const response = await fetch(`/api/autosell/config?userName=${telegramUser}&profileName=${selectedProfile}`);
                if (response.ok) {
                    const data = await response.json();
                    setSelectedProfileCa(data.ca || "");
                    if (data.ca) {
                        setInputCa(data.ca);
                        setCurrentToken(data.ca);
                    }
                    if (data.lp) {
                        setLpPool(data.lp);
                        setCurrentPool(data.lp);
                    } else {
                        setLpPool("");
                        setCurrentPool("");
                    }
                }
            } catch (err) { }
        };
        fetchConfig();
    }, [selectedProfile]);

    useEffect(() => {
        const fetchInitialStatus = async () => {
            if (!selectedProfile) return;
            const telegramUser = localStorage.getItem('userName') || 'default_user';
            try {
                const res = await fetch(`/api/autosell/logs?userName=${telegramUser}&profileName=${selectedProfile}`);
                if (res.ok) {
                    const data = await res.json();
                    const cleanLogs = (data.logs || "").replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
                    const processedLogs = cleanLogs.split('\n').map(line => line.split('\r').pop()).filter(line => line.trim() !== '').join('\n');
                    setRawLogs(processedLogs);
                    setIsRunning(data.isRunning);
                }
            } catch (e) { }
        };
        fetchInitialStatus();
    }, [selectedProfile]);

    useEffect(() => {
        const resolveToken = async () => {
            const caToResolve = inputCa || selectedProfileCa;
            if (!caToResolve || caToResolve.length !== 42 || !caToResolve.startsWith('0x')) {
                setTokenName("");
                setTokenSymbol("");
                return;
            }
            try {
                setTokenName("Memuat...");
                setTokenSymbol("...");
                const response = await fetch(`/api/autosell/tokeninfo?ca=${caToResolve}&rpc=${encodeURIComponent(rpc || 'https://mainnet.base.org')}`, { cache: 'no-store' });
                if (response.ok) {
                    const data = await response.json();
                    setTokenName(data.name || "Unknown");
                    setTokenSymbol(data.symbol || "Unknown");
                } else {
                    setTokenName(`Gagal: ${response.status}`);
                    setTokenSymbol(`Gagal`);
                }
            } catch (err) {
                setTokenName(`Err: ${err.message}`);
                setTokenSymbol(`Err`);
            }
        };
        const timeout = setTimeout(resolveToken, 500);
        return () => clearTimeout(timeout);
    }, [inputCa, selectedProfileCa, rpc]);

    useEffect(() => {
        scrollToBottom();
    }, [logs, rawLogs]);

    // --- Monitoring Logic ---
    const fetchData = async () => {
        try {
            setIsLive(true);
            let pair = null;
            
            if (currentPool) {
                const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${currentPool}`);
                const dsData = await dsRes.json();
                pair = dsData.pairs?.find(p => p.pairAddress.toLowerCase() === currentPool.toLowerCase()) || dsData.pairs?.[0];
                
                // Sinkronkan CA jika berbeda
                if (pair && currentToken !== pair.baseToken.address) {
                    setCurrentToken(pair.baseToken.address);
                }
            } else if (currentToken) {
                const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${currentToken}`);
                const dsData = await dsRes.json();
                pair = dsData.pairs?.[0];
                
                if (pair && currentPool !== pair.pairAddress) {
                    setCurrentPool(pair.pairAddress);
                }
            }

            if (pair) {

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
                        chainId: pair.chainId || 'base',
                        priceChange: {
                            m5: pair.priceChange?.m5 || 0, h1: pair.priceChange?.h1 || 0,
                            h6: pair.priceChange?.h6 || 0, h24: pair.priceChange?.h24 || 0
                        },
                        txns: {
                            buys: pair.txns?.h24?.buys || 0, sells: pair.txns?.h24?.sells || 0
                        },
                        pairCreatedAt: pair.pairCreatedAt || Date.now()
                    };
                });
            }
        } catch (err) {
            setIsLive(false);
        }
    };

    useEffect(() => {
        fetchData();
        const pollInterval = setInterval(fetchData, 15000);
        return () => clearInterval(pollInterval);
    }, [currentToken, currentPool]);

    useEffect(() => {
        if (ca.length > 2) {
            setShowDropdown(true);
            const timer = setTimeout(async () => {
                setIsSearchingAPI(true);
                try {
                    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${ca}`);
                    const data = await res.json();
                    const uniqueTokens = [];
                    const seenAddresses = new Set();
                    if (data.pairs) {
                        for (const pair of data.pairs) {
                            if (!seenAddresses.has(pair.baseToken.address.toLowerCase())) {
                                seenAddresses.add(pair.baseToken.address.toLowerCase());
                                uniqueTokens.push(pair);
                            }
                        }
                    }
                    setSearchResults(uniqueTokens.slice(0, 6));
                } catch (e) { }
                setIsSearchingAPI(false);
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setSearchResults([]);
            setShowDropdown(false);
        }
    }, [ca]);

    // --- Handlers ---
    const showToastMsg = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const addLog = (level, msg, rawHtml = false) => {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        setLogs(prev => [...prev, { time: timeStr, level, msg, rawHtml }]);
    };

    const handlePasteInput = async (setter) => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setter(text);
                setHasUnsavedChanges(true);
            }
        } catch (err) {
            showToastMsg("✕ Gagal membaca clipboard", "error");
        }
    };

    const handleCopy = (text, key) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedStates(prev => ({ ...prev, [key]: true }));
        setTimeout(() => setCopiedStates(prev => ({ ...prev, [key]: false })), 2000);
    };

    const selectToken = (pair) => {
        setCurrentToken(pair.baseToken.address);
        setCurrentPool(pair.pairAddress);
        sessionStorage.setItem('lastToken', pair.baseToken.address);
        sessionStorage.setItem('lastPool', pair.pairAddress);

        let history = [];
        try { history = JSON.parse(localStorage.getItem('searchHistory') || '[]'); } catch (e) {}
        history = history.filter(h => h.pairAddress !== pair.pairAddress);
        history.unshift(pair);
        if (history.length > 50) history = history.slice(0, 50);
        localStorage.setItem('searchHistory', JSON.stringify(history));
        setSearchHistory(history);
        setIsGoPlusOpen(false);
        setIsQuickIntelOpen(false);
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
            if (ca.length < 40) setNotFound(true);
        }, 1500);
    };

    const clearLog = async () => {
        setLogs([]);
        setRawLogs("");
        const telegramUser = localStorage.getItem('userName') || 'default_user';
        const currentProfile = localStorage.getItem('activeProfile');
        try {
            await fetch('/api/autosell/clearlog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: telegramUser, profileName: currentProfile }),
            });
        } catch (e) { }
    };

    const handleSave = async () => {
        const telegramUser = localStorage.getItem('userName') || 'default_user';
        let finalProfileName = profileName.trim();
        if (!finalProfileName) {
            if (tokenInfo && tokenInfo.symbol) {
                let baseName = tokenInfo.symbol;
                let counter = 1;
                let candidate = baseName;
                while (profiles.includes(candidate)) {
                    counter++;
                    candidate = `${baseName}${counter}`;
                }
                finalProfileName = candidate;
            } else {
                let counter = 1;
                while (profiles.includes(`Profil${counter}`)) counter++;
                finalProfileName = `Profil${counter}`;
            }
        }

        setIsSaving(true);
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const response = await fetch('/api/autosell/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userName: telegramUser, profileName: finalProfileName,
                    privateKey, inputCa, lpPool, rpc, gasMultiplier: "1.2", slippage, sellRatio
                }),
            });

            if (response.ok) {
                if (privateKey) localStorage.setItem(`pk_${telegramUser}_${finalProfileName}`, privateKey);
                else localStorage.removeItem(`pk_${telegramUser}_${finalProfileName}`);

                setHasUnsavedChanges(false);
                setProfileName("");
                localStorage.setItem('activeProfile', finalProfileName);
                setSelectedProfile(finalProfileName);
                await fetchProfiles();
                showToastMsg("✓ Sukses tersimpan");
            } else {
                showToastMsg("✕ Gagal menyimpan konfigurasi", "error");
            }
        } catch (err) {
            showToastMsg("✕ Kesalahan koneksi saat menyimpan", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async () => {
        if (!profileToDelete) return;
        const telegramUser = localStorage.getItem('userName') || 'default_user';

        setIsDeleting(true);
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const response = await fetch('/api/autosell/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: telegramUser, profileName: profileToDelete }),
            });

            if (response.ok) {
                localStorage.removeItem(`pk_${telegramUser}_${profileToDelete}`);
                showToastMsg(`🗑️ Profil ${profileToDelete} berhasil dihapus!`, "success");
                setShowDeleteModal(false);
                if (selectedProfile === profileToDelete) {
                    localStorage.removeItem('activeProfile');
                    setSelectedProfile("");
                }
                await fetchProfiles();
            } else {
                showToastMsg("✕ Gagal menghapus profil", "error");
            }
        } catch (err) {
            showToastMsg("✕ Kesalahan", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleStart = async () => {
        if (isRunning) return;
        if (hasUnsavedChanges) {
            showToastMsg("Peringatan: Anda belum menyimpan (SAVE) pengaturan terbaru!", "warning");
            return;
        }

        setIsStarting(true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsStarting(false);

        setIsRunning(true);
        setLogs([]);
        setRawLogs("");

        addLog("SYSTEM", "Auto Sell module initialized");
        const telegramUser = localStorage.getItem('userName') || 'default_user';
        const currentProfile = localStorage.getItem('activeProfile');

        try {
            const response = await fetch('/api/autosell/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: telegramUser, profileName: currentProfile, privateKey }),
            });

            const data = await response.json();
            if (response.ok) showToastMsg("✓ Bot Started", "success");
            else {
                showToastMsg("✕ " + (data.error || "Gagal menjalankan bot"), "error");
                setIsRunning(false);
            }
        } catch (err) {
            showToastMsg("✕ Kesalahan koneksi", "error");
            setIsRunning(false);
        }
    };

    const handleStop = async () => {
        if (!isRunning) return;
        const telegramUser = localStorage.getItem('userName') || 'default_user';
        const currentProfile = localStorage.getItem('activeProfile');
        try {
            const response = await fetch('/api/autosell/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: telegramUser, profileName: currentProfile }),
            });
            if (response.ok) showToastMsg("✓ Bot Stopped", "success");
            else showToastMsg("✕ Gagal menghentikan bot", "error");
        } catch (err) {
            showToastMsg("✕ Kesalahan koneksi", "error");
        }
    };

    useEffect(() => {
        let interval;
        if (isRunning) {
            const telegramUser = localStorage.getItem('userName') || 'default_user';
            const currentProfile = localStorage.getItem('activeProfile');
            let stopDelayCount = 0;
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/autosell/logs?userName=${telegramUser}&profileName=${currentProfile}`);
                    if (res.ok) {
                        const data = await res.json();
                        const cleanLogs = (data.logs || "").replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
                        const processedLogs = cleanLogs.split('\n').map(l => l.split('\r').pop()).filter(l => l.trim() !== '').join('\n');
                        setRawLogs(processedLogs);
                        if (data.isRunning === false) {
                            stopDelayCount++;
                            if (stopDelayCount >= 2) setIsRunning(false);
                        } else {
                            stopDelayCount = 0;
                        }
                    }
                } catch (e) { }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning]);

    // --- Helpers ---
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

    const searchBarComponent = isLayoutLoaded && (
        <div className="monitoring-search-bar" style={{ 
            width: '100%', 
            maxWidth: 'none', 
            padding: '0', 
            display: 'block', 
            position: 'relative',
            height: '100%'
        }}>
            <div 
                className="screenerv2-search" 
                style={{ width: `${(colWidth.search / 2059) * 100}%`, height: `${colHeight.search}px`, left: `${(colPos.search.x / 2059) * 100}%`, top: `${colPos.search.y}px`, position: 'absolute', ...(isDevMode ? { border: '2px dashed #0052FF', overflow: 'visible', flexShrink: 0, zIndex: 50 } : { transition: isLayoutAnimated ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none' }) }}
            >
                {isDevMode && <EdgeResizer colKey="search" currentWidth={colWidth.search} currentHeight={colHeight.search} currentPos={colPos.search} />}
                {isDevMode && <CenterDragHandle colKey="search" currentPos={colPos.search} currentWidth={colWidth.search} currentHeight={colHeight.search} />}
                {isDevMode && <DevControls colKey="search" />}
                
                <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 15, top: 12, color: '#94a3b8' }}>🔍</span>
                    <input
                        type="text"
                        className="monitoring-search-input"
                        style={{ paddingLeft: '40px', width: '100%', height: '100%' }}
                        placeholder="Pencarian Contract Address (CA) atau Nama Token"
                        value={ca}
                        onChange={(e) => setCa(e.target.value)}
                        onFocus={() => { if (ca.length > 2 || searchHistory.length > 0) setShowDropdown(true); }}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button className="btn btn-outline" style={{ position: 'absolute', right: 0, height: '100%', borderRadius: '0 8px 8px 0', border: 'none', background: 'rgba(255,255,255,0.1)' }} onClick={async () => { try { const text = await navigator.clipboard.readText(); setCa(text); } catch (e) { } }}>Paste</button>
                </div>
                {showDropdown && (
                    <div className="search-dropdown transparent-scroll" style={{ maxHeight: '350px', overflowY: 'auto' }}>
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
                        ) : ca.length === 0 && searchHistory.length > 0 ? (
                            <>
                                <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Pencarian Terakhir</span>
                                    <span style={{ cursor: 'pointer', color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); localStorage.removeItem('searchHistory'); setSearchHistory([]); }}>Hapus</span>
                                </div>
                                {searchHistory.map((pair, idx) => (
                                    <div key={`hist-${idx}`} className="search-dropdown-item" onClick={() => selectToken(pair)}>
                                        <div className="search-item-left">
                                            <span className="search-item-symbol" style={{ color: '#94a3b8' }}>🕒 {pair.baseToken.symbol}</span>
                                            <span className="search-item-name">{pair.baseToken.name}</span>
                                        </div>
                                        <div className="search-item-right">
                                            <span className="search-item-chain">{pair.chainId}</span>
                                            <span className="search-item-price">${Number(pair.priceUsd).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                                        </div>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div style={{ padding: '1rem', textAlign: 'center', color: '#ef4444' }}>Tidak ada hasil ditemukan</div>
                        )}
                    </div>
                )}
            </div>

            <div 
                className="screenerv2-btn-cari" 
                style={{ width: `${(colWidth.btnCari / 2059) * 100}%`, height: `${colHeight.btnCari}px`, left: `${(colPos.btnCari.x / 2059) * 100}%`, top: `${colPos.btnCari.y}px`, position: 'absolute', ...(isDevMode ? { border: '2px dashed #0052FF', overflow: 'visible', flexShrink: 0, zIndex: 50 } : { transition: isLayoutAnimated ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none' }) }}
            >
                {isDevMode && <EdgeResizer colKey="btnCari" currentWidth={colWidth.btnCari} currentHeight={colHeight.btnCari} currentPos={colPos.btnCari} />}
                {isDevMode && <CenterDragHandle colKey="btnCari" currentPos={colPos.btnCari} currentWidth={colWidth.btnCari} currentHeight={colHeight.btnCari} />}
                {isDevMode && <DevControls colKey="btnCari" />}
                <button className="btn btn-primary-tele" onClick={handleSearch} style={{ width: '100%', height: '100%', margin: 0 }}>Cari</button>
            </div>
        </div>
    );

    const knownRpcs = [
        { label: "https://mainnet.base.org", value: "https://mainnet.base.org" },
        { label: "https://base-mainnet.g.alchemy.com/public", value: "https://base-mainnet.g.alchemy.com/public" },
        { label: "https://base-rpc.keccak.io", value: "https://base-rpc.keccak.io" },
        { label: "https://base.lava.build", value: "https://base.lava.build" },
        { label: "https://base.api.pocket.network", value: "https://base.api.pocket.network" }
    ];
    const randomRpcString = knownRpcs.map(r => r.value).join(",");
    const isRandom = !rpc || rpc === randomRpcString || rpc === "https://mainnet.base.org,https://base-mainnet.g.alchemy.com/public";
    const isKnown = knownRpcs.some(r => r.value === rpc);

    const handleSizeAndPos = (colKey, newWidth, newHeight, newX, newY) => {
        setColWidth(prev => ({ ...prev, [colKey]: newWidth }));
        setColHeight(prev => ({ ...prev, [colKey]: newHeight }));
        setColPos(prev => ({ ...prev, [colKey]: { x: newX, y: newY } }));
        setHasPendingLayout(true);
    };

    const handleCardOrder = (cardKey, direction) => {
        setCardOrder(prev => {
            const currentOrder = prev[cardKey];
            const targetOrder = currentOrder + direction;
            if (targetOrder < 1 || targetOrder > 2) return prev;
            
            const swapKey = Object.keys(prev).find(k => prev[k] === targetOrder);
            if (!swapKey) return prev;

            setHasPendingLayout(true);
            return { ...prev, [cardKey]: targetOrder, [swapKey]: currentOrder };
        });
    };

    function EdgeResizer({ colKey, currentWidth, currentHeight, currentPos }) {
        const handleDrag = (e, edge) => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = currentWidth;
            const startHeight = currentHeight;
            const startPos = currentPos;
            
            const container = document.querySelector('.screenerv2-main-layout');
            const containerWidth = container ? container.getBoundingClientRect().width : 2059;
            const containerHeight = container ? container.getBoundingClientRect().height : 938;

            const onMouseMove = (moveEvent) => {
                const physicalDeltaX = moveEvent.clientX - startX;
                const deltaX = physicalDeltaX * (2059 / containerWidth);
                const deltaY = moveEvent.clientY - startY;
                let newX = startPos.x;
                let newY = startPos.y;
                let newWidth = startWidth;
                let newHeight = startHeight;

                if (edge === 'left') {
                    newX = startPos.x + deltaX;
                    if (newX < 0) { newX = 0; newWidth = startPos.x + startWidth; } 
                    else { newWidth = Math.max(200, startWidth - deltaX); }
                } else if (edge === 'right') {
                    newWidth = Math.max(200, startWidth + deltaX);
                    if (startPos.x + newWidth > 2059) { newWidth = 2059 - startPos.x; }
                } else if (edge === 'top') {
                    newY = startPos.y + deltaY;
                    if (newY < 0) { newY = 0; newHeight = startPos.y + startHeight; }
                    else { newHeight = Math.max(100, startHeight - deltaY); }
                } else if (edge === 'bottom') {
                    newHeight = Math.max(100, startHeight + deltaY);
                    if (startPos.y + newHeight > containerHeight) { newHeight = containerHeight - startPos.y; }
                }
                setColWidth(prev => ({ ...prev, [colKey]: newWidth }));
                setColHeight(prev => ({ ...prev, [colKey]: newHeight }));
                setColPos(prev => ({ ...prev, [colKey]: { x: newX, y: newY } }));
            };
            
            const onMouseUp = (upEvent) => {
                const physicalDeltaX = upEvent.clientX - startX;
                const deltaX = physicalDeltaX * (2059 / containerWidth);
                const deltaY = upEvent.clientY - startY;
                let newX = startPos.x;
                let newY = startPos.y;
                let newWidth = startWidth;
                let newHeight = startHeight;

                if (edge === 'left') {
                    newX = startPos.x + deltaX;
                    if (newX < 0) { newX = 0; newWidth = startPos.x + startWidth; } 
                    else { newWidth = Math.max(200, startWidth - deltaX); }
                } else if (edge === 'right') {
                    newWidth = Math.max(200, startWidth + deltaX);
                    if (startPos.x + newWidth > 2059) { newWidth = 2059 - startPos.x; }
                } else if (edge === 'top') {
                    newY = startPos.y + deltaY;
                    if (newY < 0) { newY = 0; newHeight = startPos.y + startHeight; }
                    else { newHeight = Math.max(100, startHeight - deltaY); }
                } else if (edge === 'bottom') {
                    newHeight = Math.max(100, startHeight + deltaY);
                    if (startPos.y + newHeight > containerHeight) { newHeight = containerHeight - startPos.y; }
                }
                handleSizeAndPos(colKey, newWidth, newHeight, newX, newY);
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };
        const handleStyle = { position: 'absolute', background: '#e11d48', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontWeight: 'bold', fontSize: '14px', borderRadius: '4px' };
        return (
            <>
                <div style={{ ...handleStyle, top: '0px', left: '50%', transform: 'translateX(-50%)', width: '28px', height: '18px', cursor: 'ns-resize' }} onMouseDown={(e) => handleDrag(e, 'top')}>⇧</div>
                <div style={{ ...handleStyle, top: '50%', right: '0px', transform: 'translateY(-50%)', width: '18px', height: '28px', cursor: 'ew-resize' }} onMouseDown={(e) => handleDrag(e, 'right')}>⇨</div>
                <div style={{ ...handleStyle, bottom: '0px', left: '50%', transform: 'translateX(-50%)', width: '28px', height: '18px', cursor: 'ns-resize' }} onMouseDown={(e) => handleDrag(e, 'bottom')}>⇩</div>
                <div style={{ ...handleStyle, top: '50%', left: '0px', transform: 'translateY(-50%)', width: '18px', height: '28px', cursor: 'ew-resize' }} onMouseDown={(e) => handleDrag(e, 'left')}>⇦</div>
            </>
        );
    };

    function CenterDragHandle({ colKey, currentPos, currentWidth, currentHeight }) {
        const handleDrag = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startPos = currentPos;
            
            const container = document.querySelector('.screenerv2-main-layout');
            const containerWidth = container ? container.getBoundingClientRect().width : 2059;
            const containerHeight = container ? container.getBoundingClientRect().height : 938;

            const onMouseMove = (moveEvent) => {
                const physicalDeltaX = moveEvent.clientX - startX;
                const deltaX = physicalDeltaX * (2059 / containerWidth);
                
                let newX = startPos.x + deltaX;
                newX = Math.max(0, Math.min(newX, 2059 - currentWidth));

                let newY = startPos.y + (moveEvent.clientY - startY);
                newY = Math.max(0, Math.min(newY, containerHeight - currentHeight));
                
                setColPos(prev => ({ ...prev, [colKey]: { x: newX, y: newY } }));
            };
            
            const onMouseUp = (upEvent) => {
                const physicalDeltaX = upEvent.clientX - startX;
                const deltaX = physicalDeltaX * (2059 / containerWidth);
                
                let newX = startPos.x + deltaX;
                newX = Math.max(0, Math.min(newX, 2059 - currentWidth));

                let newY = startPos.y + (upEvent.clientY - startY);
                newY = Math.max(0, Math.min(newY, containerHeight - currentHeight));
                
                handleSizeAndPos(colKey, currentWidth, currentHeight, newX, newY);
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };
            
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };
        
        return (
            <div 
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '40px', height: '40px', background: 'rgba(0,82,255,0.8)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'move', zIndex: 1000, boxShadow: '0 4px 10px rgba(0,0,0,0.3)', fontSize: '20px' }}
                onMouseDown={handleDrag}
                title="Tahan dan Geser"
            >
                ✥
            </div>
        );
    };

    function DevControls({ colKey, isCard = false }) {
        if (isCard) {
            return (
                <div style={{ position: 'absolute', top: '-28px', right: '10px', display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '8px', justifyContent: 'center', zIndex: 10 }}>
                    <button style={{ background: '#334155', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px' }} onClick={() => handleCardOrder(colKey, -1)}>⬆️ NAIK</button>
                    <button style={{ background: '#334155', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px' }} onClick={() => handleCardOrder(colKey, 1)}>⬇️ TURUN</button>
                </div>
            );
        }
        return (
            <div style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '8px', justifyContent: 'center', zIndex: 10 }}>
                <button style={{ background: '#334155', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px' }} onClick={() => handleSizeAndPos(colKey, colWidth[colKey] - 10, colHeight[colKey], colPos[colKey].x, colPos[colKey].y)}>➖</button>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input 
                        type="number" 
                        value={Math.round(colWidth[colKey])} 
                        onChange={(e) => handleSizeAndPos(colKey, parseInt(e.target.value) || 200, colHeight[colKey], colPos[colKey].x, colPos[colKey].y)}
                        style={{ width: '50px', background: '#1e293b', border: '1px solid #475569', color: '#00C853', fontWeight: 'bold', textAlign: 'center', outline: 'none', borderRadius: '4px', padding: '2px' }} 
                    />
                    <span style={{ color: '#00C853', fontSize: '12px', marginLeft: '2px' }}>px</span>
                </div>
                <button style={{ background: '#334155', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px' }} onClick={() => handleSizeAndPos(colKey, colWidth[colKey] + 10, colHeight[colKey], colPos[colKey].x, colPos[colKey].y)}>➕</button>
            </div>
        );
    };

    return (
        <div className="screenerv2-container autosell-container" style={{ position: 'relative' }}>
            <style>{`
                .transparent-scroll::-webkit-scrollbar { width: 0px; height: 0px; display: none; }
                .transparent-scroll { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            {headerSlot && createPortal(searchBarComponent, headerSlot)}

            {(userRole !== 'Premium' && userRole !== 'Developer') && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔒</div>
                    <h3 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Fitur Premium</h3>
                    <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '300px' }}>Fitur ini khusus untuk Member Premium.</p>
                </div>
            )}

            {isDevMode && hasPendingLayout && (
                <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 9999, display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={() => {
                            setHasPendingLayout(false);
                            // Setting false will allow the next interval to fetch from server and revert.
                        }}
                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '30px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(239,68,68,0.5)', cursor: 'pointer' }}
                    >
                        ↩️ DISCARD
                    </button>
                    <button 
                        onClick={async () => {
                            try {
                                const res = await fetch('/api/layout', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ colWidth, colPos, colHeight, cardOrder })
                                });
                                const data = await res.json();
                                if (data.success) {
                                    alert("Layout Applied! Synchronized to all users.");
                                    setHasPendingLayout(false);
                                } else alert("Error: " + data.error);
                            } catch (e) { alert(e.message); }
                        }}
                        style={{ background: '#0052FF', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '30px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,82,255,0.5)', cursor: 'pointer' }}
                    >
                        💾 APPLY LAYOUT CHANGES
                    </button>
                </div>
            )}

            <div className="screenerv2-main-layout" style={{ opacity: isLayoutLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }}>

                {/* --- NEW LEFT TOKEN INFO COLUMN --- */}
                {isLayoutLoaded && (
                <>
                <div 
                    className="screenerv2-info-col" 
                    style={{ width: `${(colWidth.info / 2059) * 100}%`, bottom: '0px', left: `${(colPos.info.x / 2059) * 100}%`, top: `${colPos.info.y}px`, position: 'absolute', ...(isDevMode ? { border: '2px dashed #0052FF', overflow: 'visible', flexShrink: 0, zIndex: 50 } : { transition: isLayoutAnimated ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none' }) }}
                >
                    {isDevMode && <EdgeResizer colKey="info" currentWidth={colWidth.info} currentHeight={colHeight.info} currentPos={colPos.info} />}
                    {isDevMode && <CenterDragHandle colKey="info" currentPos={colPos.info} currentWidth={colWidth.info} currentHeight={colHeight.info} />}
                    {isDevMode && <DevControls colKey="info" />}
                    {!isSearching && !notFound && (
                        <div className="info-section">
                            <div className="dex-sidebar">
                                <div className="dex-sidebar-header">
                                    <div className="dex-title">{tokenInfo.symbol} <span className="copy-icon">📋</span> / {tokenInfo.quoteSymbol} <span className="dex-fire">🔥 #1</span></div>
                                    <div className="dex-badges">
                                        <span className="dex-badge blue" style={{ textTransform: 'capitalize' }}>
                                            <div className={`chain-logo ${tokenInfo.chainId}-logo`} style={{ width: 10, height: 10, display: 'inline-block', marginRight: 4 }}></div>
                                            {tokenInfo.chainId}
                                        </span>
                                        <span className="dex-badge pink" style={{ textTransform: 'capitalize' }}>{tokenInfo.dexId}</span>
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
                                                <span className="label">BUY VOL <span className="val">${formatNumberCompact(tokenInfo.txns.buys + tokenInfo.txns.sells > 0 ? (tokenInfo.txns.buys / (tokenInfo.txns.buys + tokenInfo.txns.sells)) * tokenInfo.volume24h : 0)}</span></span>
                                                <span className="label">SELL VOL <span className="val">${formatNumberCompact(tokenInfo.txns.buys + tokenInfo.txns.sells > 0 ? (tokenInfo.txns.sells / (tokenInfo.txns.buys + tokenInfo.txns.sells)) * tokenInfo.volume24h : 0)}</span></span>
                                            </div>
                                            <div className="buy-sell-bar">
                                                <div className="buy-bar" style={{ width: `${tokenInfo.txns.buys + tokenInfo.txns.sells > 0 ? (tokenInfo.txns.buys / (tokenInfo.txns.buys + tokenInfo.txns.sells)) * 100 : 50}%` }}></div>
                                                <div className="sell-bar" style={{ width: `${tokenInfo.txns.buys + tokenInfo.txns.sells > 0 ? (tokenInfo.txns.sells / (tokenInfo.txns.buys + tokenInfo.txns.sells)) * 100 : 50}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="stat-row">
                                        <div className="stat-col">
                                            <span className="label">TRADERS</span>
                                            <span className="value">{formatNumberCompact(Math.floor((tokenInfo.txns.buys + tokenInfo.txns.sells) * 0.75))}</span>
                                        </div>
                                        <div className="stat-col-wide">
                                            <div className="bar-labels">
                                                <span className="label">BUYERS <span className="val">{formatNumberCompact(Math.floor(tokenInfo.txns.buys * 0.75))}</span></span>
                                                <span className="label">SELLERS <span className="val">{formatNumberCompact(Math.floor(tokenInfo.txns.sells * 0.75))}</span></span>
                                            </div>
                                            <div className="buy-sell-bar">
                                                <div className="buy-bar" style={{ width: `${tokenInfo.txns.buys + tokenInfo.txns.sells > 0 ? (tokenInfo.txns.buys / (tokenInfo.txns.buys + tokenInfo.txns.sells)) * 100 : 50}%` }}></div>
                                                <div className="sell-bar" style={{ width: `${tokenInfo.txns.buys + tokenInfo.txns.sells > 0 ? (tokenInfo.txns.sells / (tokenInfo.txns.buys + tokenInfo.txns.sells)) * 100 : 50}%` }}></div>
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
                                        <a href={getExplorerUrl(tokenInfo.chainId, tokenInfo.pair)} target="_blank" rel="noopener noreferrer" className="link-icon" style={{ textDecoration: 'none' }}>EXP ↗</a>
                                    </div>
                                    <div className="info-item-copy">
                                        <span className="label">{tokenInfo.symbol}</span>
                                        <div className="address-pill" onClick={() => handleCopy(tokenInfo.baseTokenAddr, 'base')} style={{ cursor: 'pointer' }}>
                                            <button className="copy-btn">{copiedStates['base'] ? '✓' : '📋'}</button>
                                            <span style={{ color: copiedStates['base'] ? '#4ade80' : 'inherit' }}>{copiedStates['base'] ? 'Copied!' : truncateAddress(tokenInfo.baseTokenAddr)}</span>
                                        </div>
                                        <a href={getExplorerUrl(tokenInfo.chainId, tokenInfo.baseTokenAddr)} target="_blank" rel="noopener noreferrer" className="link-icon" style={{ textDecoration: 'none' }}>EXP ↗</a>
                                    </div>
                                    <div className="info-item-copy">
                                        <span className="label">{tokenInfo.quoteSymbol}</span>
                                        <div className="address-pill" onClick={() => handleCopy(tokenInfo.quoteTokenAddr, 'quote')} style={{ cursor: 'pointer' }}>
                                            <button className="copy-btn">{copiedStates['quote'] ? '✓' : '📋'}</button>
                                            <span style={{ color: copiedStates['quote'] ? '#4ade80' : 'inherit' }}>{copiedStates['quote'] ? 'Copied!' : truncateAddress(tokenInfo.quoteTokenAddr)}</span>
                                        </div>
                                        <a href={getExplorerUrl(tokenInfo.chainId, tokenInfo.quoteTokenAddr)} target="_blank" rel="noopener noreferrer" className="link-icon" style={{ textDecoration: 'none' }}>EXP ↗</a>
                                    </div>
                                </div>
                                
                                {/* Security Audits */}
                                <div ref={securityRef} style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                    {/* Go+ Security */}
                                    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                        {isGoPlusOpen && (
                                            <div className="transparent-scroll" style={{ position: 'absolute', bottom: '100%', left: '-1px', right: '-1px', background: '#0b1121', border: '1px solid rgba(255,255,255,0.05)', borderBottom: 'none', borderRadius: '8px 8px 0 0', padding: '0', zIndex: 10, boxShadow: '0 -10px 20px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '400px', overflowY: 'auto' }}>
                                                {[
                                                    { label: 'Buy tax', val: '0%', ok: true },
                                                    { label: 'Sell tax', val: '0%', ok: true },
                                                    { label: 'Tax modifiable', val: 'No', ok: true },
                                                    { label: 'External call', val: 'No', ok: true },
                                                    { label: 'Hidden owner', val: 'No', ok: true },
                                                    { label: 'Open source', val: 'Yes', ok: true },
                                                    { label: 'Honeypot', val: 'No', ok: true },
                                                    { label: 'Proxy contract', val: 'No', ok: true },
                                                    { label: 'Mintable', val: 'No', ok: true },
                                                    { label: 'Transfer pausable', val: 'No', ok: true },
                                                    { label: 'Trading cooldown', val: 'No', ok: true },
                                                    { label: "Can't sell all", val: 'No', ok: true },
                                                    { label: 'Owner can change balance', val: 'No', ok: true },
                                                    { label: 'Has blacklist', val: 'No', ok: true },
                                                    { label: 'Has whitelist', val: 'No', ok: true },
                                                    { label: 'Ownership renounced', val: 'Unknown', ok: null },
                                                    { label: 'Is anti whale', val: 'No', ok: 'warn' },
                                                    { label: 'Holder count', val: '61,432', ok: null },
                                                    { label: 'LP Holder count', val: '133', ok: null },
                                                    { label: 'Creator address', val: tokenInfo.baseTokenAddr ? truncateAddress(tokenInfo.baseTokenAddr) : '0xcdfc...ca90', ok: null, link: getExplorerUrl(tokenInfo.chainId, tokenInfo.baseTokenAddr || '0xcdfc00000000000000000000000000000000ca90') },
                                                    { label: 'Creator balance', val: '1,511.020 (<0.01%)', ok: null },
                                                    { label: 'Owner balance', val: '0 (0.00%)', ok: null }
                                                ].map((r, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem', color: '#cbd5e1' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>ⓘ</span> {r.label}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white', fontWeight: 600 }}>
                                                            {r.link ? (
                                                                <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'white', textDecoration: 'none' }}>
                                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>↗</span> {r.val}
                                                                </a>
                                                            ) : (
                                                                <>
                                                                    {r.ok === true && <span style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '12px', height: '12px', background: '#10b981', color: 'white', borderRadius: '50%', fontSize: '8px' }}>✓</span>}
                                                                    {r.ok === 'warn' && <span style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '12px', height: '12px', background: 'transparent', border: '1px solid white', color: 'white', borderRadius: '50%', fontSize: '8px', fontWeight: 'bold' }}>!</span>}
                                                                    {r.val}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div onClick={() => { setIsGoPlusOpen(!isGoPlusOpen); if (!isGoPlusOpen) setIsQuickIntelOpen(false); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'transparent', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px 8px 0 0' }}>
                                            <span style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>Go+ Security</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ color: 'white', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    No issues <span style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '14px', height: '14px', background: '#10b981', color: 'white', borderRadius: '50%', fontSize: '9px', fontWeight: 'bold' }}>✓</span>
                                                </span>
                                                <span style={{ color: '#94a3b8', fontSize: '0.7rem', transform: isGoPlusOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>▼</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Quick Intel */}
                                    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                        {isQuickIntelOpen && (
                                            <div className="transparent-scroll" style={{ position: 'absolute', bottom: '100%', left: '-1px', right: '-1px', background: '#0b1121', border: '1px solid rgba(255,255,255,0.05)', borderBottom: 'none', borderRadius: '8px 8px 0 0', padding: '0', zIndex: 10, boxShadow: '0 -10px 20px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '400px', overflowY: 'auto' }}>
                                                {[
                                                    { label: 'Contract Verified', val: 'Yes', ok: true },
                                                    { label: 'Honeypot', val: 'No', ok: true },
                                                    { label: 'Buy Tax', val: '0%', ok: true },
                                                    { label: 'Sell Tax', val: '0%', ok: true },
                                                    { label: 'Proxy', val: 'No', ok: true },
                                                    { label: 'Blacklist', val: 'No', ok: true },
                                                    { label: 'Mintable', val: 'No', ok: true },
                                                    { label: 'Pausable', val: 'No', ok: true }
                                                ].map((r, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem', color: '#cbd5e1' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>ⓘ</span> {r.label}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white', fontWeight: 600 }}>
                                                            {r.ok === true && <span style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '12px', height: '12px', background: '#10b981', color: 'white', borderRadius: '50%', fontSize: '8px' }}>✓</span>}
                                                            {r.val}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div onClick={() => { setIsQuickIntelOpen(!isQuickIntelOpen); if (!isQuickIntelOpen) setIsGoPlusOpen(false); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'transparent', cursor: 'pointer', borderRadius: '0 0 8px 8px' }}>
                                            <span style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>Quick Intel</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ color: 'white', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    No issues <span style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '14px', height: '14px', background: '#10b981', color: 'white', borderRadius: '50%', fontSize: '9px', fontWeight: 'bold' }}>✓</span>
                                                </span>
                                                <span style={{ color: '#94a3b8', fontSize: '0.7rem', transform: isQuickIntelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>▼</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div 
                    className="screenerv2-left-col" 
                    style={{ width: `${(colWidth.left / 2059) * 100}%`, bottom: '0px', left: `${(colPos.left.x / 2059) * 100}%`, top: `${colPos.left.y}px`, position: 'absolute', ...(isDevMode ? { border: '2px dashed #0052FF', overflow: 'visible', flexShrink: 0, zIndex: 50 } : { transition: isLayoutAnimated ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none' }) }}
                >
                    {isDevMode && <EdgeResizer colKey="left" currentWidth={colWidth.left} currentHeight={colHeight.left} currentPos={colPos.left} />}
                    {isDevMode && <CenterDragHandle colKey="left" currentPos={colPos.left} currentWidth={colWidth.left} currentHeight={colHeight.left} />}
                    {isDevMode && <DevControls colKey="left" />}
                    {toast.show && <div className={`toast-notification ${toast.type}`}>{toast.message}</div>}

                    {/* --- BOTTOM SECTION (Chart + Info + Log) --- */}
                    <div className="screenerv2-left">
                        {isSearching ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                                <div className="spinner" style={{ marginBottom: '1rem' }}>⏳</div>
                                Loading token data...
                            </div>
                        ) : !currentPool ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                                Memuat chart...
                            </div>
                        ) : (
                            <>
                                <iframe
                                    src={`https://dexscreener.com/${tokenInfo.chainId || 'base'}/${currentPool}?embed=1&theme=dark&info=0`}
                                    title="DexScreener Embed"
                                ></iframe>
                                <div className="dex-watermark-overlay">
                                    <div className="live-dot" style={{ width: 8, height: 8, marginRight: 6 }}></div>
                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>Connected</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div 
                    className="screenerv2-right" 
                    style={{ width: `${(colWidth.right / 2059) * 100}%`, bottom: '0px', left: `${(colPos.right.x / 2059) * 100}%`, top: `${colPos.right.y}px`, position: 'absolute', ...(isDevMode ? { border: '2px dashed #0052FF', overflow: 'visible', flexShrink: 0, zIndex: 50 } : { transition: isLayoutAnimated ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none' }) }}
                >
                    {isDevMode && <EdgeResizer colKey="right" currentWidth={colWidth.right} currentHeight={colHeight.right} currentPos={colPos.right} />}
                    {isDevMode && <CenterDragHandle colKey="right" currentPos={colPos.right} currentWidth={colWidth.right} currentHeight={colHeight.right} />}
                    {isDevMode && <DevControls colKey="right" />}
                    {/* --- NEW MINI CONTROL PANEL --- */}
                    <div className="control-panel-card" style={{ order: cardOrder.controlPanel || 1, position: 'relative', overflow: 'visible' }}>
                        {isDevMode && <DevControls colKey="controlPanel" isCard={true} />}
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 8px', width: '100%' }}>
                            {/* ROW 1 */}
                            <button className="btn-setup" style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', height: '32px', padding: '0 12px', fontSize: '0.8rem', width: '100%' }} onClick={() => setShowSettingsModal(true)}>⚙️ KONFIGURASI</button>
                            {isRunning ? (
                                <button className="btn-setup btn-start" style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', height: '32px', padding: '0 16px', fontSize: '0.8rem', width: '100%' }} onClick={handleStop}>
                                    ⏹️ STOP
                                </button>
                            ) : (
                                <button className="btn-setup btn-start" onClick={handleStart} disabled={isStarting} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', opacity: isStarting ? 0.7 : 1, cursor: isStarting ? 'not-allowed' : 'pointer', height: '32px', padding: '0 16px', fontSize: '0.8rem', width: '100%' }}>
                                    {isStarting ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>⏳ START...</span> : <div style={{ textAlign: 'center' }}>▷ START</div>}
                                </button>
                            )}

                            {/* ROW 2 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                <div className="select-wrapper" style={{ flex: 1 }}>
                                    <select className="setup-select" style={{ height: '32px', padding: '0 8px', width: '100%' }} value={selectedProfile} onChange={(e) => { setSelectedProfile(e.target.value); localStorage.setItem('activeProfile', e.target.value); }}>
                                        {filteredProfiles.length > 0 ? filteredProfiles.map(p => <option key={p} value={p} style={{ color: 'black' }}>{p}</option>) : <option value="" style={{ color: 'black' }}>(Kosong)</option>}
                                    </select>
                                </div>
                            </div>
                            <button className="btn-setup btn-reset" style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', height: '32px', padding: '0 12px', fontSize: '0.8rem', width: '100%' }} onClick={() => { setProfileToDelete(selectedProfile || (profiles.length > 0 ? profiles[0] : "")); setShowDeleteModal(true); }}>
                                🗑️ HAPUS
                            </button>
                        </div>
                    </div>

                    {/* Log Terminal */}
                    <div className="terminal-card" style={{ order: cardOrder.terminal, position: 'relative', overflow: 'visible' }}>
                        {isDevMode && <DevControls colKey="terminal" isCard={true} />}
                        <div className="terminal-header">
                            <span 
                                className="terminal-title"
                                contentEditable={isDevMode}
                                suppressContentEditableWarning={true}
                                style={{ outline: isDevMode ? '1px dashed #0052FF' : 'none', minWidth: '50px' }}
                                onBlur={(e) => {
                                    const newText = e.target.innerText;
                                    if (newText !== "LOG TERMINAL") {
                                        setPendingChanges(prev => [
                                            ...prev,
                                            { type: 'text', file: 'src/app/dashboard/monitoring/screenerv2/page.js', isRegex: false, target: '>LOG TERMINAL<', replacement: `>${newText}<` }
                                        ]);
                                    }
                                }}
                            >LOG TERMINAL</span>
                            <button className="btn-clear-log" onClick={clearLog}>🗑️ Clear Log</button>
                        </div>
                        <div className="terminal-body">
                            {logs.map((log, idx) => (
                                <div key={idx} className="log-entry">
                                    <span className="log-time">[{log.time}]</span>
                                    <span className={`log-level ${log.level.toLowerCase()}`}>{log.level}</span>
                                    {log.rawHtml ? (
                                        <span className="log-msg" dangerouslySetInnerHTML={{ __html: log.msg }}></span>
                                    ) : (
                                        <span className={`log-msg ${log.level === 'SUCCESS' && log.msg.includes('started') ? 'log-green' : ''}`}>{log.msg}</span>
                                    )}
                                </div>
                            ))}
                            {rawLogs && (
                                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', width: '100%', gap: '2px' }}>
                                    {rawLogs.split('\n').map((line, i) => {
                                        if (!line.trim()) return <span key={i} style={{ minHeight: '1.2em' }}></span>;
                                        let timestampMatch = line.match(/^\[.*?\]\s*/);
                                        let timestamp = '', content = line;
                                        if (timestampMatch) {
                                            timestamp = timestampMatch[0];
                                            content = line.substring(timestamp.length);
                                        }
                                        let htmlLine = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                        if (content.includes('AUTO COUNTER-SELL BOT') || content.includes('──────────────────────────────────────────') || content.includes('══════════════════════════════════════════')) {
                                            htmlLine = `<span style="color: #0ea5e9;">${htmlLine}</span>`;
                                        } else if (content.match(/^(Token|Wallet|DEX|Pool|Saldo|Jual|Slippage)\s*:/)) {
                                            let parts = content.split(':');
                                            let label = parts[0] + ':';
                                            let val = parts.slice(1).join(':');
                                            let valColor = '#facc15';
                                            if (label.includes('Saldo')) valColor = '#4ade80';
                                            else if (label.includes('Slippage')) valColor = '#f8fafc';
                                            htmlLine = `<span style="color: #0ea5e9;">${label.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span><span style="color: ${valColor};">${val.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
                                        } else if (content.includes('Memantau dari blok') || content.includes('Memantau Blok:')) {
                                            htmlLine = `<span style="color: #0ea5e9;">${htmlLine}</span>`;
                                        } else if (content.includes('BUY TERDETEKSI') || content.includes('Dibeli :') || content.includes('sudah memiliki izin Permit2') || content.includes('SUKSES sell #') || content.includes('Token berhasil di-approve') || content.includes('✅')) {
                                            htmlLine = `<span style="color: #4ade80;">${htmlLine}</span>`;
                                        } else if (content.includes('Jual    :')) {
                                            htmlLine = `<span style="color: #facc15; font-weight: bold;">${htmlLine}</span>`;
                                        } else if (content.includes('Mengirim transaksi swap') || content.includes('SUKSES! Berhasil menjual') || content.includes('Estimasi Pembelian')) {
                                            htmlLine = `<span style="color: #facc15; font-weight: bold;">${htmlLine}</span>`;
                                        } else if (content.includes('dikirim! Hash:')) {
                                            htmlLine = `<span style="color: #94a3b8;">${htmlLine}</span>`;
                                        } else if (content.includes('ERROR') || content.includes('❌') || content.includes('Gagal') || content.includes('RPC bermasalah')) {
                                            htmlLine = `<span style="color: #ef4444;">${htmlLine}</span>`;
                                        } else if (content.includes('⚠️')) {
                                            htmlLine = `<span style="color: #facc15;">${htmlLine}</span>`;
                                        } else {
                                            htmlLine = `<span style="color: #e2e8f0;">${htmlLine}</span>`;
                                        }
                                        if (timestamp) htmlLine = `<span style="color: #f8fafc;">${timestamp.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>` + htmlLine;
                                        return <span key={i} className="log-msg" style={{ fontFamily: 'monospace', lineHeight: '1.5', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: htmlLine }}></span>;
                                    })}
                                </div>
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                </div>
                </>
                )}
            </div>

            {/* Modals */}
            {showSettingsModal && (
                <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
                    <div className="settings-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>⚙️ Pengaturan Bot & Auto Sell</h3>
                            <button className="close-btn" onClick={() => setShowSettingsModal(false)}>✕</button>
                        </div>

                        <div className="settings-grid">
                            {/* KIRI: AUTO SELL */}
                            <div className="settings-section">
                                <div className="settings-section-title">AUTO SELL SETUP</div>
                                <div className="form-group">
                                    <label>1. PRIVATE KEY</label>
                                    <div className="input-with-icon">
                                        <input type="text" autoComplete="off" spellCheck="false" placeholder="Paste Private Key" value={privateKey} onChange={(e) => { setPrivateKey(e.target.value); setHasUnsavedChanges(true); }} style={{ WebkitTextSecurity: 'disc' }} />
                                        <span className="input-icon" style={{ cursor: 'pointer' }} onClick={() => handlePasteInput(setPrivateKey)}>📋</span>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label>2. INPUT CA</label>
                                    <div className="input-with-icon">
                                        <input type="text" placeholder="Paste Contract Address (CA)" value={inputCa} onChange={(e) => { setInputCa(e.target.value); setHasUnsavedChanges(true); }} />
                                        <span className="input-icon" style={{ cursor: 'pointer' }} onClick={() => handlePasteInput(setInputCa)}>📋</span>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label>3. LP POOL ADDRESS</label>
                                    <div className="input-with-icon">
                                        <input type="text" placeholder="Paste LP Pool Address" value={lpPool} onChange={(e) => { setLpPool(e.target.value); setHasUnsavedChanges(true); }} />
                                        <span className="input-icon" style={{ cursor: 'pointer' }} onClick={() => handlePasteInput(setLpPool)}>📋</span>
                                    </div>
                                </div>
                            </div>

                            {/* KANAN: PROFIL & LANJUTAN */}
                            <div className="settings-section">
                                <div className="settings-section-title">PROFIL & JARINGAN</div>
                                <div className="form-group">
                                    <label>NAMA AKUN PROFIL</label>
                                    <div className="input-with-suffix" style={{ display: 'flex' }}>
                                        <input type="text" placeholder={`Default: ${tokenInfo?.symbol || 'Profil1'}`} value={profileName} onChange={(e) => { setProfileName(e.target.value); setHasUnsavedChanges(true); }} style={{ paddingRight: '1rem', width: '100%' }} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label>INFO TOKEN</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input type="text" readOnly placeholder="Nama Token" value={tokenName} style={{ cursor: 'not-allowed', flex: 2, background: 'rgba(0,0,0,0.2)' }} />
                                        <input type="text" readOnly placeholder="Simbol" value={tokenSymbol} style={{ cursor: 'not-allowed', flex: 1, background: 'rgba(0,0,0,0.2)' }} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label>RPC NODE</label>
                                    <select value={isRandom ? "random" : isKnown ? rpc : "manual"} onChange={(e) => { const val = e.target.value; if (val === "random") setRpc(randomRpcString); else if (val === "manual") setRpc("https://"); else setRpc(val); setHasUnsavedChanges(true); }} className="setup-select">
                                        <option value="random" style={{ color: 'black' }}>Default (Random)</option>
                                        {knownRpcs.map((r, i) => <option key={i} value={r.value} style={{ color: 'black' }}>{r.label}</option>)}
                                        <option value="manual" style={{ color: 'black' }}>Tambahkan manual</option>
                                    </select>
                                    {(!isRandom && !isKnown) && (
                                        <input type="text" placeholder="Masukkan URL RPC Custom" value={rpc} onChange={(e) => { setRpc(e.target.value); setHasUnsavedChanges(true); }} style={{ width: '100%', marginTop: '8px' }} />
                                    )}
                                </div>
                                
                                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>SLIPPAGE (%)</label>
                                        <div className="input-with-suffix">
                                            <input type="number" step="0.1" placeholder="2.5" value={slippage} onChange={(e) => { setSlippage(e.target.value); setHasUnsavedChanges(true); }} style={{ width: '100%' }} />
                                            <span className="suffix">%</span>
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>SELL RATIO (%)</label>
                                        <div className="input-with-suffix">
                                            <input type="number" step="1" placeholder="98" value={sellRatio} onChange={(e) => { setSellRatio(e.target.value); setHasUnsavedChanges(true); }} style={{ width: '100%' }} />
                                            <span className="suffix">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <button className="btn-setup btn-save" style={{ marginTop: '25px', width: '100%', height: '44px', fontSize: '1rem', fontWeight: 'bold', opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }} onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "⏳ MENYIMPAN PENGATURAN..." : "💾 SIMPAN PENGATURAN"}
                        </button>
                    </div>
                </div>
            )}
            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Hapus Profil</h3>
                            <button className="close-btn" onClick={() => setShowDeleteModal(false)}>✕</button>
                        </div>
                        <button className="btn-setup btn-reset" style={{ marginTop: '25px', width: '100%', height: '48px', color: 'white', background: '#ef4444', fontSize: '1rem' }} onClick={handleReset} disabled={!profileToDelete || isDeleting}>{isDeleting ? "MENGHAPUS..." : "HAPUS PROFIL"}</button>
                    </div>
                </div>
            )}
        </div>
    );
}
