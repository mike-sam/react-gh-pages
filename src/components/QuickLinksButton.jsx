import React, { useEffect, useRef, useState } from 'react';
import { GOOGLE_LINKS } from '../config';
import { FloatingStackItem } from '../context/FloatingStackContext';

/** Quick links FAB — sits in floating stack (bottom-right, order 0). */
const QuickLinksButton = () => {
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
    <FloatingStackItem id="quick-links" order={0}>
      <div
        className="quick-links-fab-wrap"
        ref={wrapRef}
        tabIndex={-1}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) closeMenu();
        }}
      >
        {showMenu && (
          <div className="quick-links-menu">
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
        <button
          type="button"
          className={`quick-links-fab${showMenu ? ' is-open' : ''}`}
          onClick={() => setShowMenu((v) => !v)}
          title="快速链接"
          aria-expanded={showMenu}
        >
          {showMenu ? '✕' : '🔗'}
        </button>
      </div>
    </FloatingStackItem>
  );
};

export default QuickLinksButton;
