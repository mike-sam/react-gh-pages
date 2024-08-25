import React, { useState, useEffect } from 'react';

function Geolocation() {
  const [location, setLocation] = useState('');

  useEffect(() => {
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
  }, []);

  return (
    <div className="row row-wrap w-100">
      <span id="geolocation-href" className="w-100">
        {location && (
          <button className="w-100 btn">
            已获取目前位置, 提交表单时将一同记录。
          </button>
        )}
      </span>
    </div>
  );
}

export default Geolocation;
