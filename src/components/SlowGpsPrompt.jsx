import React from 'react';
import { createPortal } from 'react-dom';
import { useHistoryOverlay } from '../hooks/useHistoryOverlay';
import { distanceMeters } from '../utils/landmarkRegions';
import {
  formatDistanceHuman,
  formatLocationLabel,
  formatRelativeTime,
} from '../utils/locationStorage';

function coordLine(loc) {
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return '';
  return `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
}

function accuracyLine(loc) {
  const m = Number(loc?.accuracy);
  if (!Number.isFinite(m) || m <= 0) return '';
  return `精度 ±${formatDistanceHuman(m)}`;
}

function SlowGpsPrompt({ cached, live, onUseCache, onUseLive, onWait }) {
  useHistoryOverlay(true, onWait);

  const gapM =
    cached && live ? distanceMeters(cached, live) : NaN;
  const gapText = Number.isFinite(gapM) ? formatDistanceHuman(gapM) : '';

  return createPortal(
    <div
      className="picker-modal-overlay picker-modal-overlay--center"
      onClick={onWait}
      role="presentation"
    >
      <div
        className="picker-modal slow-gps-modal"
        role="dialog"
        aria-label="定位較慢"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-modal-header">
          <h4>定位超過 3 秒</h4>
          <button type="button" className="picker-modal-close" onClick={onWait} aria-label="繼續等">
            ✕
          </button>
        </div>
        <p className="slow-gps-lead">可以用快取先走，或等新定位回來再比差距。</p>
        <div className="slow-gps-block">
          <span className="slow-gps-k">目前快取</span>
          <strong>{formatLocationLabel(cached)}</strong>
          <span>{coordLine(cached)}</span>
          <span>
            {formatRelativeTime(cached?.updatedAt)}
            {accuracyLine(cached) ? ` · ${accuracyLine(cached)}` : ''}
          </span>
        </div>
        <div className="slow-gps-block">
          <span className="slow-gps-k">新定位</span>
          {live ? (
            <>
              <strong>{formatLocationLabel(live)}</strong>
              <span>{coordLine(live)}</span>
              {accuracyLine(live) ? <span>{accuracyLine(live)}</span> : null}
            </>
          ) : (
            <span>仍在取 GPS…</span>
          )}
        </div>
        <p className={`slow-gps-gap${live ? ' is-ready' : ''}`}>
          {live
            ? gapM < 8
              ? '差距很小，幾乎沒動'
              : `差距 ${gapText}`
            : '差距等 GPS 回來再算'}
        </p>
        <div className="slow-gps-actions">
          <button type="button" className="slow-gps-btn" onClick={onUseCache}>
            使用快取
          </button>
          <button type="button" className="slow-gps-btn" onClick={onWait}>
            繼續等
          </button>
          <button
            type="button"
            className="slow-gps-btn is-primary"
            onClick={onUseLive}
            disabled={!live}
          >
            用新定位
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default SlowGpsPrompt;
