import React, { useState } from 'react';
import HeaderActions from '../components/HeaderActions';
import EntryUrlExamples from '../components/EntryUrlExamples';
import SelfmanageMark from '../brand/SelfmanageMark';
import EatWhatModal from '../components/EatWhatModal';
import { forceReload } from '../utils/forceReload';
import { hrefFor, ROUTES } from '../utils/routing';
import '../App.css';

const ACTIONS = [
  {
    path: ROUTES.EXPENSE,
    icon: '🧾',
    title: '記帳',
    desc: '單筆、排程、報表。URL 參數見內頁 ?',
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
    path: ROUTES.VEHICLES,
    icon: '🚗',
    title: '車輛',
    desc: '地圖上看全部車輛，記位置與保養記帳。URL 參數見內頁 ?',
    direct: '#/vehicles',
  },
  {
    path: ROUTES.REGIONS,
    icon: '🗺️',
    title: '地圖管理',
    desc: '區域與地標，定位時自動帶入',
    direct: '#/regions',
  },
];

function EntryPage() {
  const [eatOpen, setEatOpen] = useState(false);
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
        {ACTIONS.slice(0, 1).map((action) => (
          <a key={action.path} className="entry-action-card" href={hrefFor(action.path)}>
            <div className="entry-action-icon">{action.icon}</div>
            <div className="entry-action-body">
              <div className="entry-action-title">{action.title}</div>
              <div className="entry-action-desc">{action.desc}</div>
              <code className="entry-action-url">{action.direct}</code>
            </div>
          </a>
        ))}
        <a className="entry-action-card" href={hrefFor(ROUTES.PHOTO)}>
          <div className="entry-action-icon">📷</div>
          <div className="entry-action-body">
            <div className="entry-action-title">拍照記錄</div>
            <div className="entry-action-desc">拍照後可記錄到 Telegram，或帶去記帳。</div>
            <code className="entry-action-url">#/photo</code>
          </div>
        </a>
        <button type="button" className="entry-action-card" onClick={() => setEatOpen(true)}>
          <div className="entry-action-icon">🍜</div>
          <div className="entry-action-body">
            <div className="entry-action-title">吃什麼</div>
            <div className="entry-action-desc">附近過去一年吃過的，轉一下。不進報表。</div>
          </div>
        </button>
        {ACTIONS.slice(1).map((action) => (
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
      {eatOpen ? <EatWhatModal open onClose={() => setEatOpen(false)} /> : null}
    </div>
  );
}

export default EntryPage;
