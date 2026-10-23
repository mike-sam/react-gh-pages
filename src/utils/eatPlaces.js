import { API_ENDPOINTS } from '../config';

const KEY = 'eatPlaces.v2';
const TTL_MS = 24 * 60 * 60 * 1000;

export function readEatPlacesCache() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.success !== true || !Array.isArray(parsed.places)) return null;
    const at = Number(parsed.fetchedAt) || 0;
    if (!at || Date.now() - at > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function invalidateEatPlacesCache() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export async function ensureEatPlaces({ force = false } = {}) {
  if (!force) {
    const cached = readEatPlacesCache();
    if (cached) return cached;
  }
  const url = new URL(API_ENDPOINTS.GSHEET_SUBMIT);
  url.searchParams.set('action', 'getEatPlaces');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data || data.success !== true) throw new Error(data?.error || '讀取吃過的地點失敗');
  const payload = {
    ...data,
    places: Array.isArray(data.places) ? data.places : [],
    fetchedAt: Date.now(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  return payload;
}

export function monthsAgoMs(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - Number(months || 0));
  return d.getTime();
}

export function parseEatWhen(raw) {
  const s = String(raw || '').trim();
  if (!s) return 0;
  const t = Date.parse(s.replace(' ', 'T'));
  return Number.isNaN(t) ? 0 : t;
}
