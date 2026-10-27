import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_ENDPOINTS } from '../config';
import {
  enqueueItem,
  loadQueue,
  queueLength,
  rememberUnconfirmed,
  removeFromQueue,
  restoreUnconfirmedToQueue,
} from '../utils/offlineQueue';
import { buildCalendarTrackUrlFromPayload, stampCalendarTimestamp } from '../utils/calendarTrackUrl';
import { markBootstrapDirty } from '../utils/appBootstrap';

const QueueContext = createContext(null);

async function postPayload(payload, signal) {
  if (payload.action === 'trackCalendar') {
    const url = buildCalendarTrackUrlFromPayload(payload);
    if (!url) throw new Error('缺少行事曆端點');
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-cache',
      credentials: 'omit',
      signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!data) {
      throw new Error(text.slice(0, 180) || `HTTP ${res.status}`);
    }
    if (data.success === false) {
      throw new Error(data.error || 'trackCalendar 失敗');
    }
    return data;
  }

  const endpoint =
    payload.action === 'parkLocation' || payload.action === 'save_parking'
      ? API_ENDPOINTS.PARK_LOCATION || API_ENDPOINTS.GSHEET_SUBMIT
      : API_ENDPOINTS.GSHEET_SUBMIT; // upsertExpense / obligations share this exec

  // no-cors: opaque ok = request left device; only network fail throws
  await fetch(endpoint, {
    method: 'POST',
    mode: 'no-cors',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    signal,
  });
  return null;
}

export function QueueProvider({ children }) {
  const [pending, setPending] = useState(() => queueLength());
  const [flushing, setFlushing] = useState(false);

  const refreshCount = useCallback(() => {
    setPending(queueLength());
  }, []);

  useEffect(() => {
    restoreUnconfirmedToQueue();
    refreshCount();
  }, [refreshCount]);

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
          rememberUnconfirmed(item);
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
      if (body.action === 'trackCalendar') {
        const missingStamp =
          body.timestamp == null || String(body.timestamp).trim() === '';
        if (missingStamp) {
          const now = new Date();
          body.timestamp = stampCalendarTimestamp(now);
          if (body.timestampMs == null || body.timestampMs === '') {
            body.timestampMs = now.getTime();
          }
        }
      }

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
        const data = await postPayload(body, signal);
        // JSON success is confirmed — do not restore-and-resend on next boot.
        if (!data || data.success === false) {
          rememberUnconfirmed({
            id,
            action: body.action || 'expense',
            payload: body,
            enqueuedAt: Date.now(),
          });
        }
        removeFromQueue(id);
        refreshCount();
        markBootstrapDirty();
        return { queued: false, sent: true, data };
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
