import React, { useMemo, useState } from 'react';
import { SHORTCUTS } from '../config';
import { useSmartLocation } from '../hooks/useSmartLocation';
import { useOfflineQueue } from '../context/QueueContext';
import { isIOS, openShortcut } from '../utils/platform';

const PRESET_TITLES = [
  '工作',
  '外出',
  '會議',
  '用餐',
  '通勤',
  '運動',
  '購物',
  '其他',
];

const PRESET_PREFIXES = ['抵達', '用餐', '開會', '離開', '途經', '停留', '開始', '結束'];

/**
 * Calendar trip log:
 * - iOS / iPadOS → iOS Shortcuts deep link
 * - 其他裝置 → Apps Script POST
 */
function CalendarTracker() {
  const { location, refreshLocation, hasLocation } = useSmartLocation();
  const { enqueueAndSend } = useOfflineQueue();
  const [title, setTitle] = useState('外出');
  const [customTitle, setCustomTitle] = useState('');
  const [prefix, setPrefix] = useState('抵達');
  const [useCachedCoords, setUseCachedCoords] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [forceGas, setForceGas] = useState(false);

  const onIOS = useMemo(() => isIOS(), []);
  const useShortcut = onIOS && !forceGas;
  const shortcutName = SHORTCUTS?.CALENDAR_TRACK || 'CalendarTrack';

  const resolvedTitle = title === '__custom__' ? customTitle.trim() : title;

  const handleSubmit = async () => {
    if (!resolvedTitle) {
      setMessage('請輸入 Event 標題');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      let coords = location;
      if (!useCachedCoords) {
        try {
          coords = await refreshLocation();
        } catch {
          // GPS 失敗仍可送出（無座標或沿用舊快取）
          coords = location;
        }
      }

      const id = Date.now();
      const payload = {
        id,
        action: 'trackCalendar',
        title: resolvedTitle,
        prefix: prefix || '',
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        accuracy: coords?.accuracy ?? null,
        useLocation: Boolean(coords),
      };

      if (useShortcut) {
        openShortcut(shortcutName, JSON.stringify(payload));
        setMessage(`已透過 iOS Shortcuts「${shortcutName}」啟動`);
        return;
      }

      const result = await enqueueAndSend(payload);
      setMessage(
        result.sent
          ? `已送出：${resolvedTitle} / ${prefix || '（無前綴）'}`
          : `已暫存佇列：${resolvedTitle}`
      );
    } catch (err) {
      setMessage(`失敗：${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="entry-card calendar-tracker">
      <div className="entry-card-header">
        📅 記錄行程 / 追加軌跡
        <span className="entry-route-badge" title={useShortcut ? `捷徑：${shortcutName}` : 'Apps Script'}>
          {useShortcut ? 'iOS Shortcuts' : 'Apps Script'}
        </span>
      </div>

      <label className="entry-field-label">Event 標題</label>
      <div className="entry-chip-row">
        {PRESET_TITLES.map((item) => (
          <button
            key={item}
            type="button"
            className={`entry-chip ${title === item ? 'active' : ''}`}
            onClick={() => setTitle(item)}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          className={`entry-chip ${title === '__custom__' ? 'active' : ''}`}
          onClick={() => setTitle('__custom__')}
        >
          自訂
        </button>
      </div>
      {title === '__custom__' && (
        <input
          className="entry-text-input"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          placeholder="手動輸入標題"
        />
      )}

      <label className="entry-field-label">Prefix / 標註</label>
      <div className="entry-chip-row">
        {PRESET_PREFIXES.map((item) => (
          <button
            key={item}
            type="button"
            className={`entry-chip ${prefix === item ? 'active' : ''}`}
            onClick={() => setPrefix(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <input
        className="entry-text-input"
        value={prefix}
        onChange={(e) => setPrefix(e.target.value)}
        placeholder="或手動輸入 prefix"
      />

      <label className="entry-toggle">
        <input
          type="checkbox"
          checked={useCachedCoords}
          onChange={(e) => setUseCachedCoords(e.target.checked)}
        />
        使用當前快取座標
        {!hasLocation && <span className="entry-hint">（尚無快取）</span>}
      </label>

      {onIOS && (
        <label className="entry-toggle">
          <input
            type="checkbox"
            checked={forceGas}
            onChange={(e) => setForceGas(e.target.checked)}
          />
          強制改走 Apps Script（略過 Shortcuts）
        </label>
      )}

      <button
        type="button"
        className="entry-primary-btn"
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting
          ? '送出中…'
          : useShortcut
            ? `📅 用 Shortcuts 記錄（${shortcutName}）`
            : '📅 記錄行程 / 追加軌跡'}
      </button>

      {message && <div className="entry-message">{message}</div>}
    </div>
  );
}

export default CalendarTracker;
