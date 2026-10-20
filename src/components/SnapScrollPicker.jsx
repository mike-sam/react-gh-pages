import React, { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * One-item-per-viewport horizontal swipe picker.
 * Each option fills 100% width → reliable touch scroll + snap.
 */
function SnapScrollPicker({
  options = [],
  value,
  onChange,
  className = '',
  ariaLabel,
}) {
  const trackRef = useRef(null);
  const settleTimer = useRef(null);
  const syncing = useRef(false);
  const drag = useRef(null);
  const moved = useRef(false);

  const normalized = useMemo(
    () => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options]
  );

  const indexOf = useCallback(
    (val) => {
      const i = normalized.findIndex((o) => o.value === val);
      return i >= 0 ? i : 0;
    },
    [normalized]
  );

  const scrollToIndex = useCallback((idx, behavior = 'auto') => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const clamped = Math.max(0, Math.min(idx, normalized.length - 1));
    syncing.current = true;
    track.scrollTo({ left: clamped * track.clientWidth, behavior });
    // release sync flag after scroll settles
    window.setTimeout(() => {
      syncing.current = false;
    }, behavior === 'smooth' ? 280 : 40);
  }, [normalized.length]);

  useEffect(() => {
    scrollToIndex(indexOf(value), 'auto');
  }, [value, normalized.length, indexOf, scrollToIndex]);

  // Keep aligned on resize
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      scrollToIndex(indexOf(value), 'auto');
    });
    ro.observe(track);
    return () => ro.disconnect();
  }, [value, indexOf, scrollToIndex]);

  const commitFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || !track.clientWidth || syncing.current) return;
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    const clamped = Math.max(0, Math.min(idx, normalized.length - 1));
    const next = normalized[clamped]?.value;
    // snap precisely
    syncing.current = true;
    track.scrollTo({ left: clamped * track.clientWidth, behavior: 'smooth' });
    window.setTimeout(() => {
      syncing.current = false;
    }, 200);
    if (next != null && next !== value) onChange?.(next);
  }, [normalized, onChange, value]);

  const onScroll = () => {
    if (syncing.current) return;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(commitFromScroll, 80);
  };

  // Desktop: drag to scroll
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch') return;
    const track = trackRef.current;
    if (!track) return;
    moved.current = false;
    drag.current = { id: e.pointerId, x: e.clientX, scroll: track.scrollLeft };
    try {
      track.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (e) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const track = trackRef.current;
    if (!track) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 3) moved.current = true;
    track.scrollLeft = drag.current.scroll - dx;
  };

  const endDrag = (e) => {
    if (!drag.current || (e && drag.current.id !== e.pointerId)) return;
    drag.current = null;
    commitFromScroll();
  };

  const onItemActivate = (idx) => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    const next = normalized[idx]?.value;
    if (next == null) return;
    scrollToIndex(idx, 'smooth');
    if (next !== value) onChange?.(next);
  };

  return (
    <div className={`snap-scroll-picker ${className}`} aria-label={ariaLabel}>
      <div
        ref={trackRef}
        className="snap-scroll-track"
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {normalized.map((opt, idx) => (
          <button
            key={`${String(opt.value)}-${idx}`}
            type="button"
            className={`snap-scroll-item${opt.value === value ? ' is-active' : ''}`}
            onClick={() => onItemActivate(idx)}
            tabIndex={-1}
          >
            <span className="snap-scroll-label">{opt.label}</span>
          </button>
        ))}
      </div>
      <div className="snap-scroll-hint" aria-hidden>
        ‹ ›
      </div>
    </div>
  );
}

export default SnapScrollPicker;
