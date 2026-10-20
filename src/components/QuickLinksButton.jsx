import React, { useState } from 'react';
import { GOOGLE_LINKS } from '../config';
import { FloatingStackItem } from '../context/FloatingStackContext';

/** Quick links FAB — sits in floating stack (bottom-right, order 0). */
const QuickLinksButton = () => {
  const [showMenu, setShowMenu] = useState(false);

  const handleOpenSheets = () => {
    window.open(GOOGLE_LINKS.SHEETS_URL, '_blank');
    setShowMenu(false);
  };

  const handleOpenPhotosFolder = () => {
    const searchUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(
      GOOGLE_LINKS.PHOTOS_FOLDER_NAME
    )}`;
    window.open(searchUrl, '_blank');
    setShowMenu(false);
  };

  return (
    <FloatingStackItem id="quick-links" order={0}>
      <div className="quick-links-fab-wrap">
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
        >
          {showMenu ? '✕' : '🔗'}
        </button>
      </div>
    </FloatingStackItem>
  );
};

export default QuickLinksButton;
