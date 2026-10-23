import {
  DEFAULT_CAR_PLATES,
  loadParkedByCar,
  loadParkedForCar,
} from './locationStorage';
import { distanceMeters } from './landmarkRegions';

export const ALL_VEHICLES = 'all';
export const VEHICLES_KEY = 'managedVehicles';
export const REMOVED_VEHICLES_KEY = 'removedVehicles';

/** If fleet span exceeds this, 返回車輛 is disabled in 全部 mode. */
export const FLEET_FIT_MAX_M = 40000;

export const VEHICLE_EXPENSE_CAT = '交通出行';

/** Subcats that jump to 記帳. `subcat` must match SECONDARY_TAGS. */
export const VEHICLE_EXPENSE_SHORTCUTS = [
  { subcat: '打油', label: '打油' },
  { subcat: '维修保养', label: '維護保養' },
  { subcat: '洗车美容', label: '洗車美容' },
  { subcat: '停车费', label: '停車費' },
  { subcat: '车险', label: '車險' },
  { subcat: '车贷', label: '車貸' },
];

export const VEHICLE_EXPENSE_SUBCATS = VEHICLE_EXPENSE_SHORTCUTS.map((s) => s.subcat);

/** Subcats that show ODO and fetch last mileage. Wash / loan do not. */
export const VEHICLE_ODO_SUBCATS = ['打油', '维修保养', '车险', '停车费'];

export function vehicleNeedsOdo(tag, subcat) {
  return tag === VEHICLE_EXPENSE_CAT && VEHICLE_ODO_SUBCATS.includes(subcat);
}

export function normalizePlate(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePlate).filter(Boolean);
  } catch {
    return [];
  }
}

function writeList(key, list) {
  const next = [...new Set((list || []).map(normalizePlate).filter(Boolean))];
  localStorage.setItem(key, JSON.stringify(next));
  return next;
}

export function loadRemovedVehicles() {
  return readList(REMOVED_VEHICLES_KEY);
}

export function loadVehicleRoster() {
  const removed = new Set(loadRemovedVehicles());
  let stored = null;
  try {
    const raw = localStorage.getItem(VEHICLES_KEY);
    if (raw != null) stored = JSON.parse(raw);
  } catch {
    stored = null;
  }
  const plates = Array.isArray(stored)
    ? stored.map(normalizePlate).filter(Boolean)
    : DEFAULT_CAR_PLATES;
  return [...new Set(plates)].filter((p) => !removed.has(p));
}

export function addVehicle(plate) {
  const key = normalizePlate(plate);
  if (!key) return loadVehicleRoster();
  const removed = loadRemovedVehicles().filter((p) => p !== key);
  writeList(REMOVED_VEHICLES_KEY, removed);
  const roster = loadVehicleRoster();
  if (!roster.includes(key)) roster.push(key);
  writeList(VEHICLES_KEY, roster);
  return loadVehicleRoster();
}

/** Hide from selector/map. Parked + expense history stay. */
export function removeVehicle(plate) {
  const key = normalizePlate(plate);
  if (!key) return loadVehicleRoster();
  writeList(
    VEHICLES_KEY,
    loadVehicleRoster().filter((p) => p !== key)
  );
  writeList(REMOVED_VEHICLES_KEY, [...loadRemovedVehicles(), key]);
  return loadVehicleRoster();
}

export function listFleetMarkers(roster = loadVehicleRoster()) {
  return (roster || []).map((plate) => {
    const parked = loadParkedForCar(plate);
    const located =
      parked && typeof parked.lat === 'number' && typeof parked.lng === 'number';
    return {
      plate,
      lat: located ? parked.lat : null,
      lng: located ? parked.lng : null,
      label: parked?.label || '',
      updatedAt: parked?.updatedAt || 0,
    };
  });
}

export function locatedFleet(markers) {
  return (markers || []).filter(
    (m) => typeof m?.lat === 'number' && typeof m?.lng === 'number'
  );
}

export function fleetSpanM(points) {
  const pts = locatedFleet(points);
  if (pts.length < 2) return 0;
  let max = 0;
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      max = Math.max(max, distanceMeters(pts[i], pts[j]));
    }
  }
  return max;
}

export function canFitFleet(points) {
  const pts = locatedFleet(points);
  if (pts.length === 0) return false;
  if (pts.length === 1) return true;
  return fleetSpanM(pts) <= FLEET_FIT_MAX_M;
}

/** Plates currently parked in local cache (including removed vehicles). */
export function knownParkedPlates() {
  return Object.keys(loadParkedByCar() || {}).map(normalizePlate).filter(Boolean);
}
