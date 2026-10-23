import { API_ENDPOINTS } from '../config';
import { detectPaymentCategory, detectPaymentRegion } from './paymentCategory';
import { applyParkedByCar, DEFAULT_CAR_PLATES, isParkedFetchFresh } from './locationStorage';
import { isLandmarkFetchFresh, mergeLandmarkRegionsFromCloud } from './landmarkRegions';
import { writeFxRates } from './fxRates';
import { loadExpenseHistory } from './expenseHistory';

export const BOOTSTRAP_FETCH_AT_KEY = 'appBootstrapFetchedAt';
export const BOOTSTRAP_ATTEMPT_AT_KEY = 'appBootstrapAttemptAt';
export const BOOTSTRAP_DIRTY_KEY = 'appBootstrapDirty';
export const BOOTSTRAP_TTL_MS = 60 * 60 * 1000;
/** F5 / remount without a write: do not hit GAS again inside this window. */
export const BOOTSTRAP_RETRY_MS = 5 * 60 * 1000;
export const PAYMENT_OPTIONS_CACHE_VER = 'v4';
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
      const prev = JSON.parse(localStorage.getItem('paymentOptions') || '{}');
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

export function transformPaymentOptions(raw, defaults = DEFAULT_PAYMENT_OPTIONS) {
  const acc = {};
  const source = raw && typeof raw === 'object' && Object.keys(raw).length ? raw : defaults;
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
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

export function writePaymentOptionsCache(transformed, at = Date.now()) {
  localStorage.setItem('paymentOptions', JSON.stringify(transformed));
  localStorage.setItem('paymentOptionsTimestamp', String(at));
  localStorage.setItem('paymentOptionsVer', PAYMENT_OPTIONS_CACHE_VER);
  return transformed;
}

function applyBootstrapPayload(data) {
  if (!data || data.success !== true) return false;
  let applied = false;
  if (data.paymentOptions && typeof data.paymentOptions === 'object') {
    writePaymentOptionsCache(transformPaymentOptions(data.paymentOptions));
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
  const landmarksFresh = isLandmarkFetchFresh();
  return !(parkedFresh && landmarksFresh);
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
        notifyBootstrap('http');
        return 'http';
      }
      const data = await res.json();
      if (!applyBootstrapPayload(data)) {
        notifyBootstrap('unsupported');
        return 'unsupported';
      }
      notifyBootstrap('ok');
      return 'ok';
    } catch (err) {
      console.warn('app bootstrap failed', err);
      notifyBootstrap('error');
      return 'error';
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
