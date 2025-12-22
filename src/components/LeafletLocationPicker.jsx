import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { API_ENDPOINTS } from '../config';

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
  const [nearbyLocations, setNearbyLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [showLocationSelector, setShowLocationSelector] = useState(false);

  // Parse location to get coordinates
  useEffect(() => {
    if (location) {
      const googleMapsMatch = location.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (googleMapsMatch) {
        const lat = parseFloat(googleMapsMatch[1]);
        const lng = parseFloat(googleMapsMatch[2]);
        setCoordinates([lat, lng]);
        // 当位置改变且地图打开时，查找附近的地点
        if (isMapVisible) {
          fetchNearbyLocations(lat, lng);
        }
      }
    }
  }, [location, isMapVisible]);

  // 查找附近的地点
  const fetchNearbyLocations = async (lat, lng) => {
    setIsLoadingNearby(true);
    try {
      const url = `${API_ENDPOINTS.LOCATION}?action=getNearbyLocations&latitude=${lat}&longitude=${lng}&radius=1`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.locations && data.locations.length > 0) {
          setNearbyLocations(data.locations);
          setShowLocationSelector(true);
          // 自动选择最近的地点
          setSelectedLocation(data.locations[0]);
          setLocationName(data.locations[0].name || '');
        } else {
          setNearbyLocations([]);
          setShowLocationSelector(false);
        }
      }
    } catch (error) {
      console.warn('获取附近地点失败:', error);
      setNearbyLocations([]);
    } finally {
      setIsLoadingNearby(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const newCoords = [position.coords.latitude, position.coords.longitude];
          setCoordinates(newCoords);
          const newLocation = `https://maps.google.com/maps?q=${newCoords[0]},${newCoords[1]}`;
          setLocation(newLocation);
          // 查找附近的地点
          await fetchNearbyLocations(newCoords[0], newCoords[1]);
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
    // 打开地图时，查找当前位置附近的地点
    if (coordinates[0] && coordinates[1]) {
      fetchNearbyLocations(coordinates[0], coordinates[1]);
    }
  };

  const handleConfirmLocation = async () => {
    // 如果选择了附近的地点，使用该地点的坐标
    let finalCoords = coordinates;
    let finalName = locationName.trim();
    
    if (selectedLocation) {
      finalCoords = [selectedLocation.latitude, selectedLocation.longitude];
      finalName = selectedLocation.name || finalName;
    }
    
    // 保存地点到Location sheet（如果有名称）
    if (finalName) {
      try {
        await fetch(API_ENDPOINTS.LOCATION, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'saveLocation',
            latitude: finalCoords[0],
            longitude: finalCoords[1],
            name: finalName
          })
        });
      } catch (error) {
        console.warn('保存地点失败:', error);
      }
    }
    
    // 将地点名称编码到URL中，格式：q=lat,lng&name=locationName
    const newLocation = `https://maps.google.com/maps?q=${finalCoords[0]},${finalCoords[1]}${finalName ? '&name=' + encodeURIComponent(finalName) : ''}`;
    setLocation(newLocation);
    setIsMapVisible(false);
    setShowLocationSelector(false);
    setSelectedLocation(null);
    setLocationName('');
  };
  
  // 当坐标改变时，查找附近的地点
  useEffect(() => {
    if (isMapVisible && coordinates[0] && coordinates[1]) {
      const timer = setTimeout(() => {
        fetchNearbyLocations(coordinates[0], coordinates[1]);
      }, 500); // 延迟500ms避免频繁请求
      return () => clearTimeout(timer);
    }
  }, [coordinates, isMapVisible]);

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
            `${coordinates[0].toFixed(4)}, ${coordinates[1].toFixed(4)}` : 
            '定位失败'
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

              {/* 附近地点选择器 */}
              {showLocationSelector && nearbyLocations.length > 0 && (
                <div className="nearby-locations-selector" style={{marginTop: '10px', padding: '10px', background: '#f5f5f5', borderRadius: '4px'}}>
                  <div style={{fontWeight: 'bold', marginBottom: '8px', fontSize: '12px'}}>
                    📍 附近已记录的地点（1km内）:
                  </div>
                  <div style={{maxHeight: '120px', overflowY: 'auto'}}>
                    {nearbyLocations.map((loc, index) => (
                      <label key={index} style={{display: 'block', marginBottom: '6px', fontSize: '11px', cursor: 'pointer'}}>
                        <input
                          type="radio"
                          name="nearbyLocation"
                          checked={selectedLocation && selectedLocation.latitude === loc.latitude && selectedLocation.longitude === loc.longitude}
                          onChange={() => {
                            setSelectedLocation(loc);
                            setLocationName(loc.name || '');
                            setCoordinates([loc.latitude, loc.longitude]);
                          }}
                          style={{marginRight: '6px'}}
                        />
                        <span>
                          {loc.name || '未命名地点'} 
                          {loc.distance && ` (${loc.distance}km)`}
                        </span>
                      </label>
                    ))}
                  </div>
                  <label style={{display: 'block', marginTop: '8px', fontSize: '11px'}}>
                    <input
                      type="radio"
                      name="nearbyLocation"
                      checked={!selectedLocation}
                      onChange={() => {
                        setSelectedLocation(null);
                        setLocationName('');
                      }}
                      style={{marginRight: '6px'}}
                    />
                    <span>使用当前位置（添加新地点）</span>
                  </label>
                </div>
              )}

              {/* 地点名称输入 */}
              <div style={{marginTop: '10px'}}>
                <input
                  type="text"
                  placeholder="地点名称（可选）"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    fontSize: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
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
