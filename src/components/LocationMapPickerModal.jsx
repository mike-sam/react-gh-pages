import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_MAP_CENTER } from '../utils/mapDefaults';
import {
  DEFAULT_REGION_RADIUS_M,
  deleteLandmarkRegionLocal,
  deleteLandmarkRegionRemote,
  fetchLandmarkRegionsFromCloud,
  fetchNearbyLegacyLocations,
  isLandmarkFetchFresh,
  loadLandmarkRegions,
  matchLandmarksAt,
  mergeLandmarkRegionsFromCloud,
  newLandmarkId,
  upsertLandmarkRegionLocal,
  upsertLandmarkRegionRemote,
} from '../utils/landmarkRegions';
import { ensureAppBootstrap, isBootstrapAttemptCooling } from '../utils/appBootstrap';
import { useHistoryOverlay } from '../hooks/useHistoryOverlay';

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

function MapClickHandler({ onChange, enabled }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
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

function formatDist(m) {
  if (!Number.isFinite(m)) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

/**
 * Modal map picker: drag / tap / search + landmark region match / CRUD.
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
  useHistoryOverlay(open, onClose);

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

  const [regions, setRegions] = useState(() => loadLandmarkRegions());
  const [legacyPoints, setLegacyPoints] = useState([]);
  const [matches, setMatches] = useState([]);
  const [syncNote, setSyncNote] = useState('');
  const [syncing, setSyncing] = useState(false);

  /** null | 'create' | 'edit' */
  const [editMode, setEditMode] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const labelTouchedRef = useRef(false);
  const autoFilledIdRef = useRef(null);

  const refreshMatches = useCallback(
    (lat, lng, regionList = regions, legacy = legacyPoints) => {
      const hits = matchLandmarksAt(
        { lat, lng },
        { regions: regionList, legacyPoints: legacy }
      );
      setMatches(hits);
      return hits;
    },
    [regions, legacyPoints]
  );

  const applyMatchAutofill = useCallback((hits) => {
    if (labelTouchedRef.current) return;
    if (hits.length === 1) {
      setLabel(hits[0].name);
      autoFilledIdRef.current = hits[0].id;
      setSelectedMatchId(hits[0].id);
    } else if (hits.length === 0) {
      if (autoFilledIdRef.current) {
        setLabel('');
        autoFilledIdRef.current = null;
        setSelectedMatchId(null);
      }
    } else {
      setSelectedMatchId(null);
    }
    // ≥2: wait for user pick — don't clear if already chosen
  }, []);

  const syncFromCloud = useCallback(async ({ force = false } = {}) => {
    if (!force) ensureAppBootstrap();
    if (!force && (isLandmarkFetchFresh() || isBootstrapAttemptCooling())) {
      setSyncNote(
        isLandmarkFetchFresh() ? '地標快取仍有效（1h）' : '稍早已向雲端查過，先用本機地標'
      );
      return loadLandmarkRegions();
    }
    setSyncing(true);
    setSyncNote('同步地標中…');
    try {
      const cloud = await fetchLandmarkRegionsFromCloud();
      const merged = mergeLandmarkRegionsFromCloud(cloud);
      setRegions(merged);
      setSyncNote(`已同步 ${merged.length} 個區域地標`);
      return merged;
    } catch (err) {
      console.warn('landmark sync failed', err);
      setSyncNote('雲端同步失敗，使用本機地標');
      return loadLandmarkRegions();
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const ready =
      typeof initialLat === 'number' && typeof initialLng === 'number';
    const nextPos = [
      ready ? initialLat : DEFAULT_MAP_CENTER.lat,
      ready ? initialLng : DEFAULT_MAP_CENTER.lng,
    ];
    setPosition(nextPos);
    setLabel(initialLabel || '');
    labelTouchedRef.current = Boolean(initialLabel);
    autoFilledIdRef.current = null;
    setQuery('');
    setResults([]);
    setSearchError('');
    setGpsHint('');
    setOffMarker(false);
    setEditMode(null);
    setEditDraft(null);
    setSelectedMatchId(null);
    setFocusNonce((n) => n + 1);

    const local = loadLandmarkRegions();
    setRegions(local);
    const hits = matchLandmarksAt(
      { lat: nextPos[0], lng: nextPos[1] },
      { regions: local }
    );
    setMatches(hits);
    if (!initialLabel && hits.length === 1) {
      setLabel(hits[0].name);
      autoFilledIdRef.current = hits[0].id;
      setSelectedMatchId(hits[0].id);
    }

    let cancelled = false;
    (async () => {
      const merged = await syncFromCloud({ force: false });
      if (cancelled) return;
      try {
        const legacy = await fetchNearbyLegacyLocations(nextPos[0], nextPos[1], 0.2);
        if (cancelled) return;
        setLegacyPoints(legacy);
        const nextHits = matchLandmarksAt(
          { lat: nextPos[0], lng: nextPos[1] },
          { regions: merged, legacyPoints: legacy }
        );
        setMatches(nextHits);
        if (!labelTouchedRef.current && nextHits.length === 1) {
          setLabel(nextHits[0].name);
          autoFilledIdRef.current = nextHits[0].id;
          setSelectedMatchId(nextHits[0].id);
        }
      } catch (err) {
        console.warn('nearby legacy failed', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, initialLat, initialLng, initialLabel, syncFromCloud]);

  useEffect(() => {
    const el = returnBtnRef.current;
    if (!el) return undefined;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    return undefined;
  }, [offMarker, open]);

  const handleChange = (lat, lng) => {
    setPosition([lat, lng]);
    const hits = refreshMatches(lat, lng);
    applyMatchAutofill(hits);
    // Refresh legacy nearby in background
    fetchNearbyLegacyLocations(lat, lng, 0.2)
      .then((legacy) => {
        setLegacyPoints(legacy);
        const nextHits = matchLandmarksAt(
          { lat, lng },
          { regions, legacyPoints: legacy }
        );
        setMatches(nextHits);
        applyMatchAutofill(nextHits);
      })
      .catch(() => {});
  };

  const handleGps = async () => {
    if (!onRefreshGps) return;
    setGpsLoading(true);
    setGpsHint('');
    try {
      const coords = await onRefreshGps();
      if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        labelTouchedRef.current = false;
        setPosition([coords.lat, coords.lng]);
        setFocusNonce((n) => n + 1);
        setGpsHint('已更新為 GPS 座標，可再拖曳微調');
        const hits = refreshMatches(coords.lat, coords.lng);
        applyMatchAutofill(hits);
      }
    } catch (err) {
      setGpsHint(err?.message || 'GPS 失敗，可繼續點地圖選點');
    } finally {
      setGpsLoading(false);
    }
  };

  const returnToPin = () => setFocusNonce((n) => n + 1);

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
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
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
    labelTouchedRef.current = false;
    setPosition([item.lat, item.lng]);
    setResults([]);
    setFocusNonce((n) => n + 1);
    const hits = refreshMatches(item.lat, item.lng);
    if (hits.length === 0) {
      setLabel(item.name.split(',')[0] || item.name);
      labelTouchedRef.current = true;
    } else {
      applyMatchAutofill(hits);
    }
  };

  const pickMatch = (hit) => {
    setLabel(hit.name);
    labelTouchedRef.current = true;
    autoFilledIdRef.current = hit.id;
    setSelectedMatchId(hit.id);
  };

  const startCreateRegion = () => {
    setEditMode('create');
    setEditDraft({
      id: newLandmarkId(),
      name: label.trim() || '',
      center: { lat: position[0], lng: position[1] },
      radiusM: DEFAULT_REGION_RADIUS_M,
      vertices: [],
    });
  };

  const startEditRegion = (region) => {
    setEditMode('edit');
    setEditDraft({
      ...region,
      center: { ...region.center },
      vertices: [...(region.vertices || [])],
    });
    setPosition([region.center.lat, region.center.lng]);
    setFocusNonce((n) => n + 1);
  };

  const cancelEdit = () => {
    setEditMode(null);
    setEditDraft(null);
  };

  const saveEditDraft = async () => {
    if (!editDraft) return;
    const name = (editDraft.name || '').trim();
    if (!name) {
      setGpsHint('請輸入地標名稱');
      return;
    }
    const payload = {
      ...editDraft,
      name,
      center: { lat: position[0], lng: position[1] },
      radiusM: Math.max(10, Number(editDraft.radiusM) || DEFAULT_REGION_RADIUS_M),
      updatedAt: Date.now(),
      source: 'local',
    };
    upsertLandmarkRegionLocal(payload);
    const next = loadLandmarkRegions();
    setRegions(next);
    setLabel(name);
    labelTouchedRef.current = true;
    setEditMode(null);
    setEditDraft(null);
    setGpsHint('地標已儲存（本機）');
    const hits = matchLandmarksAt(
      { lat: position[0], lng: position[1] },
      { regions: next, legacyPoints }
    );
    setMatches(hits);
    try {
      await upsertLandmarkRegionRemote(payload);
      setGpsHint('地標已儲存並同步雲端');
    } catch (err) {
      console.warn(err);
      setGpsHint('地標已存本機，雲端同步失敗');
    }
  };

  const removeRegion = async (id) => {
    if (!id) return;
    if (!window.confirm('確定刪除此區域地標？')) return;
    deleteLandmarkRegionLocal(id);
    const next = loadLandmarkRegions();
    setRegions(next);
    setMatches(
      matchLandmarksAt(
        { lat: position[0], lng: position[1] },
        { regions: next, legacyPoints }
      )
    );
    if (editDraft?.id === id) cancelEdit();
    try {
      await deleteLandmarkRegionRemote(id);
    } catch (err) {
      console.warn(err);
    }
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

  const circlesToShow = useMemo(() => {
    if (editMode && editDraft) {
      return [
        {
          id: 'edit-draft',
          center: { lat: position[0], lng: position[1] },
          radiusM: Math.max(10, Number(editDraft.radiusM) || DEFAULT_REGION_RADIUS_M),
          editing: true,
        },
      ];
    }
    return matches.map((m) => ({
      id: m.id,
      center: m.center,
      radiusM: m.radiusM,
      editing: false,
      legacy: m.source === 'legacy',
    }));
  }, [editMode, editDraft, position, matches]);

  if (!open) return null;

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
            <button
              type="button"
              className="location-gps-btn"
              onClick={() => syncFromCloud({ force: true })}
              disabled={syncing}
              title="強制重新同步區域地標"
            >
              {syncing ? '同步中…' : '同步地標'}
            </button>
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
          {(gpsHint || syncNote) && (
            <div className="location-gps-hint">
              {gpsHint || syncNote}
            </div>
          )}

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
              {circlesToShow.map((c) => (
                <Circle
                  key={c.id}
                  center={[c.center.lat, c.center.lng]}
                  radius={c.radiusM}
                  pathOptions={{
                    color: c.editing ? '#1a73e8' : c.legacy ? '#f9ab00' : '#34a853',
                    fillColor: c.editing ? '#1a73e8' : c.legacy ? '#f9ab00' : '#34a853',
                    fillOpacity: c.editing ? 0.18 : 0.12,
                    weight: c.legacy ? 1.5 : 2,
                    dashArray: c.legacy ? '4 4' : undefined,
                  }}
                />
              ))}
              <DraggableMarker position={position} onChange={handleChange} />
              <MapClickHandler onChange={handleChange} enabled />
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

          {/* Match results */}
          <div className="landmark-match-block">
            <div className="landmark-match-head">
              <span className="entry-field-label" style={{ margin: 0 }}>
                命中地標
              </span>
              <span className="landmark-match-count">
                {matches.length === 0
                  ? '無'
                  : matches.length === 1
                    ? '1 個（已自動帶入）'
                    : `${matches.length} 個（請選擇）`}
              </span>
            </div>
            {matches.length >= 2 && (
              <ul className="landmark-match-list">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={`landmark-match-item${selectedMatchId === m.id || label === m.name ? ' is-active' : ''}`}
                      onClick={() => pickMatch(m)}
                    >
                      <span className="landmark-match-name">{m.name}</span>
                      <span className="landmark-match-meta">
                        {formatDist(m.distanceM)}
                        {m.source === 'legacy' ? ' · 單點' : ` · ${m.radiusM}m`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {matches.length === 1 && (
              <div className="landmark-match-single">
                {matches[0].name}
                <span className="landmark-match-meta">
                  {' '}
                  · {formatDist(matches[0].distanceM)}
                </span>
              </div>
            )}
          </div>

          <input
            className="entry-text-input"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              labelTouchedRef.current = true;
            }}
            placeholder="地點名稱（可選）"
          />

          {/* Region editor */}
          {editMode && editDraft ? (
            <div className="landmark-edit-panel">
              <div className="landmark-edit-title">
                {editMode === 'create' ? '新增區域地標' : '編輯區域地標'}
              </div>
              <p className="landmark-edit-hint">
                地圖標記為中心點；拖曳標記可調整中心。
              </p>
              <input
                className="entry-text-input"
                value={editDraft.name}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="地標名稱（如：Pavilion KL）"
              />
              <label className="landmark-radius-label">
                半徑 {Math.round(editDraft.radiusM)} m
                <input
                  type="range"
                  min={30}
                  max={800}
                  step={10}
                  value={editDraft.radiusM}
                  onChange={(e) =>
                    setEditDraft((d) => ({
                      ...d,
                      radiusM: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <div className="landmark-edit-actions">
                <button type="button" className="cancel-btn" onClick={cancelEdit}>
                  取消
                </button>
                {editMode === 'edit' && (
                  <button
                    type="button"
                    className="landmark-delete-btn"
                    onClick={() => removeRegion(editDraft.id)}
                  >
                    刪除
                  </button>
                )}
                <button type="button" className="confirm-btn" onClick={saveEditDraft}>
                  儲存地標
                </button>
              </div>
            </div>
          ) : (
            <div className="landmark-manage-row">
              <button
                type="button"
                className="landmark-manage-btn"
                onClick={startCreateRegion}
              >
                ＋ 以目前標記新增區域
              </button>
              {matches.filter((m) => m.source !== 'legacy').length > 0 && (
                <button
                  type="button"
                  className="landmark-manage-btn"
                  onClick={() => {
                    const first = matches.find((m) => m.source !== 'legacy');
                    if (first) startEditRegion(first);
                  }}
                >
                  編輯命中區域
                </button>
              )}
            </div>
          )}

          {!editMode && regions.length > 0 && (
            <details className="landmark-all-list">
              <summary>全部區域地標（{regions.length}）</summary>
              <ul>
                {regions.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="landmark-all-item"
                      onClick={() => startEditRegion(r)}
                    >
                      <span>{r.name}</span>
                      <span className="landmark-match-meta">{r.radiusM}m</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="map-hint">
            {hasInitial
              ? '拖曳標記或點擊地圖微調 · 落在區域內會自動帶名稱'
              : '無 GPS 也可繼續：點地圖／搜尋後選點，或新增區域地標'}
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

  return createPortal(modal, document.body);
}

export default LocationMapPickerModal;
