import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatLocationLabel,
  formatRelativeTime,
  loadLocationMode,
  loadSmartLocation,
  saveLocationMode,
  saveSmartLocation,
  toMapsUrl,
} from '../utils/locationStorage';
import { getGeolocationBlockReason } from '../utils/geolocationGuard';
import { labelFromCoveringPlace } from '../utils/landmarkRegions';
import SlowGpsPrompt from '../components/SlowGpsPrompt';

const LocationContext = createContext(null);
const SLOW_GPS_MS = 3000;
const FRESH_CACHE_MS = 10 * 60 * 1000;

export function LocationProvider({ children }) {
  const [location, setLocationState] = useState(() => loadSmartLocation());
  const [locationMode, setLocationModeState] = useState(() => loadLocationMode());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [slowPrompt, setSlowPrompt] = useState(null);
  const locationRef = useRef(location);
  locationRef.current = location;
  const inflightRef = useRef(null);
  const promptOpenRef = useRef(false);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'smartLocation') {
        setLocationState(loadSmartLocation());
      }
      if (e.key === 'locationMode') {
        setLocationModeState(loadLocationMode());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setCachedLocation = useCallback((next) => {
    if (!next || typeof next.lat !== 'number' || typeof next.lng !== 'number') return;
    const payload = {
      lat: next.lat,
      lng: next.lng,
      accuracy: next.accuracy ?? null,
      updatedAt: next.updatedAt || Date.now(),
      label: next.label || labelFromCoveringPlace(next) || '',
      manual: next.manual === true,
    };
    saveSmartLocation(payload);
    setLocationState(payload);
    setError(null);
  }, []);

  const setLocationMode = useCallback((mode) => {
    const next = mode === 'live' ? 'live' : 'cache';
    saveLocationMode(next);
    setLocationModeState(next);
    if (next === 'live' && locationRef.current?.manual) {
      const cleared = { ...locationRef.current, manual: false };
      saveSmartLocation(cleared);
      setLocationState(cleared);
    }
  }, []);

  /**
   * Explicit GPS refresh.
   * @param {{ slowPromptMs?: number }} [opts] after this, ask to use cache if GPS still pending
   */
  const refreshLocation = useCallback((opts = {}) => {
    const slowPromptMs = opts.slowPromptMs;
    return new Promise((resolve, reject) => {
      const blocked = getGeolocationBlockReason();
      if (blocked) {
        setError(blocked);
        reject(new Error(blocked));
        return;
      }

      let slowTimer = null;
      const ctx = {
        settled: false,
        cached: locationRef.current,
        live: null,
        failed: false,
        resolve,
        reject,
      };
      inflightRef.current = ctx;
      promptOpenRef.current = false;

      const finish = (fn) => {
        if (ctx.settled) return;
        ctx.settled = true;
        if (slowTimer) clearTimeout(slowTimer);
        promptOpenRef.current = false;
        inflightRef.current = null;
        setIsRefreshing(false);
        setSlowPrompt(null);
        fn();
      };
      ctx.finish = finish;

      setIsRefreshing(true);
      setError(null);

      if (slowPromptMs > 0) {
        slowTimer = window.setTimeout(() => {
          if (ctx.settled) return;
          const cached = locationRef.current;
          if (!cached) return;
          promptOpenRef.current = true;
          setSlowPrompt({ cached, live: ctx.live });
        }, slowPromptMs);
      }

      const cached = locationRef.current;
      const freshMs = cached?.updatedAt ? Date.now() - cached.updatedAt : Infinity;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          const payload = {
            lat: coords.lat,
            lng: coords.lng,
            accuracy: position.coords.accuracy,
            updatedAt: Date.now(),
            label: labelFromCoveringPlace(coords),
            manual: false,
          };
          ctx.live = payload;
          if (promptOpenRef.current && !ctx.settled) {
            setSlowPrompt((prev) => ({
              cached: prev?.cached || locationRef.current,
              live: payload,
            }));
            return;
          }
          finish(() => {
            saveSmartLocation(payload);
            setLocationState(payload);
            resolve(payload);
          });
        },
        (geoError) => {
          let message = geoError?.message || '定位失敗';
          if (/permission|secure|origin/i.test(message)) {
            message =
              `${message} — 請改用 http://localhost:3000 或 HTTPS（目前：${window.location.origin}）`;
          }
          ctx.failed = true;
          const fallback = locationRef.current;
          if (promptOpenRef.current && fallback && !ctx.settled) {
            setError(message);
            setSlowPrompt((prev) => ({
              cached: prev?.cached || fallback,
              live: prev?.live || null,
            }));
            return;
          }
          if (fallback) {
            finish(() => {
              setError(message);
              resolve(fallback);
            });
            return;
          }
          finish(() => {
            setError(message);
            reject(new Error(message));
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: freshMs < 60000 ? 60000 : 0,
        }
      );
    });
  }, []);

  /** Live: GPS. Cache: reuse if fresh. Stale or missing cache: GPS once. Manual pin is never overwritten. */
  const resolveForAction = useCallback(async () => {
    const current = locationRef.current;
    if (current?.manual) return current;
    const stale = !current?.updatedAt || Date.now() - current.updatedAt > FRESH_CACHE_MS;
    if (locationMode !== 'live' && !stale) return current;
    try {
      return await refreshLocation({ slowPromptMs: SLOW_GPS_MS });
    } catch {
      return locationRef.current || current || null;
    }
  }, [locationMode, refreshLocation]);

  useEffect(() => {
    if (locationRef.current?.manual) return undefined;
    refreshLocation().catch(() => {});
  }, [refreshLocation]);

  const mapsUrl = useMemo(() => {
    if (!location) return '';
    return toMapsUrl(location.lat, location.lng, location.label);
  }, [location]);

  const statusText = useMemo(() => {
    if (!location) return '📍 尚無定位快取 — 請更新當前位置';
    return `📍 ${formatLocationLabel(location)}（${formatRelativeTime(location.updatedAt)}）`;
  }, [location]);

  const value = useMemo(
    () => ({
      location,
      locationMode,
      mapsUrl,
      statusText,
      isRefreshing,
      error,
      refreshLocation,
      resolveForAction,
      setCachedLocation,
      setLocationMode,
      hasLocation: Boolean(location),
    }),
    [
      location,
      locationMode,
      mapsUrl,
      statusText,
      isRefreshing,
      error,
      refreshLocation,
      resolveForAction,
      setCachedLocation,
      setLocationMode,
    ]
  );

  const acceptSlowCache = useCallback(() => {
    const ctx = inflightRef.current;
    const cached = slowPrompt?.cached || locationRef.current;
    if (!ctx || !cached) {
      setSlowPrompt(null);
      promptOpenRef.current = false;
      return;
    }
    saveLocationMode('cache');
    setLocationModeState('cache');
    ctx.finish(() => ctx.resolve(cached));
  }, [slowPrompt]);

  const acceptSlowLive = useCallback(() => {
    const ctx = inflightRef.current;
    const live = ctx?.live || slowPrompt?.live;
    if (!ctx || !live) return;
    ctx.finish(() => {
      saveSmartLocation(live);
      setLocationState(live);
      ctx.resolve(live);
    });
  }, [slowPrompt]);

  const dismissSlowPrompt = useCallback(() => {
    const ctx = inflightRef.current;
    if (ctx && !ctx.settled && ctx.live) {
      ctx.finish(() => {
        saveSmartLocation(ctx.live);
        setLocationState(ctx.live);
        ctx.resolve(ctx.live);
      });
      return;
    }
    if (ctx && !ctx.settled && ctx.failed) {
      const cached = locationRef.current;
      ctx.finish(() => ctx.resolve(cached || null));
      return;
    }
    promptOpenRef.current = false;
    setSlowPrompt(null);
  }, []);

  return (
    <LocationContext.Provider value={value}>
      {children}
      {slowPrompt?.cached ? (
        <SlowGpsPrompt
          cached={slowPrompt.cached}
          live={slowPrompt.live}
          onUseCache={acceptSlowCache}
          onUseLive={acceptSlowLive}
          onWait={dismissSlowPrompt}
        />
      ) : null}
    </LocationContext.Provider>
  );
}

export function useSmartLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useSmartLocation must be used within LocationProvider');
  }
  return ctx;
}
