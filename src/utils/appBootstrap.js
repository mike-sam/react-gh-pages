import { API_ENDPOINTS } from '../config';
import { detectPaymentCategory, detectPaymentRegion } from './paymentCategory';
import { applyParkedByCar, DEFAULT_CAR_PLATES, isParkedFetchFresh } from './locationStorage';
import { mergeLandmarkRegionsFromCloud } from './landmarkRegions';
import { writeFxRates } from './fxRates';
import { loadExpenseHistory } from './expenseHistory';
import { applyExpenseTagsOverlay } from './expenseTags';

export const BOOTSTRAP_FETCH_AT_KEY = 'appBootstrapFetchedAt';
export const BOOTSTRAP_ATTEMPT_AT_KEY = 'appBootstrapAttemptAt';
export const BOOTSTRAP_DIRTY_KEY = 'appBootstrapDirty';
export const BOOTSTRAP_TTL_MS = 60 * 60 * 1000;
/** F5 / remount without a write: do not hit GAS again inside this window. */
export const BOOTSTRAP_RETRY_MS = 5 * 60 * 1000;
export const PAYMENT_OPTIONS_CACHE_VER = 'v5';
export const PAYMENT_OPTIONS_TTL_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_PAYMENT_OPTIONS = {
  Cash: { key: 'Cash', card_num: 'Cash', bank: 'Cash', shortname: 'Cash', region: '' },
  eWallet1: { key: 'eWallet', card_num: 'TnG', bank: 'TnG', shortname: 'TnG', region: 'MY' },
  eWallet2: { key: 'eWallet', card_num: 'GrabPay', bank: 'GrabPay', shortname: 'GrabPay', region: 'MY' },
  eWallet3: { key: 'eWallet', card_num: 'Setel', bank: 'Setel', shortname: 'Setel', region: 'MY' },
  eWallet4: { key: 'eWallet', card_num: 'ShopeePay', bank: 'ShopeePay', shortname: 'ShopeePay', region: 'MY' },
};

let inflight = null;
const listeners = new Set();

export function subscribeAppBootstrap(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyBootstrap(result) {
  listeners.forEach((fn) => {
    try {
      fn(result);
    } catch {
      /* ignore */
    }
  });
}

export function isBootstrapFresh(ttlMs = BOOTSTRAP_TTL_MS) {
  const at = Number(localStorage.getItem(BOOTSTRAP_FETCH_AT_KEY) || 0);
  if (!at) return false;
  return Date.now() - at < ttlMs;
}

export function markBootstrapFetched(at = Date.now()) {
  localStorage.setItem(BOOTSTRAP_FETCH_AT_KEY, String(at));
}

export function markBootstrapAttempt(at = Date.now()) {
  localStorage.setItem(BOOTSTRAP_ATTEMPT_AT_KEY, String(at));
}

export function isBootstrapAttemptCooling(retryMs = BOOTSTRAP_RETRY_MS) {
  const at = Number(localStorage.getItem(BOOTSTRAP_ATTEMPT_AT_KEY) || 0);
  if (!at) return false;
  return Date.now() - at < retryMs;
}

/** After a real write, next page load may refetch once (bypass F5 cooldown). */
export function markBootstrapDirty() {
  localStorage.setItem(BOOTSTRAP_DIRTY_KEY, '1');
}

export function isBootstrapDirty() {
  return localStorage.getItem(BOOTSTRAP_DIRTY_KEY) === '1';
}

function consumeBootstrapDirty() {
  if (!isBootstrapDirty()) return false;
  localStorage.removeItem(BOOTSTRAP_DIRTY_KEY);
  return true;
}

function upsertPaymentOption(acc, id, value) {
  if (!value?.card_num) return;
  const draft = {
    key: value.key,
    card_num: value.card_num,
    bank: value.bank || '',
    shortname: value.shortname || value.bank || '',
  };
  const catKey = detectPaymentCategory(draft, id) || 'Card';
  const short =
    value.shortname ||
    value.bank ||
    (value.key && !['Cash', 'eWallet', 'Card'].includes(value.key) ? value.key : '');
  const next = {
    key: catKey,
    card_num: String(value.card_num).trim(),
    bank: value.bank || short,
    shortname: short,
    region: detectPaymentRegion({ ...draft, shortname: short }),
  };
  const existingId = Object.keys(acc).find((k) => String(acc[k].card_num) === next.card_num);
  acc[existingId || id] = existingId ? { ...acc[existingId], ...next } : next;
}

function mergeLocalCardFallbacks(acc) {
  const hasCard = Object.entries(acc).some(([id, o]) => detectPaymentCategory(o, id) === 'Card');
  if (!hasCard) {
    try {
      const prev = unwrapPaymentMap(JSON.parse(localStorage.getItem('paymentOptions') || '{}')) || {};
      Object.entries(prev).forEach(([id, o]) => {
        if (detectPaymentCategory(o, id) === 'Card') upsertPaymentOption(acc, id, o);
      });
    } catch {
      /* ignore */
    }
  }
  try {
    loadExpenseHistory().forEach((entry, i) => {
      const num = String(entry.payment_method || entry.payment || '').trim();
      if (!num || !/\d{4}/.test(num.replace(/\s/g, ''))) return;
      const draft = { key: 'Card', card_num: num };
      if (detectPaymentCategory(draft) !== 'Card') return;
      upsertPaymentOption(acc, `HistCard_${i}_${num}`, draft);
    });
  } catch {
    /* ignore */
  }
}

function unwrapPaymentMap(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (parsed.data && typeof parsed.data === 'object' && !parsed.data.card_num) {
    return parsed.data;
  }
  return parsed;
}

export function transformPaymentOptions(raw, defaults = DEFAULT_PAYMENT_OPTIONS) {
  const acc = {};
  const unwrapped = unwrapPaymentMap(raw);
  const source = unwrapped && Object.keys(unwrapped).length ? unwrapped : defaults;
  Object.entries(source).forEach(([id, value]) => upsertPaymentOption(acc, id, value));
  Object.entries(defaults).forEach(([id, value]) => upsertPaymentOption(acc, id, value));
  mergeLocalCardFallbacks(acc);
  return acc;
}

export function readPaymentOptionsCache({ allowStale = false } = {}) {
  try {
    const cached = localStorage.getItem('paymentOptions');
    const cacheTimestamp = localStorage.getItem('paymentOptionsTimestamp');
    const cacheVer = localStorage.getItem('paymentOptionsVer');
    if (!cached) return null;
    if (!allowStale && cacheVer !== PAYMENT_OPTIONS_CACHE_VER) return null;
    if (
      !allowStale &&
      (!cacheTimestamp || Date.now() - parseInt(cacheTimestamp, 10) >= PAYMENT_OPTIONS_TTL_MS)
    ) {
      return null;
    }
    return unwrapPaymentMap(JSON.parse(cached));
  } catch {
    return null;
  }
}

export function writePaymentOptionsCache(transformed, at = Date.now()) {
  localStorage.setItem('paymentOptions', JSON.stringify(transformed));
  localStorage.setItem('paymentOptionsTimestamp', String(at));
  localStorage.setItem('paymentOptionsVer', PAYMENT_OPTIONS_CACHE_VER);
  try {
    window.dispatchEvent(new Event('paymentOptionsUpdated'));
  } catch {
    /* ignore */
  }
  return transformed;
}

function paymentMapHasCards(map) {
  return Object.entries(map || {}).some(([id, o]) => detectPaymentCategory(o, id) === 'Card');
}

function parsePaymentOptionsPayload(data) {
  if (!data || typeof data !== 'object') return null;
  const src =
    data.paymentOptions && typeof data.paymentOptions === 'object' && !data.paymentOptions.card_num
      ? data.paymentOptions
      : data;
  const raw = {};
  Object.entries(src).forEach(([id, value]) => {
    if (!value || typeof value !== 'object' || !value.card_num) return;
    if (id === 'success' || id === 'error' || id === 'ok') return;
    raw[id] = {
      key: value.key || (String(value.card_num) === 'Cash' ? 'Cash' : 'Card'),
      card_num: value.card_num,
      bank: value.bank || '',
      shortname: value.shortname || value.bank || id,
    };
  });
  return Object.keys(raw).length ? raw : null;
}

let paymentsInflight = null;

/** Cards live on a dedicated web app; bootstrap GAS only has cash/wallets. */
export async function ensurePaymentOptions({ force = false } = {}) {
  const cached = readPaymentOptionsCache({ allowStale: true }) || {};
  if (paymentMapHasCards(cached) && !force) return cached;
  if (paymentsInflight) return paymentsInflight;
  paymentsInflight = (async () => {
    try {
      const url = API_ENDPOINTS.PAYMENT_OPTIONS;
      const res = await fetch(url);
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      const raw = parsePaymentOptionsPayload(data);
      if (!raw) return cached;
      const merged = transformPaymentOptions({ ...cached, ...raw });
      writePaymentOptionsCache(merged);
      notifyBootstrap('payments');
      return merged;
    } catch (err) {
      console.warn('payment options fetch failed', err);
      return cached;
    } finally {
      paymentsInflight = null;
    }
  })();
  return paymentsInflight;
}

function applyBootstrapPayload(data) {
  if (!data || data.success !== true) return false;
  let applied = false;
  if (data.paymentOptions && typeof data.paymentOptions === 'object') {
    const prev = readPaymentOptionsCache({ allowStale: true }) || {};
    const incoming = transformPaymentOptions(data.paymentOptions);
    writePaymentOptionsCache(
      paymentMapHasCards(incoming) ? incoming : transformPaymentOptions({ ...prev, ...incoming })
    );
    applied = true;
  }
  const byCar = data.parked?.byCar;
  if (byCar && typeof byCar === 'object') {
    applyParkedByCar(byCar);
    applied = true;
  }
  const regions = Array.isArray(data.landmarks)
    ? data.landmarks
    : data.landmarks?.regions;
  if (Array.isArray(regions)) {
    mergeLandmarkRegionsFromCloud(regions);
    applied = true;
  }
  if (data.fx && data.fx.rates && typeof data.fx.rates === 'object') {
    writeFxRates(data.fx);
    applied = true;
  }
  if (data.expenseTags && typeof data.expenseTags === 'object') {
    applyExpenseTagsOverlay(data.expenseTags);
    applied = true;
  }
  if (applied) markBootstrapFetched(Number(data.fetchedAt) || Date.now());
  return applied;
}

function paymentCacheNeedsUpgrade() {
  try {
    const cached = localStorage.getItem('paymentOptions');
    const cacheVer = localStorage.getItem('paymentOptionsVer');
    if (!cached) return false;
    return cacheVer !== PAYMENT_OPTIONS_CACHE_VER;
  } catch {
    return false;
  }
}

function needsBootstrap({ force = false } = {}) {
  if (force) return true;
  if (isBootstrapDirty()) return true;
  if (paymentCacheNeedsUpgrade()) return true;
  const paymentsFresh = Boolean(readPaymentOptionsCache());
  if (!paymentsFresh) {
    if (isBootstrapAttemptCooling()) return false;
    return true;
  }
  if (isBootstrapFresh()) return false;
  if (isBootstrapAttemptCooling()) return false;
  const parkedFresh = DEFAULT_CAR_PLATES.every((p) => isParkedFetchFresh(p));
  return !parkedFresh;
}

/**
 * Single-flight small-data load. Safe to call from any page; joins an in-flight request.
 * Falls back silently if GAS has not been redeployed with getBootstrap yet.
 * Manual F5 without a write is cooled down so Apps Script quota is not burned.
 */
export function ensureAppBootstrap({ force = false } = {}) {
  if (!force && !needsBootstrap({ force })) {
    if (isBootstrapAttemptCooling() && !isBootstrapFresh()) {
      return Promise.resolve('cooldown');
    }
    return Promise.resolve('cached');
  }
  if (inflight) return inflight;
  consumeBootstrapDirty();
  markBootstrapAttempt();
  inflight = (async () => {
    try {
      const url = `${API_ENDPOINTS.GSHEET_SUBMIT}?action=getBootstrap`;
      const res = await fetch(url);
      if (!res.ok) {
        await ensurePaymentOptions({ force: true });
        notifyBootstrap('http');
        return 'http';
      }
      const data = await res.json();
      if (!applyBootstrapPayload(data)) {
        notifyBootstrap('unsupported');
        await ensurePaymentOptions({ force: true });
        return 'unsupported';
      }
      await ensurePaymentOptions();
      notifyBootstrap('ok');
      return 'ok';
    } catch (err) {
      console.warn('app bootstrap failed', err);
      await ensurePaymentOptions({ force: true });
      notifyBootstrap('error');
      return 'error';
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
