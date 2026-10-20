import { useEffect, useRef } from 'react';
import { getHashPath } from '../utils/routing';

const DEFAULT_MSG = '尚有未送出的內容，確定要離開嗎？未送出的輸入將會遺失。';

/**
 * Warn on refresh/close (beforeunload) and on hash-route leave while dirty.
 * @param {boolean} isDirty
 * @param {{ message?: string, whenPath?: string }} [options]
 *   whenPath — only treat as "leave" when navigating away from this hash path
 */
export function useUnsavedGuard(isDirty, { message = DEFAULT_MSG, whenPath } = {}) {
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const allowRef = useRef(false);
  const stayHashRef = useRef(typeof window !== 'undefined' ? window.location.hash : '');

  useEffect(() => {
    if (isDirty) stayHashRef.current = window.location.hash;
  }, [isDirty]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirtyRef.current || allowRef.current) return;
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [message]);

  useEffect(() => {
    const onHashChange = () => {
      if (!dirtyRef.current || allowRef.current) {
        allowRef.current = false;
        stayHashRef.current = window.location.hash;
        return;
      }

      const path = getHashPath();
      // Still on the guarded page (e.g. query-only hash tweak)
      if (whenPath && path === whenPath) {
        stayHashRef.current = window.location.hash;
        return;
      }

      const ok = window.confirm(message);
      if (!ok) {
        allowRef.current = true;
        window.location.hash = stayHashRef.current || `#${whenPath || '/'}`;
        window.setTimeout(() => {
          allowRef.current = false;
        }, 0);
      } else {
        stayHashRef.current = window.location.hash;
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [message, whenPath]);
}
