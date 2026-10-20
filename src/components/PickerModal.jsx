import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Searchable picker sheet.
 * Portaled to document.body so sticky page-chrome cannot cover it.
 * Anchored from the top; height follows visualViewport (keyboard-safe).
 */
function PickerModal({
  title,
  options,
  sections,
  value,
  onSelect,
  onClose,
  searchPlaceholder = '搜尋…',
  autoFocusSearch = false,
}) {
  const [query, setQuery] = useState('');
  const [viewport, setViewport] = useState(() => ({
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
    offsetTop: 0,
  }));
  const q = query.trim().toLowerCase();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    const sync = () => {
      if (vv) {
        setViewport({ height: vv.height, offsetTop: vv.offsetTop || 0 });
      } else {
        setViewport({ height: window.innerHeight, offsetTop: 0 });
      }
    };
    sync();
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    return () => {
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  const resolvedSections = useMemo(() => {
    if (sections?.length) {
      return sections
        .map((sec) => ({
          ...sec,
          options: (sec.options || [])
            .map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
            .filter((o) => {
              if (!q) return true;
              return (
                String(o.label).toLowerCase().includes(q) ||
                String(o.value).toLowerCase().includes(q) ||
                String(sec.title).toLowerCase().includes(q)
              );
            }),
        }))
        .filter((sec) => sec.options.length > 0);
    }
    const flat = (options || []).map((o) =>
      typeof o === 'string' ? { value: o, label: o } : o
    );
    const filtered = q
      ? flat.filter(
          (o) =>
            String(o.label).toLowerCase().includes(q) ||
            String(o.value).toLowerCase().includes(q)
        )
      : flat;
    return filtered.length ? [{ id: 'all', title: null, options: filtered }] : [];
  }, [sections, options, q]);

  const sheetStyle = {
    height: `${Math.max(240, Math.floor(viewport.height))}px`,
    maxHeight: `${Math.floor(viewport.height)}px`,
    transform: viewport.offsetTop ? `translateY(${viewport.offsetTop}px)` : undefined,
  };

  const node = (
    <div className="picker-modal-overlay picker-modal-overlay--top" onClick={onClose}>
      <div
        className="picker-modal picker-modal--search picker-modal--top"
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-modal-header">
          <h4>{title}</h4>
          <button type="button" className="picker-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <input
          type="search"
          className="picker-modal-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          autoFocus={autoFocusSearch}
          enterKeyHint="search"
        />

        <div className="picker-modal-body">
          {resolvedSections.length === 0 && (
            <p className="picker-modal-empty">沒有符合的選項</p>
          )}
          {resolvedSections.map((sec) => (
            <div key={sec.id || sec.title || 'all'} className="picker-modal-section">
              {sec.title && <div className="picker-modal-section-title">{sec.title}</div>}
              <div className="picker-modal-grid">
                {sec.options.map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    className={`picker-modal-tag${opt.value === value ? ' is-active' : ''}`}
                    onClick={() => {
                      onSelect(opt.value);
                      onClose();
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}

export default PickerModal;
