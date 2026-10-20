import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const COPIES = 5;

/**
 * Snap wheel with gray neighbors.
 * infinite: auto when options.length > 2 (override with prop).
 * 1 item → static; 2 items → finite up/down; >2 → infinite loop.
 */
function WheelPicker({
  options = [],
  value,
  onChange,
  onDoubleSelect,
  axis = 'y',
  className = '',
  ariaLabel,
  infinite: infiniteProp,
}) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const settleTimer = useRef(null);
  const syncing = useRef(false);
  const skipChangeRef = useRef(false);
  const lastTap = useRef({ t: 0, value: null });
  const [itemSize, setItemSize] = useState(24);
  const [activeBase, setActiveBase] = useState(0);

  const normalized = useMemo(
    () => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options]
  );
  const n = normalized.length;
  const infinite = infiniteProp != null ? infiniteProp : n > 2;
  const midCopy = Math.floor(COPIES / 2);
  const copyCount = infinite ? COPIES : 1;

  const looped = useMemo(() => {
    if (!n) return [];
    const out = [];
    for (let c = 0; c < copyCount; c += 1) {
      normalized.forEach((opt, i) => {
        out.push({ ...opt, _key: `${c}-${i}`, _base: i, _copy: c });
      });
    }
    return out;
  }, [normalized, n, copyCount]);

  const measure = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const raw = axis === 'y' ? vp.clientHeight : vp.clientWidth;
    // Wait until laid out — never shrink via inline height (caused 3px collapse)
    if (raw < 24) return;
    const size = Math.max(1, Math.floor(raw / 3));
    if (size > 0) setItemSize(size);
  }, [axis]);

  useLayoutEffect(() => {
    measure();
  }, [measure, className]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    return () => ro.disconnect();
  }, [measure]);

  const scrollToLoopIndex = useCallback(
    (loopIdx, behavior = 'auto') => {
      const track = trackRef.current;
      if (!track || !itemSize) return;
      syncing.current = true;
      const pos = loopIdx * itemSize;
      track.scrollTo(
        axis === 'y' ? { top: pos, behavior } : { left: pos, behavior }
      );
      window.setTimeout(() => {
        syncing.current = false;
      }, behavior === 'smooth' ? 200 : 24);
    },
    [axis, itemSize]
  );

  const indexForBase = useCallback(
    (baseIdx) => (infinite ? midCopy * n + baseIdx : baseIdx),
    [infinite, midCopy, n]
  );

  const syncToValue = useCallback(
    (behavior = 'auto') => {
      if (!n || !itemSize) return;
      let base = normalized.findIndex((o) => o.value === value);
      if (base < 0) base = 0;
      setActiveBase(base);
      skipChangeRef.current = true;
      scrollToLoopIndex(indexForBase(base), behavior);
    },
    [n, itemSize, normalized, value, indexForBase, scrollToLoopIndex]
  );

  useEffect(() => {
    syncToValue('auto');
  }, [value, n, itemSize, infinite]); // eslint-disable-line react-hooks/exhaustive-deps

  const readLoopIndex = () => {
    const track = trackRef.current;
    if (!track || !itemSize) return 0;
    const pos = axis === 'y' ? track.scrollTop : track.scrollLeft;
    return Math.round(pos / itemSize);
  };

  const commitFromScroll = useCallback(() => {
    if (!n || !itemSize || syncing.current) return;
    let loopIdx = readLoopIndex();
    loopIdx = Math.max(0, Math.min(loopIdx, looped.length - 1));
    const base = ((loopIdx % n) + n) % n;
    setActiveBase(base);

    const next = normalized[base]?.value;
    if (next != null && next !== value && !skipChangeRef.current) {
      onChange?.(next);
    }
    skipChangeRef.current = false;

    if (infinite) {
      const copy = Math.floor(loopIdx / n);
      if (copy <= 0 || copy >= COPIES - 1) {
        scrollToLoopIndex(midCopy * n + base, 'auto');
      } else {
        scrollToLoopIndex(loopIdx, 'auto');
      }
    } else {
      scrollToLoopIndex(base, 'auto');
    }
  }, [n, itemSize, looped.length, normalized, value, onChange, infinite, midCopy, scrollToLoopIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    if (syncing.current || !n || !itemSize || n <= 1) return;
    const loopIdx = readLoopIndex();
    setActiveBase(((loopIdx % n) + n) % n);
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(commitFromScroll, 70);
  };

  const handleTap = (baseIdx) => {
    const optValue = normalized[baseIdx]?.value;
    if (optValue == null) return;
    const now = Date.now();
    if (
      onDoubleSelect &&
      lastTap.current.value === optValue &&
      now - lastTap.current.t < 320
    ) {
      lastTap.current = { t: 0, value: null };
      onDoubleSelect(optValue);
      return;
    }
    lastTap.current = { t: now, value: optValue };
    setActiveBase(baseIdx);
    scrollToLoopIndex(indexForBase(baseIdx), 'smooth');
    if (optValue !== value) onChange?.(optValue);
  };

  const padStyle =
    axis === 'y'
      ? { height: itemSize, minHeight: itemSize, width: '100%' }
      : { width: itemSize, minWidth: itemSize, height: '100%' };

  const itemStyle =
    axis === 'y'
      ? { height: itemSize, minHeight: itemSize }
      : { width: itemSize, minWidth: itemSize };

  if (!n) {
    return (
      <div className={`wheel-picker wheel-picker--${axis} ${className}`}>
        <div className="wheel-picker-empty">—</div>
      </div>
    );
  }

  // Single option: no scroll chrome needed beyond showing the value
  if (n === 1) {
    return (
      <div
        className={`wheel-picker wheel-picker--${axis} wheel-picker--single ${className}`}
        aria-label={ariaLabel}
        onDoubleClick={() => onDoubleSelect?.(normalized[0].value)}
      >
        <span className="wheel-picker-label is-active-static">{normalized[0].label}</span>
      </div>
    );
  }

  return (
    <div
      className={`wheel-picker wheel-picker--${axis} ${className}${infinite ? '' : ' wheel-picker--finite'}`}
      aria-label={ariaLabel}
      ref={viewportRef}
    >
      <div className="wheel-picker-fade wheel-picker-fade--start" aria-hidden />
      <div className="wheel-picker-fade wheel-picker-fade--end" aria-hidden />
      <div className="wheel-picker-center-band" aria-hidden />
      <div ref={trackRef} className="wheel-picker-track" onScroll={onScroll}>
        <div className="wheel-picker-pad" style={padStyle} aria-hidden />
        {looped.map((opt) => {
          const isActive = opt._base === activeBase;
          let dist = Math.abs(opt._base - activeBase);
          if (infinite) dist = Math.min(dist, n - dist);
          return (
            <button
              key={opt._key}
              type="button"
              style={itemStyle}
              className={[
                'wheel-picker-item',
                isActive ? 'is-active' : '',
                dist === 1 ? 'is-neighbor' : '',
                dist > 1 ? 'is-far' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleTap(opt._base)}
              tabIndex={-1}
            >
              <span className="wheel-picker-label">{opt.label}</span>
            </button>
          );
        })}
        <div className="wheel-picker-pad" style={padStyle} aria-hidden />
      </div>
    </div>
  );
}

export default WheelPicker;
