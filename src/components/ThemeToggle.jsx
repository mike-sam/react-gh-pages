import React from 'react';
import { useTheme } from '../context/ThemeContext';

const OPTIONS = [
  { value: 'light', label: '白', title: '淺色' },
  { value: 'dark', label: '黑', title: '深色' },
  { value: 'system', label: '系統', title: '跟隨系統' },
];

function ThemeToggle({ compact = false }) {
  const { preference, setPreference } = useTheme();

  return (
    <div className={`theme-toggle ${compact ? 'theme-toggle-compact' : ''}`} role="group" aria-label="主題">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`theme-toggle-btn ${preference === opt.value ? 'active' : ''}`}
          title={opt.title}
          onClick={() => setPreference(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default ThemeToggle;
