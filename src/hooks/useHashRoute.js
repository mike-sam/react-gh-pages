import { useEffect, useState } from 'react';
import { getHashPath } from '../utils/routing';

export function useHashRoute() {
  const [path, setPath] = useState(() => getHashPath());

  useEffect(() => {
    const sync = () => setPath(getHashPath());
    // Ensure default hash on first load so deep links stay consistent
    if (!window.location.hash) {
      window.location.replace(`${window.location.pathname}${window.location.search}#/`);
    }
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  return path;
}
