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
  deleteLandmarkRegionRemote,
  deleteSavedLocationRemote,
  distanceMeters,
  fetchLandmarkRegionsFromCloud,
  fetchSavedLocations,
  absorbPointTwins,
  filterLivePlaces,
  forgetPlace,
  landmarkFetchHint,
  landmarkFetchedAt,
  loadSheetPlaces,
  mergePlaceCatalog,
  finalizeDraft,
  formatCoverage,
  formatDist,
  inferShape,
  isNamedPoint,
  isSheetPlace,
  insertPolygonVertex,
  commitPolygonVertexMove,
  loadLandmarkRegions,
  matchLandmarksAt,
  mergeLandmarkRegionsFromCloud,
  newLandmarkId,
  PIN_ICON_DEFAULT,
  PIN_ICONS,
  normalizePinIcon,
  pruneTombstonesAgainst,
  regionContains,
  regionOverlapsView,
  rectVerticesFromCenter,
  searchLocalLandmarks,
  saveSavedLocationRemote,
  saveSheetPlaces,
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
  MapInvalidateOn,
  MAX_ZOOM,
  MoveGhost,
  OffMarkerWatcher,
  PinGlyph,
  RangeHalo,
  ProbeDot,
  Recenter,
  RegionShape,
  ReturnPinButton,
  tilesFor,
  VertexMarkers,
  openInGoogleMaps,
} from './map/LeafletBits';
import { getMergedQueryParams } from '../utils/expenseQuickUrl';
import { applyHash, hrefFor, ROUTES } from '../utils/routing';

function ModeToggle({ value, options, onChange, ariaLabel, className }) {
  return (
    <div
      className={`mode-toggle${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label={ariaLabel}
    >
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
  const [sheetPlaces, setSheetPlaces] = useState(() => loadSheetPlaces());
  const [tab, setTab] = useState('browse');
  const [kind, setKind] = useState(() =>
    String(getMergedQueryParams().get('kind') || '').toLowerCase() === 'point' ? 'point' : 'region'
  );

  useEffect(() => {
    const syncKind = () => {
      const next =
        String(getMergedQueryParams().get('kind') || '').toLowerCase() === 'point'
          ? 'point'
          : 'region';
      setKind((k) => (k === next ? k : next));
    };
    window.addEventListener('hashchange', syncKind);
    return () => window.removeEventListener('hashchange', syncKind);
  }, []);
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
  const [dragPreview, setDragPreview] = useState(null);
  const [ringChoice, setRingChoice] = useState(null);
  const [editOrigin, setEditOrigin] = useState(null);
  const [inspectedId, setInspectedId] = useState(null);
  const inspectGuardUntil = useRef(0);
  const returnBtnRef = useRef(null);
  const ringChipRef = useRef(null);
  const wrapRef = useRef(null);
  const dockRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sizeToken, setSizeToken] = useState(0);

  const catalog = useMemo(
    () => mergePlaceCatalog(regions, sheetPlaces),
    [regions, sheetPlaces]
  );

  const reloadLocal = () => {
    const next = loadLandmarkRegions();
    setRegions(next);
    return next;
  };

  const syncFromCloud = useCallback(async () => {
    setSyncing(true);
    setNote('同步中…');
    try {
      const cloud = await fetchLandmarkRegionsFromCloud();
      const merged = mergeLandmarkRegionsFromCloud(cloud);
      setRegions(merged);
      try {
        const pins = await fetchSavedLocations();
        pruneTombstonesAgainst(pins);
        const live = saveSheetPlaces(filterLivePlaces(pins));
        setSheetPlaces(live);
      } catch {
        setSheetPlaces((list) => filterLivePlaces(list));
      }
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
    if (landmarkFetchedAt()) return undefined;
    syncFromCloud();
    return undefined;
  }, [syncFromCloud]);

  useEffect(() => {
    const el = returnBtnRef.current;
    if (!el) return undefined;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    return undefined;
  }, [offMarker]);

  useEffect(() => {
    const el = ringChipRef.current;
    if (!el) return undefined;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    return undefined;
  }, [ringChoice]);

  useEffect(() => {
    const el = dockRef.current;
    if (!el) return undefined;
    L.DomEvent.disableClickPropagation(el);
    return undefined;
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const el = wrapRef.current;
      const active = Boolean(
        document.fullscreenElement === el || document.webkitFullscreenElement === el
      );
      setIsFullscreen(active);
      setSizeToken((n) => n + 1);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      setIsFullscreen(false);
      setSizeToken((n) => n + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isFullscreen]);

  useEffect(
    () => () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    },
    []
  );

  const toggleFullscreen = async () => {
    const el = wrapRef.current;
    if (!el) return;
    const nativeOn =
      document.fullscreenElement === el || document.webkitFullscreenElement === el;
    if (isFullscreen) {
      if (nativeOn) {
        try {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        } catch (err) {
          console.warn('fullscreen failed', err);
          setIsFullscreen(false);
          setSizeToken((n) => n + 1);
        }
      } else {
        setIsFullscreen(false);
        setSizeToken((n) => n + 1);
      }
      return;
    }
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else {
        setIsFullscreen(true);
        setSizeToken((n) => n + 1);
      }
    } catch (err) {
      console.warn('fullscreen failed', err);
      setIsFullscreen(true);
      setSizeToken((n) => n + 1);
    }
  };

  const handleChange = (lat, lng) => {
    if (editDraft && inferShape(editDraft) === SHAPE_POINT) {
      setPosition([lat, lng]);
      setEditDraft((d) => (d ? { ...d, center: { lat, lng } } : d));
      return;
    }
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
    setInspectedId(null);
    setProbe({ lat, lng });
    const hits = matchLandmarksAt({ lat, lng }, { regions: catalog }).filter((r) =>
      kind === 'point' ? isNamedPoint(r) : !isNamedPoint(r)
    );
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
    const local = searchLocalLandmarks(q, catalog).map((r) => ({
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

  const startCreateRegion = (nextKind = kind) => {
    const fromProbe = probe && typeof probe.lat === 'number';
    const center = fromProbe
      ? { lat: probe.lat, lng: probe.lng }
      : { lat: position[0], lng: position[1] };
    if (fromProbe) setPosition([probe.lat, probe.lng]);
    setTab('create');
    setEditMode('create');
    setSelectedVertex(null);
    setDragPreview(null);
    setEditOrigin(null);
    setInspectedId(null);
    const asPoint = nextKind === 'point';
    setEditDraft({
      id: newLandmarkId(),
      name: '',
      center,
      radiusM: asPoint ? DEFAULT_POINT_NEARBY_M : DEFAULT_REGION_RADIUS_M,
      vertices: [],
      shape: asPoint ? SHAPE_POINT : SHAPE_CIRCLE,
      icon: PIN_ICON_DEFAULT,
    });
  };

  const startEditRegion = (region) => {
    const shape = inferShape(region);
    setKind(shape === SHAPE_POINT ? 'point' : 'region');
    setTab('create');
    setEditMode('edit');
    setSelectedVertex(null);
    setDragPreview(null);
    setEditDraft({
      ...region,
      shape,
      center: { ...region.center },
      vertices: [...(region.vertices || [])],
    });
    setPosition([region.center.lat, region.center.lng]);
    setEditOrigin({ lat: region.center.lat, lng: region.center.lng });
    setInspectedId(null);
    setFocusNonce((n) => n + 1);
  };

  const inspectRegion = (region, { fly = false } = {}) => {
    if (!region) return;
    inspectGuardUntil.current = Date.now() + 450;
    setInspectedId(region.id);
    setProbe(null);
    if (fly && region.center) {
      setPosition([region.center.lat, region.center.lng]);
      setFocusNonce((n) => n + 1);
    }
  };

  const requestEdit = (region) => {
    if (Date.now() < inspectGuardUntil.current) return;
    startEditRegion(region);
  };

  const goBrowse = () => {
    setTab('browse');
    setEditMode(null);
    setEditDraft(null);
    setSelectedVertex(null);
    setDragPreview(null);
    setFilterMode('view');
    setProbe(null);
    setHereHits([]);
    setEditOrigin(null);
    setInspectedId(null);
  };

  const cancelEdit = () => {
    const draft = editDraft;
    const origin = editOrigin;
    const keep =
      editMode === 'edit' && draft
        ? catalog.find((r) => r.id === draft.id) || {
            ...draft,
            center: origin ? { ...origin } : draft.center,
          }
        : null;
    goBrowse();
    if (keep) inspectRegion(keep, { fly: true });
  };

  const switchKind = (next) => {
    if (next === kind) return;
    setInspectedId(null);
    setKind(next);
    applyHash(hrefFor(ROUTES.REGIONS, next === 'point' ? { kind: 'point' } : {}), {
      replace: true,
      skipGuard: true,
    });
    if (tab !== 'create' || !editDraft) return;
    setSelectedVertex(null);
    setDragPreview(null);
    setEditDraft((d) => {
      if (!d) return d;
      const center = { lat: position[0], lng: position[1] };
      if (next === 'point') {
        return {
          ...d,
          center,
          shape: SHAPE_POINT,
          vertices: [],
          radiusM: DEFAULT_POINT_NEARBY_M,
        };
      }
      return {
        ...d,
        center,
        shape: SHAPE_CIRCLE,
        vertices: [],
        radiusM: d.radiusM || DEFAULT_REGION_RADIUS_M,
      };
    });
  };

  const pickResult = (item) => {
    setPosition([item.lat, item.lng]);
    setResults([]);
    setFocusNonce((n) => n + 1);
    if (item.kind === 'landmark') {
      const region = catalog.find((r) => r.id === item.id);
      if (region) {
        if (tab === 'browse') inspectRegion(region, { fly: true });
        else startEditRegion(region);
      }
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
    setEditDraft((d) => {
      if (!d || inferShape(d) !== SHAPE_POLYGON) return d;
      const result = insertPolygonVertex(d.vertices || [], { lat, lng });
      if (result.index < 0 || result.snapped) return d;
      queueMicrotask(() => {
        setSelectedVertex(result.index);
        setRingChoice(null);
      });
      return { ...d, vertices: result.vertices };
    });
  };

  const movePolygonVertex = useCallback((index, lat, lng) => {
    setEditDraft((d) => {
      if (!d) return d;
      const result = commitPolygonVertexMove(d.vertices || [], index, lat, lng);
      if (!result.changed) return d;
      queueMicrotask(() => setSelectedVertex(result.index));
      if (result.reordered && result.original) {
        queueMicrotask(() =>
          setRingChoice({
            original: result.original,
            fromIndex: result.fromIndex,
          })
        );
      } else {
        queueMicrotask(() => setRingChoice(null));
      }
      return { ...d, vertices: result.vertices };
    });
  }, []);

  const keepOriginalRing = useCallback(() => {
    setRingChoice((choice) => {
      if (!choice?.original) return null;
      setEditDraft((d) => (d ? { ...d, vertices: choice.original } : d));
      setSelectedVertex(choice.fromIndex ?? null);
      return null;
    });
  }, []);

  const removePolygonVertex = useCallback((index) => {
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
  }, []);

  const selectPolygonVertex = useCallback((index) => {
    setSelectedVertex((cur) => (cur === index ? null : index));
  }, []);

  const onVertexDragLive = useCallback((p) => {
    setDragPreview(p);
    if (p) setRingChoice(null);
  }, []);

  const fireRemote = (task, failNote) => {
    window.setTimeout(() => {
      try {
        Promise.resolve()
          .then(task)
          .catch(() => {
            if (failNote) setNote(failNote);
          });
      } catch {
        if (failNote) setNote(failNote);
      }
    }, 0);
  };

  const saveEditDraft = () => {
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
    const sheet = isSheetPlace(editDraft);
    const prevDraft = editDraft;
    const payload = {
      ...finalized,
      name,
      icon: normalizePinIcon(finalized.icon || editDraft.icon),
      updatedAt: Date.now(),
      source: sheet ? 'sheet' : editDraft.source || 'local',
      id: prevDraft.id || finalized.id,
    };
    if (sheet || inferShape(payload) === SHAPE_POINT) {
      absorbPointTwins(payload, prevDraft.center || editOrigin);
      setSheetPlaces(loadSheetPlaces());
      reloadLocal();
      goBrowse();
      setNote('已儲存（本機）');
      fireRemote(async () => {
        await Promise.allSettled([
          upsertLandmarkRegionRemote(payload),
          saveSavedLocationRemote(payload),
        ]);
        if (
          prevDraft.center &&
          (prevDraft.center.lat !== payload.center.lat ||
            prevDraft.center.lng !== payload.center.lng ||
            prevDraft.name !== payload.name)
        ) {
          await deleteSavedLocationRemote(prevDraft);
        }
        setNote('已儲存並同步');
      }, '已存本機，雲端同步失敗');
      return;
    }
    upsertLandmarkRegionLocal(payload);
    reloadLocal();
    goBrowse();
    setNote('已儲存（本機）');
    fireRemote(async () => {
      await upsertLandmarkRegionRemote(payload);
      setNote('已儲存並同步');
    }, '已存本機，雲端同步失敗');
  };

  const removeRegion = (id) => {
    if (!id) return;
    if (!window.confirm('確定刪除？')) return;
    try {
      const row = catalog.find((r) => r.id === id) || editDraft;
      if (editDraft?.id === id) goBrowse();
      if (inspectedId === id) setInspectedId(null);
      const sheet = isSheetPlace(row);
      forgetPlace(row || { id });
      setSheetPlaces(loadSheetPlaces());
      reloadLocal();
      setNote('已刪除');
      fireRemote(async () => {
        const tasks = [];
        if (sheet || (row && inferShape(row) === SHAPE_POINT)) {
          tasks.push(deleteSavedLocationRemote(row));
        }
        if (id) tasks.push(deleteLandmarkRegionRemote(id));
        await Promise.allSettled(tasks);
      }, '已刪本機，雲端同步失敗');
    } catch (err) {
      console.warn(err);
      setNote('已刪本機');
    }
  };

  const requestDelete = (region) => {
    if (!region?.id) return;
    removeRegion(region.id);
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
  const polyVertices = useMemo(() => {
    const verts = liveDraft?.vertices || [];
    if (!dragPreview || dragPreview.index == null) return verts;
    return verts.map((v, i) =>
      i === dragPreview.index ? { lat: dragPreview.lat, lng: dragPreview.lng } : v
    );
  }, [liveDraft, dragPreview]);
  const draftShape = liveDraft ? liveDraft.shape : SHAPE_CIRCLE;
  const tile = tilesFor(basemap);
  const coverageText = liveDraft ? formatCoverage(liveDraft) : '';

  const shapesToShow = useMemo(() => {
    const sameKind = catalog.filter((r) =>
      kind === 'point' ? isNamedPoint(r) : !isNamedPoint(r)
    );
    const focus =
      tab === 'create' && liveDraft
        ? { ...liveDraft, center: { lat: position[0], lng: position[1] } }
        : tab === 'browse' && inspectedId
          ? catalog.find((r) => r.id === inspectedId)
          : null;
    const toneOf = (r) => {
      const selected = Boolean(focus && r.id === focus.id);
      const affected = Boolean(
        focus && !selected && r.center && regionContains(focus, r.center)
      );
      const probeHit = Boolean(
        !focus && probe && regionContains(r, probe)
      );
      return {
        selected,
        affected: affected || probeHit,
        muted: Boolean(focus || probe) && !selected && !affected && !probeHit,
        nearby: tab === 'create' && !selected && !affected,
        hit: false,
        editing: false,
      };
    };
    const others = sameKind
      .filter((r) => !(liveDraft && r.id === liveDraft.id))
      .map((r) => ({ ...r, ...toneOf(r) }));
    if (tab === 'create' && liveDraft) {
      if (inferShape(liveDraft) === SHAPE_POINT) return others;
      return [
        ...others,
        {
          ...liveDraft,
          vertices: liveDraft.shape === SHAPE_POLYGON ? polyVertices : liveDraft.vertices,
          id: 'edit-draft',
          editing: true,
          selected: true,
          affected: false,
          muted: false,
          nearby: false,
          hit: false,
        },
      ];
    }
    return sameKind.map((r) => ({ ...r, ...toneOf(r) }));
  }, [tab, liveDraft, catalog, polyVertices, kind, inspectedId, position, probe]);

  const listedRegions = useMemo(() => {
    const pool = (tab !== 'browse' ? catalog : filterMode === 'here' ? hereHits : catalog).filter(
      (r) => (kind === 'point' ? isNamedPoint(r) : !isNamedPoint(r))
    );
    if (tab === 'browse' && filterMode === 'view' && mapBounds) {
      return pool.filter((r) => regionOverlapsView(r, mapBounds));
    }
    return pool;
  }, [tab, catalog, filterMode, hereHits, mapBounds, kind]);

  const inspectedRow = tab === 'browse' ? catalog.find((r) => r.id === inspectedId) : null;
  const listOrigin =
    inspectedRow?.center ||
    (probe && Number.isFinite(probe.lat) && Number.isFinite(probe.lng) ? probe : null);
  const listMeta = (r) => {
    if (!listOrigin || !r?.center) return shapeMeta(r);
    if (inspectedRow && r.id === inspectedRow.id) return '目前';
    const d = Number.isFinite(r.distanceM) ? r.distanceM : distanceMeters(listOrigin, r.center);
    return Number.isFinite(d) ? formatDist(d) : shapeMeta(r);
  };

  return (
    <div className="entry-card landmark-regions-card">
      <div className="entry-card-header landmark-regions-head">
        <ModeToggle
          ariaLabel="類型"
          value={kind}
          onChange={switchKind}
          options={[
            { id: 'region', label: '區域' },
            { id: 'point', label: '地標' },
          ]}
        />
        <div className="landmark-head-actions">
          {tab !== 'create' ? (
            <button
              type="button"
              className="landmark-add-btn"
              onClick={() => startCreateRegion(kind)}
            >
              {kind === 'point' ? '新增地標' : '新增區域'}
            </button>
          ) : null}
          <button
            type="button"
            className="calendar-status-refresh"
            onClick={() => syncFromCloud()}
            disabled={syncing}
            title={landmarkFetchHint()}
          >
            {syncing ? '同步中…' : '同步'}
          </button>
        </div>
      </div>

      {note && <div className="location-gps-hint">{note}</div>}

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

      <div
        ref={wrapRef}
        className={`landmark-manager-shell${isFullscreen ? ' is-fullscreen' : ''}`}
      >
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
            onClick={toggleFullscreen}
            title={isFullscreen ? '退出全螢幕' : '全螢幕編輯'}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? '退出全螢幕' : '全螢幕'}
          </button>
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
          className={basemap === 'satellite' ? 'is-satellite' : undefined}
          center={position}
          zoom={DEFAULT_ZOOM}
          maxZoom={MAX_ZOOM}
          style={{ height: isFullscreen ? '100%' : 320, width: '100%' }}
          zoomControl={false}
          scrollWheelZoom
          doubleClickZoom={tab !== 'create'}
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
          <ZoomControl
            key={isFullscreen ? 'zoom-fs' : 'zoom-n'}
            position={isFullscreen ? 'topright' : 'bottomright'}
          />
          <MapInvalidateOn token={sizeToken} />
          {shapesToShow.map((c) => (
            <RegionShape
              key={`${c.id}-${c.icon || 'place'}-${c.selected ? 's' : c.affected ? 'a' : c.muted ? 'm' : 'n'}`}
              region={c}
              editing={c.editing}
              nearby={c.nearby}
              selected={c.selected || inspectedId === c.id}
              affected={c.affected}
              muted={c.muted}
              interactive={tab === 'browse'}
              popupOpen={tab === 'browse' && inspectedId === c.id}
              onClick={tab === 'browse' && !c.editing ? () => inspectRegion(c) : undefined}
              onEdit={tab === 'browse' && !c.editing ? () => requestEdit(c) : undefined}
              onDelete={tab === 'browse' && !c.editing ? () => requestDelete(c) : undefined}
            />
          ))}
          {polygonMode && (
            <VertexMarkers
              vertices={liveDraft.vertices}
              selectedIndex={selectedVertex}
              onMove={movePolygonVertex}
              onSelect={selectPolygonVertex}
              onDragLive={onVertexDragLive}
            />
          )}
          {tab === 'create' && draftShape === SHAPE_POINT && editOrigin ? (
            <MoveGhost
              from={editOrigin}
              to={{ lat: position[0], lng: position[1] }}
            />
          ) : null}
          {tab === 'create' && !polygonMode && (
            <DraggableMarker position={position} onChange={handleChange} />
          )}
          {tab === 'browse' && probe ? (
            <>
              <RangeHalo
                center={probe}
                radiusM={DEFAULT_POINT_NEARBY_M}
                color="#1a73e8"
              />
              <ProbeDot lat={probe.lat} lng={probe.lng} />
            </>
          ) : null}
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
              ? '已選取 · 拖曳移動，或按刪除此點'
              : '點地圖加點 · 點頂點選取 · 拖過交叉會重排連線'}
          </div>
        )}
        {polygonMode && ringChoice ? (
          <div ref={ringChipRef} className="landmark-ring-chip">
            <span>已重排連線</span>
            <button type="button" onClick={keepOriginalRing}>
              維持原連線
            </button>
          </div>
        ) : null}
      </div>

      <div ref={dockRef} className="landmark-fs-dock">
      <div className="landmark-fs-tabs">
        <ModeToggle
          ariaLabel="類型"
          value={kind}
          onChange={switchKind}
          options={[
            { id: 'region', label: '區域' },
            { id: 'point', label: '地標' },
          ]}
        />
        {tab !== 'create' ? (
          <button
            type="button"
            className="landmark-add-btn"
            onClick={() => startCreateRegion(kind)}
          >
            {kind === 'point' ? '新增地標' : '新增區域'}
          </button>
        ) : null}
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
            {kind === 'point'
              ? editMode === 'edit'
                ? '編輯地標'
                : '新增地標'
              : editMode === 'edit'
                ? '編輯區域'
                : '新增區域'}
          </div>
          {kind === 'region' ? (
          <ModeToggle
            ariaLabel="形狀"
            value={draftShape === SHAPE_POINT ? SHAPE_CIRCLE : draftShape}
            onChange={setDraftShape}
            options={[
              { id: SHAPE_CIRCLE, label: '圓' },
              { id: SHAPE_RECT, label: '方' },
              { id: SHAPE_POLYGON, label: '多邊形' },
            ]}
          />
          ) : null}
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
            <ModeToggle
              className="pin-icon-toggle"
              ariaLabel="圖示"
              value={editDraft.icon || PIN_ICON_DEFAULT}
              onChange={(icon) => setEditDraft((d) => (d ? { ...d, icon } : d))}
              options={PIN_ICONS.map((p) => ({
                id: p.id,
                label: (
                  <>
                    <PinGlyph icon={p.id} size={13} />
                    {p.label}
                  </>
                ),
              }))}
            />
          ) : null}
          {draftShape === SHAPE_POINT ? (
            <p className="landmark-edit-hint">
              {editOrigin ? '拖曳標記。空心橙點是原本位置，取消即回到該點。' : '拖曳標記，填名稱'}
            </p>
          ) : draftShape === SHAPE_POLYGON ? (
            <div className="landmark-poly-tools">
              <p className="landmark-edit-hint">
                點地圖加點 · 點頂點選取 · 刪除請按刪除此點
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
            <button type="button" className="cancel-btn" onClick={cancelEdit}>
              取消
            </button>
            <button type="button" className="confirm-btn" onClick={saveEditDraft}>
              儲存
            </button>
          </div>
        </div>
      ) : (
        <>
          {inspectedRow ? (
            <div className="landmark-inspect-bar">
              <div className="landmark-inspect-bar-copy">
                <span className="landmark-inspect-bar-name">
                  {isNamedPoint(inspectedRow) ? (
                    <PinGlyph icon={inspectedRow.icon} size={15} />
                  ) : null}
                  {inspectedRow.name || '未命名'}
                </span>
                <span className="landmark-match-meta">{shapeMeta(inspectedRow)}</span>
              </div>
              <div className="landmark-inspect-bar-actions">
                <button
                  type="button"
                  className="location-search-btn"
                  onClick={() => startEditRegion(inspectedRow)}
                >
                  編輯
                </button>
                <button
                  type="button"
                  className="landmark-delete-btn"
                  onClick={() => removeRegion(inspectedRow.id)}
                >
                  刪除
                </button>
              </div>
            </div>
          ) : null}
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
            {catalog.filter((r) => (kind === 'point' ? isNamedPoint(r) : !isNamedPoint(r))).length ===
            0 ? (
              <li className="landmark-region-empty">{kind === 'point' ? '尚無地標' : '尚無區域'}</li>
            ) : listedRegions.length === 0 ? (
              <li className="landmark-region-empty">
                {filterMode === 'here'
                  ? kind === 'point'
                    ? '此處沒有地標'
                    : '此處沒有區域'
                  : kind === 'point'
                    ? '此畫面沒有地標'
                    : '此畫面沒有區域'}
              </li>
            ) : (
              listedRegions.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`landmark-all-item${inspectedId === r.id ? ' is-current' : ''}`}
                    aria-current={inspectedId === r.id ? 'true' : undefined}
                    onClick={() => inspectRegion(r, { fly: true })}
                  >
                    <span className="landmark-all-item-name">
                      {isNamedPoint(r) ? <PinGlyph icon={r.icon} size={14} /> : null}
                      {r.name}
                    </span>
                    <span className="landmark-match-meta">{listMeta(r)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </>
      )}
      </div>
      </div>
    </div>
  );
}

export default LandmarkRegionsManager;
