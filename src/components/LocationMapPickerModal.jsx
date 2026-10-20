import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_MAP_CENTER } from '../utils/mapDefaults';

const MAX_ZOOM = 19;
const DEFAULT_ZOOM = 16;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const TILES = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    subdomains: ['a', 'b', 'c'],
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    subdomains: [],
  },
};

function Recenter({ lat, lng, focusNonce }) {
  const map = useMap();
  const prevNonce = useRef(focusNonce);
  const didInit = useRef(false);

  useEffect(() => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    const bumped = focusNonce != null && focusNonce !== prevNonce.current;
    prevNonce.current = focusNonce;
    if (bumped) {
      map.flyTo([lat, lng], Math.max(map.getZoom() || DEFAULT_ZOOM, DEFAULT_ZOOM), {
        duration: 0.45,
      });
      didInit.current = true;
      return;
    }
    if (!didInit.current) {
      map.setView([lat, lng], DEFAULT_ZOOM);
      didInit.current = true;
    }
  }, [lat, lng, focusNonce, map]);

  return null;
}

function DraggableMarker({ position, onChange }) {
  const markerRef = useRef(null);
  return (
    <Marker
      draggable
      position={position}
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const marker = markerRef.current;
          if (!marker) return;
          const { lat, lng } = marker.getLatLng();
          onChange(lat, lng);
        },
      }}
    />
  );
}

function MapClickHandler({ onChange }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function OffMarkerWatcher({ lat, lng, onOffChange }) {
  const map = useMap();
  const check = () => {
    try {
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        onOffChange(false);
        return;
      }
      const size = map.getSize?.();
      if (!size || size.x < 2 || size.y < 2) {
        onOffChange(false);
        return;
      }
      const bounds = map.getBounds();
      if (!bounds || (typeof bounds.isValid === 'function' && !bounds.isValid())) {
        onOffChange(false);
        return;
      }
      onOffChange(!bounds.contains([lat, lng]));
    } catch {
      onOffChange(false);
    }
  };

  useMapEvents({
    moveend: check,
    zoomend: check,
  });

  useEffect(() => {
    check();
  }, [lat, lng, map]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function openInGoogleMaps(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return;
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    '_blank',
    'noopener,noreferrer'
  );
}

/**
 * Modal map picker: drag / tap / search (Nominatim), then confirm save.
 */
function LocationMapPickerModal({
  open,
  initialLat,
  initialLng,
  initialLabel = '',
  onClose,
  onSave,
  onRefreshGps,
}) {
  const hasInitial =
    typeof initialLat === 'number' && typeof initialLng === 'number';
  const [position, setPosition] = useState(() => [
    hasInitial ? initialLat : DEFAULT_MAP_CENTER.lat,
    hasInitial ? initialLng : DEFAULT_MAP_CENTER.lng,
  ]);
  const [label, setLabel] = useState(initialLabel || '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsHint, setGpsHint] = useState('');
  const [basemap, setBasemap] = useState('street');
  const [focusNonce, setFocusNonce] = useState(0);
  const [offMarker, setOffMarker] = useState(false);
  const returnBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const ready =
      typeof initialLat === 'number' && typeof initialLng === 'number';
    setPosition([
      ready ? initialLat : DEFAULT_MAP_CENTER.lat,
      ready ? initialLng : DEFAULT_MAP_CENTER.lng,
    ]);
    setLabel(initialLabel || '');
    setQuery('');
    setResults([]);
    setSearchError('');
    setGpsHint('');
    setOffMarker(false);
    setFocusNonce((n) => n + 1);
  }, [open, initialLat, initialLng, initialLabel]);

  useEffect(() => {
    const el = returnBtnRef.current;
    if (!el) return undefined;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    return undefined;
  }, [offMarker, open]);

  if (!open) return null;

  const handleChange = (lat, lng) => {
    setPosition([lat, lng]);
  };

  const handleGps = async () => {
    if (!onRefreshGps) return;
    setGpsLoading(true);
    setGpsHint('');
    try {
      const coords = await onRefreshGps();
      if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        setPosition([coords.lat, coords.lng]);
        if (coords.label) setLabel(coords.label);
        setFocusNonce((n) => n + 1);
        setGpsHint('已更新為 GPS 座標，可再拖曳微調');
      }
    } catch (err) {
      setGpsHint(err?.message || 'GPS 失敗，可繼續點地圖選點');
    } finally {
      setGpsLoading(false);
    }
  };

  const returnToPin = () => {
    setFocusNonce((n) => n + 1);
  };

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setResults([]);
    try {
      const url =
        'https://nominatim.openstreetmap.org/search?' +
        new URLSearchParams({
          format: 'json',
          q,
          limit: '6',
          addressdetails: '0',
        }).toString();
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error('搜尋失敗');
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setSearchError('找不到結果');
        return;
      }
      setResults(
        data.map((item) => ({
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          name: item.display_name || q,
        }))
      );
    } catch (err) {
      setSearchError(err.message || '搜尋失敗');
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (item) => {
    setPosition([item.lat, item.lng]);
    setLabel(item.name.split(',')[0] || item.name);
    setResults([]);
    setFocusNonce((n) => n + 1);
  };

  const handleConfirm = () => {
    onSave?.({
      lat: position[0],
      lng: position[1],
      label: label.trim(),
      updatedAt: Date.now(),
      accuracy: null,
    });
    onClose?.();
  };

  const tile = TILES[basemap] || TILES.street;

  const modal = (
    <div
      className="map-editor-overlay location-pin-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="map-editor location-pin-editor">
        <div className="map-editor-header">
          <h4>修正定位</h4>
          <div className="map-editor-header-actions">
            {onRefreshGps && (
              <button
                type="button"
                className="location-gps-btn"
                onClick={handleGps}
                disabled={gpsLoading}
                title="重新以 GPS 定位並移到標記"
              >
                {gpsLoading ? '定位中…' : '📍 GPS'}
              </button>
            )}
            <button type="button" className="close-btn" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <div className="map-editor-content">
          {gpsHint && <div className="location-gps-hint">{gpsHint}</div>}
          <form className="location-search-form" onSubmit={handleSearch}>
            <input
              className="entry-text-input location-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋地點（如：KLCC、家附近店名）"
            />
            <button type="submit" className="location-search-btn" disabled={searching}>
              {searching ? '…' : '搜尋'}
            </button>
          </form>
          {searchError && <div className="location-search-error">{searchError}</div>}
          {results.length > 0 && (
            <ul className="location-search-results">
              {results.map((item, idx) => (
                <li key={`${item.lat}-${item.lng}-${idx}`}>
                  <button type="button" onClick={() => pickResult(item)}>
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="leaflet-map-container location-picker-map">
            <div className="parking-map-basemap" role="group" aria-label="地圖類型">
              <button
                type="button"
                className={`parking-map-basemap-btn${basemap === 'street' ? ' is-active' : ''}`}
                onClick={() => setBasemap('street')}
                aria-pressed={basemap === 'street'}
              >
                簡約
              </button>
              <button
                type="button"
                className={`parking-map-basemap-btn${basemap === 'satellite' ? ' is-active' : ''}`}
                onClick={() => setBasemap('satellite')}
                aria-pressed={basemap === 'satellite'}
              >
                衛星
              </button>
            </div>

            <div className="parking-map-actions" role="group" aria-label="地圖檢視">
              <button
                type="button"
                className="parking-map-action-btn"
                onClick={returnToPin}
                title="視角返回目前標記"
              >
                返回定位
              </button>
              <button
                type="button"
                className="parking-map-action-btn"
                onClick={() => openInGoogleMaps(position[0], position[1])}
                title="用 Google Maps 開啟標記位置"
              >
                Google Maps
              </button>
            </div>

            <MapContainer
              center={position}
              zoom={DEFAULT_ZOOM}
              maxZoom={MAX_ZOOM}
              style={{ height: 280, width: '100%' }}
              key={`pin-map-${open}`}
              zoomControl={false}
              scrollWheelZoom
              doubleClickZoom
              touchZoom
              dragging
            >
              <TileLayer
                key={basemap}
                attribution={tile.attribution}
                url={tile.url}
                subdomains={tile.subdomains}
                maxZoom={MAX_ZOOM}
              />
              <ZoomControl position="bottomright" />
              <DraggableMarker position={position} onChange={handleChange} />
              <MapClickHandler onChange={handleChange} />
              <OffMarkerWatcher
                lat={position[0]}
                lng={position[1]}
                onOffChange={setOffMarker}
              />
              <Recenter
                lat={position[0]}
                lng={position[1]}
                focusNonce={focusNonce}
              />
            </MapContainer>

            {offMarker && (
              <button
                ref={returnBtnRef}
                type="button"
                className="parking-map-return-pin"
                title="視角返回標記（不改座標）"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  returnToPin();
                }}
              >
                返回定位
              </button>
            )}
          </div>

          <div className="coordinates-display">
            <span>{position[0].toFixed(6)}</span>
            <span>{position[1].toFixed(6)}</span>
          </div>

          <input
            className="entry-text-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="地點名稱（可選）"
          />

          <div className="map-hint">
            {hasInitial
              ? '拖曳標記或點擊地圖微調 · 可切換簡約／衛星'
              : '無 GPS 也可繼續：直接點地圖或搜尋後選點，再按儲存'}
          </div>
        </div>

        <div className="map-editor-actions">
          <button type="button" className="cancel-btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="confirm-btn" onClick={handleConfirm}>
            儲存定位
          </button>
        </div>
      </div>
    </div>
  );

  // Portal to body so sticky header stacking (z-index 200) cannot trap the overlay
  // under Leaflet panes from the parking map.
  return createPortal(modal, document.body);
}

export default LocationMapPickerModal;
