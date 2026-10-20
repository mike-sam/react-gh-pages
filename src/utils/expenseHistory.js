const HISTORY_KEY = 'expenseHistory';
const MAX_ITEMS = 40;

/** @returns {object[]} */
export function loadExpenseHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {object} entry */
export function pushExpenseHistory(entry) {
  const prev = loadExpenseHistory().filter((x) => String(x.id) !== String(entry.id));
  const next = [{ ...entry, savedAt: Date.now() }, ...prev].slice(0, MAX_ITEMS);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearExpenseHistory() {
  localStorage.removeItem(HISTORY_KEY);
}
