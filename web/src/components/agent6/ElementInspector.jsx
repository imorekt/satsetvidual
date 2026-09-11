'use client';
import { useEffect, useState } from 'react';

export default function ElementInspector({ isActive, onSelectElement, onCancel }) {
  const [hoveredRect, setHoveredRect] = useState(null);
  const [hoveredInfo, setHoveredInfo] = useState('');

  useEffect(() => {
    if (!isActive) {
      setHoveredRect(null);
      return;
    }

    const handleMouseOver = (e) => {
      // Don't inspect the inspector itself or agent 6 panel
      if (e.target.closest('.agent6-panel-window') || e.target.closest('.agent6-floating-bubble') || e.target.closest('.agent6-inspector-active-banner')) {
        return;
      }

      const rect = e.target.getBoundingClientRect();
      const tagName = e.target.tagName.toLowerCase();
      const className = typeof e.target.className === 'string' ? e.target.className : '';
      const id = e.target.id ? `#${e.target.id}` : '';
      
      setHoveredRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height
      });

      setHoveredInfo(`${tagName}${id}${className ? '.' + className.split(' ').filter(Boolean).slice(0, 2).join('.') : ''} (${Math.round(rect.width)} × ${Math.round(rect.height)}px)`);
    };

    const handleClick = (e) => {
      if (e.target.closest('.agent6-panel-window') || e.target.closest('.agent6-floating-bubble') || e.target.closest('.agent6-inspector-active-banner')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const el = e.target;
      const tagName = el.tagName.toLowerCase();
      const className = typeof el.className === 'string' ? el.className : '';
      const id = el.id ? `#${el.id}` : '';
      const selector = `${tagName}${id}${className ? '.' + className.split(' ').filter(Boolean).join('.') : ''}`;
      const innerSnippet = (el.innerText || el.textContent || '').trim().substring(0, 100);

      onSelectElement({
        tagName,
        selector,
        className,
        id: el.id || '',
        innerSnippet,
        width: Math.round(el.offsetWidth),
        height: Math.round(el.offsetHeight)
      });
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isActive, onSelectElement]);

  if (!isActive) return null;

  return (
    <>
      <div className="agent6-inspector-active-banner">
        <span>🎯 Mode Inspect Aktif — Klik elemen/kotak di layar untuk dipilih</span>
        <button
          onClick={onCancel}
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.4)',
            color: 'white',
            borderRadius: '20px',
            padding: '2px 8px',
            fontSize: '0.72rem',
            cursor: 'pointer'
          }}
        >
          Batalkan (Esc)
        </button>
      </div>

      {hoveredRect && (
        <div
          style={{
            position: 'absolute',
            top: `${hoveredRect.top}px`,
            left: `${hoveredRect.left}px`,
            width: `${hoveredRect.width}px`,
            height: `${hoveredRect.height}px`,
            border: '2px dashed #ec4899',
            backgroundColor: 'rgba(236, 72, 153, 0.15)',
            boxShadow: '0 0 15px rgba(236, 72, 153, 0.5)',
            pointerEvents: 'none',
            zIndex: 999998,
            transition: 'all 0.05s ease-out'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-24px',
              left: '0',
              background: '#ec4899',
              color: 'white',
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
            }}
          >
            {hoveredInfo}
          </div>
        </div>
      )}
    </>
  );
}
