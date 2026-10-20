/**
 * Lightweight hash routing for GitHub Pages.
 * Examples: #/  #/expense  #/calendar  #/parking
 */

export const ROUTES = {
  HOME: '/',
  EXPENSE: '/expense',
  CALENDAR: '/calendar',
  PARKING: '/parking',
};

export function getHashPath() {
  const raw = (window.location.hash || '').replace(/^#/, '');
  const pathOnly = (raw.split('?')[0] || '/').trim();
  if (!pathOnly || pathOnly === '') return '/';
  return pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
}

export function navigate(path) {
  const next = path.startsWith('/') ? path : `/${path}`;
  if (getHashPath() === next) return;
  window.location.hash = next;
}

export function hrefFor(path, query) {
  const next = path.startsWith('/') ? path : `/${path}`;
  if (!query || typeof query !== 'object') return `#${next}`;
  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v == null || v === '') return;
    qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `#${next}?${s}` : `#${next}`;
}
