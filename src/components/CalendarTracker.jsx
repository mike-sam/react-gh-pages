import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SHORTCUTS } from '../config';
import { useSmartLocation } from '../hooks/useSmartLocation';
import { useOfflineQueue } from '../context/QueueContext';
import { isIOS, openShortcut, stringifyCalendarTrackInput } from '../utils/platform';
import CalendarUrlExamples from './CalendarUrlExamples';
import MobileFriendlyDateTime from './MobileFriendlyDateTime';
import { PinIcon } from './LocationPinButton';
import {
  CALENDAR_PREFIXES,
  CALENDAR_TITLES,
  buildCalendarTrailPreview,
  buildCalendarTrackUrl,
  stampCalendarTimestamp,
} from '../utils/calendarTrackUrl';
import {
  applyOptimisticCalendarAction,
  fetchCalendarCheck,
  formatCalendarClock,
  loadCalendarStatus,
} from '../utils/calendarStatusCache';

function CalendarTracker() {
  const { location, hasLocation, locationMode, setLocationMode, refreshLocation } =
    useSmartLocation();
  const { enqueueAndSend } = useOfflineQueue();
  const [title, setTitle] = useState('Work');
  const [customTitle, setCustomTitle] = useState('');
  const [prefix, setPrefix] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [useShortcut, setUseShortcut] = useState(false);
  const [status, setStatus] = useState(() => loadCalendarStatus());
  const [actionTime, setActionTime] = useState(() => new Date());
  const timeEditedRef = useRef(false);
  const checkTimer = useRef(null);

  const onIOS = useMemo(() => isIOS(), []);
  const shortcutName = SHORTCUTS?.CALENDAR_TRACK || 'CalendarTrack';
  const resolvedTitle = title === '__custom__' ? customTitle.trim() : title;

  const refreshStatus = async ({ silent = false, force = !silent } = {}) => {
    if (!silent) setIsChecking(true);
    try {
      const next = await fetchCalendarCheck({ force });
      setStatus(next);
      if (!silent) setMessage(next.starts.length || next.homes.length ? '已更新進行中的行程' : '日曆上沒有進行中的行程');
    } catch (err) {
      if (!silent) setMessage(`無法讀取日曆：${err.message || err}`);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    const stale = !status.fetchedAt || Date.now() - status.fetchedAt > 5 * 60 * 1000;
    if (stale) refreshStatus({ silent: true });
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
    // mount-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!timeEditedRef.current) setActionTime(new Date());
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const liveUrl = useMemo(() => {
    const params = {
      op: 'append',
      title: resolvedTitle || undefined,
      prefix: prefix.trim() || undefined,
    };
    if (location?.lat != null && location?.lng != null) {
      params.lat = location.lat;
      params.lng = location.lng;
    }
    params.timestamp = stampCalendarTimestamp(actionTime);
    return buildCalendarTrackUrl(params);
  }, [resolvedTitle, prefix, location, actionTime]);

  const trailPreview = useMemo(
    () =>
      buildCalendarTrailPreview({
        when: actionTime,
        prefix,
        lat: location?.lat,
        lng: location?.lng,
      }),
    [actionTime, prefix, location]
  );

  const handleOp = (op, flags = {}) => {
    if ((op === 'start' || flags.requireTitle) && !resolvedTitle) {
      setMessage('請選擇或輸入 Event 標題');
      return;
    }

    const label = flags.uiLabel || resolvedTitle || op;
    const when = actionTime instanceof Date ? actionTime : new Date();
    const timestamp = stampCalendarTimestamp(when);
    const cached = location;
    timeEditedRef.current = false;
    setActionTime(new Date());
    setStatus(
      applyOptimisticCalendarAction(loadCalendarStatus(), {
        op,
        title: flags.all ? '' : resolvedTitle,
        uiLabel: label,
        all: flags.all === true,
        startHome: flags.startHome === true,
        queued: true,
        when,
      })
    );
    setMessage(`已排入：${label}`);

    const buildPayload = (coords) => ({
      id: Date.now(),
      action: 'trackCalendar',
      op,
      title: flags.all ? '' : resolvedTitle || '',
      prefix: prefix.trim(),
      timestamp,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      endExisting: flags.endExisting !== undefined ? flags.endExisting : true,
      startHome: flags.startHome === true,
      all: flags.all === true,
      endAny: flags.endAny === true,
    });

    if (onIOS && useShortcut) {
      openShortcut(shortcutName, stringifyCalendarTrackInput(buildPayload(cached)));
      setMessage(`已透過 iOS Shortcuts「${shortcutName}」啟動`);
      return;
    }

    setPendingCount((n) => n + 1);
    void (async () => {
      let coords = cached;
      if (locationMode === 'live') {
        try {
          coords = (await refreshLocation()) || cached;
        } catch {
          coords = cached;
        }
      }
      try {
        const result = await enqueueAndSend(buildPayload(coords));
        if (result.aborted) {
          setMessage(`${label} 已取消`);
          return;
        }
        if (result.sent) {
          setMessage(`已送出：${label}`);
          if (checkTimer.current) clearTimeout(checkTimer.current);
          checkTimer.current = setTimeout(() => refreshStatus({ silent: true, force: true }), 2200);
        } else {
          setMessage(`已暫存佇列：${label}（稍後自動重試）`);
        }
      } catch (err) {
        setMessage(`失敗：${label} — ${err.message || err}`);
      } finally {
        setPendingCount((n) => Math.max(0, n - 1));
      }
    })();
  };

  return (
    <div className="entry-card calendar-tracker">
      <div className="entry-card-header">
        行事曆軌跡
        <span className="entry-route-badge" title={onIOS && useShortcut ? `捷徑：${shortcutName}` : 'Apps Script URL'}>
          {onIOS && useShortcut ? 'iOS Shortcuts' : 'GAS URL'}
        </span>
      </div>

      <div className="calendar-time-row">
        <MobileFriendlyDateTime
          value={actionTime}
          onChange={(d) => {
            timeEditedRef.current = Math.abs(Date.now() - d.getTime()) > 120000;
            setActionTime(d);
          }}
          title="軌跡時間"
        />
      </div>

      <div className="calendar-fields">
        <section className="calendar-field">
          <div className="calendar-field-head">
            <span className="entry-field-label">Event</span>
          </div>
          <div className="entry-chip-row calendar-title-chips">
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
        </section>

        <section className="calendar-field">
          <div className="calendar-field-head">
            <span className="entry-field-label">Prefix</span>
          </div>
          <div className="entry-chip-row calendar-prefix-chips">
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
            placeholder="空白則為 -no input-"
          />
        </section>
      </div>

      <div className="entry-radio-row calendar-loc-row" role="radiogroup" aria-label="座標來源">
        <span
          className={[
            'calendar-loc-pin',
            hasLocation ? 'is-located' : 'is-empty',
            locationMode === 'live' ? 'is-live' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        >
          <PinIcon />
        </span>
        <label className="entry-radio">
          <input
            type="radio"
            name="calendar-loc-mode"
            checked={locationMode === 'cache'}
            onChange={() => setLocationMode('cache')}
          />
          快取
        </label>
        <label className="entry-radio">
          <input
            type="radio"
            name="calendar-loc-mode"
            checked={locationMode === 'live'}
            onChange={() => setLocationMode('live')}
          />
          實時定位
        </label>
        {locationMode === 'live' && (
          <span className="entry-hint">提交表單後取得所在位置</span>
        )}
        {locationMode !== 'live' && !hasLocation && (
          <span className="entry-hint">尚無快取，仍會送出</span>
        )}
      </div>

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

      <div className="calendar-status">
        <div className="calendar-status-head">
          <span className="entry-field-label">進行中</span>
          <button
            type="button"
            className="calendar-status-refresh"
            onClick={() => refreshStatus()}
            disabled={isChecking}
          >
            {isChecking ? '更新中…' : '重新整理'}
          </button>
        </div>
        {status.starts.length === 0 && status.homes.length === 0 ? (
          <p className="calendar-status-empty">尚無進行中的行程</p>
        ) : (
          <ul className="calendar-status-list">
            {status.starts.map((ev) => (
              <li key={`s-${ev.eventId || ev.title}-${ev.start}`}>
                <strong>{ev.title}</strong>
                {ev.marker !== '**start**' ? (
                  <span className="calendar-status-adopted">既有</span>
                ) : null}
                {ev.start ? <span>從 {formatCalendarClock(ev.start)}</span> : null}
              </li>
            ))}
            {status.homes.map((ev) => (
              <li key={`h-${ev.eventId || ev.title}-${ev.start}`}>
                <strong>Home</strong>
                {ev.start ? <span>從 {formatCalendarClock(ev.start)}</span> : null}
              </li>
            ))}
          </ul>
        )}
        {status.recent.length > 0 ? (
          <>
            <p className="calendar-recent-label">近期動作</p>
            <ul className="calendar-recent-list">
              {status.recent.slice(0, 4).map((row) => (
                <li key={row.id}>
                  <span className="calendar-recent-time">{formatCalendarClock(row.at)}</span>
                  <span>
                    {row.label}
                    {row.title ? ` · ${row.title}` : ''}
                    {row.queued ? '（佇列）' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="entry-btn-row">
        <button
          type="button"
          className="entry-btn-start"
          onClick={() => handleOp('append', { uiLabel: 'Start/Append' })}
          title="有進行中的行程就追加；沒有則開始"
        >
          Start/Append
        </button>
        <button
          type="button"
          className="entry-btn-start-new"
          onClick={() =>
            handleOp('start', { endExisting: true, requireTitle: true, uiLabel: 'Start New' })
          }
          title="結束標記中的行程後，用目前標題開新的"
        >
          Start New
        </button>
        <button
          type="button"
          className="entry-btn-end-start"
          onClick={() =>
            handleOp('start', {
              endExisting: true,
              endAny: true,
              requireTitle: true,
              uiLabel: 'End+Start',
            })
          }
          title="結束任何進行中的行程後，用目前標題開新的"
        >
          End+Start
        </button>
        <button
          type="button"
          className="entry-btn-end"
          onClick={() => handleOp('end', { uiLabel: 'End' })}
          title="結束目前所選標題的行程"
        >
          End
        </button>
        <button
          type="button"
          className="entry-btn-end-all"
          onClick={() => handleOp('end', { all: true, uiLabel: 'End All' })}
          title="結束所有進行中的行程"
        >
          End All
        </button>
      </div>
      <pre className="calendar-trail-preview" aria-label="預覽">
        <span className="calendar-trail-label">預覽</span>
        <span className="calendar-trail-marker">{trailPreview.marker}</span>
        <span className="calendar-trail-line">{trailPreview.line}</span>
      </pre>

      {(message || pendingCount > 0) && (
        <div className={`entry-message${/失敗|無法/.test(message) ? ' is-error' : ''}`}>
          {message}
          {pendingCount > 0 ? ` · ${pendingCount} 筆背景送出中` : ''}
        </div>
      )}

      <CalendarUrlExamples liveUrl={liveUrl} />
    </div>
  );
}

export default CalendarTracker;
