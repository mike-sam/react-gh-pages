import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_MAP_CENTER } from '../utils/mapDefaults';
import {
  distanceMeters,
  formatDist,
  isNamedPoint,
  isSheetPlace,
  landmarksAround,
  loadLandmarkRegions,
  loadSheetPlaces,
  mergePlaceCatalog,
  rememberNamedPoint,
  searchLocalLandmarks,
  searchNominatim,
} from '../utils/landmarkRegions';
import { useHistoryOverlay } from '../hooks/useHistoryOverlay';
import { applyHash, clearHistoryOverlays, getHashPath, hrefFor, ROUTES } from '../utils/routing';
import {
  DEFAULT_ZOOM,
  DraggableMarker,
  MapEditClick,
  MAX_ZOOM,
  OffMarkerWatcher,
  Recenter,
  RegionShape,
  ReturnPinButton,
  tilesFor,
  openInGoogleMaps,
} from './map/LeafletBits';

const SAVED_LIST_CAP = 80;
const SAVED_SORTS = [
  { id: 'near', label: '距離' },
  { id: 'name', label: '名稱' },
  { id: 'recent', label: '最近' },
];

/**
 * Pick-only map: drag / tap / search. Names come from saved 地標 pins, not 區域.
 */
function LocationMapPickerModal({
  open,
  initialLat,
  initialLng,
  initialLabel = '',
  onClose,
  onSave,
  onRefreshGps,
  requestGps = 0,
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
  const [sheetPlaces, setSheetPlaces] = useState(() => loadSheetPlaces());
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [savedQuery, setSavedQuery] = useState('');
  const [savedSort, setSavedSort] = useState('near');
  const [manageHint, setManageHint] = useState('');
  const labelTouchedRef = useRef(false);
  const autoFilledIdRef = useRef(null);
  const positionRef = useRef(position);
  positionRef.current = position;

  const pointCatalog = useMemo(
    () => mergePlaceCatalog(regions, sheetPlaces).filter(isNamedPoint),
    [regions, sheetPlaces]
  );

  const refreshMatches = useCallback(
    (lat, lng, catalog = pointCatalog) => {
      const hits = landmarksAround(
        { lat, lng },
        { regions: catalog.filter(isNamedPoint), nearbyM: 2500 }
      );
      setMatches(hits);
      return hits;
    },
    [pointCatalog]
  );

  const applyMatchAutofill = useCallback((hits, { force = false } = {}) => {
    if (labelTouchedRef.current && !force) return;
    const inside = (hits || []).filter((h) => h.inside);
    if (inside.length >= 1) {
      setLabel(inside[0].name);
      autoFilledIdRef.current = inside[0].id;
      setSelectedMatchId(inside[0].id);
      return;
    }
    if (force || autoFilledIdRef.current) {
      setLabel('');
      autoFilledIdRef.current = null;
      setSelectedMatchId(null);
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
    setSavedQuery('');
    setSavedSort('near');
    setManageHint('');
    setFocusNonce((n) => n + 1);

    const local = loadLandmarkRegions();
    const sheet = loadSheetPlaces();
    setRegions(local);
    setSheetPlaces(sheet);
    const localPts = [...local.filter(isNamedPoint), ...sheet];
    const hits = landmarksAround(
      { lat: nextPos[0], lng: nextPos[1] },
      { regions: localPts, nearbyM: 2500 }
    );
    setMatches(hits);
    const inside = hits.filter((h) => h.inside);
    if (!initialLabel && inside.length >= 1) {
      setLabel(inside[0].name);
      autoFilledIdRef.current = inside[0].id;
      setSelectedMatchId(inside[0].id);
    }
  }, [open, initialLat, initialLng, initialLabel]);

  useEffect(() => {
    if (!open) return;
    const [lat, lng] = positionRef.current;
    refreshMatches(lat, lng);
  }, [open, pointCatalog, refreshMatches]);

  useEffect(() => {
    const el = returnBtnRef.current;
    if (!el) return undefined;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    return undefined;
  }, [offMarker, open]);

  const handleChange = (lat, lng) => {
    setPosition([lat, lng]);
    applyMatchAutofill(refreshMatches(lat, lng));
  };

  const handleGps = async () => {
    if (!onRefreshGps) return;
    setGpsLoading(true);
    setGpsHint('');
    try {
      const coords = await onRefreshGps();
      if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        labelTouchedRef.current = false;
        autoFilledIdRef.current = null;
        setSelectedMatchId(null);
        setPosition([coords.lat, coords.lng]);
        setFocusNonce((n) => n + 1);
        setGpsHint('已更新為目前位置，可再拖曳微調');
        const hits = refreshMatches(coords.lat, coords.lng);
        applyMatchAutofill(hits, { force: true });
      }
    } catch (err) {
      setGpsHint(err?.message || 'GPS 失敗，可繼續點地圖選點');
    } finally {
      setGpsLoading(false);
    }
  };

  const gpsRequestRef = useRef(0);
  useEffect(() => {
    if (!open || !requestGps || requestGps === gpsRequestRef.current) return undefined;
    gpsRequestRef.current = requestGps;
    handleGps();
    return undefined;
  }, [open, requestGps]);

  const returnToPin = () => setFocusNonce((n) => n + 1);

  const jumpToRegions = (e) => {
    e?.preventDefault?.();
    const fromHome = getHashPath() === ROUTES.HOME || window.history.state?.fromHome;
    clearHistoryOverlays();
    applyHash(hrefFor(ROUTES.REGIONS, { kind: 'point' }), {
      replace: true,
      skipGuard: true,
      state: fromHome ? { fromHome: true } : null,
    });
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSearchError('');
  };

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    const q = query.trim();
    if (!q) {
      clearSearch();
      return;
    }
    setSearching(true);
    setSearchError('');
    setResults([]);
    const local = searchLocalLandmarks(q, pointCatalog).map((r) => ({
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
      const hit = pointCatalog.find((p) => p.id === item.id) || {
        id: item.id,
        name: item.name,
        center: { lat: item.lat, lng: item.lng },
      };
      selectPlace(hit);
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

  const selectPlace = (hit) => {
    if (!hit?.center) return;
    setPosition([hit.center.lat, hit.center.lng]);
    setFocusNonce((n) => n + 1);
    pickMatch(hit);
    refreshMatches(hit.center.lat, hit.center.lng);
    setManageHint(`所屬：${hit.name}`);
  };

  const handleConfirm = () => {
    const name = label.trim();
    if (name && !selectedMatchId) {
      rememberNamedPoint({
        lat: position[0],
        lng: position[1],
        name,
      });
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
      matches
        .filter(isNamedPoint)
        .filter((m) => m.id !== selectedMatchId)
        .map((m) => ({
          ...m,
          editing: false,
          nearby: !m.inside,
          legacy: isSheetPlace(m),
        })),
    [matches, selectedMatchId]
  );

  const savedList = useMemo(() => {
    const q = savedQuery.trim().toLowerCase();
    const here = { lat: position[0], lng: position[1] };
    let list = pointCatalog.map((r) => ({
      ...r,
      distanceM: distanceMeters(here, r.center),
      inside: matches.some((m) => m.id === r.id && m.inside),
    }));
    if (q) {
      list = list.filter((r) => String(r.name || '').toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (savedSort === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
      }
      if (savedSort === 'recent') return (b.updatedAt || 0) - (a.updatedAt || 0);
      if (a.inside !== b.inside) return Number(b.inside) - Number(a.inside);
      return a.distanceM - b.distanceM;
    });
    return list;
  }, [pointCatalog, position, savedQuery, savedSort, matches]);

  const visibleSaved = savedQuery.trim() ? savedList : savedList.slice(0, SAVED_LIST_CAP);

  if (!open) return null;

  const tile = tilesFor(basemap);

  const renderSavedList = (list) => (
    <ul className="landmark-match-list saved-places-list">
      {list.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            className={`landmark-match-item${selectedMatchId === m.id ? ' is-active' : ''}`}
            title="選為所屬地點"
            onClick={() => selectPlace(m)}
          >
            <span className="landmark-match-name">{m.name}</span>
            <span className="landmark-match-meta">{formatDist(m.distanceM)}</span>
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
                {gpsLoading ? '定位中…' : '定位目前位置'}
              </button>
            )}
            <a
              href={hrefFor(ROUTES.REGIONS, { kind: 'point' })}
              className="location-gps-btn"
              title="地圖管理"
              onClick={jumpToRegions}
            >
              地圖管理
            </a>
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
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                if (!v.trim()) {
                  setResults([]);
                  setSearchError('');
                }
              }}
              placeholder="搜尋地圖或地標"
            />
            {query.trim() || results.length > 0 || searchError ? (
              <button type="button" className="location-search-clear" onClick={clearSearch}>
                清空
              </button>
            ) : null}
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
              {onRefreshGps && (
                <button
                  type="button"
                  className="parking-map-action-btn is-locate"
                  onClick={handleGps}
                  disabled={gpsLoading}
                  title="用 GPS 把標記移到目前位置"
                >
                  {gpsLoading ? '定位中…' : '定位目前位置'}
                </button>
              )}
              <button
                type="button"
                className="parking-map-action-btn"
                onClick={returnToPin}
                title="視角回到標記，不重新定位"
              >
                回到標記
              </button>
              <button
                type="button"
                className="parking-map-action-btn"
                onClick={() => openInGoogleMaps(position[0], position[1])}
                title="用 Google Maps 開啟標記位置"
              >
                Google Maps
              </button>
              <a
                href={hrefFor(ROUTES.REGIONS, { kind: 'point' })}
                className="parking-map-action-btn"
                title="地圖管理"
                onClick={jumpToRegions}
              >
                地圖管理
              </a>
            </div>

            <MapContainer
              className={basemap === 'satellite' ? 'is-satellite' : undefined}
              center={position}
              zoom={DEFAULT_ZOOM}
              maxZoom={MAX_ZOOM}
              style={{ height: 320, width: '100%' }}
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
                  hit={false}
                  onClick={() => selectPlace(c)}
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

          <div className="landmark-match-block">
            <div className="landmark-match-head">
              <span className="entry-field-label" style={{ margin: 0 }}>
                附近地點
              </span>
              <span className="landmark-match-count">{savedList.length} 筆</span>
              <a
                href={hrefFor(ROUTES.REGIONS, { kind: 'point' })}
                className="landmark-regions-jump"
                onClick={jumpToRegions}
              >
                地圖管理
              </a>
            </div>
            <div className="saved-places-toolbar">
              <input
                className="entry-text-input saved-places-filter"
                value={savedQuery}
                onChange={(e) => setSavedQuery(e.target.value)}
                placeholder="搜尋地標名稱"
              />
              <div className="saved-places-sort" role="group" aria-label="排序">
                {SAVED_SORTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`saved-places-sort-btn${savedSort === s.id ? ' is-active' : ''}`}
                    onClick={() => setSavedSort(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {!manageHint ? (
              <div className="saved-places-hint">點附近地點作為所屬名稱。拖曳標記只調目前座標。</div>
            ) : null}
            {manageHint && <div className="saved-places-hint">{manageHint}</div>}
            {visibleSaved.length > 0 ? (
              renderSavedList(visibleSaved)
            ) : (
              <div className="saved-places-empty">
                {savedQuery.trim() ? '沒有符合的地標' : '尚無已存地標'}
                <a
                  href={hrefFor(ROUTES.REGIONS, { kind: 'point' })}
                  className="landmark-regions-jump"
                  onClick={jumpToRegions}
                >
                  去地圖管理
                </a>
              </div>
            )}
            {!savedQuery.trim() && savedList.length > SAVED_LIST_CAP && (
              <div className="saved-places-more">
                還有 {savedList.length - SAVED_LIST_CAP} 筆，請搜尋名稱
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

          <div className="map-hint">
            {hasInitial ? '拖曳標記或點擊地圖微調目前座標' : '點地圖或搜尋後選點'}
            {' · '}
            <a href={hrefFor(ROUTES.REGIONS, { kind: 'point' })} className="landmark-regions-jump" onClick={jumpToRegions}>
              地圖管理
            </a>
          </div>
        </div>

        <div className="map-editor-actions">
          <button type="button" className="cancel-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="confirm-btn"
            onClick={handleConfirm}
            title="把地圖上的點設成目前定位"
          >
            儲存定位
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default LocationMapPickerModal;
