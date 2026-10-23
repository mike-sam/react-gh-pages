import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSmartLocation } from '../hooks/useSmartLocation';
import LocationMapPickerModal from './LocationMapPickerModal';
import { navigate, ROUTES } from '../utils/routing';

const CLICK_DELAY_MS = 280;

export function PinIcon() {
  return (
    <svg
      className="location-pin-glyph"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"
      />
    </svg>
  );
}

/**
 * Landmark pin next to theme toggle.
 * - Single click: choose cache / live GPS / map pick
 * - Double click: GPS now
 */
function LocationPinButton({ compact = false }) {
  const {
    location,
    hasLocation,
    isRefreshing,
    locationMode,
    refreshLocation,
    setCachedLocation,
    setLocationMode,
  } = useSmartLocation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [flash, setFlash] = useState('');
  const clickTimer = useRef(null);
  const flashTimer = useRef(null);
  const wrapRef = useRef(null);

  const showFlash = (text) => {
    setFlash(text);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(''), 2400);
  };

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer, true);
    return () => document.removeEventListener('pointerdown', onPointer, true);
  }, [menuOpen]);

  const handleSingleOrDouble = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      setMenuOpen((v) => !v);
    }, CLICK_DELAY_MS);
  };

  const handleDoubleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    setMenuOpen(false);
    try {
      await refreshLocation({ slowPromptMs: 3000 });
      showFlash('已重新定位');
    } catch {
      showFlash('GPS 不可用，請在地圖上點選');
      setPickerOpen(true);
    }
  };

  const pickMode = (mode) => {
    setLocationMode(mode);
    setMenuOpen(false);
    showFlash(mode === 'live' ? '之後每次操作會實時定位' : '之後操作使用快取座標');
  };

  const title = locationMode === 'live'
    ? '實時 GPS · 單擊改設定 · 雙擊立即定位'
    : hasLocation
      ? '快取定位 · 單擊改設定 · 雙擊立即定位'
      : '未定位 · 單擊設定 · 雙擊嘗試 GPS';

  return (
    <div className="location-pin-wrap" ref={wrapRef}>
      <button
        type="button"
        className={[
          'location-pin-btn',
          compact ? 'location-pin-btn-compact' : '',
          hasLocation ? 'is-located' : 'is-empty',
          locationMode === 'live' ? 'is-live' : '',
          isRefreshing ? 'is-refreshing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={handleSingleOrDouble}
        onDoubleClick={handleDoubleClick}
        title={title}
        aria-label={title}
        aria-expanded={menuOpen}
      >
        <PinIcon />
      </button>

      {menuOpen && (
        <div className="location-mode-menu" role="menu">
          <button
            type="button"
            className={`location-mode-item${locationMode === 'cache' ? ' is-active' : ''}`}
            onClick={() => pickMode('cache')}
          >
            使用快取
          </button>
          <button
            type="button"
            className={`location-mode-item${locationMode === 'live' ? ' is-active' : ''}`}
            onClick={() => pickMode('live')}
          >
            每次操作實時 GPS
          </button>
          <button
            type="button"
            className="location-mode-item"
            onClick={() => {
              setMenuOpen(false);
              setPickerOpen(true);
            }}
          >
            在地圖上點選…
          </button>
          <button
            type="button"
            className="location-mode-item"
            onClick={() => {
              setMenuOpen(false);
              navigate(ROUTES.REGIONS);
            }}
          >
            常用區域
          </button>
        </div>
      )}

      {flash &&
        createPortal(
          <div className="app-center-toast" role="status">
            {flash}
          </div>,
          document.body
        )}

      <LocationMapPickerModal
        open={pickerOpen}
        initialLat={location?.lat}
        initialLng={location?.lng}
        initialLabel={location?.label || ''}
        onClose={() => setPickerOpen(false)}
        onRefreshGps={refreshLocation}
        onSave={(next) => {
          setCachedLocation(next);
          setLocationMode('cache');
          showFlash('定位已儲存（快取）');
        }}
      />
    </div>
  );
}

export default LocationPinButton;
