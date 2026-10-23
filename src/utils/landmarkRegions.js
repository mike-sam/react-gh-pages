import { API_ENDPOINTS } from '../config';
import { haversineKm } from './expenseSummary';
import {
  LEGACY_SEED_REGIONS,
  SEED_REGIONS_APPLIED_KEY,
} from './seedRegions';

export const LANDMARK_REGIONS_KEY = 'landmarkRegions';
export const LANDMARK_FETCH_AT_KEY = 'landmarkRegionsFetchedAt';
export const LANDMARK_FETCH_TTL_MS = 60 * 60 * 1000;

/** Default hit radius for legacy single-point Location rows (metres) */
export const DEFAULT_POINT_NEARBY_M = 100;
export const DEFAULT_REGION_RADIUS_M = 150;
export const REGION_RADIUS_MIN_M = 30;
export const REGION_RADIUS_MAX_M = 3000;
export const NEARBY_LANDMARK_M = 1200;

export const SHAPE_CIRCLE = 'circle';
export const SHAPE_RECT = 'rect';
export const SHAPE_POLYGON = 'polygon';
export const SHAPE_POINT = 'point';
export const POINT_DEDUP_M = 120;

/**
 * @typedef {{ lat: number, lng: number }} LatLng
 * @typedef {{
 *   id: string,
 *   name: string,
 *   center: LatLng,
 *   radiusM: number,
 *   vertices?: LatLng[],
 *   shape?: 'circle'|'rect'|'polygon',
 *   updatedAt: number,
 *   source?: 'local'|'cloud'|'legacy'
 * }} LandmarkRegion
 * @typedef {LandmarkRegion & { distanceM: number, inside?: boolean }} LandmarkMatch
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

function takeVertices(list) {
  return (Array.isArray(list) ? list : [])
    .map((v) => ({ lat: Number(v.lat), lng: Number(v.lng) }))
    .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng));
}

function parseVerticesField(raw) {
  if (Array.isArray(raw)) {
    return { vertices: takeVertices(raw), shape: '' };
  }
  if (raw && typeof raw === 'object') {
    return {
      vertices: takeVertices(raw.vertices),
      shape: String(raw.shape || '').trim(),
    };
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return parseVerticesField(JSON.parse(raw));
    } catch {
      return { vertices: [], shape: '' };
    }
  }
  return { vertices: [], shape: '' };
}

export function inferShape(region) {
  const shape = String(region?.shape || '').trim();
  if (
    shape === SHAPE_RECT ||
    shape === SHAPE_POLYGON ||
    shape === SHAPE_CIRCLE ||
    shape === SHAPE_POINT
  ) {
    return shape;
  }
  return (region?.vertices || []).length >= 3 ? SHAPE_POLYGON : SHAPE_CIRCLE;
}

/** Ray-casting point-in-polygon (lat = y, lng = x). */
export function pointInPolygon(point, vertices) {
  if (!point || !Array.isArray(vertices) || vertices.length < 3) return false;
  const x = Number(point.lng);
  const y = Number(point.lat);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = Number(vertices[i].lng);
    const yi = Number(vertices[i].lat);
    const xj = Number(vertices[j].lng);
    const yj = Number(vertices[j].lat);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersect =
      (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function regionContains(region, point) {
  if (!region || !point) return false;
  const verts = region.vertices || [];
  const shape = inferShape(region);
  if ((shape === SHAPE_POLYGON || shape === SHAPE_RECT) && verts.length >= 3) {
    return pointInPolygon(point, verts);
  }
  return distanceMeters(point, region.center) <= (Number(region.radiusM) || 0);
}

export function regionLatLngBounds(region) {
  if (!region) return null;
  const shape = inferShape(region);
  const verts = region.vertices || [];
  if ((shape === SHAPE_POLYGON || shape === SHAPE_RECT) && verts.length >= 1) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    verts.forEach((v) => {
      if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) return;
      if (v.lat < minLat) minLat = v.lat;
      if (v.lat > maxLat) maxLat = v.lat;
      if (v.lng < minLng) minLng = v.lng;
      if (v.lng > maxLng) maxLng = v.lng;
    });
    if (!Number.isFinite(minLat)) return null;
    return { minLat, maxLat, minLng, maxLng };
  }
  const c = region.center;
  if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return null;
  const r = Number(region.radiusM) || 0;
  const { dLat, dLng } = metersToLatLngDelta(c, r, r);
  return {
    minLat: c.lat - dLat,
    maxLat: c.lat + dLat,
    minLng: c.lng - dLng,
    maxLng: c.lng + dLng,
  };
}

export function regionOverlapsView(region, view) {
  if (!view) return true;
  const b = regionLatLngBounds(region);
  if (!b) return false;
  return (
    b.maxLat >= view.south &&
    b.minLat <= view.north &&
    b.maxLng >= view.west &&
    b.minLng <= view.east
  );
}

export function metersToLatLngDelta(center, northM, eastM) {
  const lat = Number(center?.lat);
  const dLat = northM / 111320;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLng = eastM / (111320 * Math.max(0.2, Math.abs(cos) || 0.2));
  return { dLat, dLng };
}

export function rectVerticesFromCenter(center, halfM) {
  const { dLat, dLng } = metersToLatLngDelta(center, halfM, halfM);
  return [
    { lat: center.lat - dLat, lng: center.lng - dLng },
    { lat: center.lat - dLat, lng: center.lng + dLng },
    { lat: center.lat + dLat, lng: center.lng + dLng },
    { lat: center.lat + dLat, lng: center.lng - dLng },
  ];
}

export function polygonCentroid(vertices) {
  if (!Array.isArray(vertices) || vertices.length === 0) return null;
  let lat = 0;
  let lng = 0;
  vertices.forEach((v) => {
    lat += v.lat;
    lng += v.lng;
  });
  return { lat: lat / vertices.length, lng: lng / vertices.length };
}

export function maxVertexDistanceM(center, vertices) {
  let max = 0;
  (vertices || []).forEach((v) => {
    max = Math.max(max, distanceMeters(center, v));
  });
  return max;
}

export function searchLocalLandmarks(query, regions) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return (regions || []).filter((r) => String(r.name || '').toLowerCase().includes(q));
}

export function formatDist(m) {
  if (!Number.isFinite(m)) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export function formatArea(m2) {
  if (!Number.isFinite(m2) || m2 <= 0) return '';
  if (m2 < 1e6) return `${Math.round(m2).toLocaleString()} m²`;
  return `${(m2 / 1e6).toFixed(2)} km²`;
}

export function regionAreaM2(region) {
  if (!region) return Infinity;
  const shape = inferShape(region);
  if (shape === SHAPE_POINT) return 1;
  if (shape === SHAPE_CIRCLE) {
    const r = Number(region.radiusM) || 0;
    return Math.PI * r * r;
  }
  const poly = polygonAreaM2(region.vertices || []);
  if (poly > 0) return poly;
  const r = Number(region.radiusM) || 0;
  return Math.PI * r * r;
}

export const VERTEX_SNAP_M = 30;
/** Click within this of an edge sticks onto the edge; farther clicks keep the tap point. */
export const EDGE_STICK_M = 18;
/** Ignore snap-merge unless the vertex actually moved (dblclick / click jitter). */
export const MIN_MERGE_MOVE_M = 10;

function localMetersPerDegree(lat) {
  const cos = Math.cos((Number(lat) * Math.PI) / 180);
  return {
    mPerLat: 111320,
    mPerLng: 111320 * Math.max(0.2, Math.abs(cos) || 0.2),
  };
}

/** Closest point on segment AB, in lat/lng, plus distance in metres. */
export function closestPointOnSegment(point, a, b) {
  if (!point || !a || !b) {
    return { lat: NaN, lng: NaN, t: 0, distM: Infinity };
  }
  const { mPerLat, mPerLng } = localMetersPerDegree(a.lat);
  const px = (point.lng - a.lng) * mPerLng;
  const py = (point.lat - a.lat) * mPerLat;
  const bx = (b.lng - a.lng) * mPerLng;
  const by = (b.lat - a.lat) * mPerLat;
  const len2 = bx * bx + by * by;
  let t = 0;
  if (len2 >= 1e-6) {
    t = (px * bx + py * by) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  return {
    lat: a.lat + t * (by / mPerLat),
    lng: a.lng + t * (bx / mPerLng),
    t,
    distM: Math.hypot(px - t * bx, py - t * by),
  };
}

/** Shortest distance from point to segment AB, in metres. */
export function distancePointToSegmentMeters(point, a, b) {
  return closestPointOnSegment(point, a, b).distM;
}

/**
 * Add a polygon vertex next to nearby points instead of always appending
 * (which makes edges jump across the shape).
 * n < 3: append. n >= 3: insert on the nearest edge.
 * Snap to an existing vertex within VERTEX_SNAP_M.
 * Only stick onto the edge if the tap is within EDGE_STICK_M; otherwise keep the tap point.
 */
export function insertPolygonVertex(vertices, point, snapM = VERTEX_SNAP_M) {
  const verts = Array.isArray(vertices) ? vertices : [];
  const pt = {
    lat: Number(point?.lat),
    lng: Number(point?.lng),
  };
  if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) {
    return { vertices: verts, index: -1, snapped: false };
  }
  let nearestI = -1;
  let nearestD = Infinity;
  verts.forEach((v, i) => {
    const d = distanceMeters(pt, v);
    if (d < nearestD) {
      nearestD = d;
      nearestI = i;
    }
  });
  if (nearestI >= 0 && nearestD <= snapM) {
    return { vertices: verts, index: nearestI, snapped: true };
  }
  if (verts.length < 3) {
    return { vertices: [...verts, pt], index: verts.length, snapped: false };
  }
  let bestI = verts.length - 1;
  let bestD = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const hit = closestPointOnSegment(pt, verts[i], verts[(i + 1) % verts.length]);
    if (hit.distM < bestD) {
      bestD = hit.distM;
      bestI = i;
    }
  }
  const hit = closestPointOnSegment(pt, verts[bestI], verts[(bestI + 1) % verts.length]);
  const insertPt = hit.distM <= EDGE_STICK_M ? { lat: hit.lat, lng: hit.lng } : pt;
  const next = [...verts];
  const insertAt = bestI + 1;
  next.splice(insertAt, 0, insertPt);
  return { vertices: next, index: insertAt, snapped: false };
}

function orient2d(a, b, c) {
  const { mPerLat, mPerLng } = localMetersPerDegree(a.lat);
  const ax = a.lng * mPerLng;
  const ay = a.lat * mPerLat;
  const bx = b.lng * mPerLng;
  const by = b.lat * mPerLat;
  const cx = c.lng * mPerLng;
  const cy = c.lat * mPerLat;
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function segmentsCross(a, b, c, d) {
  const o1 = orient2d(a, b, c);
  const o2 = orient2d(a, b, d);
  const o3 = orient2d(c, d, a);
  const o4 = orient2d(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/** True when two non-adjacent edges of the closed ring properly intersect. */
export function polygonSelfIntersects(vertices) {
  const verts = Array.isArray(vertices) ? vertices : [];
  const n = verts.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (j === i + 1) continue;
      if (i === 0 && j === n - 1) continue;
      if (
        segmentsCross(
          verts[i],
          verts[(i + 1) % n],
          verts[j],
          verts[(j + 1) % n]
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Pull `index` out of the ring and splice it onto a remaining edge.
 * Prefer a simple (non-crossing) ring; among those, the nearest edge.
 */
export function reinsertVertexOnNearestEdge(vertices, index) {
  const verts = Array.isArray(vertices) ? vertices.map((v) => ({ lat: v.lat, lng: v.lng })) : [];
  if (index < 0 || index >= verts.length || verts.length < 4) {
    return { vertices: verts, index, changed: false };
  }
  const pt = verts[index];
  const rest = verts.filter((_, i) => i !== index);
  const candidates = [];
  for (let i = 0; i < rest.length; i += 1) {
    const next = [...rest];
    const insertAt = i + 1;
    next.splice(insertAt, 0, pt);
    const dist = closestPointOnSegment(pt, rest[i], rest[(i + 1) % rest.length]).distM;
    candidates.push({
      vertices: next,
      index: insertAt,
      dist,
      crosses: polygonSelfIntersects(next),
    });
  }
  const simple = candidates.filter((c) => !c.crosses);
  const pool = simple.length ? simple : candidates;
  pool.sort((a, b) => a.dist - b.dist);
  const best = pool[0];
  if (!best) return { vertices: verts, index, changed: false };
  const unchanged =
    best.vertices.length === verts.length &&
    best.vertices.every((v, i) => v.lat === verts[i].lat && v.lng === verts[i].lng);
  return { vertices: best.vertices, index: best.index, changed: !unchanged };
}

/**
 * Drop a vertex at lat/lng. If it lands on another vertex, snap onto it and
 * remove the duplicate so the ring forms a new shape instead of stacking.
 * If the in-place ring crosses itself, reinsert the vertex on the nearest edge.
 */
export function commitPolygonVertexMove(vertices, index, lat, lng, snapM = VERTEX_SNAP_M) {
  const verts = Array.isArray(vertices) ? vertices.map((v) => ({ lat: v.lat, lng: v.lng })) : [];
  if (index < 0 || index >= verts.length) {
    return { vertices: verts, index, changed: false };
  }
  const pt = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) {
    return { vertices: verts, index, changed: false };
  }
  let hit = -1;
  let hitD = Infinity;
  verts.forEach((v, i) => {
    if (i === index) return;
    const d = distanceMeters(pt, v);
    if (d < hitD) {
      hitD = d;
      hit = i;
    }
  });
  const prev = verts[index];
  const movedM = prev ? distanceMeters(prev, pt) : Infinity;
  if (hit >= 0 && hitD <= snapM && verts.length > 3 && movedM >= MIN_MERGE_MOVE_M) {
    const snapped = { lat: verts[hit].lat, lng: verts[hit].lng };
    const next = verts.map((v, i) => (i === index ? snapped : v)).filter((_, i) => i !== hit);
    const newIndex = hit < index ? index - 1 : index;
    return { vertices: next, index: newIndex, changed: true, merged: true };
  }
  if (prev && prev.lat === pt.lat && prev.lng === pt.lng) {
    return { vertices: verts, index, changed: false };
  }
  verts[index] = pt;
  if (verts.length >= 4 && polygonSelfIntersects(verts)) {
    const relocated = reinsertVertexOnNearestEdge(verts, index);
    if (relocated.changed) {
      return {
        vertices: relocated.vertices,
        index: relocated.index,
        changed: true,
        merged: false,
        reordered: true,
        original: verts,
        fromIndex: index,
      };
    }
  }
  return { vertices: verts, index, changed: true, merged: false };
}

/** Shoelace area in m² using a local-meters projection. */
export function polygonAreaM2(vertices) {
  if (!Array.isArray(vertices) || vertices.length < 3) return 0;
  const c = polygonCentroid(vertices);
  if (!c) return 0;
  const cos = Math.cos((c.lat * Math.PI) / 180);
  const pts = vertices.map((v) => ({
    x: (v.lng - c.lng) * 111320 * cos,
    y: (v.lat - c.lat) * 111320,
  }));
  let sum = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    sum += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
  }
  return Math.abs(sum) / 2;
}

/** Covering radius (方圓) + area for the current shape. */
export function regionCoverage(region) {
  const shape = inferShape(region);
  if (shape === SHAPE_POINT) {
    const radiusM = Number(region.radiusM) || DEFAULT_POINT_NEARBY_M;
    return { radiusM, areaM2: 1 };
  }
  if (shape === SHAPE_CIRCLE) {
    const radiusM = Number(region.radiusM) || 0;
    return { radiusM, areaM2: Math.PI * radiusM * radiusM };
  }
  if (shape === SHAPE_RECT) {
    const half = Number(region.radiusM) || 0;
    return { radiusM: half * Math.SQRT2, areaM2: 4 * half * half };
  }
  const verts = region.vertices || [];
  const center = polygonCentroid(verts) || region.center;
  return {
    radiusM: center ? maxVertexDistanceM(center, verts) : 0,
    areaM2: polygonAreaM2(verts),
  };
}

export function formatCoverage(region) {
  const { radiusM, areaM2 } = regionCoverage(region);
  if (!Number.isFinite(radiusM) || radiusM < 1) return '';
  const r = formatDist(radiusM);
  const a = formatArea(areaM2);
  if (!r) return '';
  return a ? `方圓 ${r} · ${a}` : `方圓 ${r}`;
}

export function shapeMeta(region) {
  const shape = inferShape(region);
  if (shape === SHAPE_POINT) {
    const r = Number(region.radiusM) || DEFAULT_POINT_NEARBY_M;
    return `點 · 附近 ${formatDist(r)}`;
  }
  const cover = formatCoverage(region);
  const kind =
    shape === SHAPE_POLYGON
      ? `${(region.vertices || []).length} 點`
      : shape === SHAPE_RECT
        ? '方'
        : '圓';
  return cover ? `${kind} · ${cover}` : kind;
}

export function finalizeDraft(draft, pin) {
  const shape = inferShape(draft);
  if (shape === SHAPE_POLYGON) {
    const verts = draft.vertices || [];
    if (verts.length < 3) return { error: '多邊形至少 3 個頂點' };
    const center = polygonCentroid(verts) || { lat: pin[0], lng: pin[1] };
    return {
      ...draft,
      shape: SHAPE_POLYGON,
      center,
      radiusM: Math.max(10, maxVertexDistanceM(center, verts)),
      vertices: verts,
    };
  }
  const center = { lat: pin[0], lng: pin[1] };
  if (shape === SHAPE_POINT) {
    return {
      ...draft,
      shape: SHAPE_POINT,
      center,
      radiusM: Math.max(10, Number(draft.radiusM) || DEFAULT_POINT_NEARBY_M),
      vertices: [],
    };
  }
  const radiusM = Math.max(10, Number(draft.radiusM) || DEFAULT_REGION_RADIUS_M);
  if (shape === SHAPE_RECT) {
    return {
      ...draft,
      shape: SHAPE_RECT,
      center,
      radiusM,
      vertices: rectVerticesFromCenter(center, radiusM),
    };
  }
  return {
    ...draft,
    shape: SHAPE_CIRCLE,
    center,
    radiusM,
    vertices: [],
  };
}

function namesMatch(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function findSimilarNamed(list, name, center, maxM = POINT_DEDUP_M) {
  return (list || []).find(
    (r) => namesMatch(r.name, name) && distanceMeters(center, r.center) <= maxM
  );
}

/**
 * Keep a named pin from 記帳 / 修正定位 so later visits can autofill.
 * Skips blank names and existing nearby same-name regions.
 */
export function rememberNamedPoint({ lat, lng, name, source = 'local' } = {}) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  const center = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return null;
  const all = loadLandmarkRegions();
  const similar = findSimilarNamed(all, trimmed, center);
  if (similar) {
    if (inferShape(similar) !== SHAPE_POINT) return similar;
    const next = {
      ...similar,
      center,
      radiusM: similar.radiusM || DEFAULT_POINT_NEARBY_M,
      updatedAt: Date.now(),
      source: similar.source || source,
    };
    upsertLandmarkRegionLocal(next);
    return next;
  }
  const created = {
    id: `pt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: trimmed,
    center,
    radiusM: DEFAULT_POINT_NEARBY_M,
    vertices: [],
    shape: SHAPE_POINT,
    updatedAt: Date.now(),
    source,
  };
  upsertLandmarkRegionLocal(created);
  return created;
}

export async function searchNominatim(query, limit = 6, near = null) {
  const q = String(query || '').trim();
  if (!q) return [];
  const params = {
    format: 'json',
    q,
    limit: String(limit),
    addressdetails: '0',
  };
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
    const latPad = 6 / 111;
    const lngPad = 6 / (111 * Math.max(0.2, Math.cos((near.lat * Math.PI) / 180)));
    params.viewbox = `${near.lng - lngPad},${near.lat + latPad},${near.lng + lngPad},${near.lat - latPad}`;
    params.bounded = '1';
  }
  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams(params).toString();
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('搜尋失敗');
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => ({
      kind: 'map',
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      name: item.display_name || q,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

function namesLooseMatch(a, b) {
  const na = String(a || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
  const nb = String(b || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export const MERCHANT_NEAR_KM = 5;

function findLocalMerchantNear(name, here, maxKm) {
  const all = loadLandmarkRegions();
  let best = null;
  for (const r of all || []) {
    if (!namesLooseMatch(r.name, name)) continue;
    const c = r.center;
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    const km = haversineKm(here.lat, here.lng, c.lat, c.lng);
    if (km <= maxKm && (!best || km < best.km)) best = { name: r.name, km };
  }
  return best;
}

async function saveNamedLocationRemote(lat, lng, name) {
  try {
    await fetch(API_ENDPOINTS.LOCATION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'saveLocation',
        latitude: lat,
        longitude: lng,
        name,
      }),
    });
  } catch {
    /* local pin still kept */
  }
}

/** If merchant geocodes (or already saved) within 5km of here, name the current GPS pin. */
export async function pinMerchantIfNearHere({ merchant, address, here, maxKm = MERCHANT_NEAR_KM } = {}) {
  const name = String(merchant || '').trim();
  if (!name) return { ok: false, reason: 'no-merchant' };
  if (!here || !Number.isFinite(here.lat) || !Number.isFinite(here.lng)) {
    return { ok: false, reason: 'no-gps' };
  }
  const local = findLocalMerchantNear(name, here, maxKm);
  let km = local ? local.km : null;
  let confirmed = Boolean(local);
  if (!confirmed) {
    const q = [name, String(address || '').trim()].filter(Boolean).join(' ');
    let hits = [];
    try {
      hits = await searchNominatim(q, 5, here);
      if (!hits.length) hits = await searchNominatim(q, 5);
    } catch {
      hits = [];
    }
    for (const h of hits) {
      const d = haversineKm(here.lat, here.lng, h.lat, h.lng);
      if (d <= maxKm && (km == null || d < km)) {
        confirmed = true;
        km = d;
      }
    }
  }
  if (!confirmed) return { ok: false, reason: 'too-far', km };
  rememberNamedPoint({ lat: here.lat, lng: here.lng, name, source: 'ai-receipt' });
  saveNamedLocationRemote(here.lat, here.lng, name);
  return { ok: true, km, name };
}

function normalizeRegion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.center?.lat ?? raw.lat ?? raw.latitude);
  const lng = Number(raw.center?.lng ?? raw.lng ?? raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  const id =
    String(raw.id || '').trim() ||
    `lr_${lat.toFixed(5)}_${lng.toFixed(5)}_${name}`.replace(/\s+/g, '_');
  const parsed = parseVerticesField(raw.vertices ?? raw.verticesJson);
  const vertices = parsed.vertices;
  let shape = String(raw.shape || parsed.shape || '').trim();
  if (
    shape !== SHAPE_RECT &&
    shape !== SHAPE_POLYGON &&
    shape !== SHAPE_CIRCLE &&
    shape !== SHAPE_POINT
  ) {
    shape = vertices.length >= 3 ? SHAPE_POLYGON : SHAPE_CIRCLE;
  }
  const fallbackR = shape === SHAPE_POINT ? DEFAULT_POINT_NEARBY_M : DEFAULT_REGION_RADIUS_M;
  const radiusM = Math.max(
    10,
    Number(raw.radiusM ?? raw.radius_m ?? fallbackR) || fallbackR
  );
  return {
    id,
    name,
    center: { lat, lng },
    radiusM,
    vertices,
    shape,
    updatedAt: Number(raw.updatedAt) || Date.now(),
    source: raw.source || 'local',
  };
}

function readStoredLandmarkRegions() {
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

function injectSeedRegionsIfNeeded(list) {
  try {
    if (localStorage.getItem(SEED_REGIONS_APPLIED_KEY) === '1') return list;
  } catch {
    return list;
  }
  const byId = new Map(list.map((r) => [r.id, r]));
  const names = new Set(list.map((r) => String(r.name || '').trim().toLowerCase()));
  let added = false;
  LEGACY_SEED_REGIONS.forEach((seed) => {
    const next = normalizeRegion(seed);
    if (!next) return;
    if (byId.has(next.id) || names.has(next.name.toLowerCase())) return;
    byId.set(next.id, next);
    names.add(next.name.toLowerCase());
    added = true;
  });
  const merged = Array.from(byId.values());
  if (added) {
    try {
      localStorage.setItem(LANDMARK_REGIONS_KEY, JSON.stringify(merged));
    } catch {
      return list;
    }
  }
  try {
    localStorage.setItem(SEED_REGIONS_APPLIED_KEY, '1');
  } catch {
    /* ignore quota */
  }
  return merged;
}

/** @returns {LandmarkRegion[]} */
export function loadLandmarkRegions() {
  return injectSeedRegionsIfNeeded(readStoredLandmarkRegions());
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

export function renameLandmarkRegionLocal(id, name) {
  const trimmed = String(name || '').trim();
  if (!id || !trimmed) return null;
  const all = loadLandmarkRegions();
  const prev = all.find((r) => r.id === id);
  if (!prev) return null;
  return upsertLandmarkRegionLocal({ ...prev, name: trimmed });
}

export function isNamedPoint(region) {
  return Boolean(region) && inferShape(region) === SHAPE_POINT;
}

export function isSheetPlace(region) {
  return region?.source === 'sheet' || region?.source === 'legacy';
}

/**
 * Keep one 地標; delete other checked 地標 locally (sheet rows are deleted by caller).
 * @returns {{ keep: LandmarkRegion, dropped: LandmarkRegion[] } | null}
 */
export function mergeNamedPointsLocal(items, { keepId, checkedIds } = {}) {
  const list = (items || []).filter(isNamedPoint);
  const keep = list.find((r) => r.id === keepId);
  if (!keep) return null;
  const dropSet = new Set((checkedIds || []).map((id) => String(id)));
  const dropped = list.filter((r) => r.id !== keep.id && dropSet.has(r.id));
  if (dropped.length < 1) return null;
  dropped.forEach((r) => {
    if (!isSheetPlace(r)) deleteLandmarkRegionLocal(r.id);
  });
  return { keep, dropped };
}

/** Name of the nearest named pin covering this point — never a 區域. */
export function labelFromLandmarks(point) {
  const hits = matchLandmarksAt(point).filter(isNamedPoint);
  return hits[0]?.name || '';
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
    if (prev) {
      if ((r.updatedAt || 0) >= (prev.updatedAt || 0)) byId.set(r.id, r);
      return;
    }
    const similar = findSimilarNamed(Array.from(byId.values()), r.name, r.center);
    if (similar) return;
    byId.set(r.id, r);
  });
  const merged = Array.from(byId.values());
  saveLandmarkRegions(merged);
  markLandmarkRegionsFetched();
  return merged;
}

function asLegacyMatch(p, nearbyM) {
  const lat = Number(p.lat ?? p.latitude);
  const lng = Number(p.lng ?? p.longitude);
  const name = String(p.name || '').trim();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !name) return null;
  const radius = Number(p.radiusM) || nearbyM;
  return {
    id: `legacy_${lat.toFixed(5)}_${lng.toFixed(5)}_${name}`,
    name,
    center: { lat, lng },
    radiusM: radius,
    vertices: [],
    shape: SHAPE_POINT,
    updatedAt: 0,
    source: 'legacy',
  };
}

function matchSort(a, b) {
  const insideDiff = Number(b.inside) - Number(a.inside);
  if (insideDiff) return insideDiff;
  if (a.inside && b.inside) {
    const areaDiff = regionAreaM2(a) - regionAreaM2(b);
    if (areaDiff) return areaDiff;
  }
  return a.distanceM - b.distanceM;
}

function dedupeMatches(hits) {
  const best = new Map();
  hits
    .slice()
    .sort(matchSort)
    .forEach((h) => {
      const key = `${h.name.toLowerCase()}|${h.center.lat.toFixed(4)}|${h.center.lng.toFixed(4)}`;
      if (!best.has(key)) best.set(key, h);
    });
  return Array.from(best.values()).sort(matchSort);
}

/**
 * Hits inside a region, plus nearby landmarks within nearbyM of the pin.
 * @param {LatLng} point
 * @param {{ regions?: LandmarkRegion[], legacyPoints?: Array<{lat:number,lng:number,name:string,radiusM?:number}>, nearbyM?: number }} [opts]
 * @returns {LandmarkMatch[]}
 */
export function landmarksAround(point, opts = {}) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return [];
  const regions = opts.regions || loadLandmarkRegions();
  const nearbyM = opts.nearbyM ?? NEARBY_LANDMARK_M;
  const pointRadius = opts.pointRadiusM ?? DEFAULT_POINT_NEARBY_M;
  const hits = [];

  regions.forEach((r) => {
    const d = distanceMeters(point, r.center);
    const inside = regionContains(r, point);
    if (inside || d <= nearbyM) {
      hits.push({ ...r, distanceM: d, inside });
    }
  });

  (opts.legacyPoints || []).forEach((p) => {
    const row = asLegacyMatch(p, pointRadius);
    if (!row) return;
    const d = distanceMeters(point, row.center);
    if (d <= row.radiusM) {
      hits.push({ ...row, distanceM: d, inside: true });
    }
  });

  return dedupeMatches(hits);
}

/**
 * Match pin against regions (+ optional legacy nearby points).
 * @param {LatLng} point
 * @param {{ regions?: LandmarkRegion[], legacyPoints?: Array<{lat:number,lng:number,name:string,radiusM?:number}>, nearbyM?: number }} [opts]
 * @returns {LandmarkMatch[]}
 */
export function matchLandmarksAt(point, opts = {}) {
  return landmarksAround(point, opts).filter((h) => h.inside);
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
      shape: body.shape || SHAPE_CIRCLE,
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

export function savedLocationToPoint(loc) {
  const lat = Number(loc.lat ?? loc.latitude);
  const lng = Number(loc.lng ?? loc.longitude);
  const name = String(loc.name || '').trim();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !name) return null;
  const created = loc.createdTime || loc.updatedAt;
  return {
    id: `loc_${lat.toFixed(5)}_${lng.toFixed(5)}_${name}`,
    name,
    center: { lat, lng },
    radiusM: Number(loc.radiusM) || DEFAULT_POINT_NEARBY_M,
    vertices: [],
    shape: SHAPE_POINT,
    updatedAt: created ? Date.parse(created) || 0 : 0,
    source: 'sheet',
    usageCount: Number(loc.usageCount) || 0,
  };
}

/** Nearby legacy Location points from GAS */
export async function fetchNearbyLegacyLocations(lat, lng, radiusKm = 1.2) {
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
    createdTime: loc.createdTime,
    usageCount: loc.usageCount,
  }));
}

/** All named pins from Location sheet (GPS 地標). */
export async function fetchSavedLocations() {
  const url = `${API_ENDPOINTS.LOCATION}?action=listLocations`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.success) return [];
  return (data.locations || []).map(savedLocationToPoint).filter(Boolean);
}

export async function saveSavedLocationRemote(place) {
  const lat = Number(place?.center?.lat ?? place?.lat);
  const lng = Number(place?.center?.lng ?? place?.lng);
  const name = String(place?.name || '').trim();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !name) return null;
  const res = await fetch(API_ENDPOINTS.LOCATION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'saveLocation',
      latitude: lat,
      longitude: lng,
      name,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json().catch(() => null);
}

export async function deleteSavedLocationRemote(place) {
  const lat = Number(place?.center?.lat ?? place?.lat);
  const lng = Number(place?.center?.lng ?? place?.lng);
  const name = String(place?.name || '').trim();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const res = await fetch(API_ENDPOINTS.LOCATION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'deleteLocation',
      latitude: lat,
      longitude: lng,
      name,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.success) throw new Error(data?.error || 'deleteLocation failed');
  return data;
}
