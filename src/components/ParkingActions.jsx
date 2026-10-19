import React, { useEffect, useMemo, useState } from 'react';
import { API_ENDPOINTS } from '../config';
import { useSmartLocation } from '../hooks/useSmartLocation';
import {
  DEFAULT_CAR_PLATES,
  formatRelativeTime,
  loadParkedForCar,
  loadSelectedCarPlate,
  saveParkedForCar,
  saveSelectedCarPlate,
} from '../utils/locationStorage';
import ParkingMapPreview from './ParkingMapPreview';

/**
 * Simple parking: pick car → drag pin on inline map → save.
 */
function ParkingActions() {
  const { location: smartLoc, refreshLocation, hasLocation } = useSmartLocation();
  const [presetPlates] = useState(DEFAULT_CAR_PLATES);
  const [plateMode, setPlateMode] = useState(() => {
    const saved = loadSelectedCarPlate();
    return DEFAULT_CAR_PLATES.includes(saved) ? saved : 'other';
  });
  const [customPlate, setCustomPlate] = useState(() => {
    const saved = loadSelectedCarPlate();
    return DEFAULT_CAR_PLATES.includes(saved) ? '' : saved;
  });
  const [draft, setDraft] = useState(null); // { lat, lng, label }
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [message, setMessage] = useState('');
  const [tick, setTick] = useState(0);

  const activePlate = useMemo(() => {
    if (plateMode === 'other') return (customPlate || '').trim().toUpperCase();
    return plateMode;
  }, [plateMode, customPlate]);

  const parked = useMemo(() => {
    if (!activePlate) return null;
    return loadParkedForCar(activePlate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlate, tick]);

  useEffect(() => {
    if (activePlate) saveSelectedCarPlate(activePlate);
  }, [activePlate]);

  // When switching car: seed from that car's parked spot, else smart cache
  useEffect(() => {
    if (parked) {
      setDraft({
        lat: parked.lat,
        lng: parked.lng,
        label: parked.label || '',
      });
      return;
    }
    if (smartLoc) {
      setDraft({
        lat: smartLoc.lat,
        lng: smartLoc.lng,
        label: smartLoc.label || '',
      });
    } else {
      setDraft(null);
    }
  }, [activePlate, parked?.lat, parked?.lng, parked?.label, smartLoc]);

  const seedFromCache = () => {
    if (!smartLoc) {
      setMessage('尚無定位快取');
      return;
    }
    setDraft({
      lat: smartLoc.lat,
      lng: smartLoc.lng,
      label: smartLoc.label || '',
    });
    setMessage('已套用快取座標，可直接拖曳');
  };

  const seedFromGps = async () => {
    setIsSeeding(true);
    setMessage('');
    try {
      const coords = await refreshLocation();
      setDraft({
        lat: coords.lat,
        lng: coords.lng,
        label: coords.label || '',
      });
      setMessage('已刷新 GPS，可直接拖曳');
    } catch (err) {
      setMessage(`定位失敗：${err.message || err}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleMapChange = (lat, lng) => {
    setDraft((prev) => ({
      lat,
      lng,
      label: prev?.label || '',
    }));
  };

  const handlePark = async () => {
    if (!activePlate) {
      setMessage('請選擇或輸入車牌');
      return;
    }
    if (!draft) {
      setMessage('請先取得座標再拖曳微調');
      return;
    }

    setIsSaving(true);
    setMessage('');
    try {
      const payload = {
        action: 'parkLocation',
        latitude: draft.lat,
        longitude: draft.lng,
        accuracy: null,
        label: draft.label || '',
        carPlate: activePlate,
        timestamp: new Date().toISOString(),
      };

      const parkedRecord = {
        lat: draft.lat,
        lng: draft.lng,
        accuracy: null,
        updatedAt: Date.now(),
        label: draft.label || '',
        carPlate: activePlate,
      };
      saveParkedForCar(activePlate, parkedRecord);
      setTick((n) => n + 1);

      await fetch(API_ENDPOINTS.PARK_LOCATION || API_ENDPOINTS.GSHEET_SUBMIT, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      setMessage(`已記下 ${activePlate} 車位`);
    } catch (err) {
      setMessage(`失敗：${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNavigate = () => {
    const target = parked || draft;
    if (!target) {
      setMessage(activePlate ? `${activePlate} 尚無車位` : '請先選擇車牌');
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${target.lat},${target.lng}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="entry-card parking-actions">
      <div className="entry-card-header">🚗 車輛位置</div>

      <label className="entry-field-label">選擇車輛</label>
      <div className="entry-chip-row">
        {presetPlates.map((plate) => (
          <button
            key={plate}
            type="button"
            className={`entry-chip ${plateMode === plate ? 'active' : ''}`}
            onClick={() => setPlateMode(plate)}
          >
            {plate}
          </button>
        ))}
        <button
          type="button"
          className={`entry-chip ${plateMode === 'other' ? 'active' : ''}`}
          onClick={() => setPlateMode('other')}
        >
          其他
        </button>
      </div>
      {plateMode === 'other' && (
        <input
          className="entry-text-input"
          value={customPlate}
          onChange={(e) => setCustomPlate(e.target.value.toUpperCase())}
          placeholder="輸入車牌"
        />
      )}

      <div className="parking-seed-row">
        <button type="button" className="entry-tool-btn" onClick={seedFromCache} disabled={!hasLocation}>
          套用快取
        </button>
        <button type="button" className="entry-tool-btn" onClick={seedFromGps} disabled={isSeeding}>
          {isSeeding ? '定位中…' : '🔄 GPS'}
        </button>
      </div>

      <ParkingMapPreview
        lat={draft?.lat}
        lng={draft?.lng}
        onChange={handleMapChange}
        editable
      />

      {draft && (
        <div className="entry-meta">
          {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
          {parked?.updatedAt ? ` · 上次儲存 ${formatRelativeTime(parked.updatedAt)}` : ''}
        </div>
      )}

      <div className="entry-btn-row">
        <button
          type="button"
          className="entry-primary-btn"
          onClick={handlePark}
          disabled={isSaving || !activePlate || !draft}
        >
          {isSaving ? '儲存中…' : '🚗 記車位'}
        </button>
        <button
          type="button"
          className="entry-secondary-btn"
          onClick={handleNavigate}
          disabled={!parked && !draft}
        >
          🗺️ 找車
        </button>
      </div>

      {message && <div className="entry-message">{message}</div>}
    </div>
  );
}

export default ParkingActions;
