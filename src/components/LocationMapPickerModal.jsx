import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_MAP_CENTER } from '../utils/mapDefaults';
import {
  fetchLandmarkRegionsFromCloud,
  fetchNearbyLegacyLocations,
  formatDist,
  isLandmarkFetchFresh,
  landmarksAround,
  loadLandmarkRegions,
  mergeLandmarkRegionsFromCloud,
  rememberNamedPoint,
  searchLocalLandmarks,
  upsertLandmarkRegionRemote,
  searchNominatim,
  shapeMeta,
} from '../utils/landmarkRegions';
import { ensureAppBootstrap, isBootstrapAttemptCooling } from '../utils/appBootstrap';
import { useHistoryOverlay } from '../hooks/useHistoryOverlay';
import {
  DEFAULT_ZOOM,
  DraggableMarker,
  MapEditClick,
  MAX_ZOOM,
  OffMarkerWatcher,
  Recenter,
  RegionShape,
  ReturnPinButton,
  TILES,
  openInGoogleMaps,
} from './map/LeafletBits';

const LEGACY_NEARBY_KM = 0.2;

/**
 * Pick-only map: drag / tap / search. Names come from known regions when the pin is inside.
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
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const labelTouchedRef = useRef(false);
  const autoFilledIdRef = useRef(null);

  const refreshMatches = useCallback(
    (lat, lng, regionList = regions, legacy = legacyPoints) => {
      const hits = landmarksAround(
        { lat, lng },
        { regions: regionList, legacyPoints: legacy }
      );
      setMatches(hits);
      return hits;
    },
    [regions, legacyPoints]
  );

  const applyMatchAutofill = useCallback((hits) => {
    const inside = (hits || []).filter((h) => h.inside);
    if (labelTouchedRef.current) return;
    if (inside.length >= 1) {
      setLabel(inside[0].name);
      autoFilledIdRef.current = inside[0].id;
      setSelectedMatchId(inside[0].id);
    } else if (autoFilledIdRef.current) {
      setLabel('');
      autoFilledIdRef.current = null;
      setSelectedMatchId(null);
    }
  }, []);

  const syncFromCloud = useCallback(async ({ force = false } = {}) => {
    if (!force) ensureAppBootstrap();
    if (!force && (isLandmarkFetchFresh() || isBootstrapAttemptCooling())) {
      return loadLandmarkRegions();
    }
    try {
      const cloud = await fetchLandmarkRegionsFromCloud();
      const merged = mergeLandmarkRegionsFromCloud(cloud);
      setRegions(merged);
      return merged;
    } catch (err) {
      console.warn('landmark sync failed', err);
      return loadLandmarkRegions();
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
    setSelectedMatchId(null);
    setFocusNonce((n) => n + 1);

    const local = loadLandmarkRegions();
    setRegions(local);
    const hits = landmarksAround(
      { lat: nextPos[0], lng: nextPos[1] },
      { regions: local }
    );
    setMatches(hits);
    const inside = hits.filter((h) => h.inside);
    if (!initialLabel && inside.length >= 1) {
      setLabel(inside[0].name);
      autoFilledIdRef.current = inside[0].id;
      setSelectedMatchId(inside[0].id);
    }

    let cancelled = false;
    (async () => {
      const merged = await syncFromCloud({ force: false });
      if (cancelled) return;
      try {
        const legacy = await fetchNearbyLegacyLocations(
          nextPos[0],
          nextPos[1],
          LEGACY_NEARBY_KM
        );
        if (cancelled) return;
        setLegacyPoints(legacy);
        const nextHits = landmarksAround(
          { lat: nextPos[0], lng: nextPos[1] },
          { regions: merged, legacyPoints: legacy }
        );
        setMatches(nextHits);
        applyMatchAutofill(nextHits);
      } catch (err) {
        console.warn('nearby legacy failed', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, initialLat, initialLng, initialLabel, syncFromCloud, applyMatchAutofill]);

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
    fetchNearbyLegacyLocations(lat, lng, LEGACY_NEARBY_KM)
      .then((legacy) => {
        setLegacyPoints(legacy);
        const nextHits = landmarksAround(
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
    const local = searchLocalLandmarks(q, regions).map((r) => ({
      kind: 'landmark',
      id: r.id,
      lat: r.center.lat,
      lng: r.center.lng,
      name: r.name,
    }));
    let mapHits = [];
    try {
      mapHits = await searchNominatim(q);
    } catch (err) {
      if (local.length === 0) {
        setSearchError(err.message || '搜尋失敗');
        setSearching(false);
        return;
      }
    }
    const next = [...local, ...mapHits];
    if (next.length === 0) setSearchError('找不到結果');
    else setResults(next);
    setSearching(false);
  };

  const pickResult = (item) => {
    setPosition([item.lat, item.lng]);
    setResults([]);
    setFocusNonce((n) => n + 1);
    const hits = refreshMatches(item.lat, item.lng);
    if (item.kind === 'landmark') {
      setLabel(item.name);
      labelTouchedRef.current = true;
      autoFilledIdRef.current = item.id;
      setSelectedMatchId(item.id);
      return;
    }
    labelTouchedRef.current = false;
    const inside = hits.filter((h) => h.inside);
    if (inside.length === 0) {
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

  const handleConfirm = () => {
    const name = label.trim();
    if (name) {
      const saved = rememberNamedPoint({
        lat: position[0],
        lng: position[1],
        name,
      });
      if (saved) {
        upsertLandmarkRegionRemote(saved).catch(() => {});
      }
    }
    onSave?.({
      lat: position[0],
      lng: position[1],
      label: name,
      updatedAt: Date.now(),
      accuracy: null,
    });
    onClose?.();
  };

  const shapesToShow = useMemo(
    () =>
      matches.map((m) => ({
        ...m,
        editing: false,
        nearby: !m.inside,
        legacy: m.source === 'legacy',
      })),
    [matches]
  );

  const insideHits = matches.filter((m) => m.inside);
  const nearbyHits = matches.filter((m) => !m.inside).slice(0, 5);

  if (!open) return null;

  const tile = TILES[basemap] || TILES.street;

  const renderMatchList = (list) => (
    <ul className="landmark-match-list">
      {list.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            className={`landmark-match-item${selectedMatchId === m.id || label === m.name ? ' is-active' : ''}`}
            onClick={() => pickMatch(m)}
          >
            <span className="landmark-match-name">{m.name}</span>
            <span className="landmark-match-meta">
              {m.inside ? '內' : '附近'} · {formatDist(m.distanceM)}
              {m.source === 'legacy' ? ' · 單點' : ` · ${shapeMeta(m)}`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

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
              placeholder="搜尋地圖或地標"
            />
            <button type="submit" className="location-search-btn" disabled={searching}>
              {searching ? '…' : '搜尋'}
            </button>
          </form>
          {searchError && <div className="location-search-error">{searchError}</div>}
          {results.length > 0 && (
            <ul className="location-search-results">
              {results.map((item, idx) => (
                <li key={`${item.kind}-${item.lat}-${item.lng}-${idx}`}>
                  <button type="button" onClick={() => pickResult(item)}>
                    <span
                      className={`location-search-kind${item.kind === 'landmark' ? ' is-landmark' : ''}`}
                    >
                      {item.kind === 'landmark' ? '地標' : '地圖'}
                    </span>
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
              {shapesToShow.map((c) => (
                <RegionShape
                  key={c.id}
                  region={c}
                  editing={c.editing}
                  nearby={c.nearby}
                />
              ))}
              <DraggableMarker position={position} onChange={handleChange} />
              <MapEditClick polygonMode={false} onPin={handleChange} />
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
              <ReturnPinButton buttonRef={returnBtnRef} onClick={returnToPin} />
            )}
          </div>

          <div className="coordinates-display">
            <span>{position[0].toFixed(6)}</span>
            <span>{position[1].toFixed(6)}</span>
          </div>

          {(insideHits.length > 0 || nearbyHits.length > 0) && (
            <div className="landmark-match-block">
              <div className="landmark-match-head">
                <span className="entry-field-label" style={{ margin: 0 }}>
                  地標
                </span>
                <span className="landmark-match-count">
                  {insideHits.length === 0
                    ? '附近'
                    : insideHits.length === 1
                      ? '已帶入'
                      : `${insideHits.length} 個`}
                </span>
              </div>
              {insideHits.length > 0 && renderMatchList(insideHits)}
              {nearbyHits.length > 0 && (
                <>
                  {insideHits.length > 0 ? (
                    <div className="landmark-match-subhead">附近</div>
                  ) : null}
                  {renderMatchList(nearbyHits)}
                </>
              )}
            </div>
          )}

          <input
            className="entry-text-input"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              labelTouchedRef.current = true;
            }}
            placeholder="地點名稱（可選）"
          />

          <div className="map-hint">
            {hasInitial ? '拖曳標記或點擊地圖微調' : '點地圖或搜尋後選點'}
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
