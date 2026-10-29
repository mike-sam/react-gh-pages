import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SHORTCUTS } from '../config';
import { useSmartLocation } from '../hooks/useSmartLocation';
import { useOfflineQueue } from '../context/QueueContext';
import { isIOS, openShortcut, stringifyCalendarTrackInput } from '../utils/platform';
import CalendarUrlExamples from './CalendarUrlExamples';
import MobileFriendlyDateTime from './MobileFriendlyDateTime';
import { PinIcon } from './LocationPinButton';
import {
  CALENDAR_LOOKBACK_DAY_CHOICES,
  CALENDAR_PREFIXES,
  CALENDAR_TITLES,
  buildCalendarTrailPreview,
  buildCalendarTrackUrl,
  loadCalendarLookbackDays,
  saveCalendarLookbackDays,
  stampCalendarTimestamp,
} from '../utils/calendarTrackUrl';
import { labelFromCoveringPlace } from '../utils/landmarkRegions';
import {
  applyOptimisticCalendarAction,
  fetchCalendarCheck,
  formatCalendarClock,
  loadCalendarStatus,
} from '../utils/calendarStatusCache';

function formatTrackResult(label, data) {
  if (!data || typeof data !== 'object') return `已送出：${label}`;
  if (data.ping) return `GAS 通了 · ${data.at || ''}`;
  if (data.mode === 'ended') {
    const n = Array.isArray(data.closed) ? data.closed.length : 0;
    const extra = data.warning ? ` · ${data.warning}` : '';
    return `已結束 ${n} 筆${extra}`;
  }
  if (data.mode === 'noop') {
    if (data.op === 'appendIfExists') {
      return `沒有開著的「${data.title || '該'}」行程，未追加`;
    }
    return `沒找到可結束的行程${data.warning ? ` · ${data.warning}` : ''}`;
  }
  if (data.mode === 'skipped') {
    return `${label} 已略過（${data.reason || 'duplicate'}）`;
  }
  if (data.mode === 'created' || data.mode === 'appended' || data.mode === 'home' || data.mode === 'home_started') {
    return `已送出：${label}`;
  }
  return `已送出：${label}${data.mode ? ` · ${data.mode}` : ''}`;
}

function CalendarTracker() {
  const { location, hasLocation, locationMode, setLocationMode, resolveForAction } =
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
  const [lookbackDays, setLookbackDays] = useState(() => loadCalendarLookbackDays());
  const timeEditedRef = useRef(false);
  const editorOpenRef = useRef(false);
  const actionTimeRef = useRef(actionTime);
  actionTimeRef.current = actionTime;
  const checkTimer = useRef(null);

  const onIOS = useMemo(() => isIOS(), []);
  const shortcutName = SHORTCUTS?.CALENDAR_TRACK || 'CalendarTrack';
  const resolvedTitle = title === '__custom__' ? customTitle.trim() : title;
  const selectEventTitle = (name) => {
    const next = String(name || '').trim();
    if (!next) return;
    if (CALENDAR_TITLES.includes(next)) {
      setTitle(next);
      return;
    }
    setTitle('__custom__');
    setCustomTitle(next);
  };

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
      if (timeEditedRef.current || editorOpenRef.current) return;
      setActionTime(new Date());
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const placeName = useMemo(
    () => (location ? labelFromCoveringPlace(location) || location.label || '' : ''),
    [location]
  );

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
    if (placeName) params.placeName = placeName;
    params.timestamp = stampCalendarTimestamp(actionTime);
    params.timestampMs = actionTime instanceof Date ? actionTime.getTime() : Date.now();
    params.days = lookbackDays;
    params.lookbackDays = lookbackDays;
    return buildCalendarTrackUrl(params);
  }, [resolvedTitle, prefix, location, placeName, actionTime, lookbackDays]);

  const prevTrailAt = useMemo(() => {
    const pool = status.starts || [];
    if (!pool.length) return null;
    const want = resolvedTitle;
    const ev = (want && pool.find((e) => e.title === want)) || pool[0];
    const raw = ev.lastTrailAt || ev.start;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [status.starts, resolvedTitle]);

  const trailPreview = useMemo(
    () =>
      buildCalendarTrailPreview({
        when: actionTime,
        prefix,
        lat: location?.lat,
        lng: location?.lng,
        placeName,
        prevWhen: prevTrailAt,
      }),
    [actionTime, prefix, location, placeName, prevTrailAt]
  );

  const pickLookbackDays = (n) => {
    const next = saveCalendarLookbackDays(n);
    setLookbackDays(next);
    refreshStatus({ silent: true, force: true });
    return next;
  };

  const pingGas = async () => {
    setMessage('測試連線中…');
    try {
      const url = buildCalendarTrackUrl({ op: 'ping' });
      const res = await fetch(url);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      if (data?.ping) {
        setMessage(`GAS 通了 · ${data.at || ''}`);
        return;
      }
      setMessage(`GAS 回應異常：${(data && data.error) || text.slice(0, 180) || `HTTP ${res.status}`}`);
    } catch (err) {
      setMessage(`無法連 GAS：${err.message || err}`);
    }
  };

  const handleOp = (op, flags = {}, days = lookbackDays) => {
    if ((op === 'start' || flags.requireTitle) && !resolvedTitle) {
      setMessage('請選擇或輸入 Event 標題');
      return;
    }
    const label = flags.uiLabel || resolvedTitle || op;
    const source =
      actionTimeRef.current instanceof Date ? actionTimeRef.current : actionTime;
    const when = source instanceof Date ? new Date(source.getTime()) : new Date();
    const timestamp = stampCalendarTimestamp(when);
    const timestampMs = when.getTime();
    const cached = location;
    const endScope =
      flags.endScope || (flags.all ? 'all' : flags.endAny ? 'latest' : '');
    timeEditedRef.current = false;
    editorOpenRef.current = false;
    setActionTime(new Date());
    setStatus(
      applyOptimisticCalendarAction(loadCalendarStatus(), {
        op,
        title: flags.all ? '' : resolvedTitle,
        uiLabel: label,
        all: flags.all === true,
        endAny: flags.endAny === true,
        endScope,
        endExisting: flags.endExisting !== undefined ? flags.endExisting : true,
        startHome: flags.startHome === true,
        queued: true,
        when,
      })
    );
    setMessage(`已排入：${label}`);

    const buildPayload = (coords) => ({
      id: Date.now(),
      action: 'trackCalendar',
      op: flags.all ? 'end all' : op,
      title: flags.all ? '' : resolvedTitle || '',
      prefix: prefix.trim(),
      timestamp,
      timestampMs,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      placeName: coords ? labelFromCoveringPlace(coords) || coords.label || placeName : placeName,
      endExisting: flags.endExisting !== undefined ? flags.endExisting : true,
      startHome: flags.startHome === true,
      all: flags.all === true,
      endAny: flags.endAny === true,
      endScope,
      silent: true,
      days,
      lookbackDays: days,
    });

    if (onIOS && useShortcut) {
      openShortcut(shortcutName, stringifyCalendarTrackInput(buildPayload(cached)));
      setMessage(`已透過 iOS Shortcuts「${shortcutName}」啟動`);
      return;
    }

    setPendingCount((n) => n + 1);
    void (async () => {
      let coords = cached;
      try {
        coords = (await resolveForAction()) || cached;
      } catch {
        coords = cached;
      }
      try {
        const result = await enqueueAndSend(buildPayload(coords));
        if (result.aborted) {
          setMessage(`${label} 已取消`);
          return;
        }
        if (result.sent) {
          setMessage(formatTrackResult(label, result.data));
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
            timeEditedRef.current = true;
            setActionTime(d);
          }}
          onEditingChange={(open) => {
            editorOpenRef.current = Boolean(open);
          }}
          title="軌跡時間"
        />
      </div>

      <section className="calendar-endall">
        <span className="entry-field-label">過去</span>
        <span className="entry-chip-row calendar-lookback-chips" role="group" aria-label="搜尋過去幾天">
          {CALENDAR_LOOKBACK_DAY_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              className={`entry-chip${lookbackDays === n ? ' active' : ''}`}
              onClick={() => pickLookbackDays(n)}
            >
              {n}天
            </button>
          ))}
        </span>
        <button
          type="button"
          className="entry-btn-end-all"
          onClick={() => handleOp('end', { all: true, endScope: 'all', uiLabel: 'End All' })}
        >
          End All
          <small className="calendar-btn-note">end all events within {lookbackDays} days</small>
        </button>
      </section>

      <div className="calendar-fields">
        <section className="calendar-field">
          <div className="calendar-field-head">
            <span className="entry-field-label">Event</span>
            <span className="calendar-lookback-caption">選取後才按下面按鈕</span>
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
            <span className="calendar-lookback-caption">按鈕會自己寫 start/end，這裡只需附加說明</span>
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
          <button
            type="button"
            className="calendar-status-refresh"
            onClick={() => pingGas()}
            title="GET ping，確認這支 GAS 有被打到"
          >
            測試連線
          </button>
        </div>
        {status.starts.length === 0 && status.homes.length === 0 ? (
          <p className="calendar-status-empty">過去 {lookbackDays} 天內沒有尚未結束的行程</p>
        ) : (
          <ul className="calendar-status-list">
            {status.starts.map((ev) => (
              <li key={`s-${ev.eventId || ev.title}-${ev.start}`}>
                <button
                  type="button"
                  className={`calendar-status-pick${resolvedTitle === ev.title ? ' is-selected' : ''}`}
                  onClick={() => selectEventTitle(ev.title)}
                >
                  <strong>{ev.title}</strong>
                  {ev.marker !== '**start**' ? (
                    <span className="calendar-status-adopted">既有</span>
                  ) : null}
                  {ev.start ? <span>從 {formatCalendarClock(ev.start)}</span> : null}
                </button>
              </li>
            ))}
            {status.homes.map((ev) => (
              <li key={`h-${ev.eventId || ev.title}-${ev.start}`}>
                <span className="calendar-status-pick is-static">
                  <strong>Home</strong>
                  {ev.start ? <span>從 {formatCalendarClock(ev.start)}</span> : null}
                </span>
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

      <div className="calendar-act-rows">
        <div className="entry-btn-row">
          <button
            type="button"
            className="entry-btn-start"
            onClick={() => handleOp('append', { requireTitle: true, uiLabel: 'Start/Append' })}
          >
            Start/Append
            <small className="calendar-btn-note">append if exists or start if doesn't exists</small>
          </button>
          <button
            type="button"
            className="entry-btn-start"
            onClick={() => handleOp('appendIfExists', { requireTitle: true, uiLabel: 'Append If' })}
          >
            Append If Exists
            <small className="calendar-btn-note">only append if exists</small>
          </button>
          <button
            type="button"
            className="entry-btn-start-new"
            onClick={() =>
              handleOp('start', {
                endExisting: false,
                endScope: 'none',
                requireTitle: true,
                uiLabel: 'Start New',
              })
            }
          >
            Start New
            <small className="calendar-btn-note">ignore any, create new</small>
          </button>
        </div>
        <div className="entry-btn-row">
          <button
            type="button"
            className="entry-btn-end-start"
            onClick={() =>
              handleOp('start', {
                endExisting: true,
                endScope: 'latest',
                requireTitle: true,
                uiLabel: 'End+Start',
              })
            }
          >
            End+Start
            <small className="calendar-btn-note">end recent event & start this event</small>
          </button>
          <button
            type="button"
            className="entry-btn-end"
            onClick={() => handleOp('end', { endScope: 'title', requireTitle: true, uiLabel: 'End' })}
          >
            End
            <small className="calendar-btn-note">end this event only</small>
          </button>
        </div>
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
