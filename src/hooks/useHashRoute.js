import { useEffect, useState } from 'react';
import {
  applyHash,
  BACK_MODES,
  consumeOverlayPop,
  getHashPath,
  goHomeFromTool,
  loadBackMode,
  parseHashPath,
  isOnDirtyStayPath,
  restoreIfDirtyPop,
  takeHomeCollapse,
  ROUTES,
  shouldHoldRouteSync,
} from '../utils/routing';

export function useHashRoute() {
  const [path, setPath] = useState(() => getHashPath());

  useEffect(() => {
    const sync = () => {
      if (shouldHoldRouteSync()) return;
      setPath(getHashPath());
    };
    // Ensure default hash on first load so deep links stay consistent
    if (!window.location.hash) {
      window.location.replace(`${window.location.pathname}${window.location.search}#/`);
    }

    const onHashClick = (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.('a[href^="#"]');
      if (!a || a.getAttribute('target') === '_blank' || a.hasAttribute('download')) return;
      if (loadBackMode() !== BACK_MODES.HOME) return;
      const href = a.getAttribute('href');
      if (!href || href === '#') return;

      e.preventDefault();
      const nextPath = parseHashPath(href);
      const from = getHashPath();
      if (nextPath === ROUTES.HOME && from !== ROUTES.HOME) {
        goHomeFromTool();
        return;
      }
      const leavingHome = from === ROUTES.HOME && nextPath !== ROUTES.HOME;
      applyHash(href, {
        replace: !leavingHome,
        state: leavingHome || window.history.state?.fromHome ? { fromHome: true } : null,
      });
    };

    const onPop = () => {
      if (consumeOverlayPop()) {
        takeHomeCollapse();
        return;
      }
      if (restoreIfDirtyPop()) {
        takeHomeCollapse();
        return;
      }
      const forceHome = takeHomeCollapse();
      if (loadBackMode() !== BACK_MODES.HOME) return;
      if (getHashPath() === ROUTES.HOME) return;
      if (isOnDirtyStayPath()) return;
      if (!forceHome && getHashPath() === ROUTES.PHOTO) return;
      applyHash('#/', { replace: true });
    };

    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', onPop);
    document.addEventListener('click', onHashClick);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('click', onHashClick);
    };
  }, []);

  return path;
}
