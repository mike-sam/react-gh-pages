import { API_ENDPOINTS } from '../config';

export const CALENDAR_TITLES = ['Work', 'Commute', 'Driving', 'Trip', 'Sleep'];

export const CALENDAR_PREFIXES = ['start', 'end', 'public transportation'];

export function stampCalendarTimestamp(date = new Date()) {
  return date.toISOString();
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
  const ts = '2026-06-08T07:09:43';
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
      title: '回到家 · home',
      note: '結束所有 **start**，不自動開 Home',
      params: {
        op: 'home',
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
