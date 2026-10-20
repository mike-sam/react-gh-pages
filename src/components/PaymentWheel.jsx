import React, { useEffect, useMemo, useRef } from 'react';
import WheelPicker from './WheelPicker';
import { formatPaymentLabel } from '../utils/paymentLabel';

const CAT_ORDER = ['Cash', 'eWallet', 'Card'];

/**
 * ←→ category on whole cell; ↑↓ options.
 * MY/SG 分類僅透過雙擊開啟 PickerModal，不另開 region 滑動列。
 */
function PaymentWheel({ categorized, paymentMethod, setPaymentMethod, onDoubleSelect }) {
  const rootRef = useRef(null);
  const touchRef = useRef({ x: 0, y: 0, axis: null });
  const switchCatRef = useRef(null);
  const swipeConsumedRef = useRef(false);

  const payCat = useMemo(() => {
    if (!paymentMethod) return 'Cash';
    for (const cat of CAT_ORDER) {
      if ((categorized[cat] || []).some((o) => o.card_num === paymentMethod)) return cat;
    }
    if ((categorized.eWallet || []).length) return 'eWallet';
    return 'Cash';
  }, [paymentMethod, categorized]);

  const options = useMemo(() => {
    const list = categorized[payCat] || [];
    return list.map((o) => ({
      value: o.card_num,
      label: formatPaymentLabel(o),
    }));
  }, [categorized, payCat]);

  const switchCat = (dir) => {
    const available = CAT_ORDER.filter((c) => (categorized[c] || []).length > 0);
    if (!available.length) return;
    const idx = Math.max(0, available.indexOf(payCat));
    const next = available[(idx + dir + available.length) % available.length];
    const list = categorized[next] || [];
    setPaymentMethod(list[0]?.card_num || '');
  };
  switchCatRef.current = switchCat;

  const onNavClick = (dir) => (e) => {
    if (swipeConsumedRef.current) {
      e.preventDefault();
      swipeConsumedRef.current = false;
      return;
    }
    switchCat(dir);
  };

  // Whole cell: horizontal swipe → category (vertical left to WheelPicker)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;

    const onStart = (clientX, clientY) => {
      touchRef.current = { x: clientX, y: clientY, axis: null };
    };

    const onMove = (clientX, clientY, e) => {
      const dx = clientX - touchRef.current.x;
      const dy = clientY - touchRef.current.y;
      if (!touchRef.current.axis) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        touchRef.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (touchRef.current.axis === 'x') {
        e?.preventDefault?.();
      }
    };

    const onEnd = (clientX, clientY) => {
      if (touchRef.current.axis !== 'x') {
        touchRef.current.axis = null;
        return;
      }
      const dx = clientX - touchRef.current.x;
      touchRef.current.axis = null;
      if (Math.abs(dx) < 36) return;
      swipeConsumedRef.current = true;
      switchCatRef.current?.(dx < 0 ? 1 : -1);
      window.setTimeout(() => {
        swipeConsumedRef.current = false;
      }, 350);
    };

    const onTouchStart = (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      onStart(t.clientX, t.clientY);
    };
    const onTouchMove = (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      onMove(t.clientX, t.clientY, e);
    };
    const onTouchEnd = (e) => {
      const t = e.changedTouches?.[0];
      if (!t) return;
      onEnd(t.clientX, t.clientY);
    };

    // Mouse drag (desktop)
    let mouseDown = false;
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      mouseDown = true;
      onStart(e.clientX, e.clientY);
    };
    const onMouseMove = (e) => {
      if (!mouseDown) return;
      onMove(e.clientX, e.clientY, e);
    };
    const onMouseUp = (e) => {
      if (!mouseDown) return;
      mouseDown = false;
      onEnd(e.clientX, e.clientY);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div className="payment-wheel" ref={rootRef}>
      <div className="payment-wheel-catbar">
        <button type="button" className="payment-wheel-cat-nav" onClick={onNavClick(-1)}>
          ‹
        </button>
        <span className="payment-wheel-cat-label">{payCat}</span>
        <button type="button" className="payment-wheel-cat-nav" onClick={onNavClick(1)}>
          ›
        </button>
      </div>
      <WheelPicker
        className="payment-wheel-options"
        axis="y"
        options={options.length ? options : [{ value: '', label: '—' }]}
        value={paymentMethod || options[0]?.value || ''}
        onChange={setPaymentMethod}
        onDoubleSelect={onDoubleSelect}
        infinite={options.length > 2}
        ariaLabel="付款方式"
      />
    </div>
  );
}

export default PaymentWheel;
