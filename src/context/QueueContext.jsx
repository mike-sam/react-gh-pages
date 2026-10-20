import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_ENDPOINTS } from '../config';
import {
  enqueueItem,
  loadQueue,
  queueLength,
  removeFromQueue,
} from '../utils/offlineQueue';

const QueueContext = createContext(null);

async function postPayload(payload, signal) {
  const endpoint =
    payload.action === 'trackCalendar'
      ? API_ENDPOINTS.CALENDAR_TRACK || API_ENDPOINTS.GSHEET_SUBMIT
      : payload.action === 'parkLocation' || payload.action === 'save_parking'
        ? API_ENDPOINTS.PARK_LOCATION || API_ENDPOINTS.GSHEET_SUBMIT
        : payload.action === 'analyzeReceipt'
          ? API_ENDPOINTS.PHOTO_UPLOAD || API_ENDPOINTS.GSHEET_SUBMIT
          : API_ENDPOINTS.GSHEET_SUBMIT;

  // no-cors: opaque ok = request left device; only network fail throws
  await fetch(endpoint, {
    method: 'POST',
    mode: 'no-cors',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    signal,
  });
}

export function QueueProvider({ children }) {
  const [pending, setPending] = useState(() => queueLength());
  const [flushing, setFlushing] = useState(false);

  const refreshCount = useCallback(() => {
    setPending(queueLength());
  }, []);

  const flushQueue = useCallback(async () => {
    if (flushing) return { ok: true, remaining: queueLength() };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      refreshCount();
      return { ok: false, remaining: queueLength(), reason: 'offline' };
    }

    setFlushing(true);
    try {
      const items = loadQueue();
      for (const item of items) {
        try {
          await postPayload(item.payload);
          removeFromQueue(item.id);
        } catch {
          // keep item; stop sequential flush on first hard failure
          break;
        }
      }
      refreshCount();
      return { ok: true, remaining: queueLength() };
    } finally {
      setFlushing(false);
    }
  }, [flushing, refreshCount]);

  /**
   * Enqueue then try immediate send. Clears form responsibility is caller's.
   * @param {object} payload must include id (ms) and action
   * @param {{ signal?: AbortSignal }} [opts]
   */
  const enqueueAndSend = useCallback(
    async (payload, opts = {}) => {
      const { signal } = opts;
      const id = payload.id ?? payload.timestamp_ms ?? Date.now();
      const body = { ...payload, id };

      if (signal?.aborted) {
        return { aborted: true, queued: false, sent: false };
      }

      enqueueItem({
        id,
        action: body.action || 'expense',
        payload: body,
        enqueuedAt: Date.now(),
      });
      refreshCount();

      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          return { queued: true, sent: false };
        }
        await postPayload(body, signal);
        removeFromQueue(id);
        refreshCount();
        return { queued: false, sent: true };
      } catch (err) {
        const aborted =
          signal?.aborted ||
          err?.name === 'AbortError' ||
          /abort/i.test(String(err?.message || ''));
        if (aborted) {
          removeFromQueue(id);
          refreshCount();
          return { aborted: true, queued: false, sent: false };
        }
        refreshCount();
        return { queued: true, sent: false };
      }
    },
    [refreshCount]
  );

  useEffect(() => {
    flushQueue();
    const onOnline = () => flushQueue();
    window.addEventListener('online', onOnline);
    const interval = setInterval(() => flushQueue(), 60000);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(interval);
    };
  }, [flushQueue]);

  const value = useMemo(
    () => ({
      pending,
      flushing,
      enqueueAndSend,
      flushQueue,
      refreshCount,
    }),
    [pending, flushing, enqueueAndSend, flushQueue, refreshCount]
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useOfflineQueue() {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useOfflineQueue must be used within QueueProvider');
  return ctx;
}

export default QueueContext;
