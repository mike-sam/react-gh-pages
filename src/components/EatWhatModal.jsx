import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapInvalidateOn, tilesFor } from './map/LeafletBits';
import { DEFAULT_MAP_CENTER } from '../utils/mapDefaults';
import { haversineKm } from '../utils/expenseSummary';
import { ensureEatPlaces, monthsAgoMs, parseEatWhen } from '../utils/eatPlaces';
import {
  loadLandmarkRegions,
  loadSheetPlaces,
  mergePlaceCatalog,
  normalizePinIcon,
  overlayLocalPinIcons,
  regionContains,
} from '../utils/landmarkRegions';
import { toMapsDriveUrl, toMapsUrl } from '../utils/locationStorage';
import { estimateDriveMinutes, fetchDriveMinutes, formatDriveMin } from '../utils/driveEta';
import { useSmartLocation } from '../hooks/useSmartLocation';

const DEFAULT_KM = 5;
const FOOD_ONLY_KEY = 'eatFoodLandmarkOnly';

function loadFoodOnly() {
  try {
    return localStorage.getItem(FOOD_ONLY_KEY) === '1';
  } catch {
    return false;
  }
}

function foodLandmarks() {
  const local = loadLandmarkRegions();
  const sheet = overlayLocalPinIcons(loadSheetPlaces());
  return mergePlaceCatalog(local, sheet).filter((r) => normalizePinIcon(r.icon) === 'food');
}

function zoomForKm(km) {
  if (km >= 16) return 10;
  if (km >= 8) return 11;
  if (km >= 4) return 12;
  if (km >= 2) return 13;
  return 14;
}

function clampKm(raw) {
  const x = Number(raw);
  if (!Number.isFinite(x)) return DEFAULT_KM;
  return Math.min(25, Math.max(0.5, Math.round(x * 2) / 2));
}

function includeLabel(months) {
  if (months === 12) return '包涵過去 1年';
  if (months === 24) return '包涵過去 2年';
  return `包涵過去 ${months} 月`;
}

function excludeLabel(months) {
  return months === 0 ? '不移除' : `移除最近 ${months} 月`;
}

function CarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
      />
    </svg>
  );
}

function MapDirector({ here, radiusKm, flyPoint, flyInToken, restoreToken, onZoomedChange }) {
  const map = useMap();
  const flyRef = useRef(flyInToken);
  const restoreRef = useRef(restoreToken);
  const savedRef = useRef(null);

  useEffect(() => {
    if (!here) return;
    savedRef.current = null;
    onZoomedChange?.(false);
    map.setView([here.lat, here.lng], zoomForKm(radiusKm));
  }, [radiusKm, here, map, onZoomedChange]);

  useEffect(() => {
    if (!flyInToken || flyInToken === flyRef.current) return;
    flyRef.current = flyInToken;
    if (!flyPoint || !Number.isFinite(flyPoint.lat)) return;
    const center = map.getCenter();
    savedRef.current = { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
    map.flyTo([flyPoint.lat, flyPoint.lng], 16, { duration: 0.35 });
    onZoomedChange?.(true);
  }, [flyInToken, flyPoint, map, onZoomedChange]);

  useEffect(() => {
    if (!restoreToken || restoreToken === restoreRef.current) return;
    restoreRef.current = restoreToken;
    const saved = savedRef.current;
    savedRef.current = null;
    if (saved) map.flyTo([saved.lat, saved.lng], saved.zoom, { duration: 0.35 });
    else if (here) map.flyTo([here.lat, here.lng], zoomForKm(radiusKm), { duration: 0.35 });
    onZoomedChange?.(false);
  }, [restoreToken, here, radiusKm, map, onZoomedChange]);

  return here ? (
    <Circle
      center={[here.lat, here.lng]}
      radius={radiusKm * 1000}
      pathOptions={{ color: '#3d9cf0', weight: 1, fillColor: '#3d9cf0', fillOpacity: 0.08 }}
    />
  ) : null;
}

function EatWhatPanel() {
  const { location, resolveForAction } = useSmartLocation();
  const tile = tilesFor('street');
  const [places, setPlaces] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_KM);
  const [includeMonths, setIncludeMonths] = useState(12);
  const [excludeMonths, setExcludeMonths] = useState(0);
  const [foodOnly, setFoodOnly] = useState(loadFoodOnly);
  const [foodPins, setFoodPins] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [pick, setPick] = useState(null);
  const [popupNonce, setPopupNonce] = useState(0);
  const [flyInToken, setFlyInToken] = useState(0);
  const [restoreToken, setRestoreToken] = useState(0);
  const [zoomedIn, setZoomedIn] = useState(false);
  const [etaMin, setEtaMin] = useState(null);
  const [etaBusy, setEtaBusy] = useState(false);
  const [etaErr, setEtaErr] = useState('');
  const spinRef = useRef(0);
  const etaAbort = useRef(null);

  const here = useMemo(() => {
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }, [location]);

  useEffect(() => {
    setErr('');
    setPick(null);
    setEtaMin(null);
    setEtaErr('');
    setLoading(true);
    resolveForAction?.().catch(() => {});
    setFoodPins(foodLandmarks());
    let alive = true;
    ensureEatPlaces()
      .then((data) => {
        if (alive) setPlaces(data.places || []);
      })
      .catch((e) => {
        if (alive) setErr(e.message || '讀取失敗');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      etaAbort.current?.abort();
    };
  }, [resolveForAction]);

  const nearby = useMemo(() => {
    if (!here) return [];
    const includeFrom = monthsAgoMs(includeMonths);
    const excludeAfter = excludeMonths > 0 ? monthsAgoMs(excludeMonths) : Number.POSITIVE_INFINITY;
    return (places || []).filter((p) => {
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      if (haversineKm(here.lat, here.lng, lat, lng) > radiusKm) return false;
      const when = parseEatWhen(p.lastAt);
      if (when && when < includeFrom) return false;
      if (when && when >= excludeAfter) return false;
      if (foodOnly && foodPins.length) {
        const point = { lat, lng };
        if (!foodPins.some((pin) => regionContains(pin, point))) return false;
      }
      return true;
    });
  }, [places, here, radiusKm, includeMonths, excludeMonths, foodOnly, foodPins]);

  const radiusEta = formatDriveMin(estimateDriveMinutes(radiusKm));
  const pickKm = pick && here ? haversineKm(here.lat, here.lng, pick.lat, pick.lng) : 0;
  const pickEta = pick ? formatDriveMin(estimateDriveMinutes(pickKm)) : '';

  const queryEta = useCallback(async () => {
    if (!here || !pick || !Number.isFinite(pick.lat)) return;
    etaAbort.current?.abort();
    const ac = new AbortController();
    etaAbort.current = ac;
    setEtaBusy(true);
    setEtaErr('');
    try {
      const min = await fetchDriveMinutes(here, pick, ac.signal);
      if (!ac.signal.aborted) setEtaMin(min);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setEtaMin(null);
      setEtaErr('車程查不到');
    } finally {
      if (!ac.signal.aborted) setEtaBusy(false);
    }
  }, [here, pick]);

  const placeFromRow = (row) => ({
    id: `${row.lat},${row.lng}`,
    lat: Number(row.lat),
    lng: Number(row.lng),
    title: String(row.title || '').trim(),
    description: String(row.description || '').trim(),
    lastAt: row.lastAt || '',
    n: Number(row.n) || 1,
  });

  const previewPlace = (row) => {
    spinRef.current += 1;
    setSpinning(false);
    setEtaMin(null);
    setEtaErr('');
    setPick(placeFromRow(row));
    setPopupNonce((n) => n + 1);
  };

  const spin = async () => {
    const pool = nearby;
    if (!pool.length || spinning) return;
    const seq = ++spinRef.current;
    setSpinning(true);
    setEtaMin(null);
    setEtaErr('');
    if (zoomedIn) setRestoreToken((n) => n + 1);
    let i = 0;
    const tick = () => {
      if (seq !== spinRef.current) return;
      setPick(placeFromRow(pool[i % pool.length]));
      i += 1;
      if (i < 14) {
        window.setTimeout(tick, 70);
      } else {
        setPick(placeFromRow(pool[Math.floor(Math.random() * pool.length)]));
        setPopupNonce((n) => n + 1);
        setSpinning(false);
      }
    };
    tick();
  };

  let meta = '沒有目前位置';
  if (loading) meta = '讀取中…';
  else if (err) meta = err;
  else if (here && foodOnly && !foodPins.length && !nearby.length) meta = '沒有餐飲地標，圈內也沒有紀錄';
  else if (here && foodOnly && !foodPins.length) meta = `沒有餐飲地標，改用吃過的 ${nearby.length} 處`;
  else if (here && foodOnly && !nearby.length) meta = '圈內沒有餐飲地標的紀錄，放寬方圓或關掉篩選';
  else if (here && !nearby.length) meta = '圈內沒有紀錄，改篩選或放寬方圓';
  else if (here && foodOnly) meta = `圈內 ${nearby.length} 處餐飲地標，點吃什麼`;
  else if (here) meta = `圈內 ${nearby.length} 處，點吃什麼`;

  return (
    <section className="eat-page" aria-label="吃什麼">
        <button
          type="button"
          className="expense-heat-spin eat-modal-spin"
          onClick={spin}
          disabled={spinning || loading || !here || !nearby.length}
        >
          {spinning ? '轉…' : pick ? '再來' : '吃什麼'}
        </button>
        <p className="eat-modal-meta">{meta}</p>

        <label className="eat-exclude">
          <input
            type="checkbox"
            checked={foodOnly}
            onChange={(e) => {
              const next = e.target.checked;
              if (next) setFoodPins(foodLandmarks());
              setFoodOnly(next);
              setPick(null);
              try {
                localStorage.setItem(FOOD_ONLY_KEY, next ? '1' : '0');
              } catch {
                /* private mode */
              }
            }}
          />
          只用地標餐廳
        </label>

        <label className="eat-slider">
          <span>{includeLabel(includeMonths)}</span>
          <input
            type="range"
            min="1"
            max="24"
            step="1"
            value={includeMonths}
            onChange={(e) => setIncludeMonths(Number(e.target.value))}
          />
        </label>
        <label className="eat-slider">
          <span>{excludeLabel(excludeMonths)}</span>
          <input
            type="range"
            min="0"
            max="12"
            step="1"
            value={excludeMonths}
            onChange={(e) => setExcludeMonths(Number(e.target.value))}
          />
        </label>
        <label className="eat-slider">
          <span>
            方圓 {radiusKm} km
            {radiusEta ? ` · 預估 ${radiusEta}，不含路況` : ''}
          </span>
          <input
            type="range"
            min="0.5"
            max="25"
            step="0.5"
            value={radiusKm}
            onChange={(e) => setRadiusKm(clampKm(e.target.value))}
          />
        </label>

        <div className="eat-modal-map">
          <MapContainer
            center={here ? [here.lat, here.lng] : [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng]}
            zoom={zoomForKm(radiusKm)}
            maxZoom={19}
            zoomControl={false}
            className="expense-heat-leaflet"
          >
            <TileLayer url={tile.url} attribution={tile.attribution} subdomains={tile.subdomains} />
            <ZoomControl position="bottomright" />
            <MapInvalidateOn token={`${radiusKm}|${nearby.length}`} />
            <MapDirector
              here={here}
              radiusKm={radiusKm}
              flyPoint={pick}
              flyInToken={flyInToken}
              restoreToken={restoreToken}
              onZoomedChange={setZoomedIn}
            />
            {nearby.map((p) => {
              const lat = Number(p.lat);
              const lng = Number(p.lng);
              const selected = pick && pick.lat === lat && pick.lng === lng;
              return (
                <CircleMarker
                  key={`${lat},${lng}`}
                  center={[lat, lng]}
                  radius={selected ? 12 : 9}
                  className="eat-place-marker"
                  eventHandlers={{ click: () => previewPlace(p) }}
                  pathOptions={{
                    color: selected ? '#fff' : '#e8710a',
                    weight: selected ? 2 : 1,
                    fillColor: '#e8710a',
                    fillOpacity: selected ? 0.9 : 0.55,
                  }}
                />
              );
            })}
            {pick && !spinning && Number.isFinite(pick.lat) ? (
              <Popup
                key={`${pick.id}-${popupNonce}`}
                position={[pick.lat, pick.lng]}
                autoPan={false}
                closeButton
              >
                <div className="eat-pop">
                  <div className="eat-pop-title">{pick.title || pick.description || '這裡'}</div>
                  {pick.title && pick.description ? (
                    <div className="eat-pop-desc">{pick.description}</div>
                  ) : null}
                  <button
                    type="button"
                    className="eat-pop-zoom"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (zoomedIn) setRestoreToken((n) => n + 1);
                      else setFlyInToken((n) => n + 1);
                    }}
                  >
                    {zoomedIn ? '回原視角' : '放大看'}
                  </button>
                </div>
              </Popup>
            ) : null}
          </MapContainer>
          {zoomedIn ? (
            <button
              type="button"
              className="eat-restore-view"
              onClick={() => setRestoreToken((n) => n + 1)}
            >
              回原視角
            </button>
          ) : null}
        </div>
        {pick ? (
          <div className="expense-heat-pick">
            <span>
              {pick.title || pick.description || '這裡'}
              {pick.title && pick.description ? ` · ${pick.description}` : ''}
              {etaBusy
                ? ' · 查車程…'
                : etaMin
                  ? ` · 車程 ${formatDriveMin(etaMin)}`
                  : pickEta
                    ? ` · 預估 ${pickEta}`
                    : ''}
              {etaErr ? ` · ${etaErr}` : ''}
            </span>
            <button
              type="button"
              className="eat-icon-btn"
              title="查車程"
              aria-label="查車程"
              disabled={etaBusy || !here}
              onClick={queryEta}
            >
              <SearchIcon />
            </button>
            <a
              className="expense-heat-nav"
              href={toMapsDriveUrl(pick.lat, pick.lng)}
              target="_blank"
              rel="noopener noreferrer"
              title="導航"
              aria-label="導航"
            >
              <CarIcon />
            </a>
            <a
              className="expense-heat-nav eat-landmark-btn"
              href={toMapsUrl(pick.lat, pick.lng, pick.title || pick.description)}
              target="_blank"
              rel="noopener noreferrer"
              title="地標"
              aria-label="地標"
            >
              地標
            </a>
          </div>
        ) : null}
    </section>
  );
}

export default EatWhatPanel;
