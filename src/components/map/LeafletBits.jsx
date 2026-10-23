import React, { useEffect, useRef } from 'react';
import {
  Circle,
  CircleMarker,
  Marker,
  Polygon,
  Polyline,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  formatDist,
  inferShape,
  pinIconMeta,
  pinIconSvgHtml,
  SHAPE_POINT,
  SHAPE_POLYGON,
  SHAPE_RECT,
} from '../../utils/landmarkRegions';

export function PinGlyph({ icon, size = 14, className = '' }) {
  const pin = pinIconMeta(icon);
  return (
    <svg
      className={`landmark-pin-svg${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
    >
      <path fill="currentColor" d={pin.path} />
    </svg>
  );
}

function pinDropHtml(icon, { fill, stroke, glyph }) {
  const pin = pinIconMeta(icon);
  const inner =
    pin.id === 'place'
      ? `<span class="landmark-drop-dot"></span>`
      : pinIconSvgHtml(icon, glyph);
  return `<span class="landmark-drop">
    <svg class="landmark-drop-body" viewBox="0 0 24 36" aria-hidden="true">
      <path fill="${fill}" stroke="${stroke}" stroke-width="1.5"
        d="M12 1.4c-5.7 0-10.3 4.6-10.3 10.3 0 8.4 10.3 22.6 10.3 22.6s10.3-14.2 10.3-22.6C22.3 6 17.7 1.4 12 1.4z"/>
    </svg>
    <span class="landmark-drop-glyph">${inner}</span>
  </span>`;
}

export const MAX_ZOOM = 19;
export const DEFAULT_ZOOM = 16;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

export const TILES = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    subdomains: ['a', 'b', 'c'],
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    subdomains: [],
  },
};

export function tilesFor(basemap = 'street') {
  return basemap === 'satellite' ? TILES.satellite : TILES.street;
}

export function Recenter({ lat, lng, focusNonce }) {
  const map = useMap();
  const prevNonce = useRef(focusNonce);
  const didInit = useRef(false);

  useEffect(() => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    const bumped = focusNonce != null && focusNonce !== prevNonce.current;
    prevNonce.current = focusNonce;
    if (bumped) {
      map.flyTo([lat, lng], Math.max(map.getZoom() || DEFAULT_ZOOM, DEFAULT_ZOOM), {
        duration: 0.45,
      });
      didInit.current = true;
      return;
    }
    if (!didInit.current) {
      map.setView([lat, lng], DEFAULT_ZOOM);
      didInit.current = true;
    }
  }, [lat, lng, focusNonce, map]);

  return null;
}

/** After CSS size changes (fullscreen), tell Leaflet to remeasure. */
export function MapInvalidateOn({ token }) {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 80);
    return () => window.clearTimeout(t);
  }, [token, map]);
  return null;
}

export function DraggableMarker({ position, onChange, children, popupOpen = false }) {
  const markerRef = useRef(null);
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || typeof marker.openPopup !== 'function') return;
    if (popupOpen) marker.openPopup();
    else marker.closePopup();
  }, [popupOpen, position]);
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
    >
      {children}
    </Marker>
  );
}

export function MapBoundsWatcher({ onChange }) {
  const map = useMap();
  const emit = () => {
    try {
      const b = map.getBounds();
      if (!b || (typeof b.isValid === 'function' && !b.isValid())) return;
      onChange({
        south: b.getSouth(),
        north: b.getNorth(),
        west: b.getWest(),
        east: b.getEast(),
      });
    } catch {
      /* ignore */
    }
  };
  useMapEvents({
    moveend: emit,
    zoomend: emit,
  });
  useEffect(() => {
    emit();
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function ProbeDot({ lat, lng }) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return (
    <CircleMarker
      center={[lat, lng]}
      radius={5}
      pathOptions={{
        color: '#1a73e8',
        fillColor: '#1a73e8',
        fillOpacity: 0.95,
        weight: 2,
      }}
      interactive={false}
    />
  );
}

function offsetEast(lat, lng, meters) {
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLng = meters / (111320 * Math.max(0.2, Math.abs(cos)));
  return [lat, lng + dLng];
}

/** Dashed coverage ring around the browse click (not around landmarks). */
export function RangeHalo({ center, radiusM, color = '#1a73e8' }) {
  const lat = Number(center?.lat);
  const lng = Number(center?.lng);
  const r = Number(radiusM);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(r) || r < 1) return null;
  const label = formatDist(r);
  const icon = L.divIcon({
    className: 'range-halo-label',
    html: `<span>${label}</span>`,
    iconSize: [0, 0],
    iconAnchor: [-6, 10],
  });
  return (
    <>
      <Circle
        center={[lat, lng]}
        radius={r}
        pathOptions={{
          color,
          weight: 1.5,
          dashArray: '6 6',
          fillColor: color,
          fillOpacity: 0.06,
          interactive: false,
        }}
      />
      <Marker position={offsetEast(lat, lng, r)} icon={icon} interactive={false} keyboard={false} />
    </>
  );
}

/** Original pin while dragging a 地標. */
export function MoveGhost({ from, to }) {
  if (!from || !to) return null;
  if (from.lat === to.lat && from.lng === to.lng) return null;
  return (
    <>
      <CircleMarker
        center={[from.lat, from.lng]}
        radius={9}
        pathOptions={{
          color: '#e37400',
          fillColor: '#fff',
          fillOpacity: 0.95,
          weight: 3,
        }}
        interactive={false}
      />
      <Polyline
        positions={[
          [from.lat, from.lng],
          [to.lat, to.lng],
        ]}
        pathOptions={{ color: '#e37400', weight: 2, dashArray: '4 6', opacity: 0.9 }}
        interactive={false}
      />
    </>
  );
}

let suppressMapClickUntil = 0;

function suppressMapClick(ms = 400) {
  suppressMapClickUntil = Date.now() + ms;
}

function isMapClickSuppressed() {
  return Date.now() < suppressMapClickUntil;
}

function clickOnVertexIcon(e) {
  const t = e?.originalEvent?.target;
  if (!t || typeof t.closest !== 'function') return false;
  return Boolean(t.closest('.landmark-vertex-icon, .leaflet-marker-draggable'));
}

export function MapEditClick({ onPin, onAddVertex, polygonMode }) {
  const map = useMap();
  useEffect(() => {
    if (polygonMode) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    return () => {
      map.doubleClickZoom.enable();
    };
  }, [map, polygonMode]);
  useMapEvents({
    click(e) {
      if (isMapClickSuppressed() || clickOnVertexIcon(e)) return;
      if (polygonMode) {
        onAddVertex?.(e.latlng.lat, e.latlng.lng);
        return;
      }
      onPin?.(e.latlng.lat, e.latlng.lng);
    },
    dblclick(e) {
      if (!polygonMode) return;
      suppressMapClick(800);
      L.DomEvent.stop(e);
      if (e.originalEvent) L.DomEvent.stop(e.originalEvent);
    },
  });
  return null;
}

export function OffMarkerWatcher({ lat, lng, onOffChange }) {
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
      const bounds = map.getBounds();
      if (!bounds || (typeof bounds.isValid === 'function' && !bounds.isValid())) {
        onOffChange(false);
        return;
      }
      onOffChange(!bounds.contains([lat, lng]));
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

export function openInGoogleMaps(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return;
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    '_blank',
    'noopener,noreferrer'
  );
}

const TONE = {
  selected: '#1a73e8',
  affected: '#e8710a',
  rest: '#34a853',
  muted: '#9aa0a6',
  nearby: '#80868b',
  legacy: '#f9ab00',
};

function shapePathOptions({ editing, selected, affected, nearby, muted, legacy }) {
  const color =
    editing || selected
      ? TONE.selected
      : affected
        ? TONE.affected
        : nearby
          ? TONE.nearby
          : muted
            ? TONE.muted
            : legacy
              ? TONE.legacy
              : TONE.rest;
  return {
    color,
    fillColor: color,
    fillOpacity: editing || selected ? 0.22 : affected ? 0.18 : nearby || muted ? 0.05 : 0.12,
    weight: editing || selected ? 2.5 : affected ? 2 : nearby || muted || legacy ? 1.5 : 2,
    dashArray: nearby || muted ? '4 4' : undefined,
    lineJoin: 'miter',
    lineCap: 'butt',
    smoothFactor: 0,
  };
}

function InspectOverlay({ region, onEdit, onDelete, popupOpen }) {
  if (!onEdit && !onDelete) return null;
  const name = String(region.name || '').trim() || '未命名';
  return (
    <>
      <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
        <span className="landmark-tip-row">
          <PinGlyph icon={region.icon} size={12} />
          {name}
        </span>
      </Tooltip>
      {popupOpen ? (
        <Popup autoClose closeOnClick className="location-pin-popup">
          <div className="location-pin-popup-body">
            <div className="landmark-inspect-name">
              <PinGlyph icon={region.icon} size={15} />
              {name}
            </div>
            <div className="location-pin-popup-actions">
              {onEdit ? (
                <button
                  type="button"
                  className="location-search-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(region);
                  }}
                >
                  編輯
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  className="landmark-delete-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(region);
                  }}
                >
                  刪除
                </button>
              ) : null}
            </div>
          </div>
        </Popup>
      ) : null}
    </>
  );
}

export function RegionShape({
  region,
  editing,
  nearby,
  hit,
  selected,
  affected,
  muted,
  interactive: interactiveProp,
  onClick,
  onEdit,
  onDelete,
  popupOpen = false,
}) {
  const layerRef = useRef(null);
  const shape = inferShape(region);
  const isSelected = Boolean(selected || hit);
  const opts = shapePathOptions({
    editing,
    selected: isSelected,
    affected,
    nearby,
    muted,
    legacy: region.legacy || region.source === 'legacy',
  });
  const verts = region.vertices || [];
  const interactive = interactiveProp ?? (Boolean(onClick) || !editing);
  const clickHandlers = onClick
    ? {
        click: (e) => {
          L.DomEvent.stop(e);
          if (e?.originalEvent) L.DomEvent.stop(e.originalEvent);
          suppressMapClick(400);
          onClick(region);
        },
      }
    : undefined;
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || typeof layer.openPopup !== 'function') return undefined;
    if (popupOpen) {
      const t = window.setTimeout(() => {
        const current = layerRef.current;
        if (!current) return;
        const lat = Number(region.center?.lat);
        const lng = Number(region.center?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          current.openPopup(L.latLng(lat, lng));
        } else {
          current.openPopup();
        }
      }, 0);
      return () => window.clearTimeout(t);
    }
    layer.closePopup();
    return undefined;
  }, [popupOpen, region.center?.lat, region.center?.lng]);
  const overlay = (
    <InspectOverlay region={region} onEdit={onEdit} onDelete={onDelete} popupOpen={popupOpen} />
  );
  if (shape === SHAPE_POINT) {
    const center = [region.center.lat, region.center.lng];
    const w = editing || isSelected ? 26 : affected ? 22 : 20;
    const h = Math.round(w * 1.5);
    const fill = muted || nearby ? '#c5c9ce' : opts.color;
    const stroke = muted || nearby ? '#9aa0a6' : opts.color;
    const glyph = Math.max(10, Math.round(w * 0.48));
    const icon = L.divIcon({
      className: `landmark-pin-icon${isSelected ? ' is-selected' : ''}${
        affected ? ' is-affected' : ''
      }${muted || nearby ? ' is-muted' : ''}`,
      html: pinDropHtml(region.icon, { fill, stroke, glyph }),
      iconSize: [w, h],
      iconAnchor: [w / 2, h - 1],
      popupAnchor: [0, -h + 4],
    });
    return (
      <Marker
        ref={layerRef}
        position={center}
        icon={icon}
        zIndexOffset={editing || isSelected ? 600 : affected ? 200 : 0}
        interactive={interactive}
        eventHandlers={clickHandlers}
      >
        {overlay}
      </Marker>
    );
  }
  if (shape === SHAPE_POLYGON || shape === SHAPE_RECT) {
    const positions = verts.map((v) => [v.lat, v.lng]);
    if (positions.length >= 3) {
      return (
        <Polygon
          ref={layerRef}
          positions={positions}
          pathOptions={opts}
          interactive={interactive}
          eventHandlers={clickHandlers}
        >
          {overlay}
        </Polygon>
      );
    }
    if (positions.length >= 2) {
      return (
        <Polyline
          ref={layerRef}
          positions={positions}
          pathOptions={opts}
          interactive={interactive}
          eventHandlers={clickHandlers}
        >
          {overlay}
        </Polyline>
      );
    }
    return null;
  }
  return (
    <Circle
      ref={layerRef}
      center={[region.center.lat, region.center.lng]}
      radius={region.radiusM}
      pathOptions={opts}
      interactive={interactive}
      eventHandlers={clickHandlers}
    >
      {overlay}
    </Circle>
  );
}

function vertexIcon(selected) {
  return L.divIcon({
    className: `landmark-vertex-icon${selected ? ' is-selected' : ''}`,
    html: '<span class="landmark-vertex-dot"></span>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function stopVertexEvent(e) {
  suppressMapClick(800);
  L.DomEvent.stop(e);
  if (e?.originalEvent) {
    L.DomEvent.stop(e.originalEvent);
  }
}

/**
 * Imperative vertex layer. react-leaflet Marker is a controlled `position`,
 * so parent re-renders call setLatLng(original) and snap the drag back.
 */
export function VertexMarkers({ vertices, selectedIndex, onMove, onSelect, onDragLive }) {
  const map = useMap();
  const layerRef = useRef(null);
  const markersRef = useRef([]);
  const dragIndexRef = useRef(-1);
  const lastClickAtRef = useRef(0);
  const ignoreClickUntilRef = useRef(0);
  const propsRef = useRef({ vertices, selectedIndex, onMove, onSelect, onDragLive });
  propsRef.current = { vertices, selectedIndex, onMove, onSelect, onDragLive };

  useEffect(() => {
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
      markersRef.current = [];
      dragIndexRef.current = -1;
    };
  }, [map]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const verts = Array.isArray(vertices) ? vertices : [];
    const markers = markersRef.current;

    const bindMarker = (marker) => {
      marker.on('mousedown', stopVertexEvent);
      marker.on('dblclick', stopVertexEvent);
      marker.on('click', (e) => {
        stopVertexEvent(e);
        if (dragIndexRef.current >= 0) return;
        const now = Date.now();
        if (now < ignoreClickUntilRef.current) return;
        if (now - lastClickAtRef.current < 400) return;
        lastClickAtRef.current = now;
        propsRef.current.onSelect(marker._vertexIndex);
      });
      marker.on('dragstart', (e) => {
        stopVertexEvent(e);
        dragIndexRef.current = marker._vertexIndex;
      });
      marker.on('drag', () => {
        suppressMapClick(800);
        const ll = marker.getLatLng();
        propsRef.current.onDragLive?.({
          index: marker._vertexIndex,
          lat: ll.lat,
          lng: ll.lng,
        });
      });
      marker.on('dragend', () => {
        suppressMapClick(800);
        const idx = marker._vertexIndex;
        const ll = marker.getLatLng();
        ignoreClickUntilRef.current = Date.now() + 200;
        dragIndexRef.current = -1;
        propsRef.current.onMove(idx, ll.lat, ll.lng);
        propsRef.current.onDragLive?.(null);
      });
    };

    while (markers.length > verts.length) {
      const extra = markers.pop();
      layer.removeLayer(extra);
    }
    while (markers.length < verts.length) {
      const i = markers.length;
      const v = verts[i];
      const marker = L.marker([v.lat, v.lng], {
        draggable: true,
        autoPan: false,
        keyboard: false,
        bubblingMouseEvents: false,
        icon: vertexIcon(false),
        zIndexOffset: 1000,
        title: `頂點 ${i + 1}`,
        alt: `頂點 ${i + 1}`,
      });
      bindMarker(marker);
      marker.addTo(layer);
      if (marker.dragging?._draggable) {
        marker.dragging._draggable.options.clickTolerance = 12;
      }
      markers.push(marker);
    }

    markers.forEach((marker, i) => {
      marker._vertexIndex = i;
      const selected = selectedIndex === i;
      const dragging = dragIndexRef.current === i;
      if (!dragging && marker._vertexSelected !== selected) {
        marker.setIcon(vertexIcon(selected));
        marker._vertexSelected = selected;
        marker.setZIndexOffset(selected ? 1200 : 1000);
      }
      marker.options.title = `頂點 ${i + 1}`;
      if (dragging) return;
      const v = verts[i];
      const ll = marker.getLatLng();
      if (ll.lat !== v.lat || ll.lng !== v.lng) {
        marker.setLatLng([v.lat, v.lng]);
      }
    });
  }, [vertices, selectedIndex]);

  return null;
}

export function ReturnPinButton({ buttonRef, onClick }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="parking-map-return-pin"
      title="視角返回標記（不改座標）"
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
        onClick();
      }}
    >
      返回定位
    </button>
  );
}
