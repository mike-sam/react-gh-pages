import React, { useEffect, useRef, useState } from 'react';
import { GOOGLE_LINKS } from '../config';

/** Sheets / photos shortcuts — sits in the header, right of the theme toggle. */
const QuickLinksButton = ({ compact = false }) => {
  const [showMenu, setShowMenu] = useState(false);
  const wrapRef = useRef(null);

  const closeMenu = () => setShowMenu(false);

  useEffect(() => {
    if (!showMenu) return undefined;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [showMenu]);

  const handleOpenSheets = () => {
    window.open(GOOGLE_LINKS.SHEETS_URL, '_blank');
    closeMenu();
  };

  const handleOpenPhotosFolder = () => {
    const searchUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(
      GOOGLE_LINKS.PHOTOS_FOLDER_NAME
    )}`;
    window.open(searchUrl, '_blank');
    closeMenu();
  };

  return (
    <div
      className="quick-links-header-wrap"
      ref={wrapRef}
      tabIndex={-1}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) closeMenu();
      }}
    >
      <button
        type="button"
        className={[
          'quick-links-header-btn',
          compact ? 'quick-links-header-btn-compact' : '',
          showMenu ? 'is-open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => setShowMenu((v) => !v)}
        title="快速链接"
        aria-label="快速链接"
        aria-expanded={showMenu}
      >
        {showMenu ? '✕' : '🔗'}
      </button>
      {showMenu && (
        <div className="quick-links-menu" role="menu">
          <button type="button" className="quick-links-menu-item" onClick={handleOpenSheets}>
            <span>📊</span>
            <span>Google Sheets</span>
          </button>
          <button
            type="button"
            className="quick-links-menu-item"
            onClick={handleOpenPhotosFolder}
          >
            <span>📁</span>
            <span>照片文件夹</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default QuickLinksButton;
