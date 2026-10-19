import React, { useRef, useState } from 'react';
import { useSmartLocation } from '../hooks/useSmartLocation';
import LocationMapPickerModal from './LocationMapPickerModal';

const CLICK_DELAY_MS = 280;

function PinIcon() {
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
 * - Gray: no cached location
 * - Red: has location
 * - Single click: open map picker
 * - Double click: GPS refresh
 */
function LocationPinButton({ compact = false }) {
  const { location, hasLocation, isRefreshing, refreshLocation, setCachedLocation } =
    useSmartLocation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [flash, setFlash] = useState('');
  const clickTimer = useRef(null);
  const flashTimer = useRef(null);

  const showFlash = (text) => {
    setFlash(text);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(''), 2200);
  };

  const openPicker = () => setPickerOpen(true);

  const handleSingleOrDouble = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      openPicker();
    }, CLICK_DELAY_MS);
  };

  const handleDoubleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    try {
      await refreshLocation();
      showFlash('已重新定位');
    } catch {
      // GPS 失敗不阻擋：打開地圖讓使用者手動點選
      showFlash('GPS 不可用，請在地圖上點選');
      openPicker();
    }
  };

  const title = hasLocation
    ? '已定位 · 單擊修正 · 雙擊重新定位'
    : '未定位 · 單擊開地圖點選 · 雙擊嘗試 GPS';

  return (
    <>
      <button
        type="button"
        className={[
          'location-pin-btn',
          compact ? 'location-pin-btn-compact' : '',
          hasLocation ? 'is-located' : 'is-empty',
          isRefreshing ? 'is-refreshing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={handleSingleOrDouble}
        onDoubleClick={handleDoubleClick}
        title={title}
        aria-label={title}
      >
        <PinIcon />
      </button>

      {flash && (
        <span className="location-pin-toast" role="status">
          {flash}
        </span>
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
          showFlash('定位已儲存');
        }}
      />
    </>
  );
}

export default LocationPinButton;
