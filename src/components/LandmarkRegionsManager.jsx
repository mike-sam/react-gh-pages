import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_MAP_CENTER } from '../utils/mapDefaults';
import { useSmartLocation } from '../hooks/useSmartLocation';
import {
  DEFAULT_REGION_RADIUS_M,
  REGION_RADIUS_MAX_M,
  REGION_RADIUS_MIN_M,
  DEFAULT_POINT_NEARBY_M,
  SHAPE_CIRCLE,
  SHAPE_POINT,
  SHAPE_POLYGON,
  SHAPE_RECT,
  deleteLandmarkRegionLocal,
  deleteLandmarkRegionRemote,
  fetchLandmarkRegionsFromCloud,
  finalizeDraft,
  formatCoverage,
  inferShape,
  insertPolygonVertex,
  loadLandmarkRegions,
  matchLandmarksAt,
  mergeLandmarkRegionsFromCloud,
  newLandmarkId,
  regionOverlapsView,
  rectVerticesFromCenter,
  searchLocalLandmarks,
  searchNominatim,
  shapeMeta,
  upsertLandmarkRegionLocal,
  upsertLandmarkRegionRemote,
} from '../utils/landmarkRegions';
import {
  DEFAULT_ZOOM,
  DraggableMarker,
  MapBoundsWatcher,
  MapEditClick,
  MAX_ZOOM,
  OffMarkerWatcher,
  ProbeDot,
  Recenter,
  RegionShape,
  ReturnPinButton,
  TILES,
  VertexMarkers,
  openInGoogleMaps,
} from './map/LeafletBits';

function ModeToggle({ value, options, onChange, ariaLabel }) {
  return (
    <div className="mode-toggle" role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          className={value === opt.id ? 'is-on' : ''}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function LandmarkRegionsManager() {
  const { location, refreshLocation } = useSmartLocation();
  const hasLoc =
    typeof location?.lat === 'number' && typeof location?.lng === 'number';
  const [position, setPosition] = useState(() => [
    hasLoc ? location.lat : DEFAULT_MAP_CENTER.lat,
    hasLoc ? location.lng : DEFAULT_MAP_CENTER.lng,
  ]);
  const [regions, setRegions] = useState(() => loadLandmarkRegions());
  const [tab, setTab] = useState('browse');
  const [editMode, setEditMode] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [selectedVertex, setSelectedVertex] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [basemap, setBasemap] = useState('street');
  const [focusNonce, setFocusNonce] = useState(0);
  const [offMarker, setOffMarker] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [note, setNote] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [filterMode, setFilterMode] = useState('view');
  const [mapBounds, setMapBounds] = useState(null);
  const [probe, setProbe] = useState(null);
  const [hereHits, setHereHits] = useState([]);
  const returnBtnRef = useRef(null);

  const reloadLocal = () => {
    const next = loadLandmarkRegions();
    setRegions(next);
    return next;
  };

  const syncFromCloud = useCallback(async ({ force = false } = {}) => {
    setSyncing(true);
    if (!force) setNote('同步中…');
    try {
      const cloud = await fetchLandmarkRegionsFromCloud();
      const merged = mergeLandmarkRegionsFromCloud(cloud);
      setRegions(merged);
      setNote(`已同步 ${merged.length} 個`);
      return merged;
    } catch (err) {
      console.warn(err);
      setNote('雲端同步失敗，使用本機');
      return loadLandmarkRegions();
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    syncFromCloud({ force: false });
  }, [syncFromCloud]);

  useEffect(() => {
    const el = returnBtnRef.current;
    if (!el) return undefined;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    return undefined;
  }, [offMarker]);

  const handleChange = (lat, lng) => {
    setPosition([lat, lng]);
    if (editDraft && inferShape(editDraft) === SHAPE_RECT) {
      setEditDraft((d) =>
        d
          ? {
              ...d,
              center: { lat, lng },
              vertices: rectVerticesFromCenter(
                { lat, lng },
                d.radiusM || DEFAULT_REGION_RADIUS_M
              ),
            }
          : d
      );
    }
  };

  const handleBrowseClick = (lat, lng) => {
    setProbe({ lat, lng });
    const hits = matchLandmarksAt({ lat, lng }, { regions });
    setHereHits(hits);
    setFilterMode('here');
  };

  const showViewList = () => {
    setFilterMode('view');
    setProbe(null);
    setHereHits([]);
  };

  const showAllList = () => {
    setFilterMode('all');
    setProbe(null);
    setHereHits([]);
  };

  const onMapBounds = useCallback((b) => {
    setMapBounds((prev) => {
      if (
        prev &&
        prev.south === b.south &&
        prev.north === b.north &&
        prev.west === b.west &&
        prev.east === b.east
      ) {
        return prev;
      }
      return b;
    });
  }, []);

  const handleGps = async () => {
    setGpsLoading(true);
    setNote('');
    try {
      const coords = await refreshLocation();
      if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        setPosition([coords.lat, coords.lng]);
        setFocusNonce((n) => n + 1);
      }
    } catch (err) {
      setNote(err?.message || 'GPS 失敗');
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

  const startCreateRegion = () => {
    const fromProbe = probe && typeof probe.lat === 'number';
    const center = fromProbe
      ? { lat: probe.lat, lng: probe.lng }
      : { lat: position[0], lng: position[1] };
    if (fromProbe) setPosition([probe.lat, probe.lng]);
    setTab('create');
    setEditMode('create');
    setSelectedVertex(null);
    setEditDraft({
      id: newLandmarkId(),
      name: '',
      center,
      radiusM: DEFAULT_REGION_RADIUS_M,
      vertices: [],
      shape: SHAPE_CIRCLE,
    });
  };

  const startEditRegion = (region) => {
    const shape = inferShape(region);
    setTab('create');
    setEditMode('edit');
    setSelectedVertex(null);
    setEditDraft({
      ...region,
      shape,
      center: { ...region.center },
      vertices: [...(region.vertices || [])],
    });
    setPosition([region.center.lat, region.center.lng]);
    setFocusNonce((n) => n + 1);
  };

  const goBrowse = () => {
    setTab('browse');
    setEditMode(null);
    setEditDraft(null);
    setSelectedVertex(null);
    setFilterMode('view');
    setProbe(null);
    setHereHits([]);
  };

  const pickResult = (item) => {
    setPosition([item.lat, item.lng]);
    setResults([]);
    setFocusNonce((n) => n + 1);
    if (item.kind === 'landmark') {
      const region = regions.find((r) => r.id === item.id);
      if (region) startEditRegion(region);
    }
  };

  const setDraftShape = (shape) => {
    setSelectedVertex(null);
    setEditDraft((d) => {
      if (!d) return d;
      const center = { lat: position[0], lng: position[1] };
      if (shape === SHAPE_POINT) {
        return {
          ...d,
          shape,
          center,
          radiusM: DEFAULT_POINT_NEARBY_M,
          vertices: [],
        };
      }
      if (shape === SHAPE_CIRCLE) {
        return { ...d, shape, center, vertices: [] };
      }
      if (shape === SHAPE_RECT) {
        const radiusM = d.radiusM || DEFAULT_REGION_RADIUS_M;
        return {
          ...d,
          shape,
          center,
          radiusM,
          vertices: rectVerticesFromCenter(center, radiusM),
        };
      }
      return {
        ...d,
        shape: SHAPE_POLYGON,
        vertices: (d.vertices || []).length >= 3 ? d.vertices : [],
      };
    });
  };

  const addPolygonVertex = (lat, lng) => {
    const d = editDraft;
    if (!d || inferShape(d) !== SHAPE_POLYGON) return;
    const result = insertPolygonVertex(d.vertices || [], { lat, lng });
    if (result.index < 0) return;
    setSelectedVertex(result.index);
    if (result.snapped) return;
    setEditDraft({ ...d, vertices: result.vertices });
  };

  const movePolygonVertex = (index, lat, lng) => {
    setEditDraft((d) => {
      if (!d) return d;
      const vertices = (d.vertices || []).map((v, i) => (i === index ? { lat, lng } : v));
      return { ...d, vertices };
    });
  };

  const removePolygonVertex = (index) => {
    setEditDraft((d) => {
      if (!d) return d;
      return { ...d, vertices: (d.vertices || []).filter((_, i) => i !== index) };
    });
    setSelectedVertex((cur) => {
      if (cur == null) return null;
      if (cur === index) return null;
      if (cur > index) return cur - 1;
      return cur;
    });
  };

  const selectPolygonVertex = (index) => {
    if (selectedVertex === index) {
      removePolygonVertex(index);
      return;
    }
    setSelectedVertex(index);
  };

  const saveEditDraft = async () => {
    if (!editDraft) return;
    const name = (editDraft.name || '').trim();
    if (!name) {
      setNote('請輸入名稱');
      return;
    }
    const finalized = finalizeDraft(editDraft, position);
    if (finalized.error) {
      setNote(finalized.error);
      return;
    }
    const payload = {
      ...finalized,
      name,
      updatedAt: Date.now(),
      source: 'local',
    };
    upsertLandmarkRegionLocal(payload);
    reloadLocal();
    goBrowse();
    setNote('已儲存（本機）');
    try {
      await upsertLandmarkRegionRemote(payload);
      setNote('已儲存並同步');
    } catch (err) {
      console.warn(err);
      setNote('已存本機，雲端同步失敗');
    }
  };

  const removeRegion = async (id) => {
    if (!id) return;
    if (!window.confirm('確定刪除？')) return;
    deleteLandmarkRegionLocal(id);
    reloadLocal();
    if (editDraft?.id === id) goBrowse();
    try {
      await deleteLandmarkRegionRemote(id);
    } catch (err) {
      console.warn(err);
    }
  };

  const liveDraft = useMemo(() => {
    if (!editDraft) return null;
    const shape = inferShape(editDraft);
    const center = { lat: position[0], lng: position[1] };
    const radiusM = Math.max(10, Number(editDraft.radiusM) || DEFAULT_REGION_RADIUS_M);
    const vertices =
      shape === SHAPE_RECT
        ? rectVerticesFromCenter(center, radiusM)
        : editDraft.vertices || [];
    return { ...editDraft, center, radiusM, vertices, shape };
  }, [editDraft, position]);

  const polygonMode = Boolean(tab === 'create' && liveDraft && liveDraft.shape === SHAPE_POLYGON);
  const draftShape = liveDraft ? liveDraft.shape : SHAPE_CIRCLE;
  const tile = TILES[basemap] || TILES.street;
  const coverageText = liveDraft ? formatCoverage(liveDraft) : '';

  const shapesToShow = useMemo(() => {
    if (tab === 'create' && liveDraft) {
      return [{ ...liveDraft, id: 'edit-draft', editing: true, hit: false }];
    }
    const hitIds = new Set(hereHits.map((h) => h.id));
    return regions.map((r) => ({
      ...r,
      editing: false,
      nearby: false,
      hit: hitIds.has(r.id),
    }));
  }, [tab, liveDraft, regions, hereHits]);

  const listedRegions = useMemo(() => {
    if (tab !== 'browse') return regions;
    if (filterMode === 'here') return hereHits;
    if (filterMode === 'view' && mapBounds) {
      return regions.filter((r) => regionOverlapsView(r, mapBounds));
    }
    return regions;
  }, [tab, regions, filterMode, hereHits, mapBounds]);

  const hitIdSet = useMemo(() => new Set(hereHits.map((h) => h.id)), [hereHits]);

  return (
    <div className="entry-card landmark-regions-card">
      <div className="entry-card-header landmark-regions-head">
        <ModeToggle
          ariaLabel="模式"
          value={tab}
          onChange={(next) => {
            if (next === 'browse') goBrowse();
            else if (tab !== 'create') startCreateRegion();
          }}
          options={[
            { id: 'create', label: '新增' },
            { id: 'browse', label: '瀏覽' },
          ]}
        />
        <button
          type="button"
          className="calendar-status-refresh"
          onClick={() => syncFromCloud({ force: true })}
          disabled={syncing}
        >
          {syncing ? '同步中…' : '同步'}
        </button>
      </div>

      {note && <div className="location-gps-hint">{note}</div>}

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

      <div className="leaflet-map-container location-picker-map landmark-manager-map">
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
            onClick={handleGps}
            disabled={gpsLoading}
          >
            {gpsLoading ? '定位中…' : 'GPS'}
          </button>
          <button type="button" className="parking-map-action-btn" onClick={returnToPin}>
            返回定位
          </button>
          <button
            type="button"
            className="parking-map-action-btn"
            onClick={() =>
              openInGoogleMaps(probe?.lat ?? position[0], probe?.lng ?? position[1])
            }
          >
            Google Maps
          </button>
        </div>

        <MapContainer
          center={position}
          zoom={DEFAULT_ZOOM}
          maxZoom={MAX_ZOOM}
          style={{ height: 320, width: '100%' }}
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
              hit={c.hit}
              interactive={false}
            />
          ))}
          {polygonMode && (
            <VertexMarkers
              vertices={liveDraft.vertices}
              selectedIndex={selectedVertex}
              onMove={movePolygonVertex}
              onSelect={selectPolygonVertex}
            />
          )}
          {tab === 'create' && !polygonMode && (
            <DraggableMarker position={position} onChange={handleChange} />
          )}
          {tab === 'browse' && probe && (
            <ProbeDot lat={probe.lat} lng={probe.lng} />
          )}
          <MapEditClick
            polygonMode={polygonMode}
            onPin={tab === 'browse' ? handleBrowseClick : handleChange}
            onAddVertex={addPolygonVertex}
          />
          <MapBoundsWatcher onChange={onMapBounds} />
          <OffMarkerWatcher
            lat={position[0]}
            lng={position[1]}
            onOffChange={setOffMarker}
          />
          <Recenter lat={position[0]} lng={position[1]} focusNonce={focusNonce} />
        </MapContainer>
        {offMarker && tab === 'create' && !polygonMode && (
          <ReturnPinButton buttonRef={returnBtnRef} onClick={returnToPin} />
        )}
        {polygonMode && (
          <div className="landmark-map-hint">
            {selectedVertex != null
              ? '已選取 · 再點一次刪除，或按刪除此點'
              : '點靠近邊會接到附近的點 · 拖曳調整 · 單擊選取刪除'}
          </div>
        )}
      </div>

      {tab === 'create' || probe ? (
        <div className="coordinates-display">
          <span>{(probe?.lat ?? position[0]).toFixed(6)}</span>
          <span>{(probe?.lng ?? position[1]).toFixed(6)}</span>
        </div>
      ) : null}

      {tab === 'create' && liveDraft ? (
        <div className="landmark-edit-panel">
          <div className="landmark-edit-title">
            {editMode === 'edit' ? '編輯區域' : '新增區域'}
          </div>
          <ModeToggle
            ariaLabel="形狀"
            value={draftShape}
            onChange={setDraftShape}
            options={[
              { id: SHAPE_POINT, label: '點' },
              { id: SHAPE_CIRCLE, label: '圓' },
              { id: SHAPE_RECT, label: '方' },
              { id: SHAPE_POLYGON, label: '多邊形' },
            ]}
          />
          {coverageText && draftShape !== SHAPE_POINT ? (
            <div className="landmark-coverage">{coverageText}</div>
          ) : null}
          <input
            className="entry-text-input"
            value={editDraft.name}
            onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="名稱"
          />
          {draftShape === SHAPE_POINT ? (
            <p className="landmark-edit-hint">拖曳標記，填名稱</p>
          ) : draftShape === SHAPE_POLYGON ? (
            <div className="landmark-poly-tools">
              <p className="landmark-edit-hint">
                點靠近邊會接到附近的點 · 拖曳調整 · 單擊選取，再點刪除
              </p>
              <div className="landmark-poly-row">
                <span>{(liveDraft.vertices || []).length} 頂點</span>
                {selectedVertex != null && (
                  <button
                    type="button"
                    className="landmark-delete-btn"
                    onClick={() => removePolygonVertex(selectedVertex)}
                  >
                    刪除此點
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="landmark-edit-hint">
                {draftShape === SHAPE_RECT ? '拖曳標記調中心，滑桿調大小' : '拖曳標記調中心，滑桿調半徑'}
              </p>
              <label className="landmark-radius-label">
                {draftShape === SHAPE_RECT ? '半邊' : '半徑'} {Math.round(liveDraft.radiusM)} m
                <input
                  type="range"
                  min={REGION_RADIUS_MIN_M}
                  max={REGION_RADIUS_MAX_M}
                  step={10}
                  value={liveDraft.radiusM}
                  onChange={(e) =>
                    setEditDraft((d) => {
                      if (!d) return d;
                      const radiusM = Number(e.target.value);
                      const center = { lat: position[0], lng: position[1] };
                      return {
                        ...d,
                        radiusM,
                        vertices:
                          inferShape(d) === SHAPE_RECT
                            ? rectVerticesFromCenter(center, radiusM)
                            : d.vertices,
                      };
                    })
                  }
                />
              </label>
            </>
          )}
          <div className="landmark-edit-actions">
            <button type="button" className="cancel-btn" onClick={goBrowse}>
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
              儲存
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="entry-chip-row landmark-list-filter">
            <button
              type="button"
              className={`entry-chip${filterMode === 'view' ? ' active' : ''}`}
              onClick={showViewList}
            >
              地圖內
            </button>
            <button
              type="button"
              className={`entry-chip${filterMode === 'all' ? ' active' : ''}`}
              onClick={showAllList}
            >
              全部
            </button>
            {filterMode === 'here' ? (
              <button type="button" className="entry-chip active" onClick={showViewList}>
                此處 {hereHits.length} · 清除
              </button>
            ) : null}
          </div>
          <ul className="landmark-region-list">
            {regions.length === 0 ? (
              <li className="landmark-region-empty">尚無區域或地點</li>
            ) : listedRegions.length === 0 ? (
              <li className="landmark-region-empty">
                {filterMode === 'here' ? '此處沒有區域' : '此畫面沒有區域'}
              </li>
            ) : (
              listedRegions.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`landmark-all-item${hitIdSet.has(r.id) ? ' is-active' : ''}`}
                    onClick={() => startEditRegion(r)}
                  >
                    <span>{r.name}</span>
                    <span className="landmark-match-meta">{shapeMeta(r)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );
}

export default LandmarkRegionsManager;
