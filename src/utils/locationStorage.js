export const SMART_LOCATION_KEY = 'smartLocation';
export const LAST_PARKED_KEY = 'lastParkedLocation';
export const PARKED_BY_CAR_KEY = 'parkedLocationsByCar';
export const SELECTED_CAR_KEY = 'selectedCarPlate';
/** Last successful cloud fetch time per plate (epoch ms) */
export const PARKED_FETCH_AT_KEY = 'parkedFetchAtByCar';
/** Skip auto cloud re-fetch within this window unless user forces */
export const PARKED_FETCH_TTL_MS = 60 * 60 * 1000;

/** Default plates — keep in sync with expense Remark form */
export const DEFAULT_CAR_PLATES = ['PPQ8777', 'WD6060E'];

/**
 * @typedef {{ lat: number, lng: number, accuracy?: number|null, updatedAt: number, label?: string, carPlate?: string }} SmartLocation
 */

/** @returns {SmartLocation|null} */
export function loadSmartLocation() {
  try {
    const raw = localStorage.getItem(SMART_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat !== 'number' || typeof parsed?.lng !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @param {SmartLocation} loc */
export function saveSmartLocation(loc) {
  localStorage.setItem(SMART_LOCATION_KEY, JSON.stringify(loc));
}

/** @returns {SmartLocation|null} */
export function loadLastParked() {
  try {
    const raw = localStorage.getItem(LAST_PARKED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat !== 'number' || typeof parsed?.lng !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @param {SmartLocation} loc */
export function saveLastParked(loc) {
  localStorage.setItem(LAST_PARKED_KEY, JSON.stringify(loc));
}

/** @returns {Record<string, SmartLocation>} */
export function loadParkedByCar() {
  try {
    const raw = localStorage.getItem(PARKED_BY_CAR_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** @param {string} plate @param {SmartLocation} loc */
export function saveParkedForCar(plate, loc) {
  if (!plate) return;
  const key = plate.trim().toUpperCase();
  const all = loadParkedByCar();
  all[key] = { ...loc, carPlate: key };
  localStorage.setItem(PARKED_BY_CAR_KEY, JSON.stringify(all));
  saveLastParked(all[key]);
}

/** @param {string} plate @returns {SmartLocation|null} */
export function loadParkedForCar(plate) {
  if (!plate) return loadLastParked();
  const key = plate.trim().toUpperCase();
  const all = loadParkedByCar();
  return all[key] || null;
}

export function loadSelectedCarPlate() {
  try {
    return localStorage.getItem(SELECTED_CAR_KEY) || DEFAULT_CAR_PLATES[0];
  } catch {
    return DEFAULT_CAR_PLATES[0];
  }
}

export function saveSelectedCarPlate(plate) {
  localStorage.setItem(SELECTED_CAR_KEY, plate || '');
}

/** @returns {Record<string, number>} */
export function loadParkedFetchAtMap() {
  try {
    const raw = localStorage.getItem(PARKED_FETCH_AT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** @param {string} plate @returns {number} epoch ms or 0 */
export function loadParkedFetchAt(plate) {
  if (!plate) return 0;
  const key = plate.trim().toUpperCase();
  const at = loadParkedFetchAtMap()[key];
  return typeof at === 'number' && isFinite(at) ? at : 0;
}

/** @param {string} plate @param {number} [at] */
export function markParkedFetched(plate, at = Date.now()) {
  if (!plate) return;
  const key = plate.trim().toUpperCase();
  const all = loadParkedFetchAtMap();
  all[key] = at;
  localStorage.setItem(PARKED_FETCH_AT_KEY, JSON.stringify(all));
}

/** Mark several plates as freshly fetched (e.g. after bulk getParkedLocations). */
export function markParkedFetchedMany(plates, at = Date.now()) {
  if (!Array.isArray(plates) || plates.length === 0) return;
  const all = loadParkedFetchAtMap();
  plates.forEach((p) => {
    const key = String(p || '').trim().toUpperCase();
    if (key) all[key] = at;
  });
  localStorage.setItem(PARKED_FETCH_AT_KEY, JSON.stringify(all));
}

/**
 * @param {string} plate
 * @param {number} [ttlMs]
 * @returns {boolean}
 */
export function isParkedFetchFresh(plate, ttlMs = PARKED_FETCH_TTL_MS) {
  const at = loadParkedFetchAt(plate);
  if (!at) return false;
  return Date.now() - at < ttlMs;
}

export function toMapsUrl(lat, lng, name = '') {
  const base = `https://maps.google.com/maps?q=${lat},${lng}`;
  if (!name) return base;
  return `${base}&name=${encodeURIComponent(name)}`;
}

export function parseLatLngFromMapsUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (!match) return null;
  return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
}

export function formatRelativeTime(updatedAt) {
  if (!updatedAt) return '尚未取得';
  const diffMs = Date.now() - updatedAt;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 30) return '剛剛取得';
  if (sec < 60) return `${sec} 秒前取得`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分鐘前取得`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前取得`;
  const day = Math.floor(hr / 24);
  return `${day} 天前取得`;
}

/** Compact relative label for header: 剛剛 / 1m / 1h / 2d */
export function formatRelativeTimeShort(updatedAt) {
  if (!updatedAt) return '—';
  const diffMs = Math.max(0, Date.now() - updatedAt);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return '剛剛';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export function formatFullTimestamp(updatedAt) {
  if (!updatedAt) return '';
  try {
    const date = new Date(updatedAt);
    if (isNaN(date.getTime())) return String(updatedAt);
    // e.g. 2026-Oct-20 22:58:03
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const y = date.getFullYear();
    const mon = months[date.getMonth()];
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${mon}-${d} ${h}:${mi}:${s}`;
  } catch {
    return String(updatedAt);
  }
}

export function formatLocationLabel(loc) {
  if (!loc) return '尚無定位快取';
  if (loc.label) return `${loc.label}附近`;
  return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
}
