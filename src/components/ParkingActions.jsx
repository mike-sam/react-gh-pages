import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSmartLocation } from '../hooks/useSmartLocation';
import { useOfflineQueue } from '../context/QueueContext';
import { API_ENDPOINTS } from '../config';
import {
  DEFAULT_CAR_PLATES,
  formatFullTimestamp,
  formatRelativeTime,
  isParkedFetchFresh,
  loadParkedFetchAt,
  loadParkedForCar,
  loadSelectedCarPlate,
  markParkedFetched,
  markParkedFetchedMany,
  PARKED_FETCH_TTL_MS,
  saveParkedForCar,
  saveSelectedCarPlate,
} from '../utils/locationStorage';
import { DEFAULT_MAP_CENTER } from '../utils/mapDefaults';
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

function parkedDtoToLocal(dto, plateFallback) {
  if (!dto || typeof dto.lat !== 'number' || typeof dto.lng !== 'number') return null;
  const plate = (dto.carPlate || plateFallback || '').toString().trim().toUpperCase();
  return {
    lat: dto.lat,
    lng: dto.lng,
    label: dto.name || dto.label || '',
    accuracy: dto.accuracy ?? null,
    updatedAt: dto.timestampMs || Date.parse(String(dto.timestamp || '').replace(' ', 'T')) || Date.now(),
    carPlate: plate,
  };
}

/**
 * Simple parking: pick car → drag pin on inline map → save.
 */
function ParkingActions() {
  const { location: smartLoc, refreshLocation, hasLocation } = useSmartLocation();
  const { enqueueAndSend } = useOfflineQueue();
  const [presetPlates] = useState(DEFAULT_CAR_PLATES);
  const [plateMode, setPlateMode] = useState(() => {
    const saved = loadSelectedCarPlate();
    return DEFAULT_CAR_PLATES.includes(saved) ? saved : 'other';
  });
  const [customPlate, setCustomPlate] = useState(() => {
    const saved = loadSelectedCarPlate();
    return DEFAULT_CAR_PLATES.includes(saved) ? '' : saved;
  });
  const [draft, setDraft] = useState(null); // { lat, lng, label } — current pin
  /** Snapshot before unsaved edits (cloud/local parked, or last committed) */
  const [baseline, setBaseline] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [message, setMessage] = useState('');
  const [tick, setTick] = useState(0);
  /** Bump on plate tap / restore so map flies to pin */
  const [mapFocusNonce, setMapFocusNonce] = useState(0);
  /** Camera-only fly (返回車輛位置 after panning) */
  const [cameraFocus, setCameraFocus] = useState({
    lat: null,
    lng: null,
    nonce: 0,
  });
  /** idle | loading | synced | cached | empty | error */
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncNote, setSyncNote] = useState('');
  /** Lock map while cloud fetch in flight (unlock on done / fail / 3s timeout) */
  const [mapLocked, setMapLocked] = useState(false);
  /** Bump to force cloud fetch even within TTL */
  const [forceFetchNonce, setForceFetchNonce] = useState(0);
  const fetchAbortRef = useRef(0);
  const bulkPrefetchDone = useRef(false);

  const activePlate = useMemo(() => {
    if (plateMode === 'other') return (customPlate || '').trim().toUpperCase();
    return plateMode;
  }, [plateMode, customPlate]);

  const parked = useMemo(() => {
    if (!activePlate) return null;
    return loadParkedForCar(activePlate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlate, tick]);

  const lastFetchAt = useMemo(
    () => (activePlate ? loadParkedFetchAt(activePlate) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePlate, tick, forceFetchNonce]
  );

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
        note: existing ? '雲端尚無紀錄，顯示本機快取' : '尚無此車牌的車位紀錄',
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
      return { status: 'synced', note: '已從雲端同步車位' };
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
            ? `1 小時內已讀取（${formatFetchAge(loadParkedFetchAt(plate))}）· 點「重新撈取」可更新`
            : `1 小時內已查過雲端，尚無紀錄 · 點「重新撈取」可再查`
        );
        return;
      }

      setSyncStatus('loading');
      setSyncNote(force ? `正在重新撈取 ${plate}…` : `正在讀取 ${plate} 的車位…`);
      setMapLocked(true);

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
              ? '讀取逾時（3秒），已解鎖地圖 · 顯示本機快取'
              : '讀取逾時（3秒），已解鎖地圖 · 可手動選點'
            : existing
              ? '雲端讀取失敗，已解鎖地圖 · 顯示本機快取'
              : '雲端讀取失敗，已解鎖地圖 · 可手動選點'
        );
        setMapLocked(false);
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [applyCloudParked]
  );

  // Prefetch all plates once per session if any default plate is stale
  useEffect(() => {
    if (bulkPrefetchDone.current) return undefined;
    const needsBulk = DEFAULT_CAR_PLATES.some((p) => !isParkedFetchFresh(p));
    if (!needsBulk) {
      bulkPrefetchDone.current = true;
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = `${API_ENDPOINTS.PARK_LOCATION}?action=getParkedLocations`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.success || !data.byCar) return;
        const plates = [];
        Object.entries(data.byCar).forEach(([plate, dto]) => {
          const local = parkedDtoToLocal(dto, plate);
          if (!local) return;
          plates.push(plate);
          const existing = loadParkedForCar(plate);
          if (!existing || local.updatedAt >= (existing.updatedAt || 0)) {
            saveParkedForCar(plate, local);
          }
        });
        markParkedFetchedMany([...new Set([...plates, ...DEFAULT_CAR_PLATES])]);
        bulkPrefetchDone.current = true;
        if (!cancelled) setTick((n) => n + 1);
      } catch (err) {
        console.warn('getParkedLocations failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-fetch when plate changes (skipped if fresh within 1h)
  useEffect(() => {
    if (!activePlate) {
      setSyncStatus('idle');
      setSyncNote('');
      setMapLocked(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      fetchParkedFromCloud(activePlate, { force: false });
    }, 280);
    return () => clearTimeout(timer);
  }, [activePlate, fetchParkedFromCloud]);

  // Manual「重新撈取」only
  useEffect(() => {
    if (!forceFetchNonce || !activePlate) return undefined;
    fetchParkedFromCloud(activePlate, { force: true });
    return undefined;
  }, [forceFetchNonce]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: only on manual bump

  const handleForceFetch = () => {
    if (!activePlate || syncStatus === 'loading') return;
    setForceFetchNonce((n) => n + 1);
  };

  const resolveDraftForPlate = (plate) => {
    if (!plate) {
      return {
        lat: smartLoc?.lat ?? DEFAULT_MAP_CENTER.lat,
        lng: smartLoc?.lng ?? DEFAULT_MAP_CENTER.lng,
        label: smartLoc?.label || '',
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
    if (smartLoc) {
      return {
        lat: smartLoc.lat,
        lng: smartLoc.lng,
        label: smartLoc.label || '',
      };
    }
    return {
      lat: DEFAULT_MAP_CENTER.lat,
      lng: DEFAULT_MAP_CENTER.lng,
      label: '',
    };
  };

  // When switching car: parked → smart cache → default map center (still usable)
  useEffect(() => {
    const next = resolveDraftForPlate(activePlate);
    setDraft(next);
    commitBaseline(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlate, parked?.lat, parked?.lng, parked?.label, smartLoc]);

  const selectPlate = (plate) => {
    setPlateMode(plate);
    // Sync draft immediately so flyTo uses this plate's coords (not previous car)
    const nextPlate = plate === 'other' ? (customPlate || '').trim().toUpperCase() : plate;
    const next = resolveDraftForPlate(nextPlate || null);
    setDraft(next);
    commitBaseline(next);
    setMapFocusNonce((n) => n + 1);
  };

  const isDirty = Boolean(draft && baseline && !sameCoord(draft, baseline));

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
    setMessage('已還原到原始座標');
  };

  const returnToVehicle = () => {
    if (!vehicleAnchor) {
      setMessage('尚無車輛位置可返回');
      return;
    }
    setCameraFocus((prev) => ({
      lat: vehicleAnchor.lat,
      lng: vehicleAnchor.lng,
      nonce: prev.nonce + 1,
    }));
    setMessage('已返回車輛位置視角');
  };

  const seedFromCache = () => {
    if (!smartLoc) {
      setDraft({
        lat: DEFAULT_MAP_CENTER.lat,
        lng: DEFAULT_MAP_CENTER.lng,
        label: '',
      });
      setMessage('尚無上次定位，已放到預設地圖中心 — 請直接點地圖選點');
      return;
    }
    setDraft({
      lat: smartLoc.lat,
      lng: smartLoc.lng,
      label: smartLoc.label || '',
    });
    setMapFocusNonce((n) => n + 1);
    setMessage('已移到上次定位位置，可拖曳微調');
  };

  const seedFromGps = async () => {
    setIsSeeding(true);
    setMessage('');
    try {
      const coords = await refreshLocation();
      setDraft({
        lat: coords.lat,
        lng: coords.lng,
        label: coords.label || '',
      });
      setMapFocusNonce((n) => n + 1);
      setMessage('已移到目前 GPS 位置，可拖曳微調');
    } catch (err) {
      setDraft((prev) =>
        prev || {
          lat: DEFAULT_MAP_CENTER.lat,
          lng: DEFAULT_MAP_CENTER.lng,
          label: '',
        }
      );
      setMessage('無法取得 GPS，請直接在地圖上點選');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleMapChange = (lat, lng) => {
    setDraft((prev) => ({
      lat,
      lng,
      label: prev?.label || '',
    }));
  };

  const handlePark = async () => {
    if (!activePlate) {
      setMessage('請選擇或輸入車牌');
      return;
    }
    if (!draft) {
      setMessage('請先在地圖上選好座標');
      return;
    }

    setIsSaving(true);
    setMessage('');
    try {
      const id = Date.now();
      const payload = {
        id,
        action: 'save_parking',
        latitude: draft.lat,
        longitude: draft.lng,
        accuracy: null,
        label: draft.label || '',
        carPlate: activePlate,
        timestamp: new Date().toISOString(),
      };

      const parkedRecord = {
        lat: draft.lat,
        lng: draft.lng,
        accuracy: null,
        updatedAt: Date.now(),
        label: draft.label || '',
        carPlate: activePlate,
      };
      saveParkedForCar(activePlate, parkedRecord);
      commitBaseline(parkedRecord);
      setTick((n) => n + 1);

      const result = await enqueueAndSend(payload);
      setMessage(
        result.sent
          ? `已記下 ${activePlate} 車位`
          : `已暫存 ${activePlate} 車位（離線佇列）`
      );
      markParkedFetched(activePlate);
      setTick((n) => n + 1);
      setSyncStatus('synced');
      setSyncNote('已儲存並上傳');
    } catch (err) {
      setMessage(`失敗：${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNavigate = () => {
    const target = parked || draft;
    if (!target) {
      setMessage(activePlate ? `${activePlate} 尚無車位` : '請先選擇車牌');
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${target.lat},${target.lng}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="entry-card parking-actions">
      <div className="entry-card-header">
        <span>🚗 車輛位置</span>
        {activePlate ? (
          <span className="entry-route-badge">{activePlate}</span>
        ) : null}
      </div>

      <section className="parking-section">
        <label className="entry-field-label">選擇車輛</label>
        <div className="entry-chip-row">
          {presetPlates.map((plate) => (
            <button
              key={plate}
              type="button"
              className={`entry-chip ${plateMode === plate ? 'active' : ''}`}
              onClick={() => selectPlate(plate)}
            >
              {plate}
            </button>
          ))}
          <button
            type="button"
            className={`entry-chip ${plateMode === 'other' ? 'active' : ''}`}
            onClick={() => selectPlate('other')}
          >
            其他
          </button>
        </div>
        {plateMode === 'other' && (
          <input
            className="entry-text-input"
            value={customPlate}
            onChange={(e) => setCustomPlate(e.target.value.toUpperCase())}
            placeholder="輸入車牌"
          />
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
              <span>{syncNote || '正在讀取車位…'}</span>
            </>
          )}
          {syncStatus === 'synced' && <span>{syncNote || '已同步'}</span>}
          {syncStatus === 'cached' && (
            <span>{syncNote || `沿用快取（${formatFetchAge(lastFetchAt)}）`}</span>
          )}
          {syncStatus === 'empty' && <span>{syncNote || '尚無車位紀錄'}</span>}
          {syncStatus === 'error' && <span>{syncNote || '讀取失敗'}</span>}
          {syncStatus === 'idle' && <span>選擇車牌後會自動讀取雲端車位</span>}
        </div>
        {activePlate && syncStatus !== 'loading' && syncStatus !== 'idle' && (
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
        <label className="entry-field-label">把標記移到</label>
        <div className="parking-seed-row parking-seed-row--3">
          <button
            type="button"
            className="parking-seed-btn"
            onClick={seedFromCache}
            disabled={!hasLocation || mapLocked}
            title={hasLocation ? '使用 App 上次定位快取' : '尚無上次定位'}
          >
            <span className="parking-seed-btn-title">上次定位</span>
            <span className="parking-seed-btn-sub">
              {hasLocation ? '本機快取座標' : '尚無快取'}
            </span>
          </button>
          <button
            type="button"
            className="parking-seed-btn"
            onClick={seedFromGps}
            disabled={isSeeding || mapLocked}
            title="向系統重新取得目前 GPS"
          >
            <span className="parking-seed-btn-title">
              {isSeeding ? '定位中…' : '目前 GPS'}
            </span>
            <span className="parking-seed-btn-sub">重新定位並移過去</span>
          </button>
          <button
            type="button"
            className="parking-seed-btn"
            onClick={returnToVehicle}
            disabled={!vehicleAnchor || mapLocked}
            title="地圖視角回到車輛位置（不改標記，方便你逛完地圖回來）"
          >
            <span className="parking-seed-btn-title">返回車輛</span>
            <span className="parking-seed-btn-sub">只移動視角</span>
          </button>
        </div>
      </section>

      <ParkingMapPreview
        lat={draft?.lat}
        lng={draft?.lng}
        onChange={handleMapChange}
        editable
        interactive={!mapLocked}
        lockReason={mapLocked ? syncNote || '讀取車位中…' : ''}
        focusKey={activePlate || plateMode}
        focusNonce={mapFocusNonce}
        originLat={baseline?.lat}
        originLng={baseline?.lng}
        showOriginMarker={isDirty}
        cameraLat={cameraFocus.lat}
        cameraLng={cameraFocus.lng}
        cameraNonce={cameraFocus.nonce}
      />

      {draft && (
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
                <button
                  type="button"
                  className="parking-dirty-btn parking-dirty-btn--cancel"
                  onClick={restoreOriginal}
                >
                  取消
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
          ) : syncStatus === 'loading' ? (
            <div className="parking-saved-meta parking-saved-meta--muted">
              正在確認上次儲存時間…
            </div>
          ) : null}
        </div>
      )}

      <div className="entry-btn-row parking-actions-row">
        <button
          type="button"
          className="entry-primary-btn"
          onClick={handlePark}
          disabled={isSaving || !activePlate || !draft}
        >
          {isSaving ? '儲存中…' : '記車位'}
        </button>
        <button
          type="button"
          className="entry-secondary-btn"
          onClick={handleNavigate}
          disabled={!parked && !draft}
        >
          導航找車
        </button>
      </div>

      {message && <div className="entry-message">{message}</div>}
    </div>
  );
}

export default ParkingActions;
