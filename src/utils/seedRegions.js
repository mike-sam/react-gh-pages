/**
 * Legacy area boxes from getAreaNameByLatLong.js / areas.txt.
 * Converted to 4-vertex polygons so the original AABB extents stay intact
 * (SHAPE_RECT in this app is a square from center + half-side).
 */

function boxToRegion(name, box, index) {
  const tl = box['↖'] || {};
  const br = box['↘'] || {};
  const aLat = Number(tl.lat);
  const aLng = Number(tl.long ?? tl.lng);
  const bLat = Number(br.lat);
  const bLng = Number(br.long ?? br.lng);
  const minLat = Math.min(aLat, bLat);
  const maxLat = Math.max(aLat, bLat);
  const minLng = Math.min(aLng, bLng);
  const maxLng = Math.max(aLng, bLng);
  const vertices = [
    { lat: maxLat, lng: minLng },
    { lat: maxLat, lng: maxLng },
    { lat: minLat, lng: maxLng },
    { lat: minLat, lng: minLng },
  ];
  const center = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };
  const cos = Math.cos((center.lat * Math.PI) / 180);
  const halfLatM = ((maxLat - minLat) / 2) * 111320;
  const halfLngM = ((maxLng - minLng) / 2) * 111320 * cos;
  const radiusM = Math.max(10, Math.hypot(halfLatM, halfLngM));
  const priority = Number(box.priority);
  return {
    id: `seed_legacy_${String(index + 1).padStart(2, '0')}`,
    name,
    center,
    radiusM,
    vertices,
    shape: 'polygon',
    updatedAt: 1,
    source: 'seed',
    ...(Number.isFinite(priority) && priority > 0 ? { priority } : {}),
  };
}

const RAW_LEGACY_AREAS = {
  '泳池 Block B后面': {
    '↖': { lat: 1.51169, long: 103.82463 },
    '↘': { lat: 1.51098, long: 103.82538 },
  },
  '泳池 Block C后面': {
    '↖': { lat: 1.51146, long: 103.82539 },
    '↘': { lat: 1.51098, long: 103.8259 },
  },
  'Block B前': {
    '↖': { lat: 1.51075, long: 103.8242 },
    '↘': { lat: 1.50999, long: 103.82486 },
  },
  'Block A前': {
    '↖': { lat: 1.51009, long: 103.82496 },
    '↘': { lat: 1.50996, long: 103.8254 },
  },
  'Block A前(靠guard)': {
    '↖': { lat: 1.50999, long: 103.82492 },
    '↘': { lat: 1.50969, long: 103.82507 },
  },
  'Block A前(对面)': {
    '↖': { lat: 1.50994, long: 103.82508 },
    '↘': { lat: 1.50968, long: 103.82545 },
  },
  'Block A前(学校)': {
    '↖': { lat: 1.51012, long: 103.82574 },
    '↘': { lat: 1.50987, long: 103.8266 },
  },
  'Block C前(篮球场)': {
    '↖': { lat: 1.51079, long: 103.82568 },
    '↘': { lat: 1.51053, long: 103.82591 },
  },
  'Block C前(中间)': {
    '↖': { lat: 1.51054, long: 103.82574 },
    '↘': { lat: 1.51012, long: 103.82657 },
  },
  'Block C前(靠Block A旁)': {
    '↖': { lat: 1.51053, long: 103.82551 },
    '↘': { lat: 1.51011, long: 103.82568 },
  },
  'Block B后侧 - 角落': {
    '↖': { lat: 1.511779, long: 103.82323 },
    '↘': { lat: 1.50905, long: 103.82463 },
  },
  'Block B前侧 - 远': {
    '↖': { lat: 1.511, long: 103.82323 },
    '↘': { lat: 1.50958, long: 103.82427 },
  },
  'Visitor Car Park附近': {
    '↖': { lat: 1.5101, long: 103.82427 },
    '↘': { lat: 1.50965, long: 103.82483 },
  },
  'Block C侧(学校)': {
    '↖': { lat: 1.51147, long: 103.82646 },
    '↘': { lat: 1.51003, long: 103.827109 },
  },
  'Block A前(Lobby)': {
    '↖': { lat: 1.51025, long: 103.82491 },
    '↘': { lat: 1.5101, long: 103.82554 },
  },
  'Permas Ville范围内，详情看地图': {
    '↖': { lat: 1.51178, long: 103.82323 },
    '↘': { lat: 1.50905, long: 103.82711 },
  },
  CIQ: {
    '↖': { lat: 1.46678, long: 103.76176 },
    '↘': { lat: 1.45394, long: 103.76883 },
  },
  SGCP: {
    '↖': { lat: 1.45019, long: 103.76531 },
    '↘': { lat: 1.43785, long: 103.77277 },
  },
  '262 Balestier Rd': {
    '↖': { lat: 1.32273, long: 103.85246 },
    '↘': { lat: 1.32073, long: 103.85399 },
  },
  TSX: {
    '↖': { lat: 1.335082814196172, long: 103.89117121696472 },
    '↘': { lat: 1.3368847686842797, long: 103.89335989952089 },
    priority: 90,
  },
  'Taiseng MRT': {
    '↖': { lat: 1.3355869325491996, long: 103.88839244842531 },
    '↘': { lat: 1.3367131540280786, long: 103.88972282409668 },
    priority: 90,
  },
  'Kranji MRT': {
    '↖': { lat: 1.4245031758745033, long: 103.76083731651308 },
    '↘': { lat: 1.4257902379520224, long: 103.76291871070863 },
    priority: 90,
  },
  'Bishan MRT': {
    '↖': { lat: 1.3495466793404287, long: 103.84768187999725 },
    '↘': { lat: 1.3520350776001764, long: 103.85012269020082 },
    priority: 90,
  },
};

export const LEGACY_SEED_REGIONS = Object.entries(RAW_LEGACY_AREAS).map(
  ([name, box], index) => boxToRegion(name, box, index)
);

export const SEED_REGIONS_APPLIED_KEY = 'landmarkSeedRegionsV1';
