import { API_ENDPOINTS } from '../config';

const CACHE_PREFIX = 'expenseSummary.v3:';

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
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          parsed.success === true &&
          parsed.yearmonth === ym &&
          Number(parsed.count) > 0
        ) {
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
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
  if (!Array.isArray(data.recent)) data.recent = [];
  if (!data.updatedAt) data.updatedAt = formatRfc2822();
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
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
