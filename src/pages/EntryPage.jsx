import React, { useState } from 'react';
import HeaderActions from '../components/HeaderActions';
import SelfmanageMark from '../brand/SelfmanageMark';
import { forceReload } from '../utils/forceReload';
import { hrefFor } from '../utils/routing';
import { HOME_TOOLS } from '../components/HomeQuickAccess';
import '../App.css';

const HOME_VIEW_KEY = 'entryHomeView';

function loadHomeView() {
  try {
    const saved = localStorage.getItem(HOME_VIEW_KEY);
    if (saved === 'list' || saved === 'icons') return saved;
  } catch {
    /* private mode */
  }
  return 'icons';
}

function EntryPage() {
  const [view, setViewState] = useState(loadHomeView);
  const icons = view === 'icons';

  const setView = (next) => {
    setViewState(next);
    try {
      localStorage.setItem(HOME_VIEW_KEY, next);
    } catch {
      /* private mode */
    }
  };

  const handleForceReload = async () => {
    if (!window.confirm('將清空快取、註銷 Service Worker 並強制拉取最新版本，確定？')) {
      return;
    }
    await forceReload();
  };

  return (
    <div className="app-container entry-page">
      <div className="entry-top-bar">
        <HeaderActions />
      </div>

      <div className="entry-hero">
        <div className="entry-brand">
          <SelfmanageMark size={44} className="entry-brand-mark" />
          <div>
            <p className="entry-brand-name">Self-Manage Tools</p>
            <p className="entry-brand-aka">自理工具</p>
          </div>
        </div>
        <div className="entry-hero-foot">
          <h1 className="entry-hero-title">要做什麼？</h1>
          <div className="mode-toggle entry-view-toggle" role="tablist" aria-label="主頁排列">
            <button
              type="button"
              role="tab"
              aria-selected={!icons}
              className={icons ? '' : 'is-on'}
              onClick={() => setView('list')}
            >
              列表
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={icons}
              className={icons ? 'is-on' : ''}
              onClick={() => setView('icons')}
            >
              圖示
            </button>
          </div>
        </div>
        <p className="entry-hero-sub">選一項開始。也可直接用專屬網址開啟單一功能。</p>
      </div>

      <div className={`entry-action-grid${icons ? ' is-icons' : ''}`}>
        {HOME_TOOLS.map((action) => (
          <a
            key={action.id}
            className={`entry-action-card${icons ? ' is-icon' : ''}`}
            href={hrefFor(action.path)}
          >
            <div className="entry-action-icon" aria-hidden="true">{action.icon}</div>
            <div className="entry-action-body">
              <div className="entry-action-title">{action.title}</div>
              <div className="entry-action-desc">{action.desc}</div>
              <code className="entry-action-url">{action.direct}</code>
            </div>
          </a>
        ))}
      </div>

      <div className="entry-tools">
        <button type="button" className="entry-tool-btn" onClick={handleForceReload}>
          🔄 強制更新
        </button>
        <a
          className="entry-tool-btn entry-tool-link"
          href="https://docs.google.com/spreadsheets/d/1ZAFWV5aIVcA66qJEMPGGsg3azPY415_Clwe--JinQ7w/edit"
          target="_blank"
          rel="noopener noreferrer"
        >
          📊 Sheets
        </a>
      </div>
    </div>
  );
}

export default EntryPage;
