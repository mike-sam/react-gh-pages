import React, { useState, useEffect } from 'react';

const LocationMapThumbnail = ({ location, setLocation }) => {
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [coordinates, setCoordinates] = useState({ lat: 3.1390, lng: 101.6869 }); // Default to KL
  // const [isDragging, setIsDragging] = useState(false); // 暂时不用拖拽功能

  // Parse location to get coordinates
  useEffect(() => {
    if (location) {
      // Parse Google Maps URL or coordinates
      const googleMapsMatch = location.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (googleMapsMatch) {
        setCoordinates({
          lat: parseFloat(googleMapsMatch[1]),
          lng: parseFloat(googleMapsMatch[2])
        });
      }
    }
  }, [location]);

  const generateMapUrl = (lat, lng, zoom = 15, maptype = 'roadmap') => {
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=300x200&maptype=${maptype}&markers=color:red%7C${lat},${lng}&key=YOUR_API_KEY`;
  };

  const generateOpenStreetMapUrl = (lat, lng, zoom = 15) => {
    // Using OpenStreetMap tile server (free)
    return `https://tiles.wmflabs.org/hikebike/${zoom}/${Math.floor((lng + 180) / 360 * Math.pow(2, zoom))}/${Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))}.png`;
  };

  const generateSimpleMapPreview = (lat, lng, zoom = 15) => {
    // Use OpenStreetMap static tile - free alternative
    return `https://static-maps.yandex.ru/1.x/?lang=en-US&ll=${lng},${lat}&z=${zoom}&l=map&size=300,200&pt=${lng},${lat},pm2rdm`;
  };

  const handleThumbnailClick = () => {
    setIsMapVisible(true);
  };

  const handleConfirmLocation = () => {
    const newLocation = `https://maps.google.com/maps?q=${coordinates.lat},${coordinates.lng}`;
    setLocation(newLocation);
    setIsMapVisible(false);
  };

  const handleCancelLocation = () => {
    setIsMapVisible(false);
  };

  const handleMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert pixel coordinates to lat/lng (simplified calculation)
    const latOffset = (y - rect.height / 2) / rect.height * 0.01;
    const lngOffset = (x - rect.width / 2) / rect.width * 0.01;
    
    setCoordinates({
      lat: coordinates.lat - latOffset,
      lng: coordinates.lng + lngOffset
    });
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      });
    }
  };

  const formatLocationDisplay = () => {
    if (!location) return '点击获取位置';
    
    if (location.includes('maps.google.com')) {
      return `📍 ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`;
    }
    
    return '📍 已获取位置';
  };

  return (
    <div className="location-map-container">
      <div className="location-thumbnail" onClick={handleThumbnailClick}>
        {location ? (
          <div className="map-preview">
            <img
              src={generateSimpleMapPreview(coordinates.lat, coordinates.lng)}
              className="map-thumbnail-frame"
              alt="位置预览"
            />
            <div className="map-overlay">
              <span className="location-text">{formatLocationDisplay()}</span>
              <span className="edit-icon">✏️</span>
            </div>
          </div>
        ) : (
          <div className="map-placeholder">
            <span className="location-icon">📍</span>
            <span className="location-text">点击获取位置</span>
          </div>
        )}
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
                <button className="get-location-btn" onClick={getCurrentLocation}>
                  📍 获取当前位置
                </button>
              </div>

              <div 
                className="interactive-map"
                onClick={handleMapClick}
              >
                <img
                  src={generateSimpleMapPreview(coordinates.lat, coordinates.lng)}
                  className="full-map-frame"
                  alt="地图编辑"
                />
                <div className="map-crosshair">+</div>
                <div className="map-instruction">点击地图选择位置</div>
              </div>

              <div className="coordinates-display">
                <span>纬度: {coordinates.lat.toFixed(6)}</span>
                <span>经度: {coordinates.lng.toFixed(6)}</span>
              </div>

              <div className="map-type-selector">
                <span>地图类型:</span>
                <div className="map-type-buttons">
                  <button className="map-type-btn active">街道</button>
                  <button className="map-type-btn">卫星</button>
                </div>
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

export default LocationMapThumbnail;
