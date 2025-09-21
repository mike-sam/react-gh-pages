import React, { useState, useEffect } from 'react';

const DraggableMap = ({ location, setLocation }) => {
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [coordinates, setCoordinates] = useState({ lat: 3.1390, lng: 101.6869 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (location) {
      const googleMapsMatch = location.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (googleMapsMatch) {
        setCoordinates({
          lat: parseFloat(googleMapsMatch[1]),
          lng: parseFloat(googleMapsMatch[2])
        });
      }
    }
  }, [location]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCoordinates(newCoords);
          const newLocation = `https://maps.google.com/maps?q=${newCoords.lat},${newCoords.lng}`;
          setLocation(newLocation);
        },
        (error) => {
          console.error('获取位置失败:', error);
          alert('无法获取当前位置，请检查位置权限设置');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    // Convert pixel movement to lat/lng change (simplified)
    const latChange = deltaY * 0.0001;
    const lngChange = deltaX * 0.0001;
    
    setCoordinates({
      lat: coordinates.lat - latChange,
      lng: coordinates.lng + lngChange
    });
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMapClick = (e) => {
    if (isDragging) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert pixel coordinates to lat/lng offset
    const latOffset = (y - rect.height / 2) / rect.height * 0.01;
    const lngOffset = (x - rect.width / 2) / rect.width * 0.01;
    
    setCoordinates({
      lat: coordinates.lat - latOffset,
      lng: coordinates.lng + lngOffset
    });
  };

  const generateStaticMapUrl = (lat, lng, zoom = 15) => {
    // Use OpenStreetMap static map service
    return `https://render.openstreetmap.org/cgi-bin/export?bbox=${lng-0.01},${lat-0.01},${lng+0.01},${lat+0.01}&scale=4000&format=png`;
  };

  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps/@${coordinates.lat},${coordinates.lng},15z`;
    window.open(url, '_blank');
  };

  return (
    <div className="draggable-map-picker">
      <div className="location-summary" onClick={() => setIsMapVisible(true)}>
        {location ? (
          <div className="location-info-compact">
            <span className="location-icon">📍</span>
            <div className="location-text-compact">
              <div className="coordinates-text">{coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}</div>
              <div className="location-hint">点击编辑位置</div>
            </div>
          </div>
        ) : (
          <div className="location-placeholder-compact">
            <span className="location-icon">📍</span>
            <span>点击选择位置</span>
          </div>
        )}
      </div>

      {isMapVisible && (
        <div className="draggable-map-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setIsMapVisible(false);
        }}>
          <div className="draggable-map-editor">
            <div className="map-header">
              <h4>拖拽选择位置</h4>
              <button onClick={() => setIsMapVisible(false)}>×</button>
            </div>

            <div className="map-content">
              <div className="map-controls-row">
                <button className="control-btn" onClick={getCurrentLocation}>
                  📍 当前位置
                </button>
                <button className="control-btn" onClick={openInGoogleMaps}>
                  🗺️ Google地图
                </button>
              </div>

              <div 
                className="draggable-map-area"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleMapClick}
                style={{ 
                  backgroundImage: `url(https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s-l+000(${coordinates.lng},${coordinates.lat})/${coordinates.lng},${coordinates.lat},14/400x300@2x?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw)`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="map-crosshair">+</div>
                <div className="drag-instruction">
                  {isDragging ? '拖拽中...' : '点击或拖拽选择位置'}
                </div>
              </div>

              <div className="coordinates-info">
                <span>纬度: {coordinates.lat.toFixed(6)}</span>
                <span>经度: {coordinates.lng.toFixed(6)}</span>
              </div>
            </div>

            <div className="map-actions">
              <button 
                className="cancel-btn" 
                onClick={() => setIsMapVisible(false)}
              >
                取消
              </button>
              <button 
                className="confirm-btn" 
                onClick={() => {
                  const newLocation = `https://maps.google.com/maps?q=${coordinates.lat},${coordinates.lng}`;
                  setLocation(newLocation);
                  setIsMapVisible(false);
                }}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DraggableMap;
