import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_MAP_CENTER } from '../utils/mapDefaults';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number') {
      map.setView([lat, lng], Math.max(map.getZoom() || 16, 16));
    }
  }, [lat, lng, map]);
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
  }, [open, initialLat, initialLng, initialLabel]);

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
        setGpsHint('已更新為 GPS 座標，可再拖曳微調');
      }
    } catch (err) {
      setGpsHint(err?.message || 'GPS 失敗，可繼續點地圖選點');
    } finally {
      setGpsLoading(false);
    }
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

  return (
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
                title="重新以 GPS 定位"
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

          <div className="leaflet-map-container">
            <MapContainer
              center={position}
              zoom={16}
              style={{ height: 280, width: '100%' }}
              key={`pin-map-${open}`}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <DraggableMarker position={position} onChange={handleChange} />
              <MapClickHandler onChange={handleChange} />
              <Recenter lat={position[0]} lng={position[1]} />
            </MapContainer>
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
              ? '拖曳標記或點擊地圖微調位置'
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
}

export default LocationMapPickerModal;
