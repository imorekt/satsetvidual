"use client";
import { useEffect, useRef } from 'react';

/**
 * Hook untuk otomatis menyimpan dan memuat cache form berdasarkan privateKey.
 * @param {string} formName - Nama unik untuk halaman form (misal: 'deploy', 'addLp')
 * @param {string} privateKey - Kunci pembeda cache (jika kosong, gunakan default)
 * @param {object} states - Objek berisi semua state (misal: { tokenName, tokenSymbol, ... })
 * @param {object} setStates - Objek berisi semua fungsi setState (misal: { setTokenName, setTokenSymbol, ... })
 */
export function useFormCache(formName, privateKey, states, setStates) {
  const isInitialMount = useRef(true);
  const loadedKey = useRef(null);

  // Load Cache saat privateKey berubah
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const keySuffix = privateKey ? `_${privateKey.substring(0, 10)}` : '_default';
    const cacheKey = `satset_cache_${formName}${keySuffix}`;
    
    if (loadedKey.current === cacheKey) return; // Cegah load berulang
    
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        const data = JSON.parse(saved);
        Object.keys(data).forEach(key => {
          if (setStates[key] && data[key] !== undefined && data[key] !== null) {
            setStates[key](data[key]);
          }
        });
      }
      loadedKey.current = cacheKey;
    } catch (e) {
      console.error('Gagal load cache:', e);
    }
  }, [privateKey, formName, setStates]);

  // Save Cache saat states berubah
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    if (typeof window === 'undefined') return;
    
    // Jangan save jika belum pernah load untuk key ini (cegah overwrite dengan state kosong)
    const keySuffix = privateKey ? `_${privateKey.substring(0, 10)}` : '_default';
    const cacheKey = `satset_cache_${formName}${keySuffix}`;
    
    if (loadedKey.current !== cacheKey) return; 
    
    try {
      localStorage.setItem(cacheKey, JSON.stringify(states));
    } catch (e) {
      console.error('Gagal save cache:', e);
    }
  }, [privateKey, formName, JSON.stringify(states)]);
}
