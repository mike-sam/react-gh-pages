import React, { useState, useEffect } from 'react';

const SimpleLocationPicker = ({ location, setLocation }) => {
  // const [isMapVisible, setIsMapVisible] = useState(false); // 暂时不用
  const [coordinates, setCoordinates] = useState({ lat: 3.1390, lng: 101.6869 });

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
    } else {
      alert('浏览器不支持地理定位');
    }
  };

  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/@${coordinates.lat},${coordinates.lng},15z`;
    window.open(url, '_blank');
  };

  const handleManualInput = () => {
    const lat = prompt('请输入纬度:', coordinates.lat);
    const lng = prompt('请输入经度:', coordinates.lng);
    
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      const newCoords = { lat: parseFloat(lat), lng: parseFloat(lng) };
      setCoordinates(newCoords);
      const newLocation = `https://maps.google.com/maps?q=${newCoords.lat},${newCoords.lng}`;
      setLocation(newLocation);
    }
  };

  return (
    <div className="simple-location-picker">
      <div className="location-controls">
        <button 
          className="location-btn get-location"
          onClick={getCurrentLocation}
        >
          📍 获取位置
        </button>
        
        {location && (
          <>
            <button 
              className="location-btn edit-location"
              onClick={handleManualInput}
            >
              ✏️ 编辑坐标
            </button>
            
            <button 
              className="location-btn view-map"
              onClick={openGoogleMaps}
            >
              🗺️ 查看地图
            </button>
          </>
        )}
      </div>
      
      {location && (
        <div className="location-info">
          <div className="coordinates-text">
            📍 {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
          </div>
          <a 
            href={location} 
            target="_blank" 
            rel="noopener noreferrer"
            className="map-link"
          >
            在Google地图中查看 ↗
          </a>
        </div>
      )}
    </div>
  );
};

export default SimpleLocationPicker;
