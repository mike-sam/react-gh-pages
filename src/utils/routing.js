/**
 * Lightweight hash routing for GitHub Pages.
 * Examples: #/  #/expense  #/calendar  #/vehicles  #/parking  #/regions
 *
 * In-app Back returns to 主頁 (tool pages are not stacked).
 */

export const ROUTES = {
  HOME: '/',
  EXPENSE: '/expense',
  CALENDAR: '/calendar',
  PARKING: '/parking',
  VEHICLES: '/vehicles',
  REGIONS: '/regions',
  OBLIGATIONS: '/obligations',
};

export const BACK_MODES = { HOME: 'home', HISTORY: 'history' };

export function loadBackMode() {
  return BACK_MODES.HOME;
}

export function parseHashPath(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  const pathOnly = (raw.split('?')[0] || '/').trim();
  if (!pathOnly) return '/';
  return pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
}

export function getHashPath() {
  return parseHashPath(window.location.hash);
}

function fireHashChange() {
  try {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch {
    window.dispatchEvent(new Event('hashchange'));
  }
}

const DEFAULT_LEAVE_MSG = '尚有未送出的內容，確定要離開嗎？未送出的輸入將會遺失。';

let dirtyGuard = null;
let leaveConfirmed = false;

/**
 * Register an unsaved-changes guard from a page. Pass null on unmount.
 * `{ isDirty, message, stayPath, stayHash }`
 */
export function setDirtyGuard(guard) {
  dirtyGuard = guard;
  if (!guard) leaveConfirmed = false;
}

export function confirmLeaveIfDirty() {
  if (leaveConfirmed) return true;
  if (!dirtyGuard?.isDirty?.()) return true;
  const ok = window.confirm(dirtyGuard.message || DEFAULT_LEAVE_MSG);
  if (ok) leaveConfirmed = true;
  return ok;
}

function dirtyStayPath() {
  return dirtyGuard?.stayPath || null;
}

/** Keep the dirty page mounted while Back is confirmed / restored. */
export function shouldHoldRouteSync() {
  if (leaveConfirmed) return false;
  if (!dirtyGuard?.isDirty?.()) return false;
  const stay = dirtyStayPath();
  return Boolean(stay && getHashPath() !== stay);
}

export function isOnDirtyStayPath() {
  const stay = dirtyStayPath();
  return Boolean(stay && getHashPath() === stay);
}

/** After a hardware Back already left the page: confirm, or restore. */
export function restoreIfDirtyPop() {
  const stayPath = dirtyStayPath();
  if (!stayPath || getHashPath() === stayPath) return false;
  if (confirmLeaveIfDirty()) return false;
  window.history.forward();
  return true;
}

/** Push or replace the hash without relying on location.hash (which always pushes). */
export function applyHash(hash, { replace = false, state = null, skipGuard = false } = {}) {
  const normalized = hash.startsWith('#')
    ? hash
    : `#${hash.startsWith('/') ? hash : `/${hash}`}`;
  const nextPath = parseHashPath(normalized);
  if (!skipGuard && getHashPath() !== nextPath && !confirmLeaveIfDirty()) return false;
  const url = `${window.location.pathname}${window.location.search}${normalized}`;
  const sameUrl =
    `${window.location.pathname}${window.location.search}${window.location.hash}` === url;
  if (sameUrl && !replace) return true;
  if (replace) window.history.replaceState(state, '', url);
  else window.history.pushState(state, '', url);
  fireHashChange();
  return true;
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

const overlayStack = [];
let ignoreOverlayPop = 0;

function currentUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function prevHistoryState() {
  const s = window.history.state;
  return s && typeof s === 'object' ? { ...s } : {};
}

/** Close overlay UIs without popping history (e.g. 主頁 click). */
export function clearHistoryOverlays() {
  const pending = overlayStack.splice(0);
  pending.forEach((entry) => {
    entry.alive = false;
    try {
      entry.onPopClose();
    } catch {
      /* ignore */
    }
  });
}

/**
 * Trap one Back press for an open overlay. Same URL, dummy history entry.
 * Cleanup (UI close) pops that entry; hardware Back consumes it and calls onPopClose.
 */
export function bindHistoryOverlay(onPopClose) {
  const entry = { onPopClose, alive: true };
  overlayStack.push(entry);
  window.history.pushState(
    { ...prevHistoryState(), overlay: overlayStack.length },
    '',
    currentUrl()
  );

  return () => {
    if (!entry.alive) return;
    entry.alive = false;
    const idx = overlayStack.lastIndexOf(entry);
    if (idx >= 0) overlayStack.splice(idx, 1);
    if (window.history.state?.overlay) {
      ignoreOverlayPop += 1;
      window.history.back();
    }
  };
}

/** @returns {boolean} true if this popstate was an overlay dismiss */
export function consumeOverlayPop() {
  if (ignoreOverlayPop > 0) {
    ignoreOverlayPop -= 1;
    return true;
  }
  const entry = overlayStack.pop();
  if (!entry) return false;
  entry.alive = false;
  try {
    entry.onPopClose();
  } catch {
    /* ignore */
  }
  return true;
}

export function goHomeFromTool() {
  if (!confirmLeaveIfDirty()) return;
  const hadOverlay = Boolean(window.history.state?.overlay);
  clearHistoryOverlays();
  if (hadOverlay) {
    applyHash('#/', { replace: true, skipGuard: true });
    return;
  }
  if (loadBackMode() === BACK_MODES.HOME && window.history.state?.fromHome) {
    window.history.back();
    return;
  }
  applyHash('#/', { replace: true, skipGuard: true });
}

export function navigate(path, { replace, query } = {}) {
  const href = hrefFor(path, query);
  const nextPath = parseHashPath(href);
  const from = getHashPath();
  if (from === nextPath && !query) {
    if (replace) applyHash(href, { replace: true, state: window.history.state });
    return;
  }

  if (loadBackMode() !== BACK_MODES.HOME) {
    applyHash(href, { replace: Boolean(replace) });
    return;
  }

  if (nextPath === ROUTES.HOME && from !== ROUTES.HOME) {
    goHomeFromTool();
    return;
  }

  const leavingHome = from === ROUTES.HOME && nextPath !== ROUTES.HOME;
  applyHash(href, {
    replace: replace ?? !leavingHome,
    state: leavingHome || window.history.state?.fromHome ? { fromHome: true } : null,
  });
}
