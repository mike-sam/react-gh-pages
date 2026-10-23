import React, { useEffect, useMemo, useRef } from 'react';
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

export function MapEditClick({ onPin, onAddVertex, polygonMode }) {
  useMapEvents({
    click(e) {
      if (polygonMode) {
        onAddVertex?.(e.latlng.lat, e.latlng.lng);
        return;
      }
      onPin?.(e.latlng.lat, e.latlng.lng);
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

function VertexHandle({ index, lat, lng, selected, onMove, onSelect }) {
  const markerRef = useRef(null);
  const draggedRef = useRef(false);
  const icon = useMemo(() => vertexIcon(selected), [selected]);
  return (
    <Marker
      draggable
      autoPan
      bubblingMouseEvents={false}
      position={[lat, lng]}
      icon={icon}
      zIndexOffset={selected ? 1200 : 1000}
      ref={markerRef}
      eventHandlers={{
        click(e) {
          L.DomEvent.stopPropagation(e.originalEvent || e);
          if (draggedRef.current) return;
          onSelect(index);
        },
        dragstart() {
          draggedRef.current = true;
        },
        dragend() {
          const marker = markerRef.current;
          if (marker) {
            const ll = marker.getLatLng();
            onMove(index, ll.lat, ll.lng);
          }
          window.setTimeout(() => {
            draggedRef.current = false;
          }, 0);
        },
      }}
    />
  );
}

export function VertexMarkers({ vertices, selectedIndex, onMove, onSelect }) {
  return (vertices || []).map((v, i) => (
    <VertexHandle
      key={`vx-${i}`}
      index={i}
      lat={v.lat}
      lng={v.lng}
      selected={selectedIndex === i}
      onMove={onMove}
      onSelect={onSelect}
    />
  ));
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
