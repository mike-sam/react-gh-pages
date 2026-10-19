import React from 'react';
import { useSmartLocation } from '../hooks/useSmartLocation';

/**
 * Sticky status bar: cached GPS + refresh button.
 */
function LocationStatusBar() {
  const { statusText, isRefreshing, error, refreshLocation, hasLocation } = useSmartLocation();

  const handleRefresh = async () => {
    try {
      await refreshLocation();
    } catch {
      // error already stored in context
    }
  };

  return (
    <div className="location-status-bar">
      <div className="location-status-text" title={error || statusText}>
        {statusText}
        {error && (
          <div className="location-status-error">{error}</div>
        )}
      </div>
      <button
        type="button"
        className="location-refresh-btn"
        onClick={handleRefresh}
        disabled={isRefreshing}
        title="以高精度 GPS 刷新座標"
      >
        {isRefreshing ? '定位中…' : hasLocation ? '🔄 更新當前位置' : '📍 取得位置'}
      </button>
    </div>
  );
}

export default LocationStatusBar;
