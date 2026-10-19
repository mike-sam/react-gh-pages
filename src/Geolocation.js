import React, { useEffect } from 'react';
import LeafletLocationPicker from './components/LeafletLocationPicker';
import { useSmartLocation } from './hooks/useSmartLocation';
import { parseLatLngFromMapsUrl, toMapsUrl } from './utils/locationStorage';

/**
 * Expense form location field.
 * Default: reuse smart-cached coords (no GPS wait).
 * Only refreshes GPS when user explicitly updates via LocationStatusBar / map.
 */
function Geolocation({ location, setLocation, skipAutoLocation }) {
  const { location: smartLoc, mapsUrl, setCachedLocation } = useSmartLocation();

  // Seed form location from cache once (unless URL/POST already provided coords)
  useEffect(() => {
    if (skipAutoLocation && location) {
      // Sync URL-provided coords into smart cache for reuse by Calendar / Parking
      const parsed = parseLatLngFromMapsUrl(location);
      if (parsed) {
        setCachedLocation({
          ...parsed,
          accuracy: null,
          updatedAt: Date.now(),
        });
      }
      return;
    }

    if (!location && smartLoc) {
      setLocation(toMapsUrl(smartLoc.lat, smartLoc.lng, smartLoc.label));
    }
  }, [skipAutoLocation, location, smartLoc, setLocation, setCachedLocation]);

  // When smart cache refreshes, keep expense form location in sync (unless URL/POST locked it)
  useEffect(() => {
    if (skipAutoLocation) return;
    if (!smartLoc || !mapsUrl) return;
    const parsedForm = parseLatLngFromMapsUrl(location);
    const sameCoords =
      parsedForm &&
      Math.abs(parsedForm.lat - smartLoc.lat) < 1e-7 &&
      Math.abs(parsedForm.lng - smartLoc.lng) < 1e-7;
    if (!sameCoords) {
      setLocation(mapsUrl);
    }
  }, [smartLoc, mapsUrl, location, setLocation, skipAutoLocation]);

  const handleSetLocation = (nextUrl) => {
    setLocation(nextUrl);
    const parsed = parseLatLngFromMapsUrl(nextUrl);
    if (parsed) {
      const nameMatch = typeof nextUrl === 'string' ? nextUrl.match(/[&?]name=([^&]+)/) : null;
      const label = nameMatch ? decodeURIComponent(nameMatch[1]) : '';
      setCachedLocation({
        ...parsed,
        accuracy: null,
        updatedAt: Date.now(),
        label,
      });
    }
  };

  return (
    <div className="row row-wrap w-100">
      <LeafletLocationPicker 
        location={location || mapsUrl} 
        setLocation={handleSetLocation} 
      />
    </div>
  );
}

export default Geolocation;
