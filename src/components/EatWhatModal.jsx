import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_ZOOM, MapInvalidateOn, tilesFor } from './map/LeafletBits';
import { DEFAULT_MAP_CENTER } from '../utils/mapDefaults';
import { haversineKm } from '../utils/expenseSummary';
import { ensureEatPlaces, monthsAgoMs, parseEatWhen } from '../utils/eatPlaces';
import { toMapsDriveUrl, toMapsUrl } from '../utils/locationStorage';
import { estimateDriveMinutes, fetchDriveMinutes, formatDriveMin } from '../utils/driveEta';
import { useSmartLocation } from '../hooks/useSmartLocation';
import { useHistoryOverlay } from '../hooks/useHistoryOverlay';

const DEFAULT_KM = 5;

const PICK_ICON = L.divIcon({
  className: 'eat-pick-icon',
  html: '<span class="eat-pick-pin"></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 34],
});

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

function MapDirector({ here, radiusKm, flyPoint, flyNonce, zoomOutToken }) {
  const map = useMap();
  const flyRef = useRef(flyNonce);
  const outRef = useRef(zoomOutToken);

  useEffect(() => {
    if (!zoomOutToken || zoomOutToken === outRef.current) return;
    outRef.current = zoomOutToken;
    if (here && Number.isFinite(here.lat)) {
      map.flyTo([here.lat, here.lng], zoomForKm(radiusKm), { duration: 0.4 });
    }
  }, [zoomOutToken, here, radiusKm, map]);

  useEffect(() => {
    if (!flyPoint || flyNonce === flyRef.current) return;
    flyRef.current = flyNonce;
    map.flyTo([flyPoint.lat, flyPoint.lng], 16, { duration: 0.4 });
  }, [flyPoint, flyNonce, map]);

  useEffect(() => {
    if (!here) return;
    map.setView([here.lat, here.lng], Math.max(map.getZoom() || DEFAULT_ZOOM, zoomForKm(radiusKm)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!here || flyPoint) return;
    map.setView([here.lat, here.lng], zoomForKm(radiusKm));
  }, [radiusKm, here, flyPoint, map]);

  return here ? (
    <Circle
      center={[here.lat, here.lng]}
      radius={radiusKm * 1000}
      pathOptions={{ color: '#3d9cf0', weight: 1, fillColor: '#3d9cf0', fillOpacity: 0.08 }}
    />
  ) : null;
}

function EatWhatModal({ open, onClose }) {
  useHistoryOverlay(open, onClose);
  const { location, resolveForAction } = useSmartLocation();
  const tile = tilesFor('street');
  const [places, setPlaces] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_KM);
  const [includeMonths, setIncludeMonths] = useState(12);
  const [excludeMonths, setExcludeMonths] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [pick, setPick] = useState(null);
  const [zoomOutToken, setZoomOutToken] = useState(0);
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
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setErr('');
    setPick(null);
    setEtaMin(null);
    setEtaErr('');
    setLoading(true);
    resolveForAction?.().catch(() => {});
    ensureEatPlaces()
      .then((data) => setPlaces(data.places || []))
      .catch((e) => setErr(e.message || '讀取失敗'))
      .finally(() => setLoading(false));
    return () => {
      document.body.style.overflow = prev;
      etaAbort.current?.abort();
    };
  }, [open, resolveForAction]);

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
      return true;
    });
  }, [places, here, radiusKm, includeMonths, excludeMonths]);

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

  const spin = async () => {
    const pool = nearby;
    if (!pool.length || spinning) return;
    const seq = ++spinRef.current;
    setSpinning(true);
    setEtaMin(null);
    setEtaErr('');
    if (pick) {
      setZoomOutToken((n) => n + 1);
      await new Promise((r) => setTimeout(r, 420));
      if (seq !== spinRef.current) return;
    }
    const toPick = (row, i) => ({
      id: `${row.lat},${row.lng}-${i || row.lastAt || ''}`,
      lat: Number(row.lat),
      lng: Number(row.lng),
      title: String(row.title || '').trim(),
      description: String(row.description || '').trim(),
      lastAt: row.lastAt || '',
      n: Number(row.n) || 1,
    });
    let i = 0;
    const tick = () => {
      if (seq !== spinRef.current) return;
      setPick(toPick(pool[i % pool.length], i));
      i += 1;
      if (i < 14) {
        window.setTimeout(tick, 70);
      } else {
        setPick(toPick(pool[Math.floor(Math.random() * pool.length)]));
        setSpinning(false);
      }
    };
    tick();
  };

  let meta = '沒有目前位置';
  if (loading) meta = '讀取中…';
  else if (err) meta = err;
  else if (here && !nearby.length) meta = '圈內沒有紀錄，改篩選或放寬方圓';
  else if (here) meta = `圈內 ${nearby.length} 處，點吃什麼`;

  if (!open) return null;

  const node = (
    <div className="eat-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="eat-modal"
        role="dialog"
        aria-label="吃什麼"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eat-modal-head">
          <h4>吃什麼</h4>
          <button type="button" className="picker-modal-close" onClick={onClose} aria-label="關閉">
            ✕
          </button>
        </div>
        <button
          type="button"
          className="expense-heat-spin eat-modal-spin"
          onClick={spin}
          disabled={spinning || loading || !here || !nearby.length}
        >
          {spinning ? '轉…' : pick ? '再來' : '吃什麼'}
        </button>
        <p className="eat-modal-meta">{meta}</p>

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
            <MapInvalidateOn token={`${open}|${radiusKm}|${nearby.length}`} />
            <MapDirector
              here={here}
              radiusKm={radiusKm}
              flyPoint={pick}
              flyNonce={pick ? pick.id : ''}
              zoomOutToken={zoomOutToken}
            />
            {nearby.map((p) => (
              <CircleMarker
                key={`${p.lat},${p.lng}`}
                center={[Number(p.lat), Number(p.lng)]}
                radius={pick && pick.lat === Number(p.lat) && pick.lng === Number(p.lng) ? 11 : 7}
                pathOptions={{
                  color: pick && pick.lat === Number(p.lat) && pick.lng === Number(p.lng) ? '#fff' : '#e8710a',
                  weight: pick && pick.lat === Number(p.lat) && pick.lng === Number(p.lng) ? 2 : 0,
                  fillColor: '#e8710a',
                  fillOpacity: 0.45,
                }}
              />
            ))}
            {pick && Number.isFinite(pick.lat) ? (
              <Marker position={[pick.lat, pick.lng]} icon={PICK_ICON} />
            ) : null}
          </MapContainer>
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
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

export default EatWhatModal;
