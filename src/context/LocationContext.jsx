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
import { labelFromLandmarks } from '../utils/landmarkRegions';

const LocationContext = createContext(null);
const SLOW_GPS_MS = 3000;

export function LocationProvider({ children }) {
  const [location, setLocationState] = useState(() => loadSmartLocation());
  const [locationMode, setLocationModeState] = useState(() => loadLocationMode());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const locationRef = useRef(location);
  locationRef.current = location;

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
      label: next.label || '',
    };
    saveSmartLocation(payload);
    setLocationState(payload);
    setError(null);
  }, []);

  const setLocationMode = useCallback((mode) => {
    const next = mode === 'live' ? 'live' : 'cache';
    saveLocationMode(next);
    setLocationModeState(next);
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

      let settled = false;
      let slowTimer = null;
      const finish = (fn) => {
        if (settled) return;
        settled = true;
        if (slowTimer) clearTimeout(slowTimer);
        setIsRefreshing(false);
        fn();
      };

      setIsRefreshing(true);
      setError(null);

      if (slowPromptMs > 0) {
        slowTimer = window.setTimeout(() => {
          if (settled) return;
          const cached = locationRef.current;
          if (!cached) return;
          const useCache = window.confirm('定位已超過 3 秒，改成使用快取？');
          if (useCache) {
            saveLocationMode('cache');
            setLocationModeState('cache');
            finish(() => resolve(cached));
          }
        }, slowPromptMs);
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const payload = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            updatedAt: Date.now(),
            label: labelFromLandmarks({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }),
          };
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
          const cached = locationRef.current;
          if (cached) {
            finish(() => {
              setError(message);
              resolve(cached);
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
          maximumAge: 0,
        }
      );
    });
  }, []);

  /** Live mode: GPS (3s 後可改快取). Cache mode: last known, no wait. */
  const resolveForAction = useCallback(async () => {
    if (locationMode !== 'live') {
      return locationRef.current || null;
    }
    try {
      return await refreshLocation({ slowPromptMs: SLOW_GPS_MS });
    } catch {
      return locationRef.current || null;
    }
  }, [locationMode, refreshLocation]);

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

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useSmartLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useSmartLocation must be used within LocationProvider');
  }
  return ctx;
}
