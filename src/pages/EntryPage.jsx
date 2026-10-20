import React from 'react';
import HeaderActions from '../components/HeaderActions';
import { forceReload } from '../utils/forceReload';
import { hrefFor, ROUTES } from '../utils/routing';
import '../App.css';

const ACTIONS = [
  {
    path: ROUTES.EXPENSE,
    icon: '🧾',
    title: '記帳',
    desc: '支援 URL 帶入；silent=true 時 2s 送出／3s 內可點取消',
    direct: '#/expense',
  },
  {
    path: ROUTES.CALENDAR,
    icon: '📅',
    title: '行事曆軌跡',
    desc: '記錄行程 / 追加日誌（iOS Shortcuts 或 Apps Script）',
    direct: '#/calendar',
  },
  {
    path: ROUTES.PARKING,
    icon: '🚗',
    title: '記車位 / 找車',
    desc: '儲存停車座標與一鍵導航',
    direct: '#/parking',
  },
];

function EntryPage() {
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
        <h1 className="entry-hero-title">要做什麼？</h1>
        <p className="entry-hero-sub">選一項開始。也可直接用專屬網址開啟單一功能。</p>
      </div>

      <div className="entry-action-grid">
        {ACTIONS.map((action) => (
          <a key={action.path} className="entry-action-card" href={hrefFor(action.path)}>
            <div className="entry-action-icon">{action.icon}</div>
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
