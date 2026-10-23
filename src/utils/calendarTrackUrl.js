import { API_ENDPOINTS } from '../config';

export const CALENDAR_TITLES = ['Work', 'Commute', 'Driving', 'Trip', 'Sleep'];

export const CALENDAR_PREFIXES = ['start', 'end', 'public transportation'];

export const CALENDAR_LOOKBACK_DAYS_DEFAULT = 3;
export const CALENDAR_LOOKBACK_DAY_CHOICES = [1, 3, 7];
const LOOKBACK_DAYS_KEY = 'calendarLookbackDays';

export function loadCalendarLookbackDays() {
  try {
    const n = Number(localStorage.getItem(LOOKBACK_DAYS_KEY));
    if (CALENDAR_LOOKBACK_DAY_CHOICES.includes(n)) return n;
  } catch {
    /* ignore */
  }
  return CALENDAR_LOOKBACK_DAYS_DEFAULT;
}

export function saveCalendarLookbackDays(days) {
  const n = Number(days);
  const next = CALENDAR_LOOKBACK_DAY_CHOICES.includes(n) ? n : CALENDAR_LOOKBACK_DAYS_DEFAULT;
  try {
    localStorage.setItem(LOOKBACK_DAYS_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** Query contract for GAS GET/POST. Shown in the calendar ? help panel. */
export const CALENDAR_TRACK_PARAMS = [
  {
    name: 'action',
    required: 'required',
    example: 'trackCalendar',
    note: '固定。check 可用 check_current',
  },
  {
    name: 'op',
    required: 'required',
    example: 'start, append, end, home',
    note: '按鈕對應 append / start / start+endAny / end / end+all。home 仍可用 URL',
  },
  {
    name: 'title',
    required: 'start 建議',
    example: 'Work',
    note: 'Work / Commute / Driving / Trip / Sleep，或其他自訂。缺則 Trip',
  },
  {
    name: 'prefix',
    required: 'optional',
    example: 'public transportation',
    note: '軌跡標註。空白 → [-no input-]',
  },
  {
    name: 'timestamp',
    required: '建議',
    example: '2026-06-08 07:09:43',
    note: '本地牆鐘。有則可重送；沒帶用收到當下',
  },
  {
    name: 'timestampMs',
    required: '建議',
    example: '1780873783000',
    note: '毫秒 epoch。有則以此刻為準，避免牆鐘解析落到「現在」',
  },
  {
    name: 'lat',
    required: 'optional',
    example: '1.3133',
    note: '與 lng 成對',
  },
  {
    name: 'lng',
    required: 'optional',
    example: '103.8630',
    note: '與 lat 成對',
  },
  {
    name: 'latlong',
    required: 'optional',
    example: '1.3133,103.8630',
    note: '可取代 lat+lng',
  },
  {
    name: 'endExisting',
    required: 'optional',
    example: '1',
    note: '預設 1。start 時 0 可重疊',
  },
  {
    name: 'startHome',
    required: 'optional',
    example: '0',
    note: '預設 0。home 時 1 另開 **home**',
  },
  {
    name: 'all',
    required: 'optional',
    example: '0',
    note: '預設 0。append 套用每個進行中；end 結束全部進行中（含即時行程與 Home）',
  },
  {
    name: 'endAny',
    required: 'optional',
    example: '0',
    note: '預設 0。start 時 1：結束任何進行中（含既有行程）再開新的',
  },
  {
    name: 'days',
    required: 'optional',
    example: '3',
    note: '搜尋過去 N 天（1–14，預設 3）。也可用 lookbackDays',
  },
];

/** POST/queue body for trackCalendar (same fields as the GAS URL). */
export function calendarActionPayload({
  op,
  title = '',
  when,
  lat = null,
  lng = null,
  endExisting = true,
  all = false,
  endAny = false,
  prefix = '',
  lookbackDays,
  days,
  silent = true,
  id,
  timestampEnd,
  timestampEndMs,
  description,
}) {
  const resolvedDays = Number(days ?? lookbackDays) || CALENDAR_LOOKBACK_DAYS_DEFAULT;
  const body = {
    id: id ?? Date.now(),
    action: 'trackCalendar',
    op,
    title: title || '',
    prefix,
    timestamp: stampCalendarTimestamp(when instanceof Date ? when : new Date()),
    timestampMs: (when instanceof Date ? when : new Date()).getTime(),
    latitude: lat ?? null,
    longitude: lng ?? null,
    endExisting,
    startHome: false,
    all: Boolean(all),
    endAny: Boolean(endAny),
    silent: silent !== false,
    days: resolvedDays,
    lookbackDays: resolvedDays,
  };
  if (timestampEnd) body.timestampEnd = timestampEnd;
  if (timestampEndMs != null) body.timestampEndMs = timestampEndMs;
  if (description) body.description = description;
  return body;
}

/** Timed calendar block from start to end. Not a trail start/end marker. */
export function calendarBlockPayload({ title, start, end, lat = null, lng = null, description = '' }) {
  const s = start instanceof Date ? start : new Date();
  const e = end instanceof Date ? end : new Date();
  return calendarActionPayload({
    op: 'block',
    title: title || 'Trip',
    when: s,
    lat,
    lng,
    endExisting: false,
    endAny: false,
    silent: true,
    timestampEnd: stampCalendarTimestamp(e),
    timestampEndMs: e.getTime(),
    description: String(description || '').slice(0, 800),
  });
}

/** Compact relative gap: (47m), (1h47m), (1d2h47m33s). */
export function formatTrailGap(ms) {
  if (!Number.isFinite(ms) || ms < 1000) return '';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  if (!parts.length) return '';
  return ` - (${parts.join('')})`;
}

/** Description lines GAS writes onto the calendar event. */
export function buildCalendarTrailPreview({
  when,
  prefix = '',
  lat = null,
  lng = null,
  marker = '**start**',
  prevWhen = null,
} = {}) {
  const prefixPart = String(prefix || '').trim() || '-no input-';
  const hasCoords =
    lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const maps = hasCoords ? `@http://maps.google.com/maps?q=${lat},${lng}` : '';
  const at = when instanceof Date ? when : new Date();
  const prev = prevWhen instanceof Date && !Number.isNaN(prevWhen.getTime()) ? prevWhen : null;
  const gap = prev ? formatTrailGap(at.getTime() - prev.getTime()) : '';
  return {
    marker,
    line: `[${stampCalendarTimestamp(at)}][${prefixPart}]${maps}${gap}`,
  };
}

/** Local wall clock, no Z — GAS treats this as the script timezone. */
export function stampCalendarTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    ' ' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds())
  );
}

export function calendarTrackEndpoint() {
  return API_ENDPOINTS.CALENDAR_TRACK || API_ENDPOINTS.GSHEET_SUBMIT || '';
}

/** GET URL from a trackCalendar POST/queue payload (lat/lng aliases included). */
export function buildCalendarTrackUrlFromPayload(payload, base = calendarTrackEndpoint()) {
  const p = payload || {};
  return buildCalendarTrackUrl(
    {
      op: p.op,
      title: p.title,
      prefix: p.prefix,
      timestamp: p.timestamp,
      timestampMs: p.timestampMs ?? p.timestamp_ms,
      timestampEnd: p.timestampEnd ?? p.event_end,
      timestampEndMs: p.timestampEndMs ?? p.timestamp_end_ms,
      description: p.description,
      lat: p.lat ?? p.latitude,
      lng: p.lng ?? p.longitude,
      latlong: p.latlong ?? p.latlng,
      endExisting: p.endExisting,
      startHome: p.startHome,
      all: p.all,
      endAny: p.endAny,
      silent: p.silent,
      days: p.days,
      lookbackDays: p.lookbackDays,
    },
    base
  );
}

/**
 * GAS URL for Shortcuts Get Contents of URL (GET or POST, same query).
 * Booleans become 1/0. Empty values are omitted.
 */
export function buildCalendarTrackUrl(params, base = calendarTrackEndpoint()) {
  if (!base) return '';
  const u = new URL(base);
  u.searchParams.set('action', 'trackCalendar');
  const keys = [
    'op',
    'title',
    'prefix',
    'timestamp',
    'timestampMs',
    'timestampEnd',
    'timestampEndMs',
    'description',
    'lat',
    'lng',
    'latlong',
    'endExisting',
    'startHome',
    'all',
    'endAny',
    'silent',
    'days',
    'lookbackDays',
  ];
  keys.forEach((k) => {
    const v = params?.[k];
    if (v === undefined || v === null || v === '') return;
    if (v === true) {
      u.searchParams.set(k, '1');
      return;
    }
    if (v === false) {
      u.searchParams.set(k, '0');
      return;
    }
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}

export function calendarTrackUrlExamples() {
  const ts = '2026-06-08 07:09:43';
  return [
    {
      title: 'Ping（瀏覽器打開，確認 GAS 有回應）',
      note: '應看到 {"success":true,"ping":true,...}。Log 會寫 doGet。沒回應＝URL/部署不對。',
      params: {
        op: 'ping',
      },
    },
    {
      title: 'Apple Pay · append',
      note: 'prefix=public transportation。Shortcut 填 Current Date / Location，失敗則同一 URL 重送。',
      params: {
        op: 'append',
        prefix: 'public transportation',
        timestamp: ts,
        lat: '1.31',
        lng: '103.86',
      },
    },
    {
      title: '開啟 Work · start',
      note: '結束現有行程後開 Work',
      params: {
        op: 'start',
        title: 'Work',
        endExisting: true,
        timestamp: ts,
      },
    },
    {
      title: 'End+Start · Work',
      note: '結束任何進行中後開 Work。days 可省略（預設 3）',
      params: {
        op: 'start',
        title: 'Work',
        endExisting: true,
        endAny: true,
        days: 3,
        timestamp: ts,
      },
    },
    {
      title: 'End All',
      note: '結束所有進行中。op=end all 即可，不必另帶 all=1。days 可省略（預設 3）',
      params: {
        op: 'end all',
        all: true,
        endAny: true,
        days: 3,
        timestamp: ts,
      },
    },
    {
      title: '重疊 Trip',
      note: 'endExisting=0，Work 保持 **start**',
      params: {
        op: 'start',
        title: 'Trip',
        endExisting: false,
        timestamp: ts,
      },
    },
  ];
}
