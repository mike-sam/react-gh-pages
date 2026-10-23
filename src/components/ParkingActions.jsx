import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOfflineQueue } from '../context/QueueContext';
import { useSmartLocation } from '../hooks/useSmartLocation';
import { API_ENDPOINTS } from '../config';
import { isIOS } from '../utils/platform';
import {
  buildVehiclePageUrl,
  consumeVehicleQuickDraft,
  copyVehicleShare,
  latlongValue,
  sendVehicleWhatsApp,
  takeVehicleQuickDraft,
} from '../utils/vehicleShare';
import VehicleUrlExamples from './VehicleUrlExamples';
import {
  formatFullTimestamp,
  formatRelativeTime,
  applyParkedByCar,
  isParkedFetchFresh,
  loadParkedFetchAt,
  loadParkedForCar,
  markParkedFetched,
  parkedDtoToLocal,
  PARKED_FETCH_TTL_MS,
  saveParkedForCar,
  saveSelectedCarPlate,
} from '../utils/locationStorage';
import {
  ensureAppBootstrap,
  isBootstrapAttemptCooling,
  subscribeAppBootstrap,
} from '../utils/appBootstrap';
import { DEFAULT_MAP_CENTER } from '../utils/mapDefaults';
import {
  ALL_VEHICLES,
  VEHICLE_EXPENSE_CAT,
  VEHICLE_EXPENSE_SHORTCUTS,
  addVehicle,
  canFitFleet,
  listFleetMarkers,
  loadVehicleRoster,
  locatedFleet,
  normalizePlate,
  removeVehicle,
} from '../utils/vehicles';
import { navigate, ROUTES } from '../utils/routing';
import ParkingMapPreview from './ParkingMapPreview';

const FETCH_TIMEOUT_MS = 3000;

function formatFetchAge(at) {
  if (!at) return '';
  const min = Math.floor((Date.now() - at) / 60000);
  if (min < 1) return '剛剛讀取';
  if (min < 60) return `${min} 分鐘前讀取`;
  const hr = Math.floor(min / 60);
  return `${hr} 小時前讀取`;
}

function sameCoord(a, b, eps = 1e-6) {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < eps && Math.abs(a.lng - b.lng) < eps;
}

function formatCoordPair(lat, lng) {
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

function ParkingActions() {
  const { enqueueAndSend } = useOfflineQueue();
  const { resolveForAction } = useSmartLocation();
  const [roster, setRoster] = useState(() => loadVehicleRoster());
  const [selection, setSelection] = useState(ALL_VEHICLES);
  const [adding, setAdding] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [tick, setTick] = useState(0);
  const [mapFocusNonce, setMapFocusNonce] = useState(0);
  const [fitNonce, setFitNonce] = useState(1);
  const [cameraFocus, setCameraFocus] = useState({
    lat: null,
    lng: null,
    nonce: 0,
  });
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncNote, setSyncNote] = useState('');
  const [mapLocked, setMapLocked] = useState(false);
  const [forceFetchNonce, setForceFetchNonce] = useState(0);
  const fetchAbortRef = useRef(0);
  const bulkPrefetchDone = useRef(false);
  const pendingDraftRef = useRef(null);
  const quickRanRef = useRef(false);
  const onIOS = useMemo(() => isIOS(), []);

  const isAll = selection === ALL_VEHICLES;
  const activePlate = isAll ? '' : selection;

  const parked = useMemo(() => {
    if (!activePlate) return null;
    return loadParkedForCar(activePlate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlate, tick]);

  const fleet = useMemo(() => {
    const markers = listFleetMarkers(roster);
    if (!activePlate || !draft) return markers;
    const patched = markers.map((m) =>
      m.plate === activePlate ? { ...m, lat: draft.lat, lng: draft.lng, label: draft.label || m.label } : m
    );
    if (patched.some((m) => m.plate === activePlate)) return patched;
    return [...patched, { plate: activePlate, lat: draft.lat, lng: draft.lng, label: draft.label || '', updatedAt: 0 }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, tick, parked?.lat, parked?.lng, activePlate, draft?.lat, draft?.lng, draft?.label]);

  const located = useMemo(() => locatedFleet(fleet), [fleet]);
  const canFitAll = canFitFleet(located);
  const tooFar = isAll && located.length >= 2 && !canFitAll;

  useEffect(() => {
    if (activePlate) saveSelectedCarPlate(activePlate);
  }, [activePlate]);

  const commitBaseline = useCallback((pos) => {
    if (!pos || typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return;
    setBaseline({
      lat: pos.lat,
      lng: pos.lng,
      label: pos.label || '',
    });
  }, []);

  const applyCloudParked = useCallback((plate, dto) => {
    if (!dto) {
      const existing = loadParkedForCar(plate);
      markParkedFetched(plate);
      setTick((n) => n + 1);
      return {
        status: existing ? 'synced' : 'empty',
        note: existing ? '雲端尚無紀錄，顯示本機快取' : '尚無此車牌的位置',
      };
    }
    const local = parkedDtoToLocal(dto, plate);
    if (!local) {
      return { status: 'empty', note: '雲端資料格式異常' };
    }
    const existing = loadParkedForCar(plate);
    if (!existing || local.updatedAt >= (existing.updatedAt || 0)) {
      saveParkedForCar(plate, local);
      setTick((n) => n + 1);
      const next = {
        lat: local.lat,
        lng: local.lng,
        label: local.label || '',
      };
      setDraft(next);
      commitBaseline(next);
      markParkedFetched(plate);
      return { status: 'synced', note: '已從雲端同步' };
    }
    markParkedFetched(plate);
    setTick((n) => n + 1);
    return { status: 'synced', note: '本機紀錄較新，已保留' };
  }, [commitBaseline]);

  const fetchParkedFromCloud = useCallback(
    async (plate, { force = false } = {}) => {
      if (!plate) return;
      const reqId = ++fetchAbortRef.current;

      if (!force && isParkedFetchFresh(plate)) {
        const existing = loadParkedForCar(plate);
        setMapLocked(false);
        setSyncStatus(existing ? 'cached' : 'empty');
        setSyncNote(
          existing
            ? `1 小時內已讀取（${formatFetchAge(loadParkedFetchAt(plate))}）`
            : '1 小時內已查過雲端，尚無紀錄'
        );
        return;
      }

      if (!force && isBootstrapAttemptCooling()) {
        const existing = loadParkedForCar(plate);
        setMapLocked(false);
        setSyncStatus(existing ? 'cached' : 'empty');
        setSyncNote(
          existing
            ? '稍早已向雲端查過，先用本機快取'
            : '稍早已向雲端查過'
        );
        return;
      }

      setSyncStatus('loading');
      setSyncNote(force ? `正在重新撈取 ${plate}…` : `正在讀取 ${plate}…`);
      const existingLocal = loadParkedForCar(plate);
      if (force && !existingLocal) setMapLocked(true);
      else setMapLocked(false);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort('timeout'), FETCH_TIMEOUT_MS);

      try {
        const url = `${API_ENDPOINTS.PARK_LOCATION}?action=getParkedLocation&carPlate=${encodeURIComponent(plate)}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (reqId !== fetchAbortRef.current) return;
        if (!data?.success) throw new Error(data?.error || '讀取失敗');

        const result = applyCloudParked(plate, data.parked || null);
        if (reqId !== fetchAbortRef.current) return;
        setSyncStatus(result.status);
        setSyncNote(result.note);
        setMapLocked(false);
      } catch (err) {
        console.warn('getParkedLocation failed', err);
        if (reqId !== fetchAbortRef.current) return;
        const existing = loadParkedForCar(plate);
        const timedOut =
          err?.name === 'AbortError' ||
          err === 'timeout' ||
          String(err?.message || err).toLowerCase().includes('abort');
        setSyncStatus('error');
        setSyncNote(
          timedOut
            ? existing
              ? '讀取逾時，顯示本機快取'
              : '讀取逾時，可在地圖上選點'
            : existing
              ? '雲端讀取失敗，顯示本機快取'
              : '雲端讀取失敗，可在地圖上選點'
        );
        setMapLocked(false);
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [applyCloudParked]
  );

  useEffect(() => {
    if (bulkPrefetchDone.current) return undefined;
    bulkPrefetchDone.current = true;
    let cancelled = false;
    const unsub = subscribeAppBootstrap(() => {
      if (!cancelled) setTick((n) => n + 1);
    });
    ensureAppBootstrap().then((result) => {
      if (cancelled) return;
      setTick((n) => n + 1);
      if (result === 'ok' || result === 'cached' || result === 'cooldown') return;
      if (isBootstrapAttemptCooling()) return;
      if (roster.every((p) => isParkedFetchFresh(p))) return;
      (async () => {
        try {
          const url = `${API_ENDPOINTS.PARK_LOCATION}?action=getParkedLocations`;
          const res = await fetch(url);
          if (!res.ok) return;
          const data = await res.json();
          if (cancelled || !data?.success || !data.byCar) return;
          applyParkedByCar(data.byCar);
          if (!cancelled) {
            setTick((n) => n + 1);
            setFitNonce((n) => n + 1);
          }
        } catch (err) {
          console.warn('getParkedLocations failed', err);
        }
      })();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [roster]);

  useEffect(() => {
    if (isAll) {
      setSyncStatus(located.length ? 'synced' : 'empty');
      setSyncNote(
        located.length
          ? `地圖顯示 ${located.length} 輛`
          : roster.length
            ? '尚無已記錄的位置'
            : '請新增車輛'
      );
      setMapLocked(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      fetchParkedFromCloud(activePlate, { force: false });
    }, 280);
    return () => clearTimeout(timer);
  }, [isAll, activePlate, fetchParkedFromCloud, located.length, roster.length]);

  useEffect(() => {
    if (!forceFetchNonce) return undefined;
    if (isAll) {
      (async () => {
        setSyncStatus('loading');
        setSyncNote('正在重新撈取全部…');
        try {
          const url = `${API_ENDPOINTS.PARK_LOCATION}?action=getParkedLocations`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!data?.success) throw new Error(data?.error || '讀取失敗');
          applyParkedByCar(data.byCar);
          setTick((n) => n + 1);
          setFitNonce((n) => n + 1);
          setSyncStatus('synced');
          setSyncNote('已同步全部');
        } catch (err) {
          console.warn(err);
          setSyncStatus('error');
          setSyncNote('雲端讀取失敗，顯示本機');
        }
      })();
      return undefined;
    }
    if (!activePlate) return undefined;
    fetchParkedFromCloud(activePlate, { force: true });
    return undefined;
  }, [forceFetchNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleForceFetch = () => {
    if (syncStatus === 'loading') return;
    setForceFetchNonce((n) => n + 1);
  };

  const resolveDraftForPlate = (plate) => {
    if (!plate) {
      return {
        lat: DEFAULT_MAP_CENTER.lat,
        lng: DEFAULT_MAP_CENTER.lng,
        label: '',
      };
    }
    const saved = loadParkedForCar(plate);
    if (saved) {
      return {
        lat: saved.lat,
        lng: saved.lng,
        label: saved.label || '',
      };
    }
    return {
      lat: DEFAULT_MAP_CENTER.lat,
      lng: DEFAULT_MAP_CENTER.lng,
      label: '',
    };
  };

  useEffect(() => {
    if (isAll) return;
    if (pendingDraftRef.current) {
      const next = pendingDraftRef.current;
      pendingDraftRef.current = null;
      setDraft(next);
      commitBaseline(next);
      return;
    }
    const next = resolveDraftForPlate(activePlate);
    setDraft(next);
    commitBaseline(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlate, parked?.lat, parked?.lng, parked?.label, isAll]);

  const selectPlate = (plate) => {
    setAdding(false);
    setMessage('');
    if (plate === ALL_VEHICLES) {
      setSelection(ALL_VEHICLES);
      setDraft(null);
      setBaseline(null);
      if (canFitFleet(locatedFleet(listFleetMarkers(roster)))) {
        setFitNonce((n) => n + 1);
      }
      return;
    }
    setSelection(plate);
    const next = resolveDraftForPlate(plate);
    setDraft(next);
    commitBaseline(next);
    setMapFocusNonce((n) => n + 1);
  };

  const handleAddVehicle = (e) => {
    e?.preventDefault?.();
    const plate = normalizePlate(newPlate);
    if (!plate) {
      setMessage('請輸入車牌');
      return;
    }
    const nextRoster = addVehicle(plate);
    setRoster(nextRoster);
    setNewPlate('');
    setAdding(false);
    selectPlate(plate);
    setMessage(`已加入 ${plate}`);
  };

  const handleRemoveVehicle = () => {
    if (!activePlate) return;
    if (!window.confirm(`刪除 ${activePlate}？地圖上不再顯示，過去記錄會保留。`)) return;
    const nextRoster = removeVehicle(activePlate);
    setRoster(nextRoster);
    setSelection(ALL_VEHICLES);
    setDraft(null);
    setBaseline(null);
    setFitNonce((n) => n + 1);
    setMessage(`已刪除 ${activePlate}，過去記錄仍保留`);
  };

  const isDirty = Boolean(!isAll && draft && baseline && !sameCoord(draft, baseline));

  const sharePayload = useMemo(() => {
    if (!activePlate) return null;
    const pos = draft && typeof draft.lat === 'number' ? draft : parked;
    if (!pos || typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return null;
    const isPlaceholder = !parked && sameCoord(pos, DEFAULT_MAP_CENTER);
    if (isPlaceholder && !isDirty) return null;
    return {
      plate: activePlate,
      lat: pos.lat,
      lng: pos.lng,
      label: pos.label || parked?.label || '',
      updatedAt: isDirty ? Date.now() : parked?.updatedAt || Date.now(),
    };
  }, [activePlate, draft, parked, isDirty]);

  const liveVehicleUrl = useMemo(() => {
    if (!sharePayload) return '';
    return buildVehiclePageUrl({
      plate: sharePayload.plate,
      latlong: latlongValue(sharePayload.lat, sharePayload.lng, sharePayload.label),
    });
  }, [sharePayload]);

  const vehicleAnchor = useMemo(() => {
    if (parked && typeof parked.lat === 'number') {
      return { lat: parked.lat, lng: parked.lng, label: parked.label || '' };
    }
    if (baseline) return baseline;
    return draft;
  }, [parked, baseline, draft]);

  const restoreOriginal = () => {
    if (!baseline) return;
    setDraft({ ...baseline });
    setMapFocusNonce((n) => n + 1);
    setMessage('已還原');
  };

  const returnToVehicle = () => {
    if (isAll) {
      if (tooFar) {
        setMessage('車輛太遠，無法同時顯示');
        return;
      }
      if (!located.length) {
        setMessage('尚無車輛位置可返回');
        return;
      }
      setFitNonce((n) => n + 1);
      setMessage(located.length === 1 ? '已返回車輛' : '已顯示全部車輛');
      return;
    }
    if (!vehicleAnchor) {
      setMessage('尚無車輛位置可返回');
      return;
    }
    setCameraFocus((prev) => ({
      lat: vehicleAnchor.lat,
      lng: vehicleAnchor.lng,
      nonce: prev.nonce + 1,
    }));
    setMessage('已返回車輛');
  };

  const handleMapChange = (lat, lng) => {
    if (isAll) return;
    setDraft((prev) => ({
      lat,
      lng,
      label: prev?.label || '',
    }));
  };

  const parkNow = useCallback(
    async ({ plate, pos, autoWhatsApp = false, autoCopy = false } = {}) => {
      const usePlate = plate || activePlate;
      const usePos = pos || draft;
      if (!usePlate) {
        setMessage('請先選擇車輛');
        return false;
      }
      if (!usePos || typeof usePos.lat !== 'number' || typeof usePos.lng !== 'number') {
        setMessage('請先在地圖上選好座標');
        return false;
      }

      setIsSaving(true);
      setMessage('');
      try {
        const lat = usePos.lat;
        const lng = usePos.lng;
        const label = usePos.label || '';
        const id = Date.now();
        const payload = {
          id,
          action: 'save_parking',
          latitude: lat,
          longitude: lng,
          accuracy: null,
          label,
          carPlate: usePlate,
          timestamp: new Date().toISOString(),
        };

        const parkedRecord = {
          lat,
          lng,
          accuracy: null,
          updatedAt: Date.now(),
          label,
          carPlate: usePlate,
        };
        saveParkedForCar(usePlate, parkedRecord);
        commitBaseline(parkedRecord);
        setDraft({ lat, lng, label });
        setTick((n) => n + 1);

        const result = await enqueueAndSend(payload);
        setMessage(
          result.sent
            ? `已記下 ${usePlate} 位置`
            : `已暫存 ${usePlate} 位置（離線佇列）`
        );
        markParkedFetched(usePlate);
        setTick((n) => n + 1);
        setSyncStatus('synced');
        setSyncNote('已儲存並上傳');

        const share = { plate: usePlate, lat, lng, label, updatedAt: Date.now() };
        if (autoCopy) {
          const ok = await copyVehicleShare(share);
          if (ok && !autoWhatsApp) setMessage(`已記下 ${usePlate} · 已複製`);
        }
        if (autoWhatsApp) {
          sendVehicleWhatsApp(share);
        }
        return true;
      } catch (err) {
        setMessage(`失敗：${err.message || err}`);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [activePlate, draft, enqueueAndSend, commitBaseline]
  );

  const handlePark = () => {
    parkNow();
  };

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const arm = () => {
      takeVehicleQuickDraft();
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        const q = consumeVehicleQuickDraft();
        if (!q) return;
        const plate = normalizePlate(q.plate);
        if (plate) {
          const nextRoster = addVehicle(plate);
          setRoster(nextRoster);
          if (q.latlong) {
            pendingDraftRef.current = {
              lat: q.latlong.lat,
              lng: q.latlong.lng,
              label: q.latlong.label || '',
            };
          }
          setSelection(plate);
          setAdding(false);
        }

        if (!q.silent) return;
        if (quickRanRef.current) return;
        if (!plate) {
          setMessage('silent 需要車牌');
          return;
        }
        quickRanRef.current = true;

        let pos = q.latlong
          ? { lat: q.latlong.lat, lng: q.latlong.lng, label: q.latlong.label || '' }
          : null;
        if (!pos) {
          setMessage('正在定位…');
          try {
            pos = await resolveForAction();
          } catch {
            pos = null;
          }
        }
        if (cancelled) return;
        if (!pos || typeof pos.lat !== 'number' || typeof pos.lng !== 'number') {
          quickRanRef.current = false;
          setMessage('無法取得定位，請在地圖選點後儲存');
          return;
        }
        const next = { lat: pos.lat, lng: pos.lng, label: pos.label || '' };
        pendingDraftRef.current = next;
        setDraft(next);
        await parkNow({
          plate,
          pos: next,
          autoWhatsApp: q.send,
          autoCopy: q.copy,
        });
      }, 50);
    };

    arm();
    window.addEventListener('hashchange', arm);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('hashchange', arm);
    };
    // One-shot URL consume + later hash queries
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavigate = () => {
    const target = parked || draft;
    if (!target) {
      setMessage(activePlate ? `${activePlate} 尚無位置` : '請先選擇車輛');
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${target.lat},${target.lng}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const jumpExpense = (subcat) => {
    if (!activePlate) return;
    navigate(ROUTES.EXPENSE, {
      query: {
        cat: VEHICLE_EXPENSE_CAT,
        subcat,
        carPlate: activePlate,
      },
    });
  };

  const returnDisabled = isAll
    ? !located.length || tooFar || mapLocked
    : !vehicleAnchor || mapLocked;
  const returnTitle = tooFar
    ? '車輛太遠，無法同時顯示'
    : isAll
      ? '視角涵蓋全部車輛'
      : '地圖視角回到車輛（不改標記）';

  return (
    <div className="entry-card parking-actions">
      <div className="entry-card-header">
        <span>🚗 車輛</span>
        <span className="entry-route-badge">{isAll ? '全部' : activePlate}</span>
      </div>

      <section className="parking-section">
        <div className="entry-chip-row">
          <button
            type="button"
            className={`entry-chip ${isAll ? 'active' : ''}`}
            onClick={() => selectPlate(ALL_VEHICLES)}
          >
            全部
          </button>
          {roster.map((plate) => (
            <button
              key={plate}
              type="button"
              className={`entry-chip ${selection === plate ? 'active' : ''}`}
              onClick={() => selectPlate(plate)}
            >
              {plate}
            </button>
          ))}
          <button
            type="button"
            className={`entry-chip ${adding ? 'active' : ''}`}
            onClick={() => {
              setAdding((v) => !v);
              setNewPlate('');
            }}
          >
            新增
          </button>
        </div>
        {adding && (
          <form className="vehicle-add-row" onSubmit={handleAddVehicle}>
            <input
              className="entry-text-input"
              value={newPlate}
              onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
              placeholder="車牌"
              autoFocus
            />
            <button type="submit" className="location-search-btn">
              加入
            </button>
          </form>
        )}
      </section>

      <div
        className={`parking-sync-banner parking-sync-banner--${syncStatus}`}
        role="status"
        aria-live="polite"
      >
        <div className="parking-sync-banner-body">
          {syncStatus === 'loading' && (
            <>
              <span className="parking-sync-spinner" aria-hidden />
              <span>{syncNote || '讀取中…'}</span>
            </>
          )}
          {syncStatus !== 'loading' && <span>{syncNote || '選擇車輛'}</span>}
        </div>
        {syncStatus !== 'loading' && (
          <button
            type="button"
            className="parking-sync-refresh"
            onClick={handleForceFetch}
            title={`強制從雲端重新撈取（一般 ${Math.round(PARKED_FETCH_TTL_MS / 60000)} 分鐘內不自動重讀）`}
          >
            重新撈取
          </button>
        )}
      </div>

      <section className="parking-section">
        <button
          type="button"
          className="parking-seed-btn parking-seed-btn--return"
          onClick={returnToVehicle}
          disabled={returnDisabled}
          title={returnTitle}
        >
          <span className="parking-seed-btn-title">返回車輛</span>
          <span className="parking-seed-btn-sub">
            {tooFar ? '車輛太遠，無法同時顯示' : isAll ? '涵蓋全部' : '只移動視角'}
          </span>
        </button>
      </section>

      <ParkingMapPreview
        lat={draft?.lat}
        lng={draft?.lng}
        onChange={handleMapChange}
        editable={!isAll}
        interactive={!mapLocked}
        lockReason={mapLocked ? syncNote || '讀取中…' : ''}
        focusKey={activePlate || selection}
        focusNonce={mapFocusNonce}
        originLat={baseline?.lat}
        originLng={baseline?.lng}
        showOriginMarker={isDirty}
        cameraLat={cameraFocus.lat}
        cameraLng={cameraFocus.lng}
        cameraNonce={cameraFocus.nonce}
        fleet={fleet}
        activePlate={activePlate}
        onSelectPlate={selectPlate}
        fitNonce={fitNonce}
        viewMode={isAll ? 'fleet' : 'single'}
        fitEnabled={canFitAll}
      />

      {!isAll && draft && (
        <div className={`parking-coord-card${isDirty ? ' is-dirty' : ''}`}>
          <div className="parking-coord-main">
            <span className="parking-coord-label">
              {isDirty ? '目前選點（未儲存）' : '目前座標'}
            </span>
            <code className="parking-coord-value">
              {formatCoordPair(draft.lat, draft.lng)}
            </code>
          </div>

          {isDirty && baseline && (
            <div className="parking-dirty-bar">
              <div className="parking-coord-main">
                <span className="parking-coord-label">原始座標</span>
                <code className="parking-coord-value parking-coord-value--muted">
                  {formatCoordPair(baseline.lat, baseline.lng)}
                </code>
              </div>
              <div className="parking-dirty-actions">
                <button
                  type="button"
                  className="parking-dirty-btn parking-dirty-btn--restore"
                  onClick={restoreOriginal}
                >
                  還原
                </button>
              </div>
            </div>
          )}

          {parked?.updatedAt ? (
            <div className="parking-saved-meta">
              <span className="parking-saved-label">上次儲存</span>
              <span className="parking-saved-relative">
                {formatRelativeTime(parked.updatedAt)}
              </span>
              <time
                className="parking-saved-timestamp"
                dateTime={new Date(parked.updatedAt).toISOString()}
              >
                {formatFullTimestamp(parked.updatedAt)}
              </time>
            </div>
          ) : null}

          {sharePayload && (
            <div className="parking-share-bar">
              <button
                type="button"
                className="parking-share-btn"
                onClick={async () => {
                  const ok = await copyVehicleShare(sharePayload);
                  setMessage(ok ? '已複製' : '無法複製');
                }}
              >
                複製
              </button>
              <button
                type="button"
                className="parking-share-btn parking-share-btn--wa"
                title={onIOS ? '捷徑 whatsapp.recordCar' : '開啟 WhatsApp'}
                onClick={() => {
                  sendVehicleWhatsApp(sharePayload);
                  setMessage(onIOS ? '已開啟捷徑' : '已開啟 WhatsApp');
                }}
              >
                WhatsApp
              </button>
            </div>
          )}
        </div>
      )}

      <div className="entry-btn-row parking-actions-row">
        {!isAll && (
          <button
            type="button"
            className="entry-primary-btn"
            onClick={handlePark}
            disabled={isSaving || !activePlate || !draft}
          >
            {isSaving ? '儲存中…' : '儲存位置'}
          </button>
        )}
        <button
          type="button"
          className="entry-secondary-btn"
          onClick={handleNavigate}
          disabled={isAll ? located.length !== 1 : !parked && !draft}
        >
          導航
        </button>
        {!isAll && activePlate && (
          <button
            type="button"
            className="landmark-delete-btn"
            onClick={handleRemoveVehicle}
          >
            刪除車輛
          </button>
        )}
      </div>

      {message && <div className="entry-message">{message}</div>}

      {!isAll && activePlate && (
        <section className="vehicle-expense-block">
          <div className="vehicle-expense-head">
            <span className="entry-field-label">記帳</span>
            <span className="entry-hint">開支出頁並帶入車牌，不是記位置</span>
          </div>
          <div className="vehicle-shortcuts">
            {VEHICLE_EXPENSE_SHORTCUTS.map((item) => (
              <button
                key={item.subcat}
                type="button"
                className="vehicle-shortcut-btn"
                onClick={() => jumpExpense(item.subcat)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <VehicleUrlExamples liveUrl={liveVehicleUrl} />
    </div>
  );
}

export default ParkingActions;
