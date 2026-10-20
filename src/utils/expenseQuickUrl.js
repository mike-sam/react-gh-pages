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
 * Missing → Cash.
 * Ambiguous / no match → null (caller leaves for user).
 */
export function resolvePaymentMethod(raw, paymentOptions) {
  const list = Object.values(paymentOptions || {}).filter((o) => o?.card_num);
  const cash =
    list.find((o) => String(o.card_num).toLowerCase() === 'cash')?.card_num || 'Cash';

  if (raw == null || String(raw).trim() === '') return cash;

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
  const amountRaw = (p.get('amount') || '').trim();
  const desc = (p.get('desc') || p.get('remark') || '').trim();
  const currency = (p.get('currency') || 'MYR').trim().toUpperCase() || 'MYR';
  const paymentRaw = p.get('paymentmethod') ?? p.get('payment');
  const paymentProvided = paymentRaw != null && String(paymentRaw).trim() !== '';
  const silent = /^(1|true|yes)$/i.test(String(p.get('silent') || '').trim());
  const ts = parseTimestamp(p.get('timestamp'));
  const latlong = parseLatLong(p.get('latlong'));

  const hasQuickKeys = [
    'cat',
    'subcat',
    'amount',
    'desc',
    'timestamp',
    'paymentmethod',
    'payment',
    'currency',
    'latlong',
    'silent',
    'txt',
    'tag',
    'remark',
  ].some((k) => String(p.get(k) || '').trim() !== '');

  const paymentMethod = resolvePaymentMethod(paymentRaw, paymentOptions);
  const paymentUnresolved = paymentProvided && paymentMethod == null;
  const fieldsReady = Boolean(
    cat && subcat && amountRaw && amountRaw !== '0' && !paymentUnresolved
  );

  return {
    hasQuickKeys,
    cat: cat || null,
    subcat: subcat || null,
    amount: amountRaw || null,
    desc,
    currency,
    paymentMethod: paymentUnresolved ? null : paymentMethod,
    paymentUnresolved,
    timestamp: ts,
    latlong,
    silent,
    /** Only auto-submit when silent=true */
    readyToSubmit: Boolean(silent && fieldsReady),
  };
}

/** Strip search + hash query; keep route path e.g. #/expense */
export function clearExpenseQuickQuery() {
  const path = getHashPath() || '/expense';
  window.history.replaceState(null, '', `${window.location.pathname}#${path}`);
}
