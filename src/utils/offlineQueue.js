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
