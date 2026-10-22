import { useEffect, useRef } from 'react';
import { bindHistoryOverlay } from '../utils/routing';

/** While `open`, the next hardware Back closes via `onClose` instead of leaving the page. */
export function useHistoryOverlay(open, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    return bindHistoryOverlay(() => onCloseRef.current?.());
  }, [open]);
}
