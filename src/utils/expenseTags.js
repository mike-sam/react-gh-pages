import { useEffect, useState } from 'react';
import { EXPENSE_TAGS, SECONDARY_TAGS } from '../config';

export const EXPENSE_TAG_GROUP = 'Expense';
export const EXPENSE_TAGS_CACHE_KEY = 'expenseTags';
export const EXPENSE_TAGS_CACHE_AT_KEY = 'expenseTagsFetchedAt';
export const EXPENSE_TAGS_TTL_MS = 60 * 60 * 1000;
export const EXPENSE_TAGS_UPDATED_EVENT = 'expenseTagsUpdated';

const META_KEYS = new Set(['cats', 'cat', 'tags', 'tag', 'subcats', 'titles']);

const listeners = new Set();

export function defaultExpenseTagPack() {
  const subcats = {};
  Object.entries(SECONDARY_TAGS || {}).forEach(([k, list]) => {
    subcats[k] = [...(list || [])];
  });
  return { cats: [...EXPENSE_TAGS], subcats };
}

function splitList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v || '').trim()).filter(Boolean);
  }
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return [];
  return text
    .split(/[,，|;；\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function coerceJson(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  const text = String(raw).trim();
  if (!text) return null;
  if (text.charAt(0) !== '{' && text.charAt(0) !== '[') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function applySubcats(subcats, key, list) {
  const name = String(key || '').trim();
  if (!name || !Array.isArray(list)) return;
  subcats[name] = list;
}

/**
 * Overlay KeyValueConfig group=Expense onto config.js defaults.
 * Sheet rows:
 *   Cats   → 主類順序（逗號／換行）
 *   餐饮美食 → 該主類子類
 *   Tags   → 可選 JSON { cats, subcats }
 */
export function mergeExpenseTagOverlay(groupMap, defaults = defaultExpenseTagPack()) {
  const cats = [...(defaults.cats || [])];
  const subcats = {};
  Object.entries(defaults.subcats || {}).forEach(([k, list]) => {
    subcats[k] = [...(list || [])];
  });

  const raw =
    groupMap && typeof groupMap === 'object' && !Array.isArray(groupMap) ? groupMap : {};
  if (Array.isArray(raw.cats) && raw.subcats && typeof raw.subcats === 'object') {
    if (raw.cats.length) {
      cats.splice(0, cats.length, ...raw.cats.map((v) => String(v || '').trim()).filter(Boolean));
    }
    Object.entries(raw.subcats).forEach(([k, v]) => applySubcats(subcats, k, splitList(v)));
    return { cats, subcats };
  }

  const byLower = {};
  Object.entries(raw).forEach(([k, v]) => {
    const key = String(k || '').trim();
    if (!key) return;
    byLower[key.toLowerCase()] = { key, value: v };
  });

  const parsed = coerceJson(byLower.tags?.value);
  if (Array.isArray(parsed) && parsed.length) {
    cats.splice(0, cats.length, ...parsed.map((v) => String(v || '').trim()).filter(Boolean));
  } else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.cats) && parsed.cats.length) {
      cats.splice(
        0,
        cats.length,
        ...parsed.cats.map((v) => String(v || '').trim()).filter(Boolean)
      );
    }
    const subSrc =
      parsed.subcats && typeof parsed.subcats === 'object' ? parsed.subcats : parsed;
    Object.entries(subSrc).forEach(([k, v]) => {
      if (META_KEYS.has(String(k).toLowerCase())) return;
      applySubcats(subcats, k, splitList(v));
    });
  }

  const catsList = splitList(byLower.cats?.value ?? byLower.cat?.value);
  if (catsList.length) {
    cats.splice(0, cats.length, ...catsList);
  }

  Object.entries(raw).forEach(([k, v]) => {
    const key = String(k || '').trim();
    if (!key || META_KEYS.has(key.toLowerCase())) return;
    if (v == null || String(v).trim() === '') return;
    const list = splitList(v);
    applySubcats(subcats, key, list);
    if (!cats.includes(key)) cats.push(key);
  });

  return { cats, subcats };
}

export function subscribeExpenseTags(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyExpenseTags() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
  try {
    window.dispatchEvent(new Event(EXPENSE_TAGS_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export function readExpenseTagsCache({ allowStale = true } = {}) {
  try {
    const raw = localStorage.getItem(EXPENSE_TAGS_CACHE_KEY);
    if (!raw) return null;
    const at = Number(localStorage.getItem(EXPENSE_TAGS_CACHE_AT_KEY) || 0);
    if (!allowStale && at && Date.now() - at >= EXPENSE_TAGS_TTL_MS) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.cats)) return null;
    return {
      cats: parsed.cats.map((v) => String(v || '').trim()).filter(Boolean),
      subcats: parsed.subcats && typeof parsed.subcats === 'object' ? parsed.subcats : {},
    };
  } catch {
    return null;
  }
}

export function writeExpenseTagsCache(pack, at = Date.now()) {
  const next = mergeExpenseTagOverlay(pack, defaultExpenseTagPack());
  try {
    localStorage.setItem(EXPENSE_TAGS_CACHE_KEY, JSON.stringify(next));
    localStorage.setItem(EXPENSE_TAGS_CACHE_AT_KEY, String(at));
  } catch {
    /* ignore quota */
  }
  notifyExpenseTags();
  return next;
}

export function applyExpenseTagsOverlay(groupMap) {
  return writeExpenseTagsCache(mergeExpenseTagOverlay(groupMap));
}

export function getExpenseTagPack() {
  return readExpenseTagsCache({ allowStale: true }) || defaultExpenseTagPack();
}

export function clearExpenseTagsCache() {
  try {
    localStorage.removeItem(EXPENSE_TAGS_CACHE_KEY);
    localStorage.removeItem(EXPENSE_TAGS_CACHE_AT_KEY);
  } catch {
    /* ignore */
  }
  notifyExpenseTags();
}

export function useExpenseTags() {
  const [pack, setPack] = useState(() => getExpenseTagPack());
  useEffect(() => {
    const apply = () => setPack(getExpenseTagPack());
    const unsub = subscribeExpenseTags(apply);
    window.addEventListener(EXPENSE_TAGS_UPDATED_EVENT, apply);
    return () => {
      unsub();
      window.removeEventListener(EXPENSE_TAGS_UPDATED_EVENT, apply);
    };
  }, []);
  return pack;
}
