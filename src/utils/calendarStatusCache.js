import { buildCalendarTrackUrl, loadCalendarLookbackDays } from './calendarTrackUrl';

export const CALENDAR_STATUS_KEY = 'calendarTrackStatus';
export const CALENDAR_CHECK_ATTEMPT_KEY = 'calendarCheckAttemptAt';
export const CALENDAR_CHECK_RETRY_MS = 5 * 60 * 1000;
const MAX_RECENT = 8;

function emptyStatus() {
  return {
    starts: [],
    homes: [],
    recent: [],
    fetchedAt: 0,
    updatedAt: 0,
  };
}

function normalizeEvent(raw, kind) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || '').trim();
  if (!title) return null;
  return {
    eventId: String(raw.eventId || raw.id || ''),
    title,
    start: raw.start || '',
    end: raw.end || '',
    marker: raw.marker || '',
    lastTrailAt: raw.lastTrailAt || '',
    kind: kind === 'home' ? 'home' : 'start',
  };
}

export function loadCalendarStatus() {
  try {
    const raw = localStorage.getItem(CALENDAR_STATUS_KEY);
    if (!raw) return emptyStatus();
    const parsed = JSON.parse(raw);
    return {
      starts: Array.isArray(parsed.starts) ? parsed.starts.map((e) => normalizeEvent(e, 'start')).filter(Boolean) : [],
      homes: Array.isArray(parsed.homes) ? parsed.homes.map((e) => normalizeEvent(e, 'home')).filter(Boolean) : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent.slice(0, MAX_RECENT) : [],
      fetchedAt: Number(parsed.fetchedAt) || 0,
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch {
    return emptyStatus();
  }
}

export function saveCalendarStatus(next) {
  const payload = {
    starts: next.starts || [],
    homes: next.homes || [],
    recent: (next.recent || []).slice(0, MAX_RECENT),
    fetchedAt: Number(next.fetchedAt) || 0,
    updatedAt: Number(next.updatedAt) || Date.now(),
  };
  localStorage.setItem(CALENDAR_STATUS_KEY, JSON.stringify(payload));
  return payload;
}

export function formatCalendarClock(isoOrStamp) {
  if (!isoOrStamp) return '';
  const date = new Date(isoOrStamp);
  if (Number.isNaN(date.getTime())) {
    const m = String(isoOrStamp).match(/(\d{2}:\d{2})/);
    return m ? m[1] : String(isoOrStamp);
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  return `${months[date.getMonth()]} ${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function applyOptimisticCalendarAction(prev, action) {
  const whenDate =
    action.when instanceof Date && !Number.isNaN(action.when.getTime())
      ? action.when
      : new Date();
  const nowIso = whenDate.toISOString();
  const title = String(action.title || '').trim() || (action.all ? '' : 'Trip');
  const label = action.uiLabel || action.op;
  let starts = [...(prev.starts || [])];
  let homes = [...(prev.homes || [])];

  if (action.op === 'start') {
    const created = { title, start: nowIso, kind: 'start', marker: '**start**' };
    if (action.endScope === 'none' || action.endExisting === false) {
      starts = [created, ...starts];
    } else if (action.endScope === 'latest') {
      const latest = starts.reduce(
        (best, e) => (!best || String(e.start || '') > String(best.start || '') ? e : best),
        null
      );
      starts = [created, ...starts.filter((e) => e !== latest)];
    } else {
      starts = [created];
      homes = [];
    }
  } else if (action.op === 'appendIfExists') {
    /* 不開新行程；沒有 **start** 就維持原狀 */
  } else if (action.op === 'append') {
    if (!starts.some((e) => e.title === title)) {
      starts = [{ title, start: nowIso, kind: 'start', marker: '**start**' }, ...starts];
    }
  } else if (action.op === 'end') {
    if (action.all || action.endScope === 'all' || action.endAny || !action.title) {
      starts = [];
      homes = [];
    } else {
      starts = starts.filter((e) => e.title !== title);
    }
  } else if (action.op === 'home') {
    starts = [];
    homes = action.startHome
      ? [{ title: 'Home', start: nowIso, kind: 'home', marker: '**home**' }]
      : [];
  }

  const recent = [
    {
      id: Date.now(),
      at: nowIso,
      op: action.op,
      label,
      title: action.all ? '' : action.op === 'home' ? (action.startHome ? 'Home' : '') : title,
      queued: Boolean(action.queued),
    },
    ...(prev.recent || []),
  ].slice(0, MAX_RECENT);

  return saveCalendarStatus({
    ...prev,
    starts,
    homes,
    recent,
    updatedAt: Date.now(),
  });
}

export async function fetchCalendarCheck({ force = false } = {}) {
  const lastAttempt = Number(localStorage.getItem(CALENDAR_CHECK_ATTEMPT_KEY) || 0);
  if (!force && lastAttempt && Date.now() - lastAttempt < CALENDAR_CHECK_RETRY_MS) {
    return loadCalendarStatus();
  }
  localStorage.setItem(CALENDAR_CHECK_ATTEMPT_KEY, String(Date.now()));
  const url = buildCalendarTrackUrl({
    op: 'check',
    days: loadCalendarLookbackDays(),
    lookbackDays: loadCalendarLookbackDays(),
  });
  if (!url) throw new Error('缺少行事曆端點');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data || data.success === false) throw new Error(data?.error || 'check 失敗');
  const starts = (data.starts || []).map((e) => normalizeEvent(e, 'start')).filter(Boolean);
  const homes = (data.homes || []).map((e) => normalizeEvent(e, 'home')).filter(Boolean);
  const prev = loadCalendarStatus();
  return saveCalendarStatus({
    ...prev,
    starts,
    homes,
    fetchedAt: Date.now(),
    updatedAt: Date.now(),
  });
}
