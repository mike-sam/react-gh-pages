import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'uiTheme'; // 'light' | 'dark' | 'system'
const ThemeContext = createContext(null);

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveTheme(preference) {
  return preference === 'system' ? getSystemTheme() : preference;
}

function applyThemeAttr(resolved) {
  document.documentElement.setAttribute('data-theme', resolved);
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch {
      /* ignore */
    }
    return 'system';
  });

  const [resolved, setResolved] = useState(() => resolveTheme(
    (() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
      } catch {
        /* ignore */
      }
      return 'system';
    })()
  ));

  useEffect(() => {
    const next = resolveTheme(preference);
    setResolved(next);
    applyThemeAttr(next);
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      const next = resolveTheme('system');
      setResolved(next);
      applyThemeAttr(next);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, [preference]);

  const setPreference = useCallback((next) => {
    if (next !== 'light' && next !== 'dark' && next !== 'system') return;
    localStorage.setItem(STORAGE_KEY, next);
    setPreferenceState(next);
  }, []);

  const value = useMemo(
    () => ({
      preference,
      resolved,
      setPreference,
      isDark: resolved === 'dark',
    }),
    [preference, resolved, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export default ThemeContext;
