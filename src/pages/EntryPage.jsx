import React from 'react';
import HeaderActions from '../components/HeaderActions';
import EntryUrlExamples from '../components/EntryUrlExamples';
import SelfmanageMark from '../brand/SelfmanageMark';
import { forceReload } from '../utils/forceReload';
import { hrefFor, ROUTES } from '../utils/routing';
import '../App.css';

const ACTIONS = [
  {
    path: ROUTES.EXPENSE,
    icon: '🧾',
    title: '記帳',
    desc: '單筆或排程入帳。URL 參數見內頁 ?',
    direct: '#/expense',
  },
  {
    path: ROUTES.CALENDAR,
    icon: '📅',
    title: '行事曆軌跡',
    desc: '記錄行程軌跡。URL 參數見內頁 ?',
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
        <div className="entry-brand">
          <SelfmanageMark size={44} className="entry-brand-mark" />
          <div>
            <p className="entry-brand-name">Self-Manage Tools</p>
            <p className="entry-brand-aka">自理工具</p>
          </div>
        </div>
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

      <EntryUrlExamples />
    </div>
  );
}

export default EntryPage;
