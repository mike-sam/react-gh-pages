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
  id,
}) {
  return {
    id: id ?? Date.now(),
    action: 'trackCalendar',
    op,
    title: title || '',
    prefix,
    timestamp: stampCalendarTimestamp(when instanceof Date ? when : new Date()),
    latitude: lat ?? null,
    longitude: lng ?? null,
    endExisting,
    startHome: false,
    all: Boolean(all),
    endAny: Boolean(endAny),
    lookbackDays: Number(lookbackDays) || CALENDAR_LOOKBACK_DAYS_DEFAULT,
  };
}

/** Description lines GAS writes onto the calendar event. */
export function buildCalendarTrailPreview({
  when,
  prefix = '',
  lat = null,
  lng = null,
  marker = '**start**',
} = {}) {
  const prefixPart = String(prefix || '').trim() || '-no input-';
  const hasCoords =
    lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const maps = hasCoords ? `@http://maps.google.com/maps?q=${lat},${lng}` : '';
  return {
    marker,
    line: `[${stampCalendarTimestamp(when instanceof Date ? when : new Date())}][${prefixPart}]${maps}`,
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
    'lat',
    'lng',
    'latlong',
    'endExisting',
    'startHome',
    'all',
    'endAny',
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
      note: '結束任何進行中後開 Work',
      params: {
        op: 'start',
        title: 'Work',
        endExisting: true,
        endAny: true,
        timestamp: ts,
      },
    },
    {
      title: 'End All',
      note: '結束所有進行中（**start**、即時行程、Home）',
      params: {
        op: 'end',
        all: true,
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
