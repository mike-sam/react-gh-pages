import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  formatLocationLabel,
  formatRelativeTime,
  loadSmartLocation,
  saveSmartLocation,
  toMapsUrl,
} from '../utils/locationStorage';
import { getGeolocationBlockReason } from '../utils/geolocationGuard';

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const [location, setLocationState] = useState(() => loadSmartLocation());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Keep in sync if another tab updates localStorage
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'smartLocation') {
        setLocationState(loadSmartLocation());
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

  /**
   * Explicit GPS refresh only — never auto-called on mount.
   */
  const refreshLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      const blocked = getGeolocationBlockReason();
      if (blocked) {
        setError(blocked);
        reject(new Error(blocked));
        return;
      }

      setIsRefreshing(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const payload = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            updatedAt: Date.now(),
            label: location?.label || '',
          };
          saveSmartLocation(payload);
          setLocationState(payload);
          setIsRefreshing(false);
          resolve(payload);
        },
        (geoError) => {
          let message = geoError?.message || '定位失敗';
          if (/permission|secure|origin/i.test(message)) {
            message =
              `${message} — 請改用 http://localhost:3000 或 HTTPS（目前：${window.location.origin}）`;
          }
          setError(message);
          setIsRefreshing(false);
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      );
    });
  }, [location?.label]);

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
      mapsUrl,
      statusText,
      isRefreshing,
      error,
      refreshLocation,
      setCachedLocation,
      hasLocation: Boolean(location),
    }),
    [location, mapsUrl, statusText, isRefreshing, error, refreshLocation, setCachedLocation]
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

export default LocationContext;
