import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_MAP_CENTER, withMapFallback } from '../utils/mapDefaults';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number') {
      map.setView([lat, lng], map.getZoom() || 17);
    }
  }, [lat, lng, map]);
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

function MapClickHandler({ onChange }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Inline park map — always shown.
 * No GPS? Still open at default center; click / drag to pick coords.
 */
function ParkingMapPreview({ lat, lng, onChange, height = 220, editable = true }) {
  const seed = withMapFallback(lat, lng);
  const [position, setPosition] = useState([seed.lat, seed.lng]);

  useEffect(() => {
    const next = withMapFallback(lat, lng);
    setPosition([next.lat, next.lng]);
  }, [lat, lng]);

  const handleChange = (nextLat, nextLng) => {
    setPosition([nextLat, nextLng]);
    onChange?.(nextLat, nextLng);
  };

  return (
    <div className="parking-map-preview parking-map-editable" style={{ height }}>
      <MapContainer
        center={position}
        zoom={15}
        style={{ height: '100%', width: '100%', borderRadius: 10 }}
        zoomControl
        scrollWheelZoom
        doubleClickZoom
        touchZoom
        dragging
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {editable ? (
          <>
            <DraggableMarker position={position} onChange={handleChange} />
            <MapClickHandler onChange={handleChange} />
          </>
        ) : (
          <Marker position={position} />
        )}
        <Recenter lat={position[0]} lng={position[1]} />
      </MapContainer>
      {editable && (
        <div className="parking-map-hint">
          {typeof lat === 'number'
            ? '拖曳標記 · 點地圖 · 可縮放'
            : `無 GPS 也可點地圖選點（預設 ${DEFAULT_MAP_CENTER.lat}, ${DEFAULT_MAP_CENTER.lng} 附近）`}
        </div>
      )}
    </div>
  );
}

export default ParkingMapPreview;
