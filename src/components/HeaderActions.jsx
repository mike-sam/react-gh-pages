import React, { useEffect, useState } from 'react';
import LocationPinButton from './LocationPinButton';
import ThemeToggle from './ThemeToggle';
import QueueStatusBadge from './QueueStatusBadge';
import QuickLinksButton from './QuickLinksButton';
import { useSmartLocation } from '../hooks/useSmartLocation';
import { formatFullTimestamp, formatRelativeTimeShort } from '../utils/locationStorage';

/** Queue badge + relative time + landmark pin + theme + quick links. */
function HeaderActions({ compact = false }) {
  const { location, hasLocation, locationMode } = useSmartLocation();
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
      {locationMode === 'live' && (
        <span className="location-mode-live-hint" title="每次記帳、行事曆會先實時 GPS">
          實時
        </span>
      )}
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
      <QuickLinksButton compact={compact} />
    </div>
  );
}

export default HeaderActions;
