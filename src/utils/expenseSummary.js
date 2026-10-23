import { API_ENDPOINTS } from '../config';

const CACHE_PREFIX = 'expenseSummary.v5:';
const YEAR_PREFIX = 'expenseSummary.year.v5:';

function emptyYearTotals() {
  return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

export function readYearTotals(year) {
  const y = String(year || '').slice(0, 4);
  let out = emptyYearTotals();
  try {
    const raw = sessionStorage.getItem(YEAR_PREFIX + y);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr) && arr.length === 12) {
      out = arr.map((n) => Number(n) || 0);
    }
  } catch {
    /* ignore */
  }
  for (let m = 1; m <= 12; m += 1) {
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + ym);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const t = Number(parsed?.total);
      if (Number.isFinite(t) && t >= 0) out[m - 1] = t;
    } catch {
      /* ignore */
    }
  }
  return out;
}

function mergeYearTotalSlot(incoming, known) {
  const a = Number(incoming);
  const b = Number(known);
  if (Number.isFinite(a) && a > 0) return a;
  if (Number.isFinite(b) && b > 0) return b;
  if (Number.isFinite(a) && a === 0 && Number.isFinite(b)) return b;
  return 0;
}

export function absorbYearTotals(ym, data) {
  const year = String(ym || '').slice(0, 4);
  const mi = Number(String(ym).slice(5, 7)) - 1;
  const incoming =
    Array.isArray(data?.yearTotals) && data.yearTotals.length === 12
      ? data.yearTotals.map((n) => Number(n) || 0)
      : emptyYearTotals();
  const prev = readYearTotals(year);
  const next = emptyYearTotals();
  for (let i = 0; i < 12; i += 1) {
    next[i] = mergeYearTotalSlot(incoming[i], prev[i]);
  }
  if (mi >= 0 && mi < 12) {
    const monthTotal = Number(data?.total);
    if (Number.isFinite(monthTotal)) next[mi] = monthTotal;
  }
  try {
    sessionStorage.setItem(YEAR_PREFIX + year, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  if (data) data.yearTotals = next;
  return next;
}

export function isYearMonthFuture(yearmonth) {
  const ym = normalizeYearMonth(yearmonth);
  return Boolean(ym && ym > currentYearMonth());
}

export function hasExpenseSummaryCache(yearmonth) {
  const ym = normalizeYearMonth(yearmonth);
  if (!ym) return false;
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + ym);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && parsed.success === true);
  } catch {
    return false;
  }
}

export function yearMonthStatuses(year) {
  const y = String(year || '').slice(0, 4);
  const now = currentYearMonth();
  const out = [];
  for (let m = 1; m <= 12; m += 1) {
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    if (ym > now) out.push('future');
    else if (hasExpenseSummaryCache(ym)) out.push('cached');
    else out.push('uncached');
  }
  return out;
}

export function emptyExpenseSummary(yearmonth, source = 'local') {
  const ym = normalizeYearMonth(yearmonth) || currentYearMonth();
  const totals = readYearTotals(ym.slice(0, 4));
  const mi = Number(ym.slice(5, 7)) - 1;
  const total = mi >= 0 && mi < 12 ? Number(totals[mi]) || 0 : 0;
  return {
    success: true,
    yearmonth: ym,
    total,
    count: 0,
    byTag: [],
    records: [],
    recent: [],
    yearTotals: totals,
    updatedAt: '',
    source,
    cached: source === 'local',
  };
}

export function pendingExpenseSummary(yearmonth) {
  return emptyExpenseSummary(yearmonth, 'pending');
}

export function recordTag(row) {
  return String(row?.tag || '').trim();
}

export function summaryRecords(data) {
  const recs = Array.isArray(data?.records) ? data.records : [];
  if (recs.length) return recs;
  return Array.isArray(data?.recent) ? data.recent : [];
}

export function yearMonthsThroughNow(year) {
  const y = String(year || '').slice(0, 4);
  const now = currentYearMonth();
  const out = [];
  for (let m = 1; m <= 12; m += 1) {
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    if (ym > now) break;
    out.push(ym);
  }
  return out;
}

export function mergeExpenseSummaries(list) {
  const records = [];
  const seen = new Set();
  const tagMap = {};
  let total = 0;
  (list || []).forEach((d) => {
    if (!d) return;
    total += Number(d.total) || 0;
    summaryRecords(d).forEach((r, i) => {
      const id = String(r.id || `${d.yearmonth || ''}-${r.timestamp || ''}-${i}`);
      if (seen.has(id)) return;
      seen.add(id);
      records.push(r);
    });
    (d.byTag || []).forEach((t) => {
      const tag = recordTag(t);
      if (!tag) return;
      if (!tagMap[tag]) tagMap[tag] = { tag, amount: 0, count: 0 };
      tagMap[tag].amount += Number(t.amount) || 0;
      tagMap[tag].count += Number(t.count) || 0;
    });
  });
  if (!Object.keys(tagMap).length && records.length) {
    records.forEach((r) => {
      const tag = recordTag(r) || '未分類';
      if (!tagMap[tag]) tagMap[tag] = { tag, amount: 0, count: 0 };
      tagMap[tag].amount += Number(r.amount) || 0;
      tagMap[tag].count += 1;
    });
  }
  const byTag = Object.values(tagMap).sort((a, b) => b.amount - a.amount);
  return {
    records,
    byTag,
    total,
    count: records.length,
  };
}

export function isSummaryRecordsComplete(data) {
  if (!data) return false;
  const recs = summaryRecords(data);
  const count = Number(data.count);
  if (Number.isFinite(count) && count > recs.length) return false;
  if (recs.length && !recs.some((r) => r && ('lat' in r || 'geolocation' in r))) return false;
  const byTag = Array.isArray(data.byTag) ? data.byTag : [];
  const tagCounts = recs.reduce((acc, row) => {
    const tag = recordTag(row);
    if (!tag) return acc;
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {});
  for (let i = 0; i < byTag.length; i += 1) {
    const tag = recordTag(byTag[i]);
    const n = Number(byTag[i]?.count) || 0;
    if (n > 0 && (tagCounts[tag] || 0) < n) return false;
  }
  return true;
}

export function readExpenseSummaryCache(yearmonth) {
  const ym = normalizeYearMonth(yearmonth);
  if (!ym) return null;
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + ym);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.success !== true) return null;
    const got = normalizeYearMonth(parsed.yearmonth) || ym;
    if (got !== ym) return null;
    if (!isSummaryRecordsComplete(parsed)) return null;
    absorbYearTotals(ym, parsed);
    parsed.source = 'cache';
    parsed.cached = true;
    parsed.records = summaryRecords(parsed);
    return parsed;
  } catch {
    return null;
  }
}

/** Records 存 202610，報表用 2026-10。 */
export function normalizeYearMonth(raw) {
  if (raw == null || raw === '') return '';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return currentYearMonth(raw);
  }
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})[-/]?(\d{1,2})/);
  if (!m) return '';
  const month = String(m[2]).padStart(2, '0');
  if (Number(month) < 1 || Number(month) > 12) return '';
  return `${m[1]}-${month}`;
}

export function invalidateExpenseSummaryCache(yearmonth) {
  const ym = normalizeYearMonth(yearmonth) || currentYearMonth();
  try {
    sessionStorage.removeItem(CACHE_PREFIX + ym);
    sessionStorage.removeItem(`expenseSummary.v4:${ym}`);
    sessionStorage.removeItem(`expenseSummary:${ym}`);
    sessionStorage.removeItem(`expenseSummary:${ym.replace('-', '')}`);
  } catch {
    /* ignore */
  }
}

export function currentYearMonth(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function shiftYearMonth(ym, delta) {
  const norm = normalizeYearMonth(ym) || currentYearMonth();
  const [y, m] = norm.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return currentYearMonth(d);
}

/** PHP date('r') / RFC 2822, e.g. Fri, 23 Oct 2026 16:18:00 +0800 */
export function formatRfc2822(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${days[d.getDay()]}, ${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

export async function fetchExpenseSummary({ yearmonth, id, force = false } = {}) {
  const ym = normalizeYearMonth(yearmonth) || currentYearMonth();
  const cacheKey = CACHE_PREFIX + ym;
  if (!force && !id) {
    if (isYearMonthFuture(ym)) return emptyExpenseSummary(ym);
    const cached = readExpenseSummaryCache(ym);
    if (cached) return cached;
  }
  const url = new URL(API_ENDPOINTS.GSHEET_SUBMIT);
  url.searchParams.set('action', 'getExpenseSummary');
  url.searchParams.set('yearmonth', ym);
  if (force) url.searchParams.set('force', '1');
  if (id) url.searchParams.set('id', id);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data || data.success !== true) {
    throw new Error(data?.error || '讀取報表失敗（請重新部署 Apps Script）');
  }
  data.yearmonth = normalizeYearMonth(data.yearmonth) || ym;
  if (!Array.isArray(data.byTag)) data.byTag = [];
  data.records = summaryRecords(data);
  if (!Array.isArray(data.recent)) data.recent = data.records.slice(0, 24);
  if (!Array.isArray(data.yearTotals) || data.yearTotals.length !== 12) {
    data.yearTotals = emptyYearTotals();
  } else {
    data.yearTotals = data.yearTotals.map((n) => Number(n) || 0);
  }
  absorbYearTotals(data.yearmonth || ym, data);
  if (!data.updatedAt) data.updatedAt = formatRfc2822();
  try {
    if (isSummaryRecordsComplete(data)) {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    }
  } catch {
    /* ignore */
  }
  return data;
}

export const DONUT_COLORS = [
  '#3d9cf0',
  '#34a853',
  '#f9ab00',
  '#e8710a',
  '#d93025',
  '#a142f4',
  '#12b5cb',
  '#fa7b17',
  '#188038',
  '#c5221f',
  '#9aa0a6',
];

export function colorForTag(tag, index) {
  if (Number.isInteger(index) && DONUT_COLORS[index]) return DONUT_COLORS[index];
  let h = 0;
  const s = String(tag || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return DONUT_COLORS[h % DONUT_COLORS.length];
}

export function compactAmount(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 10000) return `${Math.round(v / 1000)}k`;
  if (abs >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatMoney(n) {
  return (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function catSubcat(row) {
  const tag = String(row?.tag || '').trim();
  const title = String(row?.title || '').trim();
  if (tag && title) return `${tag} / ${title}`;
  return tag || title || '—';
}

export function timestampMs(raw) {
  const s = String(raw || '').trim();
  if (!s) return 0;
  const t = Date.parse(s.replace(' ', 'T'));
  return Number.isNaN(t) ? 0 : t;
}

export function formatTimestamp(raw) {
  const ms = timestampMs(raw);
  if (!ms) return String(raw || '').slice(0, 16);
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseRecordCoords(row) {
  if (!row) return null;
  let lat = Number(row.lat ?? row.latitude);
  let lng = Number(row.lng ?? row.longitude);
  if (!(lat && lng) || Number.isNaN(lat) || Number.isNaN(lng)) {
    const geo = String(row.geolocation || '');
    const m =
      geo.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/) ||
      geo.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (m) {
      lat = Number(m[1]);
      lng = Number(m[2]);
    }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

export function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(s)));
}
