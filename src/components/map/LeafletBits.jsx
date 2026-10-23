import React, { useEffect, useRef } from 'react';
import {
  Circle,
  CircleMarker,
  Marker,
  Polygon,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  DEFAULT_POINT_NEARBY_M,
  inferShape,
  SHAPE_POINT,
  SHAPE_POLYGON,
  SHAPE_RECT,
} from '../../utils/landmarkRegions';

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

export function DraggableMarker({ position, onChange }) {
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

function shapePathOptions({ editing, legacy, nearby, hit }) {
  const color = editing || hit ? '#1a73e8' : legacy ? '#f9ab00' : nearby ? '#80868b' : '#34a853';
  return {
    color,
    fillColor: color,
    fillOpacity: editing ? 0.18 : hit ? 0.22 : nearby ? 0.05 : 0.12,
    weight: editing || hit ? 2.5 : nearby || legacy ? 1.5 : 2,
    dashArray: nearby || legacy ? '4 4' : undefined,
    lineJoin: 'miter',
    lineCap: 'butt',
    smoothFactor: 0,
  };
}

export function RegionShape({ region, editing, nearby, hit, interactive: interactiveProp }) {
  const shape = inferShape(region);
  const opts = shapePathOptions({
    editing,
    legacy: region.legacy || region.source === 'legacy',
    nearby,
    hit,
  });
  const verts = region.vertices || [];
  const interactive = interactiveProp ?? !editing;
  if (shape === SHAPE_POINT) {
    const center = [region.center.lat, region.center.lng];
    if (editing) {
      return (
        <Circle
          center={center}
          radius={Number(region.radiusM) || DEFAULT_POINT_NEARBY_M}
          pathOptions={{ ...opts, fillOpacity: 0.08, weight: 1.25, dashArray: '4 4' }}
          interactive={false}
        />
      );
    }
    return (
      <CircleMarker
        center={center}
        radius={6}
        pathOptions={{
          color: opts.color,
          fillColor: '#fff',
          fillOpacity: 1,
          weight: 3,
        }}
        interactive={interactive}
      />
    );
  }
  if (shape === SHAPE_POLYGON || shape === SHAPE_RECT) {
    const positions = verts.map((v) => [v.lat, v.lng]);
    if (positions.length >= 3) {
      return <Polygon positions={positions} pathOptions={opts} interactive={interactive} />;
    }
    if (positions.length >= 2) {
      return <Polyline positions={positions} pathOptions={opts} interactive={interactive} />;
    }
    return null;
  }
  return (
    <Circle
      center={[region.center.lat, region.center.lng]}
      radius={region.radiusM}
      pathOptions={opts}
      interactive={interactive}
    />
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
