import React, { useEffect, useState } from 'react';
import LocationPinButton from './LocationPinButton';
import ThemeToggle from './ThemeToggle';
import QueueStatusBadge from './QueueStatusBadge';
import { useSmartLocation } from '../hooks/useSmartLocation';
import { formatFullTimestamp, formatRelativeTimeShort } from '../utils/locationStorage';

/** Queue badge + relative time + landmark pin + theme icon. */
function HeaderActions({ compact = false }) {
  const { location, hasLocation } = useSmartLocation();
  const [showFullTime, setShowFullTime] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!hasLocation) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [hasLocation, location?.updatedAt]);

  useEffect(() => {
    setShowFullTime(false);
  }, [location?.updatedAt]);

  const shortLabel = hasLocation ? formatRelativeTimeShort(location.updatedAt) : '';
  const fullLabel = hasLocation ? formatFullTimestamp(location.updatedAt) : '';

  return (
    <div className={`header-actions ${compact ? 'header-actions-compact' : ''}`}>
      <QueueStatusBadge />
      {hasLocation && (
        <button
          type="button"
          className={`location-age-label ${showFullTime ? 'is-expanded' : ''}`}
          title={fullLabel || '定位時間'}
          onClick={() => setShowFullTime((v) => !v)}
        >
          {showFullTime ? fullLabel : shortLabel}
        </button>
      )}
      <LocationPinButton compact={compact} />
      <ThemeToggle compact={compact} />
    </div>
  );
}

export default HeaderActions;
