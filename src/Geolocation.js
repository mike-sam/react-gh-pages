import React, { useEffect } from 'react';
import LeafletLocationPicker from './components/LeafletLocationPicker';

function Geolocation({location, setLocation, skipAutoLocation}) {
  useEffect(() => {
    // Skip auto-location if already provided via URL params
    if (skipAutoLocation && location) {
      return;
    }
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const gmapUrl = `https://maps.google.com/maps?q=${latitude},${longitude}`;
        setLocation(gmapUrl);
      });
    } else {
      setLocation('Geolocation is not supported by this browser.');
    }
  }, [skipAutoLocation, location, setLocation]);

  return (
    <div className="row row-wrap w-100">
      <LeafletLocationPicker 
        location={location} 
        setLocation={setLocation} 
      />
    </div>
  );
}

export default Geolocation;
