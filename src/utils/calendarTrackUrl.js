import { API_ENDPOINTS } from '../config';

export const CALENDAR_TITLES = ['Work', 'WFH', 'Commute', 'Driving', 'Trip', 'Sleep'];

export const CALENDAR_WFH_MARKER = '**wfh**';

export function isWfhTitle(title) {
  return String(title || '').trim().toLowerCase() === 'wfh';
}

/** One meal name for the track time. Covers the whole day. */
export function mealEventForDate(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const mins = d.getHours() * 60 + d.getMinutes();
  if (mins >= 5 * 60 && mins < 10 * 60) return 'Breakfast';
  if (mins >= 10 * 60 && mins < 12 * 60) return 'Brunch';
  if (mins >= 12 * 60 && mins < 16 * 60) return 'Lunch';
  if (mins >= 16 * 60 && mins < 21 * 60) return 'Dinner';
  return 'Supper';
}

export const CALENDAR_PREFIXES = ['public transportation'];

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
    note: '寫入一律 trackCalendar。只讀進行中＝check_current（同 op=check）。測連線＝op=ping',
  },
  {
    name: 'op',
    required: 'required',
    example: 'append, appendIf, startNew, endStart, end, endAll',
    note: '對應按鈕：Start/Append、Append If、Start New、End+Start、End、End All。不分大小寫，end+start／end_start 也可。op=start＝全關再開',
  },
  {
    name: 'event',
    required: 'End All 以外必填',
    example: 'Shopping',
    note: '行程標題，完全相同才算同一個。title= 同義，擇一即可（兩個都給以 title 為準）。End 只關這個，沒開著就不動',
  },
  {
    name: 'prefix',
    required: 'optional',
    example: 'public transportation',
    note: '軌跡標註。空白 → [-no input-]。Start / End 按鈕會自己寫 start、end，不必當 prefix',
  },
  {
    name: 'timestamp',
    required: '建議',
    example: '2026-06-08 07:09:43',
    note: '本地時間。同一 timestamp 重送會被略過；沒帶用 GAS 收到當下。結束類＝結束時間，追加類＝延到 +30 分',
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
    note: '與 lng 成對。latitude／longitude 同義',
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
    name: 'placeName',
    required: 'optional',
    example: 'TSX',
    note: '軌跡地名。空白則 GAS 用地圖管理的區域反查。place 同義',
  },
    {
      name: 'include',
      required: 'optional',
      example: 'wfh',
      note: '只有頁面的 End All 會帶。帶了才連 **wfh** 一起關。捷徑的 endAll 不要帶，回家才不會關掉 WFH',
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
  prefix = '',
  lookbackDays,
  days,
  id,
  timestampEnd,
  timestampEndMs,
  description,
  placeName = '',
}) {
  const resolvedDays = Number(days ?? lookbackDays) || CALENDAR_LOOKBACK_DAYS_DEFAULT;
  const body = {
    id: id ?? Date.now(),
    action: 'trackCalendar',
    op,
    title: title || '',
    event: title || '',
    prefix,
    timestamp: stampCalendarTimestamp(when instanceof Date ? when : new Date()),
    timestampMs: (when instanceof Date ? when : new Date()).getTime(),
    latitude: lat ?? null,
    longitude: lng ?? null,
    placeName: placeName || '',
    days: resolvedDays,
  };
  if (timestampEnd) body.timestampEnd = timestampEnd;
  if (timestampEndMs != null) body.timestampEndMs = timestampEndMs;
  if (description) body.description = description;
  return body;
}

/** Timed calendar block from start to end. Not a trail start/end marker. */
export function calendarBlockPayload({
  title,
  start,
  end,
  lat = null,
  lng = null,
  description = '',
  placeName = '',
}) {
  const s = start instanceof Date ? start : new Date();
  const e = end instanceof Date ? end : new Date();
  return calendarActionPayload({
    op: 'block',
    title: title || 'Trip',
    when: s,
    lat,
    lng,
    placeName,
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
  placeName = '',
  marker = '**start**',
  prevWhen = null,
} = {}) {
  const prefixPart = String(prefix || '').trim() || '-no input-';
  const hasCoords =
    lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const place = String(placeName || '').trim();
  const maps = hasCoords ? `@http://maps.google.com/maps?q=${lat},${lng}` : '';
  const at = when instanceof Date ? when : new Date();
  const prev = prevWhen instanceof Date && !Number.isNaN(prevWhen.getTime()) ? prevWhen : null;
  const gap = prev ? formatTrailGap(at.getTime() - prev.getTime()) : '';
  return {
    marker,
    line: `[${stampCalendarTimestamp(at)}][${prefixPart}]${place}${maps}${gap}`,
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
      placeName: p.placeName || p.place,
      event: p.event || p.title,
      include: p.include,
      days: p.days ?? p.lookbackDays,
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
    'event',
    'prefix',
    'timestamp',
    'timestampMs',
    'timestampEnd',
    'timestampEndMs',
    'description',
    'lat',
    'lng',
    'latlong',
    'placeName',
    'include',
    'days',
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
      title: 'Start/Append · Commute',
      note: 'Commute 開著就追加，否則新開。結束延到 timestamp+30m',
      params: {
        op: 'append',
        event: 'Commute',
        prefix: 'public transportation',
        timestamp: ts,
        lat: '1.31',
        lng: '103.86',
      },
    },
    {
      title: 'Append If · Commute',
      note: 'Commute 開著才追加；沒有就不做事',
      params: {
        op: 'appendIf',
        event: 'Commute',
        timestamp: ts,
        lat: '1.31',
        lng: '103.86',
      },
    },
    {
      title: 'Start New · Shopping',
      note: '直接開 Shopping，舊的都不關',
      params: {
        op: 'startNew',
        event: 'Shopping',
        timestamp: ts,
      },
    },
    {
      title: 'End+Start · Shopping',
      note: '關掉最近一筆進行中的，再開 Shopping',
      params: {
        op: 'endStart',
        event: 'Shopping',
        timestamp: ts,
      },
    },
    {
      title: 'End · Shopping',
      note: '只關 Shopping',
      params: {
        op: 'end',
        event: 'Shopping',
        timestamp: ts,
      },
    },
    {
      title: 'End All',
      note: '不用 event。只關 **start**。WFH 不受影響',
      params: {
        op: 'endAll',
        days: 3,
        timestamp: ts,
      },
    },
    {
      title: 'End All · 含 WFH（頁面按鈕）',
      note: '捷徑不要用這條。include=wfh 才會連 WFH 一起關',
      params: {
        op: 'endAll',
        include: 'wfh',
        days: 3,
        timestamp: ts,
      },
    },
  ];
}
