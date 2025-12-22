import React, { useState } from 'react';
import { GOOGLE_LINKS } from '../config';

const QuickLinksButton = () => {
  const [showMenu, setShowMenu] = useState(false);

  const handleOpenSheets = () => {
    window.open(GOOGLE_LINKS.SHEETS_URL, '_blank');
    setShowMenu(false);
  };

  const handleOpenPhotosFolder = () => {
    // 由于我们只有文件夹名称，需要通过搜索来打开
    // 或者可以提供一个固定的文件夹ID（如果知道的话）
    // 这里使用一个通用的Drive搜索URL
    const searchUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(GOOGLE_LINKS.PHOTOS_FOLDER_NAME)}`;
    window.open(searchUrl, '_blank');
    setShowMenu(false);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000
    }}>
      {showMenu && (
        <div style={{
          position: 'absolute',
          bottom: '60px',
          right: '0',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          padding: '8px 0',
          minWidth: '180px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <button
            onClick={handleOpenSheets}
            style={{
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: '18px' }}>📊</span>
            <span>Google Sheets</span>
          </button>
          <button
            onClick={handleOpenPhotosFolder}
            style={{
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: '18px' }}>📁</span>
            <span>照片文件夹</span>
          </button>
        </div>
      )}
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: showMenu ? '#4CAF50' : '#2196F3',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          color: 'white',
          transition: 'all 0.3s',
          zIndex: 1001
        }}
        title="快速链接"
      >
        {showMenu ? '✕' : '🔗'}
      </button>
    </div>
  );
};

export default QuickLinksButton;

