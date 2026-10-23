import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_MAP_CENTER } from '../utils/mapDefaults';
import {
  deleteLandmarkRegionLocal,
  deleteLandmarkRegionRemote,
  deleteSavedLocationRemote,
  saveSavedLocationRemote,
  distanceMeters,
  fetchLandmarkRegionsFromCloud,
  fetchNearbyLegacyLocations,
  fetchSavedLocations,
  formatDist,
  isLandmarkFetchFresh,
  isNamedPoint,
  isSheetPlace,
  landmarksAround,
  loadLandmarkRegions,
  mergeLandmarkRegionsFromCloud,
  mergeNamedPointsLocal,
  rememberNamedPoint,
  renameLandmarkRegionLocal,
  savedLocationToPoint,
  searchLocalLandmarks,
  upsertLandmarkRegionRemote,
  searchNominatim,
} from '../utils/landmarkRegions';
import { ensureAppBootstrap, isBootstrapAttemptCooling } from '../utils/appBootstrap';
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
  TILES,
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
  const [sheetPlaces, setSheetPlaces] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [savedQuery, setSavedQuery] = useState('');
  const [savedSort, setSavedSort] = useState('near');
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [keepId, setKeepId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [manageHint, setManageHint] = useState('');
  const labelTouchedRef = useRef(false);
  const autoFilledIdRef = useRef(null);
  const positionRef = useRef(position);
  positionRef.current = position;

  const pointCatalog = useMemo(() => {
    const localPts = (regions || []).filter(isNamedPoint);
    const extra = [];
    (sheetPlaces || []).forEach((p) => {
      const near = localPts.some(
        (r) =>
          r.name.toLowerCase() === String(p.name || '').toLowerCase() &&
          distanceMeters(r.center, p.center) < 15
      );
      if (!near) extra.push(p);
    });
    return [...localPts, ...extra];
  }, [regions, sheetPlaces]);

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
    setSavedQuery('');
    setSavedSort('near');
    setCheckedIds(new Set());
    setKeepId(null);
    setEditingId(null);
    setEditName('');
    setManageHint('');
    setFocusNonce((n) => n + 1);

    const local = loadLandmarkRegions();
    setRegions(local);
    const localPts = local.filter(isNamedPoint);
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

    let cancelled = false;
    (async () => {
      await syncFromCloud({ force: false });
      if (cancelled) return;
      let sheet = [];
      try {
        sheet = await fetchSavedLocations();
      } catch {
        try {
          const nearby = await fetchNearbyLegacyLocations(nextPos[0], nextPos[1], 80);
          sheet = nearby.map(savedLocationToPoint).filter(Boolean);
        } catch (err) {
          console.warn('list locations failed', err);
        }
      }
      if (cancelled) return;
      setSheetPlaces(sheet);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, initialLat, initialLng, initialLabel, syncFromCloud, applyMatchAutofill]);

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
        setPosition([coords.lat, coords.lng]);
        setFocusNonce((n) => n + 1);
        setGpsHint('已更新為 GPS 座標，可再拖曳微調');
        const hits = refreshMatches(coords.lat, coords.lng);
        applyMatchAutofill(hits, { force: true });
      }
    } catch (err) {
      setGpsHint(err?.message || 'GPS 失敗，可繼續點地圖選點');
    } finally {
      setGpsLoading(false);
    }
  };

  const returnToPin = () => setFocusNonce((n) => n + 1);

  const jumpToRegions = (e) => {
    e?.preventDefault?.();
    const fromHome = getHashPath() === ROUTES.HOME || window.history.state?.fromHome;
    clearHistoryOverlays();
    applyHash(hrefFor(ROUTES.REGIONS), {
      replace: true,
      skipGuard: true,
      state: fromHome ? { fromHome: true } : null,
    });
  };

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    const q = query.trim();
    if (!q) return;
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

  const goToSaved = (hit) => {
    if (!hit?.center) return;
    setPosition([hit.center.lat, hit.center.lng]);
    setFocusNonce((n) => n + 1);
    pickMatch(hit);
    setKeepId(hit.id);
    refreshMatches(hit.center.lat, hit.center.lng);
    if (checkedIds.size >= 1) {
      setManageHint(`留下「${hit.name}」，其餘勾選會刪除`);
    }
  };

  const syncRegions = (next) => {
    const list = next || loadLandmarkRegions();
    setRegions(list);
    return list;
  };

  const toggleChecked = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEdit = (hit) => {
    setEditingId(hit.id);
    setEditName(hit.name);
    setManageHint('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = (id) => {
    const nextName = editName.trim();
    if (!nextName) {
      setManageHint('名稱不能空白');
      return;
    }
    const hit = pointCatalog.find((r) => r.id === id);
    if (!hit) {
      setManageHint('找不到這筆，無法改名');
      return;
    }
    if (isSheetPlace(hit)) {
      const renamed = {
        ...hit,
        name: nextName,
        id: `loc_${hit.center.lat.toFixed(5)}_${hit.center.lng.toFixed(5)}_${nextName}`,
      };
      setSheetPlaces((prev) => prev.map((p) => (p.id === id ? renamed : p)));
      saveSavedLocationRemote(renamed).catch(() => setManageHint('已改名（本機），雲端同步失敗'));
      if (keepId === id) setKeepId(renamed.id);
    } else {
      const saved = renameLandmarkRegionLocal(id, nextName);
      if (saved) upsertLandmarkRegionRemote(saved).catch(() => setManageHint('已改名（本機），雲端同步失敗'));
      syncRegions();
    }
    if (selectedMatchId === id || autoFilledIdRef.current === id) {
      setLabel(nextName);
    }
    setEditingId(null);
    setEditName('');
    setManageHint('已改名');
  };

  const forgetPlace = (hit) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.delete(hit.id);
      return next;
    });
    if (editingId === hit.id) cancelEdit();
    if (keepId === hit.id) setKeepId(null);
    if (selectedMatchId === hit.id || autoFilledIdRef.current === hit.id) {
      setLabel('');
      labelTouchedRef.current = false;
      autoFilledIdRef.current = null;
      setSelectedMatchId(null);
    }
  };

  const removeSaved = (hit) => {
    if (!hit?.id) return;
    if (!window.confirm(`刪除地標「${hit.name}」？`)) return;
    if (isSheetPlace(hit)) {
      setSheetPlaces((prev) => prev.filter((p) => p.id !== hit.id));
      deleteSavedLocationRemote(hit).catch(() => setManageHint('已刪本機，雲端同步失敗'));
    } else {
      deleteLandmarkRegionLocal(hit.id);
      deleteLandmarkRegionRemote(hit.id).catch(() => setManageHint('已刪本機，雲端同步失敗'));
      syncRegions();
    }
    forgetPlace(hit);
    setManageHint(`已刪「${hit.name}」`);
  };

  const mergeChecked = () => {
    if (!keepId) {
      setManageHint('請先點選要留下的地標');
      return;
    }
    const dropCount = Array.from(checkedIds).filter((id) => id !== keepId).length;
    if (dropCount < 1) {
      setManageHint('勾選附近重複的地標，再點「留下」選要覆蓋的那筆');
      return;
    }
    const keep = pointCatalog.find((r) => r.id === keepId);
    const keepName = keep?.name || '所選地標';
    if (!window.confirm(`以「${keepName}」的座標覆蓋：留下這筆，刪除其餘 ${dropCount} 筆附近重複地標？`)) {
      return;
    }
    const result = mergeNamedPointsLocal(pointCatalog, { keepId, checkedIds: Array.from(checkedIds) });
    if (!result?.keep) {
      setManageHint('合併失敗，請再點一次要留下的地標');
      return;
    }
    const droppedSheet = [];
    result.dropped.forEach((r) => {
      if (isSheetPlace(r)) {
        droppedSheet.push(r.id);
        deleteSavedLocationRemote(r).catch(() => {});
      } else {
        deleteLandmarkRegionRemote(r.id).catch(() => {});
      }
    });
    if (droppedSheet.length) {
      setSheetPlaces((prev) => prev.filter((p) => !droppedSheet.includes(p.id)));
    }
    setCheckedIds(new Set());
    setKeepId(result.keep.id);
    setEditingId(null);
    setLabel(result.keep.name);
    labelTouchedRef.current = true;
    autoFilledIdRef.current = result.keep.id;
    setSelectedMatchId(result.keep.id);
    syncRegions();
    setManageHint(`已留下「${result.keep.name}」，刪除 ${result.dropped.length} 筆重複地標`);
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
      matches.filter(isNamedPoint).map((m) => ({
        ...m,
        editing: false,
        nearby: !m.inside,
        legacy: isSheetPlace(m),
      })),
    [matches]
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
  const dropCount = Array.from(checkedIds).filter((id) => id !== keepId).length;
  const keepPlace = pointCatalog.find((r) => r.id === keepId);
  const canMerge = Boolean(keepId && dropCount >= 1);

  if (!open) return null;

  const tile = TILES[basemap] || TILES.street;

  const renderSavedList = (list) => (
    <ul className="landmark-match-list saved-places-list">
      {list.map((m) => (
        <li
          key={m.id}
          className={[
            editingId === m.id ? 'is-editing' : '',
            keepId === m.id ? 'is-keep' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <label className="saved-place-check">
            <input
              type="checkbox"
              checked={checkedIds.has(m.id)}
              onChange={() => toggleChecked(m.id)}
              aria-label={`勾選 ${m.name}`}
            />
          </label>
          {editingId === m.id ? (
            <div className="saved-place-edit">
              <input
                className="entry-text-input saved-place-edit-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveEdit(m.id);
                  }
                  if (e.key === 'Escape') cancelEdit();
                }}
                autoFocus
              />
              <button type="button" className="landmark-match-edit" onClick={() => saveEdit(m.id)}>
                存
              </button>
              <button type="button" className="landmark-match-edit" onClick={cancelEdit}>
                取消
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={`landmark-match-item${keepId === m.id || selectedMatchId === m.id ? ' is-active' : ''}`}
                onClick={() => goToSaved(m)}
                title="點選作為留下的地標"
              >
                <span className="landmark-match-name">{m.name}</span>
                <span className="landmark-match-meta">
                  {keepId === m.id ? '留下' : formatDist(m.distanceM)}
                </span>
              </button>
              <button
                type="button"
                className={`landmark-match-edit${keepId === m.id ? ' is-keep-btn' : ''}`}
                onClick={() => {
                  pickMatch(m);
                  setKeepId(m.id);
                  setManageHint(`留下「${m.name}」`);
                }}
              >
                留下
              </button>
              <button type="button" className="landmark-match-edit" onClick={() => startEdit(m)}>
                改
              </button>
              <button
                type="button"
                className="landmark-match-edit is-danger"
                onClick={() => removeSaved(m)}
              >
                刪
              </button>
            </>
          )}
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
            <a
              href={hrefFor(ROUTES.REGIONS)}
              className="location-gps-btn"
              title="編輯多邊形區域"
              onClick={jumpToRegions}
            >
              區域
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
              <a
                href={hrefFor(ROUTES.REGIONS)}
                className="parking-map-action-btn"
                title="編輯多邊形區域"
                onClick={jumpToRegions}
              >
                常用區域
              </a>
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

          <div className="landmark-match-block">
            <div className="landmark-match-head">
              <span className="entry-field-label" style={{ margin: 0 }}>
                地標
              </span>
              <span className="landmark-match-count">{savedList.length} 筆</span>
              <a
                href={hrefFor(ROUTES.REGIONS)}
                className="landmark-regions-jump"
                onClick={jumpToRegions}
              >
                常用區域
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
            {canMerge && (
              <div className="saved-merge-bar">
                <span className="saved-merge-copy">
                  以「{keepPlace?.name || '所選地標'}」覆蓋，刪除其餘 {dropCount} 筆
                </span>
                <button type="button" className="location-search-btn" onClick={mergeChecked}>
                  合併
                </button>
              </div>
            )}
            {!canMerge && checkedIds.size >= 1 && (
              <div className="saved-places-hint">勾選附近重複的地標，再點「留下」選要覆蓋的那筆</div>
            )}
            {manageHint && <div className="saved-places-hint">{manageHint}</div>}
            {visibleSaved.length > 0 ? (
              renderSavedList(visibleSaved)
            ) : (
              <div className="saved-places-empty">
                {savedQuery.trim() ? '沒有符合的地標' : '尚無已存地標'}
                <a
                  href={hrefFor(ROUTES.REGIONS)}
                  className="landmark-regions-jump"
                  onClick={jumpToRegions}
                >
                  去常用區域
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
            {hasInitial ? '拖曳標記或點擊地圖微調' : '點地圖或搜尋後選點'}
            {' · '}
            <a href={hrefFor(ROUTES.REGIONS)} className="landmark-regions-jump" onClick={jumpToRegions}>
              常用區域
            </a>
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
