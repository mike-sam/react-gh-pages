import { API_ENDPOINTS } from '../config';

export const LANDMARK_REGIONS_KEY = 'landmarkRegions';
export const LANDMARK_FETCH_AT_KEY = 'landmarkRegionsFetchedAt';
export const LANDMARK_FETCH_TTL_MS = 60 * 60 * 1000;

/** Default hit radius for legacy single-point Location rows (metres) */
export const DEFAULT_POINT_NEARBY_M = 100;
export const DEFAULT_REGION_RADIUS_M = 150;

/**
 * @typedef {{ lat: number, lng: number }} LatLng
 * @typedef {{
 *   id: string,
 *   name: string,
 *   center: LatLng,
 *   radiusM: number,
 *   vertices?: LatLng[],
 *   updatedAt: number,
 *   source?: 'local'|'cloud'|'legacy'
 * }} LandmarkRegion
 * @typedef {LandmarkRegion & { distanceM: number }} LandmarkMatch
 */

/** Haversine distance in metres */
export function distanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h =
    s1 * s1 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normalizeRegion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.center?.lat ?? raw.lat ?? raw.latitude);
  const lng = Number(raw.center?.lng ?? raw.lng ?? raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  const radiusM = Math.max(
    10,
    Number(raw.radiusM ?? raw.radius_m ?? DEFAULT_REGION_RADIUS_M) || DEFAULT_REGION_RADIUS_M
  );
  const id =
    String(raw.id || '').trim() ||
    `lr_${lat.toFixed(5)}_${lng.toFixed(5)}_${name}`.replace(/\s+/g, '_');
  let vertices = [];
  if (Array.isArray(raw.vertices)) {
    vertices = raw.vertices
      .map((v) => ({ lat: Number(v.lat), lng: Number(v.lng) }))
      .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng));
  } else if (typeof raw.verticesJson === 'string' && raw.verticesJson.trim()) {
    try {
      const parsed = JSON.parse(raw.verticesJson);
      if (Array.isArray(parsed)) {
        vertices = parsed
          .map((v) => ({ lat: Number(v.lat), lng: Number(v.lng) }))
          .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng));
      }
    } catch {
      /* ignore */
    }
  }
  return {
    id,
    name,
    center: { lat, lng },
    radiusM,
    vertices,
    updatedAt: Number(raw.updatedAt) || Date.now(),
    source: raw.source || 'local',
  };
}

/** @returns {LandmarkRegion[]} */
export function loadLandmarkRegions() {
  try {
    const raw = localStorage.getItem(LANDMARK_REGIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRegion).filter(Boolean);
  } catch {
    return [];
  }
}

/** @param {LandmarkRegion[]} list */
export function saveLandmarkRegions(list) {
  const cleaned = (Array.isArray(list) ? list : [])
    .map(normalizeRegion)
    .filter(Boolean);
  localStorage.setItem(LANDMARK_REGIONS_KEY, JSON.stringify(cleaned));
  return cleaned;
}

export function upsertLandmarkRegionLocal(region) {
  const next = normalizeRegion(region);
  if (!next) return null;
  const all = loadLandmarkRegions();
  const idx = all.findIndex((r) => r.id === next.id);
  if (idx >= 0) all[idx] = { ...all[idx], ...next, updatedAt: Date.now() };
  else all.push({ ...next, updatedAt: Date.now() });
  saveLandmarkRegions(all);
  return next;
}

export function deleteLandmarkRegionLocal(id) {
  if (!id) return;
  saveLandmarkRegions(loadLandmarkRegions().filter((r) => r.id !== id));
}

export function markLandmarkRegionsFetched(at = Date.now()) {
  localStorage.setItem(LANDMARK_FETCH_AT_KEY, String(at));
}

export function isLandmarkFetchFresh(ttlMs = LANDMARK_FETCH_TTL_MS) {
  const at = Number(localStorage.getItem(LANDMARK_FETCH_AT_KEY) || 0);
  if (!at) return false;
  return Date.now() - at < ttlMs;
}

/**
 * Merge cloud list into local (cloud wins if newer or same id).
 * @param {LandmarkRegion[]} cloud
 */
export function mergeLandmarkRegionsFromCloud(cloud) {
  const local = loadLandmarkRegions();
  const byId = new Map(local.map((r) => [r.id, r]));
  (cloud || []).forEach((raw) => {
    const r = normalizeRegion({ ...raw, source: 'cloud' });
    if (!r) return;
    const prev = byId.get(r.id);
    if (!prev || (r.updatedAt || 0) >= (prev.updatedAt || 0)) {
      byId.set(r.id, r);
    }
  });
  const merged = Array.from(byId.values());
  saveLandmarkRegions(merged);
  markLandmarkRegionsFetched();
  return merged;
}

/**
 * Match pin against regions (+ optional legacy nearby points).
 * @param {LatLng} point
 * @param {{ regions?: LandmarkRegion[], legacyPoints?: Array<{lat:number,lng:number,name:string,radiusM?:number}>, nearbyM?: number }} [opts]
 * @returns {LandmarkMatch[]}
 */
export function matchLandmarksAt(point, opts = {}) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return [];
  const regions = opts.regions || loadLandmarkRegions();
  const nearbyM = opts.nearbyM ?? DEFAULT_POINT_NEARBY_M;
  const hits = [];

  regions.forEach((r) => {
    const d = distanceMeters(point, r.center);
    if (d <= r.radiusM) {
      hits.push({ ...r, distanceM: d });
    }
  });

  (opts.legacyPoints || []).forEach((p) => {
    const lat = Number(p.lat ?? p.latitude);
    const lng = Number(p.lng ?? p.longitude);
    const name = String(p.name || '').trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !name) return;
    const radius = Number(p.radiusM) || nearbyM;
    const d = distanceMeters(point, { lat, lng });
    if (d <= radius) {
      hits.push({
        id: `legacy_${lat.toFixed(5)}_${lng.toFixed(5)}_${name}`,
        name,
        center: { lat, lng },
        radiusM: radius,
        vertices: [],
        updatedAt: 0,
        source: 'legacy',
        distanceM: d,
      });
    }
  });

  // Dedupe by name+nearby center (prefer smaller distance / region over legacy)
  const best = new Map();
  hits
    .sort((a, b) => a.distanceM - b.distanceM)
    .forEach((h) => {
      const key = `${h.name.toLowerCase()}|${h.center.lat.toFixed(4)}|${h.center.lng.toFixed(4)}`;
      if (!best.has(key)) best.set(key, h);
    });

  return Array.from(best.values()).sort((a, b) => a.distanceM - b.distanceM);
}

export function newLandmarkId() {
  return `lr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Fetch all regions from GAS */
export async function fetchLandmarkRegionsFromCloud() {
  const url = `${API_ENDPOINTS.LOCATION}?action=listLandmarkRegions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.success) throw new Error(data?.error || 'listLandmarkRegions failed');
  return (data.regions || []).map((r) => normalizeRegion({ ...r, source: 'cloud' })).filter(Boolean);
}

export async function upsertLandmarkRegionRemote(region) {
  const body = normalizeRegion(region);
  if (!body) throw new Error('Invalid region');
  const res = await fetch(API_ENDPOINTS.LOCATION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'upsertLandmarkRegion',
      id: body.id,
      name: body.name,
      latitude: body.center.lat,
      longitude: body.center.lng,
      radiusM: body.radiusM,
      vertices: body.vertices || [],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.success) throw new Error(data?.error || 'upsert failed');
  return data;
}

export async function deleteLandmarkRegionRemote(id) {
  const res = await fetch(API_ENDPOINTS.LOCATION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'deleteLandmarkRegion', id }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.success) throw new Error(data?.error || 'delete failed');
  return data;
}

/** Nearby legacy Location points from GAS */
export async function fetchNearbyLegacyLocations(lat, lng, radiusKm = 0.15) {
  const url = `${API_ENDPOINTS.LOCATION}?action=getNearbyLocations&latitude=${lat}&longitude=${lng}&radius=${radiusKm}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.success) return [];
  return (data.locations || []).map((loc) => ({
    lat: loc.latitude,
    lng: loc.longitude,
    name: loc.name,
    radiusM: Number(loc.radiusM) || DEFAULT_POINT_NEARBY_M,
  }));
}
