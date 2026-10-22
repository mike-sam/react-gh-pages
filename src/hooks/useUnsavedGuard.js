import { useEffect, useRef } from 'react';
import { getHashPath, setDirtyGuard } from '../utils/routing';

const DEFAULT_MSG = '尚有未送出的內容，確定要離開嗎？未送出的輸入將會遺失。';

/**
 * Warn on refresh/close (beforeunload) and on in-app leave while dirty.
 * Leave intercept lives in routing (click / applyHash / popstate) so it still
 * runs after hash Back — the page would otherwise unmount first.
 *
 * @param {boolean} isDirty
 * @param {{ message?: string, whenPath?: string }} [options]
 *   whenPath — only treat as "leave" when navigating away from this hash path
 */
export function useUnsavedGuard(isDirty, { message = DEFAULT_MSG, whenPath } = {}) {
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const stayHashRef = useRef(typeof window !== 'undefined' ? window.location.hash : '');

  useEffect(() => {
    if (isDirty) stayHashRef.current = window.location.hash;
  }, [isDirty]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [message]);

  useEffect(() => {
    setDirtyGuard({
      isDirty: () => dirtyRef.current,
      message,
      stayPath: whenPath || getHashPath(),
      stayHash: () => stayHashRef.current,
    });
    return () => setDirtyGuard(null);
  }, [message, whenPath]);
}
