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

function decodeHtmlEntities(s) {
  return String(s || '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function parseGasResponseText(text) {
  const raw = String(text || '').trim();
  if (!raw) return { data: null, error: '空回應' };
  if (raw[0] === '{' || raw[0] === '[') {
    try {
      return { data: JSON.parse(raw) };
    } catch {
      return { data: null, error: 'JSON 解析失敗' };
    }
  }
  const syn = raw.match(/SyntaxError:\s*([^<\n]+)/i);
  if (syn) {
    const detail = decodeHtmlEntities(syn[1]).trim();
    if (/already been declared/i.test(detail)) {
      return { data: null, error: `GAS 腳本壞了：${detail}。請整份覆蓋現有 .gs（不要另開檔）再部署` };
    }
    return { data: null, error: `GAS：${detail}` };
  }
  if (/<html/i.test(raw)) {
    return { data: null, error: 'GAS 回了錯誤頁。請整份覆蓋 code.gs 後部署新版本' };
  }
  return { data: null, error: '無法讀取驗證結果' };
}

export async function verifyAccessHash(hash) {
  const submitted = String(hash || '').trim();
  if (!submitted) return { ok: false, error: '請輸入驗證碼' };
  const url = new URL(API_ENDPOINTS.GSHEET_SUBMIT || API_ENDPOINTS.KEY_VALUE);
  url.searchParams.set('action', 'verifyAccess');
  url.searchParams.set('hash', submitted);
  let res;
  try {
    res = await fetch(url.toString(), { credentials: 'omit', cache: 'no-cache', redirect: 'follow' });
  } catch (e) {
    const msg = e && e.message ? String(e.message) : String(e);
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return { ok: false, error: '驗證服務連不上。GAS 多半掛了：請整份覆蓋 code.gs 後部署（Anyone）' };
    }
    return { ok: false, error: msg };
  }
  const text = await res.text();
  const parsed = parseGasResponseText(text);
  const data = parsed.data;
  if (data && data.ok) {
    writeAccessSession(ACCESS_TTL_MS, submitted);
    return { ok: true };
  }
  if (data && data.success === true && data.ok === false) {
    return { ok: false, error: '驗證失敗' };
  }
  if (parsed.error) return { ok: false, error: parsed.error };
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
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

function gasDeploymentId(url) {
  const m = String(url || '').match(/\/macros\/s\/([^/?#]+)/i);
  return m ? m[1] : '';
}

function isMainGasUrl(url) {
  const main = gasDeploymentId(API_ENDPOINTS.GSHEET_SUBMIT || API_ENDPOINTS.CALENDAR_TRACK);
  return Boolean(main && gasDeploymentId(url) === main);
}

function isOpenAccessActionUrl(url) {
  try {
    const u = new URL(String(url || ''), typeof window !== 'undefined' ? window.location.href : undefined);
    const action = String(u.searchParams.get('action') || '');
    return /^(verifyAccess|trackCalendar|calendarPing|check_current)$/.test(action);
  } catch {
    return /[?&]action=(verifyAccess|trackCalendar|calendarPing|check_current)\b/.test(String(url || ''));
  }
}

function inspectAccessResponse(res, url) {
  if (!res || res.type === 'opaque' || res.status === 0) return;
  if (!isMainGasUrl(url) || isVerifyAccessUrl(url) || isOpenAccessActionUrl(url)) return;
  res
    .clone()
    .text()
    .then((text) => {
      const parsed = parseGasResponseText(text);
      const data = parsed.data;
      if (!data) return;
      if (data.access === false && data.error === 'Forbidden') {
        noteAccessForbidden();
        return;
      }
      if (data.success === false) return;
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
