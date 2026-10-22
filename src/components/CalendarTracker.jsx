import React, { useMemo, useState } from 'react';
import { SHORTCUTS } from '../config';
import { useSmartLocation } from '../hooks/useSmartLocation';
import { useOfflineQueue } from '../context/QueueContext';
import { isIOS, openShortcut, stringifyCalendarTrackInput } from '../utils/platform';
import {
  CALENDAR_PREFIXES,
  CALENDAR_TITLES,
  buildCalendarTrackUrl,
  calendarTrackUrlExamples,
  stampCalendarTimestamp,
} from '../utils/calendarTrackUrl';

function CalendarTracker() {
  const { location, hasLocation } = useSmartLocation();
  const { enqueueAndSend } = useOfflineQueue();
  const [title, setTitle] = useState('Work');
  const [customTitle, setCustomTitle] = useState('');
  const [prefix, setPrefix] = useState('');
  const [endExisting, setEndExisting] = useState(true);
  const [startHome, setStartHome] = useState(false);
  const [attachCoords, setAttachCoords] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [useShortcut, setUseShortcut] = useState(false);
  const [copied, setCopied] = useState('');

  const onIOS = useMemo(() => isIOS(), []);
  const shortcutName = SHORTCUTS?.CALENDAR_TRACK || 'CalendarTrack';
  const resolvedTitle = title === '__custom__' ? customTitle.trim() : title;

  const liveUrl = useMemo(() => {
    const params = {
      op: 'append',
      title: resolvedTitle || undefined,
      prefix: prefix.trim() || undefined,
      endExisting,
      startHome,
    };
    if (attachCoords && location?.lat != null && location?.lng != null) {
      params.lat = location.lat;
      params.lng = location.lng;
    }
    return buildCalendarTrackUrl(params);
  }, [resolvedTitle, prefix, endExisting, startHome, attachCoords, location]);

  const copyText = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied('');
      setMessage('無法複製，請手動選取 URL');
    }
  };

  const handleOp = async (op) => {
    if (op === 'start' && !resolvedTitle) {
      setMessage('請選擇或輸入 Event 標題');
      return;
    }

    const timestamp = stampCalendarTimestamp();
    const useCoords = attachCoords && location?.lat != null && location?.lng != null;
    const payload = {
      id: Date.now(),
      action: 'trackCalendar',
      op,
      title: resolvedTitle || '',
      prefix: prefix.trim(),
      timestamp,
      latitude: useCoords ? location.lat : null,
      longitude: useCoords ? location.lng : null,
      endExisting,
      startHome,
    };

    setIsSubmitting(true);
    setMessage('');

    try {
      if (onIOS && useShortcut) {
        openShortcut(shortcutName, stringifyCalendarTrackInput(payload));
        setMessage(`已透過 iOS Shortcuts「${shortcutName}」啟動`);
        return;
      }

      const result = await enqueueAndSend(payload);
      const label = op === 'home' ? '回家' : resolvedTitle || op;
      setMessage(
        result.sent
          ? `已送出：${op} / ${label}`
          : `已暫存佇列：${op} / ${label}`
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
        行事曆軌跡
        <span className="entry-route-badge" title={onIOS && useShortcut ? `捷徑：${shortcutName}` : 'Apps Script URL'}>
          {onIOS && useShortcut ? 'iOS Shortcuts' : 'GAS URL'}
        </span>
      </div>

      <label className="entry-field-label">Event 標題</label>
      <div className="entry-chip-row">
        {CALENDAR_TITLES.map((item) => (
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
          Other
        </button>
      </div>
      {title === '__custom__' && (
        <input
          className="entry-text-input"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          placeholder="自行輸入標題"
        />
      )}

      <label className="entry-field-label">Prefix / 軌跡標註</label>
      <div className="entry-chip-row">
        <button
          type="button"
          className={`entry-chip ${prefix === '' ? 'active' : ''}`}
          onClick={() => setPrefix('')}
        >
          -no input-
        </button>
        {CALENDAR_PREFIXES.map((item) => (
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
        placeholder="或手動輸入 prefix（空白則為 -no input-）"
      />

      <label className="entry-toggle">
        <input
          type="checkbox"
          checked={endExisting}
          onChange={(e) => setEndExisting(e.target.checked)}
        />
        結束現有行程（start 時關閉其他 **start**）
      </label>

      <label className="entry-toggle">
        <input
          type="checkbox"
          checked={startHome}
          onChange={(e) => setStartHome(e.target.checked)}
        />
        回家後開始在家（**home**）
      </label>

      <label className="entry-toggle">
        <input
          type="checkbox"
          checked={attachCoords}
          onChange={(e) => setAttachCoords(e.target.checked)}
        />
        附帶快取座標
        {attachCoords && !hasLocation && <span className="entry-hint">（尚無快取，仍會送出）</span>}
      </label>

      {onIOS && (
        <label className="entry-toggle">
          <input
            type="checkbox"
            checked={useShortcut}
            onChange={(e) => setUseShortcut(e.target.checked)}
          />
          改走 iOS Shortcuts「{shortcutName}」（自動化請用下方 GAS URL）
        </label>
      )}

      <div className="entry-btn-row">
        <button
          type="button"
          className="entry-primary-btn"
          onClick={() => handleOp('start')}
          disabled={isSubmitting}
        >
          開始
        </button>
        <button
          type="button"
          className="entry-secondary-btn"
          onClick={() => handleOp('append')}
          disabled={isSubmitting}
        >
          追加
        </button>
        <button
          type="button"
          className="entry-secondary-btn"
          onClick={() => handleOp('end')}
          disabled={isSubmitting}
        >
          結束
        </button>
        <button
          type="button"
          className="entry-secondary-btn"
          onClick={() => handleOp('home')}
          disabled={isSubmitting}
        >
          回家
        </button>
      </div>

      {message && <div className="entry-message">{message}</div>}

      <details className="calendar-url-help">
        <summary>Shortcuts GAS URL（Get Contents of URL，失敗可重送）</summary>
        <p className="entry-help-hint">
          帶 timestamp 的同一條 URL 可重送；沒帶則後台用收到當下時間。不要 Open URL。
        </p>
        <div className="calendar-url-item">
          <div className="calendar-url-item-head">
            <strong>目前表單（append 預覽）</strong>
            <button type="button" className="calendar-url-copy" onClick={() => copyText('live', liveUrl)}>
              {copied === 'live' ? '已複製' : '複製'}
            </button>
          </div>
          <code className="calendar-url-code">{liveUrl}</code>
        </div>
        {calendarTrackUrlExamples().map((ex) => {
          const href = buildCalendarTrackUrl(ex.params);
          return (
            <div key={ex.title} className="calendar-url-item">
              <div className="calendar-url-item-head">
                <strong>{ex.title}</strong>
                <button type="button" className="calendar-url-copy" onClick={() => copyText(ex.title, href)}>
                  {copied === ex.title ? '已複製' : '複製'}
                </button>
              </div>
              <span className="entry-help-item-note">{ex.note}</span>
              <code className="calendar-url-code">{href}</code>
            </div>
          );
        })}
      </details>
    </div>
  );
}

export default CalendarTracker;
