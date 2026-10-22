import { API_ENDPOINTS } from '../config';
import {
  buildObligationSchedule,
  previewInstallmentAmount,
  roundMoney,
  todayISO,
} from './obligationSchedule';

export const OBLIGATIONS_KEY = 'obligations';
export const OBLIGATION_FETCH_AT_KEY = 'obligationsFetchedAt';
export const OBLIGATION_FETCH_TTL_MS = 60 * 60 * 1000;

export function newObligationId() {
  return `ob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function parseJsonField(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function normalizeInstallment(raw, obligationId) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const dueDate = String(raw.dueDate || raw.due_date || '').slice(0, 10);
  if (!id || !dueDate) return null;
  return {
    id,
    obligationId: String(raw.obligationId || raw.obligation_id || obligationId || '').trim(),
    seq: Number(raw.seq) || 0,
    dueDate,
    amount: roundMoney(raw.amount),
    principalPortion: roundMoney(raw.principalPortion ?? raw.principal),
    interestPortion: roundMoney(raw.interestPortion ?? raw.interest),
    status: ['pending', 'posted', 'skipped'].includes(raw.status) ? raw.status : 'pending',
    postedRecordId: String(raw.postedRecordId || raw.record_id || ''),
    note: String(raw.note || ''),
    kind: raw.kind === 'extra' ? 'extra' : 'regular',
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

export function normalizeObligation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const extra = parseJsonField(raw.json || raw.extra);
  const merged = { ...extra, ...raw };
  const name = String(merged.name || '').trim();
  if (!name) return null;
  const id = String(merged.id || '').trim() || newObligationId();
  const kind = ['loan', 'recurring', 'oneoff'].includes(merged.kind) ? merged.kind : 'loan';
  const direction = merged.direction === 'receivable' ? 'receivable' : 'payable';
  const status = ['active', 'paused', 'closed'].includes(merged.status) ? merged.status : 'active';
  const startDate = String(merged.startDate || merged.start || todayISO()).slice(0, 10);
  const endDate = merged.endDate || merged.end
    ? String(merged.endDate || merged.end).slice(0, 10)
    : '';
  const principal = roundMoney(merged.principal);
  const remainingRaw = merged.remainingPrincipal ?? merged.remaining;
  const schedule = Array.isArray(merged.schedule)
    ? merged.schedule.map((row) => normalizeInstallment(row, id)).filter(Boolean)
    : [];
  return {
    id,
    kind,
    direction,
    name,
    tag: String(merged.tag || '').trim(),
    title: String(merged.title || '').trim() || name,
    principal,
    remainingPrincipal: remainingRaw == null ? principal : roundMoney(remainingRaw),
    interestMethod: ['none', 'reducing_balance', 'flat', 'custom_pmt'].includes(merged.interestMethod)
      ? merged.interestMethod
      : 'none',
    annualRate: Number(merged.annualRate ?? merged.rate) || 0,
    termMonths: Math.max(1, Number(merged.termMonths ?? merged.term) || 1),
    installmentAmount: roundMoney(merged.installmentAmount ?? merged.pmt),
    startDate,
    endDate,
    dueDay: Number(merged.dueDay ?? merged.due_day) || Number(startDate.split('-')[2]) || 1,
    currency: String(merged.currency || 'MYR').trim() || 'MYR',
    paymentMethod: String(merged.paymentMethod || merged.payment_method || '').trim(),
    note: String(merged.note || ''),
    status,
    updatedAt: Number(merged.updatedAt) || Date.now(),
    source: merged.source || 'local',
    schedule,
  };
}

function loadBundle() {
  try {
    const raw = localStorage.getItem(OBLIGATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeObligation).filter(Boolean);
  } catch {
    return [];
  }
}

function saveBundle(list) {
  const cleaned = (Array.isArray(list) ? list : []).map(normalizeObligation).filter(Boolean);
  localStorage.setItem(OBLIGATIONS_KEY, JSON.stringify(cleaned));
  return cleaned;
}

export function loadObligations() {
  return loadBundle();
}

export function saveObligations(list) {
  return saveBundle(list);
}

export function upsertObligationLocal(ob, { rebuildSchedule = true } = {}) {
  const next = normalizeObligation(ob);
  if (!next) return null;
  if (rebuildSchedule) {
    next.schedule = buildObligationSchedule(next, next.schedule);
    if (!next.installmentAmount) {
      next.installmentAmount = previewInstallmentAmount(next);
    }
  }
  next.updatedAt = Date.now();
  const all = loadBundle();
  const idx = all.findIndex((row) => row.id === next.id);
  if (idx >= 0) all[idx] = { ...all[idx], ...next, schedule: next.schedule };
  else all.push(next);
  saveBundle(all);
  return next;
}

export function deleteObligationLocal(id) {
  if (!id) return;
  saveBundle(loadBundle().filter((row) => row.id !== id));
}

export function patchInstallmentLocal(obligationId, installmentId, patch) {
  const all = loadBundle();
  const idx = all.findIndex((row) => row.id === obligationId);
  if (idx < 0) return null;
  const ob = all[idx];
  ob.schedule = (ob.schedule || []).map((row) =>
    row.id === installmentId ? normalizeInstallment({ ...row, ...patch, updatedAt: Date.now() }, ob.id) : row
  );
  ob.updatedAt = Date.now();
  saveBundle(all);
  return ob;
}

export function markObligationsFetched(at = Date.now()) {
  localStorage.setItem(OBLIGATION_FETCH_AT_KEY, String(at));
}

export function isObligationFetchFresh(ttlMs = OBLIGATION_FETCH_TTL_MS) {
  const at = Number(localStorage.getItem(OBLIGATION_FETCH_AT_KEY) || 0);
  if (!at) return false;
  return Date.now() - at < ttlMs;
}

export function mergeObligationsFromCloud(cloud) {
  const local = loadBundle();
  const byId = new Map(local.map((row) => [row.id, row]));
  (cloud || []).forEach((raw) => {
    const next = normalizeObligation({ ...raw, source: 'cloud' });
    if (!next) return;
    const prev = byId.get(next.id);
    if (!prev || (next.updatedAt || 0) >= (prev.updatedAt || 0)) {
      byId.set(next.id, next);
    }
  });
  const merged = Array.from(byId.values());
  saveBundle(merged);
  markObligationsFetched();
  return merged;
}

function endpoint() {
  return API_ENDPOINTS.GSHEET_SUBMIT || API_ENDPOINTS.LOCATION;
}

export function obligationUpsertPayload(ob) {
  return toRemoteObligation(ob);
}

export function obligationDeletePayload(id) {
  return { action: 'deleteObligation', id };
}

export function installmentUpsertPayload(obligationId, installment) {
  const row = normalizeInstallment(installment, obligationId);
  if (!row) return null;
  return { action: 'upsertObligationInstallment', ...row };
}

function toRemoteObligation(ob) {
  const body = normalizeObligation(ob);
  if (!body) return null;
  return {
    action: 'upsertObligation',
    id: body.id,
    kind: body.kind,
    direction: body.direction,
    name: body.name,
    tag: body.tag,
    title: body.title,
    principal: body.principal,
    remainingPrincipal: body.remainingPrincipal,
    interestMethod: body.interestMethod,
    annualRate: body.annualRate,
    termMonths: body.termMonths,
    installmentAmount: body.installmentAmount,
    startDate: body.startDate,
    endDate: body.endDate,
    dueDay: body.dueDay,
    currency: body.currency,
    paymentMethod: body.paymentMethod,
    note: body.note,
    status: body.status,
    updatedAt: body.updatedAt,
    schedule: body.schedule,
  };
}

export async function fetchObligationsFromCloud() {
  const url = `${endpoint()}?action=listObligations`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.success) throw new Error(data?.error || 'listObligations failed');
  return (data.obligations || []).map((row) => normalizeObligation({ ...row, source: 'cloud' })).filter(Boolean);
}

export async function upsertObligationRemote(ob) {
  const body = toRemoteObligation(ob);
  if (!body) throw new Error('Invalid obligation');
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  try {
    const data = await res.json();
    if (data && data.success === false) throw new Error(data.error || 'upsert failed');
    return data;
  } catch (err) {
    if (err instanceof SyntaxError) return { success: true, opaque: true };
    throw err;
  }
}

export async function deleteObligationRemote(id) {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'deleteObligation', id }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  try {
    const data = await res.json();
    if (data && data.success === false) throw new Error(data.error || 'delete failed');
    return data;
  } catch (err) {
    if (err instanceof SyntaxError) return { success: true, opaque: true };
    throw err;
  }
}

export async function upsertInstallmentRemote(obligationId, installment) {
  const row = normalizeInstallment(installment, obligationId);
  if (!row) throw new Error('Invalid installment');
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'upsertObligationInstallment',
      ...row,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  try {
    const data = await res.json();
    if (data && data.success === false) throw new Error(data.error || 'upsert installment failed');
    return data;
  } catch (err) {
    if (err instanceof SyntaxError) return { success: true, opaque: true };
    throw err;
  }
}
