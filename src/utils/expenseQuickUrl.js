import { detectPaymentCategory } from './paymentCategory';
import { getHashPath } from './routing';

/**
 * Merge query from ?search and #/expense?... (hash wins on conflict).
 */
export function getMergedQueryParams() {
  const merged = new URLSearchParams(window.location.search || '');
  const hash = window.location.hash || '';
  const q = hash.indexOf('?');
  if (q >= 0) {
    new URLSearchParams(hash.slice(q + 1)).forEach((v, k) => {
      merged.set(k, v);
    });
  }
  return merged;
}

/**
 * Optional start/end range for URL quick entry.
 * start only → end = timestamp if later, else now.
 * end only → start = timestamp if earlier; no timestamp → not a range.
 */
export function resolveExpenseEventRange({ start, end, timestamp, now = new Date() } = {}) {
  const s = start instanceof Date && !Number.isNaN(start.getTime()) ? start : null;
  const e = end instanceof Date && !Number.isNaN(end.getTime()) ? end : null;
  const ts =
    timestamp instanceof Date && !Number.isNaN(timestamp.getTime()) ? timestamp : null;
  if (s && e && e.getTime() > s.getTime()) return { start: s, end: e };
  if (s && !e) {
    const endAt = ts && ts.getTime() > s.getTime() ? ts : now;
    if (endAt.getTime() > s.getTime()) return { start: s, end: endAt };
    return { start: s, end: new Date(s.getTime() + 60 * 1000) };
  }
  if (e && !s && ts && ts.getTime() < e.getTime()) return { start: ts, end: e };
  return { start: null, end: null };
}

export function parseTimestamp(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  if (/^\d{10,13}$/.test(s)) {
    const n = Number(s);
    const ms = s.length <= 10 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** latlong=3.14,101.68 or 3.14,101.68,Label */
export function parseLatLong(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const parts = String(raw)
    .trim()
    .split(',')
    .map((p) => p.trim());
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  const label = parts.slice(2).join(',').trim();
  return { lat, lng, label, updatedAt: Date.now() };
}

/**
 * cash / eWallet: exact match on card_num / shortname / bank.
 * Card: 4-digit → last4 match.
 * Missing → null（頁面顯示「請選擇」，不預設 Cash）。
 * Ambiguous / no match → null (caller leaves for user).
 */
export function resolvePaymentMethod(raw, paymentOptions) {
  const list = Object.values(paymentOptions || {}).filter((o) => o?.card_num);
  const cash =
    list.find((o) => String(o.card_num).toLowerCase() === 'cash')?.card_num || 'Cash';

  if (raw == null || String(raw).trim() === '') return null;

  const q = String(raw).trim();
  const lower = q.toLowerCase();

  if (lower === 'cash') return cash;

  const exact = list.find((o) => {
    const candidates = [o.card_num, o.shortname, o.bank]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase());
    return candidates.includes(lower);
  });
  if (exact) return exact.card_num;

  const digits = q.replace(/\D/g, '');
  if (digits.length === 4) {
    const cards = list.filter(
      (o) =>
        detectPaymentCategory(o) === 'Card' &&
        String(o.card_num).replace(/\D/g, '').endsWith(digits)
    );
    if (cards.length === 1) return cards[0].card_num;
    if (cards.length > 1) {
      const my = cards.find((o) => o.region === 'MY');
      return (my || cards[0]).card_num;
    }
  }

  return null;
}

/**
 * Quick-entry draft from URL.
 * Auto-submit only when silent=true AND cat+subcat+amount present (payment resolved).
 */
export function parseExpenseQuickDraft(paymentOptions) {
  const p = getMergedQueryParams();

  const cat = (p.get('cat') || '').trim();
  const subcat = (p.get('subcat') || p.get('txt') || p.get('tag') || '').trim();
  const carPlate = (p.get('carPlate') || p.get('plate') || '').trim().toUpperCase();
  const amountRaw = (p.get('amount') || '').trim();
  const desc = (p.get('desc') || p.get('remark') || '').trim();
  const currency = (p.get('currency') || 'MYR').trim().toUpperCase() || 'MYR';
  const paymentRaw = p.get('paymentmethod') ?? p.get('payment');
  const paymentProvided = paymentRaw != null && String(paymentRaw).trim() !== '';
  const silent = /^(1|true|yes)$/i.test(String(p.get('silent') || '').trim());
  const ts = parseTimestamp(p.get('timestamp'));
  const startRaw = parseTimestamp(p.get('start') || p.get('event_start'));
  const endRaw = parseTimestamp(p.get('end') || p.get('event_end'));
  const range = resolveExpenseEventRange({ start: startRaw, end: endRaw, timestamp: ts });
  const latlong = parseLatLong(p.get('latlong'));

  const hasQuickKeys = [
    'cat',
    'subcat',
    'amount',
    'desc',
    'timestamp',
    'start',
    'end',
    'event_start',
    'event_end',
    'paymentmethod',
    'payment',
    'currency',
    'latlong',
    'silent',
    'txt',
    'tag',
    'remark',
    'carPlate',
    'plate',
  ].some((k) => String(p.get(k) || '').trim() !== '');

  const paymentMethod = resolvePaymentMethod(paymentRaw, paymentOptions);
  const paymentUnresolved = paymentProvided && paymentMethod == null;
  const fieldsReady = Boolean(
    cat &&
      subcat &&
      amountRaw &&
      amountRaw !== '0' &&
      paymentMethod &&
      !paymentUnresolved
  );

  return {
    hasQuickKeys,
    cat: cat || null,
    subcat: subcat || null,
    carPlate: carPlate || null,
    amount: amountRaw || null,
    desc,
    currency,
    paymentMethod: paymentUnresolved ? null : paymentMethod,
    paymentUnresolved,
    timestamp: ts,
    eventStart: range.start,
    eventEnd: range.end,
    latlong,
    silent,
    /** Only auto-submit when silent=true */
    readyToSubmit: Boolean(silent && fieldsReady),
  };
}

export const EXPENSE_URL_PARAMS = [
  { name: 'cat', required: 'required', example: '餐饮美食', note: '主分類' },
  { name: 'subcat', required: 'required', example: '午餐', note: '子分類。別名 txt / tag' },
  { name: 'amount', required: 'required', example: '28.50', note: '金額' },
  { name: 'paymentmethod', required: '建議', example: 'Cash', note: '別名 payment。不帶則請選擇，不預設 Cash' },
  { name: 'desc', required: 'optional', example: '公司樓下', note: '備註。別名 remark' },
  { name: 'currency', required: 'optional', example: 'MYR', note: '預設 MYR' },
  {
    name: 'timestamp',
    required: 'optional',
    example: '2026-10-22 21:00:00',
    note: '記帳時間。沒有 start/end 時只當單一時段',
  },
  {
    name: 'start',
    required: 'optional',
    example: '2026-10-24 12:30:00',
    note: '開始。別名 event_start。沒帶 end → 結束用 timestamp，再沒有用現在',
  },
  {
    name: 'end',
    required: 'optional',
    example: '2026-10-24 14:00:00',
    note: '結束。別名 event_end。沒帶 start → 開始用 timestamp',
  },
  { name: 'latlong', required: 'optional', example: '3.14,101.68', note: '座標，可加 ,Label' },
  { name: 'carPlate', required: 'optional', example: 'PPQ8777', note: '車牌。別名 plate' },
  { name: 'silent', required: 'optional', example: 'true', note: '必填齊全才自動送出' },
];

/** Strip search + hash query; keep route path e.g. #/expense */
export function clearExpenseQuickQuery() {
  const path = getHashPath() || '/expense';
  window.history.replaceState(null, '', `${window.location.pathname}#${path}`);
}
