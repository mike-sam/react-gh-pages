import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_MAP_CENTER, withMapFallback } from '../utils/mapDefaults';

const MAX_ZOOM = 19;
const DEFAULT_ZOOM = 16;

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

/**
 * Camera control:
 * - focusKey / focusNonce → fly to marker (plate tap / restore)
 * - cameraNonce → fly only (return to vehicle after panning), does not require pin change
 * Avoid setView on every lat tick so user can pan freely while editing.
 */
function Recenter({ lat, lng, focusKey, focusNonce, cameraLat, cameraLng, cameraNonce }) {
  const map = useMap();
  const prevFocus = useRef({ key: focusKey, nonce: focusNonce });
  const prevCamera = useRef(cameraNonce);
  const didInit = useRef(false);

  useEffect(() => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    const focusChanged =
      (focusKey != null && focusKey !== prevFocus.current.key) ||
      (focusNonce != null && focusNonce !== prevFocus.current.nonce);
    prevFocus.current = { key: focusKey, nonce: focusNonce };

    if (focusChanged) {
      map.flyTo([lat, lng], MAX_ZOOM, { duration: 0.55 });
      didInit.current = true;
      return;
    }

    if (!didInit.current) {
      map.setView([lat, lng], map.getZoom() || DEFAULT_ZOOM);
      didInit.current = true;
    }
  }, [lat, lng, focusKey, focusNonce, map]);

  useEffect(() => {
    if (cameraNonce == null || cameraNonce === prevCamera.current) return;
    prevCamera.current = cameraNonce;
    if (typeof cameraLat !== 'number' || typeof cameraLng !== 'number') return;
    map.flyTo([cameraLat, cameraLng], MAX_ZOOM, { duration: 0.55 });
  }, [cameraNonce, cameraLat, cameraLng, map]);

  return null;
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
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      onOffChange(false);
      return;
    }
    const marker = L.latLng(lat, lng);
    // Slightly shrink bounds so near-edge still counts as "away"
    const visible = map.getBounds().pad(-0.08);
    onOffChange(!visible.contains(marker));
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
    map.flyTo([lat, lng], Math.max(map.getZoom(), DEFAULT_ZOOM), {
      duration: 0.45,
    });
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
          onClick={() => openInGoogleMaps(viewLat, viewLng)}
          title="用 Google Maps 開啟目前標記位置"
          disabled={typeof viewLat !== 'number' || typeof viewLng !== 'number'}
        >
          Google Maps
        </button>
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
          lat={position[0]}
          lng={position[1]}
          onOffChange={setOffMarker}
        />
        {hasOrigin && (
          <Marker
            position={[originLat, originLng]}
            opacity={0.45}
            zIndexOffset={-200}
          />
        )}
        {canEdit ? (
          <>
            <DraggableMarker position={position} onChange={handleChange} />
            <MapClickHandler onChange={handleChange} enabled />
          </>
        ) : (
          <Marker position={position} draggable={false} />
        )}
        <Recenter
          lat={position[0]}
          lng={position[1]}
          focusKey={focusKey}
          focusNonce={focusNonce}
          cameraLat={cameraLat}
          cameraLng={cameraLng}
          cameraNonce={cameraNonce}
        />
        <FlyToMarkerOnNonce
          lat={position[0]}
          lng={position[1]}
          nonce={returnNonce}
        />
      </MapContainer>

      {interactive && offMarker && (
        <button
          ref={returnBtnRef}
          type="button"
          className="parking-map-return-pin"
          title="返回目前標記座標（不改標記）"
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

      {!interactive && (
        <div className="parking-map-lock" aria-live="polite">
          <span className="parking-sync-spinner" aria-hidden />
          <span>{lockReason || '讀取車位中…'}</span>
        </div>
      )}
      {editable && interactive && !isFullscreen && (
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
