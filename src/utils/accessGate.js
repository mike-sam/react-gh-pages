import { API_ENDPOINTS } from '../config';
import { getMergedQueryParams } from './expenseQuickUrl';
import { clearUnconfirmed, restoreUnconfirmedToQueue } from './offlineQueue';

export const ACCESS_STORAGE_KEY = 'appAccessGate';
export const ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function readAccessSession() {
  try {
    const raw = localStorage.getItem(ACCESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.exp || !parsed.h) return null;
    if (Date.now() > Number(parsed.exp)) {
      localStorage.removeItem(ACCESS_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const ACCESS_REVOKED_EVENT = 'app-access-revoked';

export function writeAccessSession(ttlMs = ACCESS_TTL_MS, hash) {
  let prev = null;
  try {
    prev = JSON.parse(localStorage.getItem(ACCESS_STORAGE_KEY) || 'null');
  } catch {
    prev = null;
  }
  const h =
    hash != null && String(hash).trim() !== ''
      ? String(hash).trim()
      : prev && prev.h
        ? String(prev.h)
        : '';
  const rec = { v: 1, exp: Date.now() + ttlMs, h };
  try {
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(rec));
  } catch {
    /* ignore */
  }
  return rec;
}

export function clearAccessSession() {
  try {
    localStorage.removeItem(ACCESS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function touchAccessSession() {
  if (!readAccessSession()) return false;
  writeAccessSession();
  return true;
}

export function isAccessUnlocked() {
  return Boolean(readAccessSession());
}

export function takeAccessFromUrl() {
  const q = getMergedQueryParams();
  return String(q.get('access') || q.get('k') || '').trim();
}

export function stripAccessFromUrl() {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash || '';
  const qIndex = hash.indexOf('?');
  let nextHash = hash;
  if (qIndex >= 0) {
    const path = hash.slice(0, qIndex);
    const params = new URLSearchParams(hash.slice(qIndex + 1));
    params.delete('access');
    params.delete('k');
    const qs = params.toString();
    nextHash = qs ? `${path}?${qs}` : path;
  }
  const search = new URLSearchParams(window.location.search || '');
  search.delete('access');
  search.delete('k');
  const nextSearch = search.toString();
  const next = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash}`;
  const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== cur) window.history.replaceState(window.history.state, '', next);
}

export async function verifyAccessHash(hash) {
  const submitted = String(hash || '').trim();
  if (!submitted) return { ok: false, error: '請輸入驗證碼' };
  const url = new URL(API_ENDPOINTS.GSHEET_SUBMIT || API_ENDPOINTS.KEY_VALUE);
  url.searchParams.set('action', 'verifyAccess');
  url.searchParams.set('hash', submitted);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data && data.ok) {
    writeAccessSession(ACCESS_TTL_MS, submitted);
    return { ok: true };
  }
  return { ok: false, error: '驗證失敗' };
}

export function getStoredAccessHash() {
  const rec = readAccessSession();
  return rec && rec.h ? String(rec.h) : '';
}

export function noteAccessForbidden() {
  restoreUnconfirmedToQueue();
  clearAccessSession();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ACCESS_REVOKED_EVENT));
  }
}

function isGasUrl(url) {
  return /script\.google\.(com|usercontent\.com)/i.test(String(url || ''));
}

function appendAccessToUrl(url) {
  const token = getStoredAccessHash();
  if (!token || !url) return url;
  try {
    const u = new URL(String(url), typeof window !== 'undefined' ? window.location.href : undefined);
    if (u.searchParams.get('action') === 'verifyAccess') return url;
    if (!u.searchParams.get('access') && !u.searchParams.get('k')) {
      u.searchParams.set('access', token);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function attachAccessToBody(body) {
  const token = getStoredAccessHash();
  if (!token || body == null || typeof body !== 'string') return body;
  try {
    const obj = JSON.parse(body);
    if (obj && typeof obj === 'object' && obj.action !== 'verifyAccess' && obj.access == null) {
      obj.access = token;
      return JSON.stringify(obj);
    }
  } catch {
    /* not json */
  }
  return body;
}

function isVerifyAccessUrl(url) {
  try {
    const u = new URL(String(url || ''), typeof window !== 'undefined' ? window.location.href : undefined);
    return u.searchParams.get('action') === 'verifyAccess';
  } catch {
    return /[?&]action=verifyAccess\b/.test(String(url || ''));
  }
}

function inspectAccessResponse(res, url) {
  if (!res || res.type === 'opaque' || res.status === 0) return;
  res
    .clone()
    .json()
    .then((data) => {
      if (data && data.access === false) {
        noteAccessForbidden();
        return;
      }
      if (isVerifyAccessUrl(url)) return;
      if (data && data.success === false) return;
      clearUnconfirmed();
    })
    .catch(() => {});
}

/** Piggyback the sheet hash on existing GAS fetches. No extra verify call. */
export function installAccessFetchHook() {
  if (typeof window === 'undefined' || window.__accessFetchHooked) return;
  window.__accessFetchHooked = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input && input.url;
    if (!isGasUrl(url)) return orig(input, init);
    let nextInput = input;
    if (typeof input === 'string') nextInput = appendAccessToUrl(input);
    else if (input && input.url) nextInput = new Request(appendAccessToUrl(input.url), input);
    const nextInit = { ...init };
    if (nextInit.body) nextInit.body = attachAccessToBody(nextInit.body);
    const hookedUrl = typeof nextInput === 'string' ? nextInput : nextInput && nextInput.url;
    return orig(nextInput, nextInit).then((res) => {
      inspectAccessResponse(res, hookedUrl);
      return res;
    });
  };
}
