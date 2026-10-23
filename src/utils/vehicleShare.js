import { SHORTCUTS } from '../config';
import { copyText, openWhatsAppShare } from './platform';
import { getMergedQueryParams, parseLatLong } from './expenseQuickUrl';
import { formatRfc2822 } from './expenseSummary';
import { getHashPath, hrefFor, ROUTES } from './routing';

const VEHICLE_QUICK_KEYS = [
  'carPlate',
  'plate',
  'silent',
  'send',
  'whatsapp',
  'copy',
  'clipboard',
  'latlong',
  'latlng',
];

function isVehicleRoute() {
  const path = getHashPath();
  return path === ROUTES.VEHICLES || path === ROUTES.PARKING;
}

export function buildVehiclePageUrl(query = {}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mike-sam.github.io';
  const path =
    typeof window !== 'undefined'
      ? window.location.pathname.replace(/\/index\.html$/i, '').replace(/\/$/, '')
      : '/react-gh-pages';
  return `${origin}${path}/${hrefFor(ROUTES.VEHICLES, query)}`;
}

export function latlongValue(lat, lng, label = '') {
  const coord = `${lat},${lng}`;
  const name = String(label || '').trim();
  return name ? `${coord},${name}` : coord;
}

export function formatVehicleShareText({ plate, lat, lng, label, updatedAt } = {}) {
  const when = formatRfc2822(updatedAt ? new Date(updatedAt) : new Date());
  const lines = [];
  if (when) {
    lines.push(`[${when}]`, '');
  }
  if (plate) lines.push(`🚗 ${plate}`);
  const place = String(label || '').trim();
  if (place) lines.push(`park在${place}`);
  if (typeof lat === 'number' && typeof lng === 'number') {
    lines.push(`地图：https://maps.google.com/maps?q=${lat},${lng}`);
  }
  const query = {};
  if (plate) query.plate = plate;
  if (typeof lat === 'number' && typeof lng === 'number') {
    query.latlong = latlongValue(lat, lng, place);
  }
  lines.push('', '---auto generated---', buildVehiclePageUrl(query));
  return lines.join('\n');
}

export async function copyVehicleShare(payload) {
  const text = formatVehicleShareText(payload);
  if (!text) return false;
  return copyText(text);
}

export function sendVehicleWhatsApp(payload) {
  const text = formatVehicleShareText(payload);
  if (!text) return;
  openWhatsAppShare(text, SHORTCUTS.WHATSAPP_RECORD_CAR);
}

export function parseVehicleQuickDraft() {
  const p = getMergedQueryParams();
  const plate = String(p.get('carPlate') || p.get('plate') || '')
    .trim()
    .toUpperCase();
  const silent = /^(1|true|yes)$/i.test(String(p.get('silent') || '').trim());
  const send = /^(1|true|yes|whatsapp)$/i.test(
    String(p.get('send') || p.get('whatsapp') || '').trim()
  );
  const copy = /^(1|true|yes|clipboard)$/i.test(
    String(p.get('copy') || p.get('clipboard') || '').trim()
  );
  const latlong = parseLatLong(p.get('latlong') || p.get('latlng') || '');
  return {
    plate: plate || '',
    silent,
    send,
    copy,
    latlong,
  };
}

let pendingQuick = null;

/**
 * Consume hash/search params. Empty URL still returns a pending draft
 * so StrictMode remount can apply after the query was already stripped.
 */
export function takeVehicleQuickDraft() {
  if (!isVehicleRoute()) return null;
  const q = parseVehicleQuickDraft();
  const empty = !q.plate && !q.silent && !q.send && !q.copy && !q.latlong;
  if (!empty) {
    pendingQuick = q;
    clearVehicleQuickQuery();
  }
  return pendingQuick;
}

export function consumeVehicleQuickDraft() {
  const q = pendingQuick;
  pendingQuick = null;
  return q;
}

export function clearVehicleQuickQuery() {
  if (typeof window === 'undefined' || !isVehicleRoute()) return;
  const path = getHashPath() || ROUTES.VEHICLES;
  const hash = window.location.hash || '';
  const qIndex = hash.indexOf('?');
  let nextHash = `#${path}`;
  if (qIndex >= 0) {
    const params = new URLSearchParams(hash.slice(qIndex + 1));
    VEHICLE_QUICK_KEYS.forEach((k) => params.delete(k));
    const qs = params.toString();
    nextHash = qs ? `#${path}?${qs}` : `#${path}`;
  }
  const search = new URLSearchParams(window.location.search || '');
  VEHICLE_QUICK_KEYS.forEach((k) => search.delete(k));
  const qs = search.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${nextHash}`;
  const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== cur) window.history.replaceState(window.history.state, '', next);
}

export const VEHICLE_URL_PARAMS = [
  { name: 'plate', required: 'optional', example: 'PPQ8777', note: '車牌。別名 carPlate' },
  { name: 'latlong', required: 'optional', example: '1.511,103.825', note: '座標，可加 ,名稱' },
  { name: 'silent', required: 'optional', example: 'true', note: '有車牌則自動儲存（無座標則定位）' },
  { name: 'send', required: 'optional', example: 'true', note: '儲存後 WhatsApp。別名 whatsapp' },
  { name: 'copy', required: 'optional', example: 'true', note: '儲存後複製。別名 clipboard' },
];

export function vehicleUrlExamples() {
  return [
    {
      title: '帶入車牌',
      note: '選好車輛，不自動儲存',
      query: { plate: 'PPQ8777' },
      silent: false,
    },
    {
      title: '車牌 + 座標',
      note: '帶入位置，確認後再儲存',
      query: { plate: 'PPQ8777', latlong: '1.51126,103.82512' },
      silent: false,
    },
    {
      title: 'silent 記錄',
      note: '自動儲存；會寫入位置',
      query: { plate: 'PPQ8777', latlong: '1.51126,103.82512', silent: 'true' },
      silent: true,
    },
    {
      title: 'silent + WhatsApp',
      note: '記錄後發訊息',
      query: { plate: 'PPQ8777', silent: 'true', send: 'true' },
      silent: true,
    },
  ];
}
