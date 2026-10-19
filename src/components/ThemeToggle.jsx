import React from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Sun / moon only. Initial theme follows system once on first load (in ThemeProvider).
 */
function ThemeToggle({ compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle-icon ${compact ? 'theme-toggle-icon-compact' : ''}`}
      onClick={toggleTheme}
      title={isDark ? '深色 · 點擊切換淺色' : '淺色 · 點擊切換深色'}
      aria-label={isDark ? '深色模式' : '淺色模式'}
    >
      <span className="theme-toggle-glyph" aria-hidden="true">
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  );
}

export default ThemeToggle;
