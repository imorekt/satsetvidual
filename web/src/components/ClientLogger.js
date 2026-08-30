"use client";
import { useEffect } from "react";

function sendLog(type, message, details = null) {
  fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, message, details }),
  }).catch(() => {}); // ignore errors in sending log
}

export default function ClientLogger() {
  useEffect(() => {
    // Capture unhandled JS errors
    const handleError = (event) => {
      sendLog('ERROR', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack || null
      });
    };

    // Capture unhandled Promise rejections
    const handleRejection = (event) => {
      const reasonStr = event.reason?.toString() || event.reason || '';
      
      // Silently ignore MetaMask extension conflict errors
      if (typeof reasonStr === 'string' && (
        reasonStr.includes('Failed to connect to MetaMask') || 
        reasonStr.includes('ejbalbakoplchlghecdalmeeeajnimhm')
      )) {
        return;
      }
      
      sendLog('ERROR', 'Unhandled Promise Rejection', {
        reason: reasonStr
      });
    };

    // Capture interactions (clicks)
    const handleClick = (event) => {
      // only log clicks on buttons or links to avoid spam
      const target = event.target.closest('button, a');
      if (target) {
        const actionText = target.innerText || target.getAttribute('aria-label') || target.tagName;
        sendLog('INTERACTION', `User clicked element: ${actionText.substring(0, 50).trim().replace(/\n/g, ' ')}`);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('click', handleClick, true);
    };
  }, []);

  return null;
}
