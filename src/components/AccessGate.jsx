import React, { useCallback, useEffect, useRef, useState } from 'react';
import '../App.css';
import {
  ACCESS_REVOKED_EVENT,
  isAccessUnlocked,
  stripAccessFromUrl,
  takeAccessFromUrl,
  touchAccessSession,
  verifyAccessHash,
} from '../utils/accessGate';
import { pendingWriteCount } from '../utils/offlineQueue';

function AccessGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => isAccessUnlocked());
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);
  const autoTried = useRef(false);

  const unlock = useCallback(async (hash) => {
    setBusy(true);
    setErr('');
    try {
      const result = await verifyAccessHash(hash);
      if (result.ok) {
        stripAccessFromUrl();
        setUnlocked(true);
        setValue('');
        return true;
      }
      setErr(result.error || '驗證失敗');
      return false;
    } catch (e) {
      setErr(e.message || String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (unlocked || autoTried.current) return undefined;
    const fromUrl = takeAccessFromUrl();
    if (!fromUrl) return undefined;
    autoTried.current = true;
    unlock(fromUrl);
    return undefined;
  }, [unlocked, unlock]);

  useEffect(() => {
    if (unlocked) return undefined;
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return undefined;
    const onAct = () => {
      if (!touchAccessSession()) setUnlocked(false);
    };
    const onVis = () => {
      if (document.visibilityState === 'visible' && !isAccessUnlocked()) {
        setUnlocked(false);
      }
    };
    const onRevoked = () => setUnlocked(false);
    document.addEventListener('pointerdown', onAct, true);
    document.addEventListener('keydown', onAct, true);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener(ACCESS_REVOKED_EVENT, onRevoked);
    const tick = window.setInterval(() => {
      if (!isAccessUnlocked()) setUnlocked(false);
    }, 60 * 1000);
    return () => {
      document.removeEventListener('pointerdown', onAct, true);
      document.removeEventListener('keydown', onAct, true);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener(ACCESS_REVOKED_EVENT, onRevoked);
      window.clearInterval(tick);
    };
  }, [unlocked]);

  if (unlocked) return children;
  const waiting = pendingWriteCount();

  return (
    <div className="access-gate">
      <form
        className="access-gate-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) unlock(value);
        }}
      >
        <p className="access-gate-title">需要驗證</p>
        <input
          ref={inputRef}
          className="entry-text-input access-gate-input"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="驗證碼"
          disabled={busy}
        />
        {err ? <p className="access-gate-err">{err}</p> : null}
        {waiting > 0 ? (
          <p className="access-gate-pending">驗證後會補送 {waiting} 筆</p>
        ) : null}
        <button type="submit" className="submit submit--primary" disabled={busy || !String(value).trim()}>
          {busy ? '驗證中…' : '確認'}
        </button>
      </form>
    </div>
  );
}

export default AccessGate;
