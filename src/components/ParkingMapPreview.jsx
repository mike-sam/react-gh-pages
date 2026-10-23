import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_MAP_CENTER, withMapFallback } from '../utils/mapDefaults';

const MAX_ZOOM = 19;
const DEFAULT_ZOOM = 16;
/** Keep pins clear of top chips / bottom attribution / zoom. */
const MAP_PAD = { top: 56, right: 52, bottom: 28, left: 12 };

function focusLatLng(map, lat, lng, zoom = DEFAULT_ZOOM) {
  if (!map || typeof lat !== 'number' || typeof lng !== 'number') return;
  const z = Math.min(MAX_ZOOM, Math.max(Number(zoom) || DEFAULT_ZOOM, 14));
  const b = L.latLngBounds([
    [lat, lng],
    [lat, lng],
  ]);
  map.flyToBounds(b, {
    paddingTopLeft: [MAP_PAD.left, MAP_PAD.top],
    paddingBottomRight: [MAP_PAD.right, MAP_PAD.bottom],
    maxZoom: z,
    duration: 0.45,
  });
}

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const TILES = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    subdomains: ['a', 'b', 'c'],
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    subdomains: [],
  },
};

const CAR_SVG =
  '<svg class="vehicle-marker-car" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M5.2 11.2 6.7 7A1.8 1.8 0 0 1 8.4 5.8h7.2A1.8 1.8 0 0 1 17.3 7l1.5 4.2H20a1 1 0 0 1 1 1V15h-1.2a2.1 2.1 0 0 1-4.2 0H8.4a2.1 2.1 0 0 1-4.2 0H3v-2.8a1 1 0 0 1 1-1h1.2zm2.2-1.6h9.2l-.9-2.5a.4.4 0 0 0-.4-.3H8.7a.4.4 0 0 0-.4.3l-.9 2.5zM7.3 16.1a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2zm9.4 0a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2z"/></svg>';

function plateIcon(plate, { active = false } = {}) {
  const safe = String(plate || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return L.divIcon({
    className: `leaflet-div-icon vehicle-marker${active ? ' is-active' : ''}`,
    html: `<div class="vehicle-marker-stack"><span class="vehicle-marker-plate">${safe}</span><span class="vehicle-marker-pin">${CAR_SVG}</span></div>`,
    iconSize: [76, 54],
    iconAnchor: [38, 54],
  });
}

function FitFleet({ points, nonce, enabled = true }) {
  const map = useMap();
  const prev = useRef(nonce);
  const didInit = useRef(false);

  useEffect(() => {
    const valid = (points || []).filter(
      (p) => typeof p?.lat === 'number' && typeof p?.lng === 'number'
    );
    const bumped = nonce != null && nonce !== prev.current;
    prev.current = nonce;

    if (valid.length === 0) return;
    if (!bumped && didInit.current) return;
    didInit.current = true;
    if (!enabled) {
      focusLatLng(map, valid[0].lat, valid[0].lng, DEFAULT_ZOOM);
      return;
    }
    if (valid.length === 1) {
      focusLatLng(map, valid[0].lat, valid[0].lng, DEFAULT_ZOOM);
      return;
    }
    const b = L.latLngBounds(valid.map((p) => [p.lat, p.lng]));
    map.flyToBounds(b, {
      paddingTopLeft: [MAP_PAD.left, MAP_PAD.top],
      paddingBottomRight: [MAP_PAD.right, MAP_PAD.bottom],
      maxZoom: 16,
      duration: 0.45,
    });
  }, [points, nonce, enabled, map]);

  return null;
}

/**
 * Camera control:
 * - focusKey / focusNonce → fly to marker (plate tap / restore)
 * - cameraNonce → fly only (return to vehicle after panning), does not require pin change
 * Avoid setView on every lat tick so user can pan freely while editing.
 */
function Recenter({ lat, lng, focusKey, focusNonce, cameraLat, cameraLng, cameraNonce }) {
  const map = useMap();
  const prevFocus = useRef({ key: null, nonce: null });
  const prevCamera = useRef(cameraNonce);
  const pendingFocus = useRef(true);

  useEffect(() => {
    const focusChanged =
      (focusKey != null && focusKey !== prevFocus.current.key) ||
      (focusNonce != null && focusNonce !== prevFocus.current.nonce);
    if (focusChanged) pendingFocus.current = true;
    prevFocus.current = { key: focusKey, nonce: focusNonce };

    if (!pendingFocus.current) return;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    pendingFocus.current = false;
    focusLatLng(map, lat, lng, Math.max(map.getZoom() || DEFAULT_ZOOM, DEFAULT_ZOOM));
  }, [lat, lng, focusKey, focusNonce, map]);

  useEffect(() => {
    if (cameraNonce == null || cameraNonce === prevCamera.current) return;
    prevCamera.current = cameraNonce;
    if (typeof cameraLat !== 'number' || typeof cameraLng !== 'number') return;
    focusLatLng(map, cameraLat, cameraLng, Math.max(map.getZoom() || DEFAULT_ZOOM, DEFAULT_ZOOM));
  }, [cameraNonce, cameraLat, cameraLng, map]);

  return null;
}

function FleetMarker({ plate, lat, lng, active, draggable, onSelect, onMove }) {
  const markerRef = useRef(null);
  const icon = useMemo(() => plateIcon(plate, { active }), [plate, active]);
  return (
    <Marker
      draggable={Boolean(draggable)}
      autoPan={Boolean(draggable)}
      position={[lat, lng]}
      icon={icon}
      zIndexOffset={active ? 800 : 400}
      ref={markerRef}
      eventHandlers={{
        click(e) {
          L.DomEvent.stopPropagation(e.originalEvent || e);
          onSelect?.(plate);
        },
        dragend() {
          const marker = markerRef.current;
          if (!marker) return;
          const ll = marker.getLatLng();
          onMove?.(ll.lat, ll.lng);
        },
      }}
    />
  );
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

/** Leaflet map options don't hot-reload — toggle handlers when lock changes. */
function MapInteractionGate({ enabled }) {
  const map = useMap();
  useEffect(() => {
    const handlers = [
      map.dragging,
      map.touchZoom,
      map.doubleClickZoom,
      map.scrollWheelZoom,
      map.boxZoom,
      map.keyboard,
    ];
    handlers.forEach((h) => {
      if (!h) return;
      if (enabled) h.enable();
      else h.disable();
    });
    const el = map.getContainer();
    if (el) el.style.cursor = enabled ? '' : 'wait';
  }, [enabled, map]);
  return null;
}

/** After CSS size changes (fullscreen), tell Leaflet to remeasure. */
function MapInvalidateOn({ token }) {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 80);
    return () => window.clearTimeout(t);
  }, [token, map]);
  return null;
}

/**
 * Detect when the marker is outside the current viewport (user panned away).
 * Calls onOffChange(true/false).
 */
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
      const sw = map.containerPointToLatLng(L.point(MAP_PAD.left, size.y - MAP_PAD.bottom));
      const ne = map.containerPointToLatLng(L.point(size.x - MAP_PAD.right, MAP_PAD.top));
      const inner = L.latLngBounds(sw, ne);
      if (!inner || (typeof inner.isValid === 'function' && !inner.isValid())) {
        onOffChange(false);
        return;
      }
      onOffChange(!inner.contains([lat, lng]));
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

/** Camera-only return to marker — triggered by external button via nonce. */
function FlyToMarkerOnNonce({ lat, lng, nonce }) {
  const map = useMap();
  const prev = useRef(nonce);
  useEffect(() => {
    if (!nonce || nonce === prev.current) return;
    prev.current = nonce;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    focusLatLng(map, lat, lng, Math.max(map.getZoom() || DEFAULT_ZOOM, DEFAULT_ZOOM));
  }, [nonce, lat, lng, map]);
  return null;
}

function openInGoogleMaps(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return;
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Inline park map — street / satellite toggle, pinch & zoom controls.
 * focusKey / focusNonce: bump when user picks a plate → fly to max zoom.
 * interactive=false locks pan/zoom/edit (e.g. while cloud fetch).
 */
function ParkingMapPreview({
  lat,
  lng,
  onChange,
  height = 260,
  editable = true,
  interactive = true,
  lockReason = '',
  focusKey,
  focusNonce,
  /** Ghost marker for original / saved vehicle position while editing */
  originLat,
  originLng,
  showOriginMarker = false,
  /** Camera-only fly (e.g. 返回車輛位置 after panning) */
  cameraLat,
  cameraLng,
  cameraNonce,
  /** All vehicles to draw. `{ plate, lat, lng }` */
  fleet = [],
  activePlate = '',
  onSelectPlate,
  /** Bump to fit all (or the only) located vehicles */
  fitNonce,
  /** 'fleet' fits all; 'single' flies to the active pin */
  viewMode = 'single',
  fitEnabled = true,
}) {
  const seed = withMapFallback(lat, lng);
  const wrapRef = useRef(null);
  const [position, setPosition] = useState([seed.lat, seed.lng]);
  const [basemap, setBasemap] = useState('street');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sizeToken, setSizeToken] = useState(0);
  const [offMarker, setOffMarker] = useState(false);
  const [returnNonce, setReturnNonce] = useState(0);
  const returnBtnRef = useRef(null);
  const canEdit = editable && interactive;

  // Keep Leaflet from treating the overlay button as a map click (would move the pin)
  useEffect(() => {
    const el = returnBtnRef.current;
    if (!el) return undefined;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    return undefined;
  }, [offMarker, interactive]);

  useEffect(() => {
    const next = withMapFallback(lat, lng);
    setPosition([next.lat, next.lng]);
  }, [lat, lng]);

  useEffect(() => {
    const onFsChange = () => {
      const el = wrapRef.current;
      const active = Boolean(
        document.fullscreenElement === el ||
          document.webkitFullscreenElement === el
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

  const handleChange = (nextLat, nextLng) => {
    if (!canEdit) return;
    setPosition([nextLat, nextLng]);
    onChange?.(nextLat, nextLng);
  };

  const toggleFullscreen = async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      const active =
        document.fullscreenElement === el ||
        document.webkitFullscreenElement === el;
      if (active) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else {
        // Fallback: CSS expanded mode when Fullscreen API unavailable (e.g. some iOS)
        setIsFullscreen((v) => !v);
        setSizeToken((n) => n + 1);
      }
    } catch (err) {
      console.warn('fullscreen failed', err);
      setIsFullscreen((v) => !v);
      setSizeToken((n) => n + 1);
    }
  };

  const tile = TILES[basemap] || TILES.street;
  const hasOrigin =
    showOriginMarker &&
    typeof originLat === 'number' &&
    typeof originLng === 'number';
  const viewLat = position[0];
  const viewLng = position[1];
  const locatedFleet = (fleet || []).filter(
    (m) => typeof m?.lat === 'number' && typeof m?.lng === 'number' && m.plate
  );
  const showFleet = locatedFleet.length > 0;
  const editingSingle = canEdit && Boolean(activePlate) && activePlate !== 'all';
  const fleetHasActive = locatedFleet.some((m) => m.plate === activePlate);
  const googleTarget = editingSingle
    ? { lat: viewLat, lng: viewLng }
    : locatedFleet[0]
      ? { lat: locatedFleet[0].lat, lng: locatedFleet[0].lng }
      : { lat: viewLat, lng: viewLng };

  return (
    <div
      ref={wrapRef}
      className={`parking-map-preview parking-map-editable${interactive ? '' : ' is-locked'}${isFullscreen ? ' is-fullscreen' : ''}`}
      style={isFullscreen ? undefined : { height }}
    >
      <div className="parking-map-basemap" role="group" aria-label="地圖類型">
        <button
          type="button"
          className={`parking-map-basemap-btn${basemap === 'street' ? ' is-active' : ''}`}
          onClick={() => setBasemap('street')}
          aria-pressed={basemap === 'street'}
          disabled={!interactive}
        >
          街道
        </button>
        <button
          type="button"
          className={`parking-map-basemap-btn${basemap === 'satellite' ? ' is-active' : ''}`}
          onClick={() => setBasemap('satellite')}
          aria-pressed={basemap === 'satellite'}
          disabled={!interactive}
        >
          衛星
        </button>
      </div>

      <div className="parking-map-actions" role="group" aria-label="地圖檢視">
        <button
          type="button"
          className="parking-map-action-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? '退出全螢幕' : '全螢幕查看'}
          aria-pressed={isFullscreen}
        >
          {isFullscreen ? '退出全螢幕' : '全螢幕'}
        </button>
        <button
          type="button"
          className="parking-map-action-btn"
          onClick={() => openInGoogleMaps(googleTarget.lat, googleTarget.lng)}
          title="用 Google Maps 開啟"
          disabled={typeof googleTarget.lat !== 'number' || typeof googleTarget.lng !== 'number'}
        >
          Google Maps
        </button>
        {interactive && editingSingle && offMarker && (
          <button
            ref={returnBtnRef}
            type="button"
            className="parking-map-action-btn"
            title="返回目前標記（不改標記）"
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
              setReturnNonce((n) => n + 1);
            }}
          >
            返回坐標
          </button>
        )}
      </div>

      <MapContainer
        center={position}
        zoom={DEFAULT_ZOOM}
        maxZoom={MAX_ZOOM}
        minZoom={3}
        style={{ height: '100%', width: '100%', borderRadius: isFullscreen ? 0 : 10 }}
        zoomControl={false}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        dragging={interactive}
      >
        <TileLayer
          key={basemap}
          attribution={tile.attribution}
          url={tile.url}
          subdomains={tile.subdomains}
          maxZoom={MAX_ZOOM}
          maxNativeZoom={basemap === 'satellite' ? 19 : 19}
        />
        {interactive && <ZoomControl position="bottomright" />}
        <MapInteractionGate enabled={interactive} />
        <MapInvalidateOn token={sizeToken} />
        <OffMarkerWatcher
          lat={editingSingle ? position[0] : locatedFleet[0]?.lat}
          lng={editingSingle ? position[1] : locatedFleet[0]?.lng}
          onOffChange={setOffMarker}
        />
        {hasOrigin && (
          <Marker
            position={[originLat, originLng]}
            opacity={0.45}
            zIndexOffset={-200}
          />
        )}
        {showFleet
          ? locatedFleet.map((m) => (
              <FleetMarker
                key={m.plate}
                plate={m.plate}
                lat={
                  m.plate === activePlate && typeof position[0] === 'number'
                    ? position[0]
                    : m.lat
                }
                lng={
                  m.plate === activePlate && typeof position[1] === 'number'
                    ? position[1]
                    : m.lng
                }
                active={m.plate === activePlate}
                draggable={editingSingle && m.plate === activePlate}
                onSelect={onSelectPlate}
                onMove={handleChange}
              />
            ))
          : null}
        {editingSingle && !fleetHasActive ? (
          <DraggableMarker position={position} onChange={handleChange} />
        ) : null}
        <MapClickHandler onChange={handleChange} enabled={editingSingle} />
        {viewMode === 'fleet' ? (
          <FitFleet points={locatedFleet} nonce={fitNonce ?? 0} enabled={fitEnabled} />
        ) : (
          <Recenter
            lat={typeof lat === 'number' ? lat : null}
            lng={typeof lng === 'number' ? lng : null}
            focusKey={focusKey}
            focusNonce={focusNonce}
            cameraLat={cameraLat}
            cameraLng={cameraLng}
            cameraNonce={cameraNonce}
          />
        )}
        <FlyToMarkerOnNonce
          lat={editingSingle ? position[0] : locatedFleet[0]?.lat}
          lng={editingSingle ? position[1] : locatedFleet[0]?.lng}
          nonce={returnNonce}
        />
      </MapContainer>

      {!interactive && (
        <div className="parking-map-lock" aria-live="polite">
          <span className="parking-sync-spinner" aria-hidden />
          <span>{lockReason || '讀取車位中…'}</span>
        </div>
      )}
      {editingSingle && interactive && !isFullscreen && (
        <div className="parking-map-hint">
          {typeof lat === 'number'
            ? '拖曳標記 · 點地圖 · 雙指縮放'
            : `無 GPS 也可點地圖選點（預設 ${DEFAULT_MAP_CENTER.lat}, ${DEFAULT_MAP_CENTER.lng} 附近）`}
        </div>
      )}
    </div>
  );
}

export default ParkingMapPreview;
