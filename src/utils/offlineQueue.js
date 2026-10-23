const QUEUE_KEY = 'offlineSyncQueue';

/**
 * @typedef {{ id: number|string, action: string, payload: object, enqueuedAt: number }} QueueItem
 */

/** @returns {QueueItem[]} */
export function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {QueueItem[]} items */
export function saveQueue(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

/** @param {QueueItem} item */
export function enqueueItem(item) {
  const q = loadQueue().filter((x) => String(x.id) !== String(item.id));
  q.push(item);
  saveQueue(q);
  return q;
}

export function removeFromQueue(id) {
  const q = loadQueue().filter((x) => String(x.id) !== String(id));
  saveQueue(q);
  return q;
}

export function queueLength() {
  return loadQueue().length;
}

const UNCONFIRMED_KEY = 'offlineSyncUnconfirmed';

/** Opaque (no-cors) POSTs look successful even when GAS rejected the hash. */
export function loadUnconfirmed() {
  try {
    const raw = localStorage.getItem(UNCONFIRMED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUnconfirmed(items) {
  try {
    localStorage.setItem(UNCONFIRMED_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function rememberUnconfirmed(item) {
  if (!item || item.id == null) return loadUnconfirmed();
  const q = loadUnconfirmed().filter((x) => String(x.id) !== String(item.id));
  q.push(item);
  if (q.length > 40) q.splice(0, q.length - 40);
  saveUnconfirmed(q);
  return q;
}

export function clearUnconfirmed() {
  try {
    localStorage.removeItem(UNCONFIRMED_KEY);
  } catch {
    /* ignore */
  }
}

export function restoreUnconfirmedToQueue() {
  const items = loadUnconfirmed();
  items.forEach((item) => enqueueItem(item));
  clearUnconfirmed();
  return items.length;
}

export function pendingWriteCount() {
  const seen = new Set();
  loadQueue().forEach((x) => seen.add(String(x.id)));
  loadUnconfirmed().forEach((x) => seen.add(String(x.id)));
  return seen.size;
}
