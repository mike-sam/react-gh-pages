import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// 可拖拽标记组件
function DraggableMarker({ position, setPosition }) {
  const markerRef = useRef(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const latLng = marker.getLatLng();
        setPosition([latLng.lat, latLng.lng]);
      }
    },
  };

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    />
  );
}

// 点击地图设置位置
function MapClickHandler({ setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

const LeafletLocationPicker = ({ location, setLocation }) => {
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [coordinates, setCoordinates] = useState([3.1390, 101.6869]); // [lat, lng]
  const [mapType, setMapType] = useState('street');

  // Parse location to get coordinates
  useEffect(() => {
    if (location) {
      const googleMapsMatch = location.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (googleMapsMatch) {
        setCoordinates([parseFloat(googleMapsMatch[1]), parseFloat(googleMapsMatch[2])]);
      }
    }
  }, [location]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCoords = [position.coords.latitude, position.coords.longitude];
          setCoordinates(newCoords);
          const newLocation = `https://maps.google.com/maps?q=${newCoords[0]},${newCoords[1]}`;
          setLocation(newLocation);
        },
        (error) => {
          console.error('获取位置失败:', error);
          alert('无法获取当前位置，请检查位置权限设置');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      alert('浏览器不支持地理定位');
    }
  };

  const handleMapOpen = () => {
    setIsMapVisible(true);
  };

  const handleConfirmLocation = () => {
    const newLocation = `https://maps.google.com/maps?q=${coordinates[0]},${coordinates[1]}`;
    setLocation(newLocation);
    setIsMapVisible(false);
  };

  const handleCancelLocation = () => {
    setIsMapVisible(false);
  };

  const getTileLayerUrl = () => {
    switch (mapType) {
      case 'satellite':
        // 使用 Esri 的免费卫星图服务
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'hybrid':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  const getTileLayerSubdomains = () => {
    return mapType === 'street' ? ['a', 'b', 'c'] : [];
  };

  return (
    <div className="leaflet-location-picker">
      <div className="unified-action-button" onClick={handleMapOpen}>
        <div className="action-header">
          <span className="action-icon">📍</span>
          <span className="action-name">修正地点</span>
        </div>
        <div className="action-status">
          {location ? 
            `{${coordinates[0].toFixed(4)}, ${coordinates[1].toFixed(4)}}` : 
            '未设置'
          }
        </div>
      </div>

      {/* 地图编辑弹窗 */}
      {isMapVisible && (
        <div className="map-editor-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) handleCancelLocation();
        }}>
          <div className="map-editor">
            <div className="map-editor-header">
              <h4>选择位置</h4>
              <button className="close-btn" onClick={handleCancelLocation}>×</button>
            </div>

            <div className="map-editor-content">
              <div className="map-controls">
                
                
                <div className="map-type-selector">
                  <span>地图类型:</span>
                  <div className="map-type-buttons">
                    <button 
                      className={`map-type-btn ${mapType === 'street' ? 'active' : ''}`}
                      onClick={() => setMapType('street')}
                    >
                      街道
                    </button>
                    <button 
                      className={`map-type-btn ${mapType === 'satellite' ? 'active' : ''}`}
                      onClick={() => setMapType('satellite')}
                    >
                      卫星
                    </button>
                    <button className="get-location-btn" onClick={getCurrentLocation}>
                      📍 定位到当前位置
                    </button>
                  </div>
                </div>
              </div>

              <div className="leaflet-map-container">
                <MapContainer
                  center={coordinates}
                  zoom={15}
                  style={{ height: '300px', width: '100%' }}
                  key={`${coordinates[0]}-${coordinates[1]}-${mapType}`} // Force re-render on change
                >
                  <TileLayer
                    url={getTileLayerUrl()}
                    subdomains={getTileLayerSubdomains()}
                    attribution={mapType === 'street' ? 
                      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' :
                      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    }
                  />
                  <DraggableMarker position={coordinates} setPosition={setCoordinates} />
                  <MapClickHandler setPosition={setCoordinates} />
                </MapContainer>
              </div>

              <div className="coordinates-display">
                <span>纬度: {coordinates[0].toFixed(6)}</span>
                <span>经度: {coordinates[1].toFixed(6)}</span>
              </div>

              <div className="map-hint">
                💡 可以拖拽红色标记或点击地图来选择位置
              </div>
            </div>

            <div className="map-editor-actions">
              <button className="cancel-btn" onClick={handleCancelLocation}>
                取消
              </button>
              <button className="confirm-btn" onClick={handleConfirmLocation}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeafletLocationPicker;
