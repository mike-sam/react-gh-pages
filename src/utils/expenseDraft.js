import { getMergedQueryParams } from './expenseQuickUrl';

export const EXPENSE_DRAFT_KEY = 'expenseFormDraft';
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_JSON_CHARS = 4_500_000;

const INCOMING_KEYS = [
  'cat',
  'subcat',
  'amount',
  'desc',
  'txt',
  'tag',
  'remark',
  'paymentmethod',
  'payment',
  'silent',
  'start',
  'end',
  'timestamp',
  'latlong',
  'currency',
  'carPlate',
  'plate',
];

function parseItemizedLines(text) {
  const lines = String(text || '').split('\n');
  const items = [];
  lines.forEach((line) => {
    const match = line.match(/^(.+?):\s*(\d*\.?\d*)\s*×\s*(\d*\.?\d*)\s*=\s*(\d*\.?\d*)$/);
    if (!match) return;
    items.push({
      name: match[1],
      unitPrice: parseFloat(match[2]) || 0,
      quantity: parseFloat(match[3]) || 0,
      subtotal: parseFloat(match[4]) || 0,
    });
  });
  return items;
}

export function incomingOverridesExpenseDraft() {
  try {
    if (sessionStorage.getItem('expensePostData')) return true;
    const params = getMergedQueryParams();
    return INCOMING_KEYS.some((k) => String(params.get(k) || '').trim());
  } catch {
    return false;
  }
}

export function isExpenseDraftWorthSaving(d) {
  if (!d || typeof d !== 'object') return false;
  const amt = String(d.amount || '').trim();
  const hasAmount = amt !== '' && amt !== '0' && amt !== '0.00';
  return Boolean(
    d.selectedTag ||
      String(d.input || '').trim() ||
      hasAmount ||
      String(d.remark || '').trim() ||
      String(d.simpleDescription || '').trim() ||
      String(d.carPlate || '').trim() ||
      String(d.mileage || '').trim() ||
      (Array.isArray(d.photos) && d.photos.length) ||
      (Array.isArray(d.taxAddons) && d.taxAddons.length) ||
      d.editingId != null ||
      d.eventStart ||
      d.eventEnd
  );
}

function toIso(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

export function asDraftDate(value, fallback = null) {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/** Snapshot of the in-progress 記帳 form (local only). */
export function snapshotExpenseDraft(form) {
  const remark = String(form.remark || '');
  const parsed = parseItemizedLines(remark);
  return {
    selectedTag: form.selectedTag || '',
    input: form.input || '',
    remark,
    simpleDescription: form.simpleDescription || '',
    amount: form.amount || '',
    currency: form.currency || 'MYR',
    paymentMethod: form.paymentMethod || '',
    carPlate: form.carPlate || '',
    mileage: form.mileage || '',
    tripInfo: form.tripInfo || '',
    fuelPrice: form.fuelPrice || '',
    fuelType: form.fuelType || '',
    taxAddons: Array.isArray(form.taxAddons) ? form.taxAddons : [],
    photos: Array.isArray(form.photos) ? form.photos : [],
    itemizedItems: parsed,
    isAmountManuallySet: Boolean(form.isAmountManuallySet),
    editingId: form.editingId ?? null,
    calendarEventId: form.calendarEventId || '',
    selectedDateTime: toIso(form.selectedDateTime),
    eventStart: toIso(form.eventStart),
    eventEnd: toIso(form.eventEnd),
  };
}

function photoForDraft(photo) {
  if (!photo || typeof photo !== 'object') return photo;
  const next = { ...photo };
  delete next.sourcePreview;
  delete next.preview;
  return next;
}

/** Draft stores base64 only. Rebuild the thumbnail the page can show. */
export function hydrateDraftPhotos(list) {
  if (!Array.isArray(list)) return [];
  return list.map((photo) => {
    if (!photo || typeof photo !== 'object') return photo;
    if (photo.preview) return photo;
    if (photo.base64) {
      const type = photo.type || 'image/jpeg';
      return { ...photo, preview: `data:${type};base64,${photo.base64}` };
    }
    if (photo.uploadedUrl) return { ...photo, preview: photo.uploadedUrl };
    return photo;
  });
}

export function loadExpenseDraft() {
  try {
    const raw = localStorage.getItem(EXPENSE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const at = Number(parsed.savedAt) || 0;
    if (at && Date.now() - at > DRAFT_TTL_MS) {
      localStorage.removeItem(EXPENSE_DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Boot-time draft, skipped when URL / Shortcuts already fill the form. */
export function loadBootExpenseDraft() {
  if (incomingOverridesExpenseDraft()) return null;
  const d = loadExpenseDraft();
  if (!d || !isExpenseDraftWorthSaving(d)) return null;
  return d;
}

export function clearExpenseDraft() {
  try {
    localStorage.removeItem(EXPENSE_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function saveExpenseDraft(form) {
  const snap = snapshotExpenseDraft(form);
  snap.photos = (snap.photos || []).map(photoForDraft);
  if (!isExpenseDraftWorthSaving(snap)) {
    clearExpenseDraft();
    return false;
  }
  const write = (photos) => {
    try {
      const rec = { v: 1, savedAt: Date.now(), ...snap, photos };
      const json = JSON.stringify(rec);
      if (json.length > MAX_JSON_CHARS) return false;
      localStorage.setItem(EXPENSE_DRAFT_KEY, json);
      return true;
    } catch {
      return false;
    }
  };
  if (write(snap.photos)) return true;
  let batch = snap.photos.slice();
  while (batch.length > 1) {
    batch = batch.slice(0, -1);
    if (write(batch)) return true;
  }
  if (batch.length === 1 && write(batch)) return true;
  return false;
}
