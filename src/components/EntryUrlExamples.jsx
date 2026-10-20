import React, { useEffect, useRef, useState } from 'react';
import { FloatingStackItem } from '../context/FloatingStackContext';
import { hrefFor, ROUTES } from '../utils/routing';

/**
 * Demo / test URLs for expense quick-fill.
 * Intentionally omit silent=true so nothing auto-uploads.
 */
const EXAMPLES = [
  {
    title: '完整帶入（午餐 · Cash）',
    note: '必填齊全，停在記帳頁等你按提交',
    query: {
      cat: '餐饮美食',
      subcat: '午餐',
      amount: '28.50',
      desc: '公司楼下·测试',
      paymentmethod: 'Cash',
      currency: 'MYR',
    },
  },
  {
    title: 'eWallet 精準名（TnG）',
    note: 'paymentmethod 需與選項完全相符',
    query: {
      cat: '交通出行',
      subcat: '打油',
      amount: '80',
      paymentmethod: 'TnG',
      currency: 'MYR',
      desc: 'Setel站测试',
    },
  },
  {
    title: '信用卡後四碼',
    note: '用 4 碼搜尋卡片（依本機快取）',
    query: {
      cat: '日常购物',
      subcat: '超市',
      amount: '56.90',
      paymentmethod: '1234',
      currency: 'MYR',
      desc: '卡号测试·若对不到请手动选',
    },
  },
  {
    title: '外幣 + 座標',
    note: 'currency / latlong 帶入',
    query: {
      cat: '餐饮美食',
      subcat: '饮料',
      amount: '6.50',
      currency: 'SGD',
      paymentmethod: 'Cash',
      latlong: '1.3521,103.8198,Singapore',
      desc: '新加坡测试坐标',
    },
  },
  {
    title: '缺金額（不齊全）',
    note: '只帶 cat/subcat，需手動補金額',
    query: {
      cat: '休闲娱乐',
      subcat: '电影',
      desc: '缺amount测试',
    },
  },
  {
    title: '只有分類',
    note: '最簡帶入，其餘自己選',
    query: {
      cat: '医疗保健',
    },
  },
];

function EntryUrlExamples() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  return (
    <FloatingStackItem id="entry-url-help" order={5}>
      <div
        className="entry-help-wrap"
        ref={wrapRef}
        tabIndex={-1}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
        }}
      >
        {open && (
          <div className="entry-help-panel" role="dialog" aria-label="URL 測試範例">
            <div className="entry-help-panel-head">
              <strong>記帳 URL 測試</strong>
              <span className="entry-help-badge">不上傳 · 無 silent</span>
            </div>
            <p className="entry-help-hint">
              點連結會帶入參數到記帳頁，請自行確認／提交。不會自動送出。
            </p>
            <ul className="entry-help-list">
              {EXAMPLES.map((ex) => {
                const href = hrefFor(ROUTES.EXPENSE, ex.query);
                return (
                  <li key={ex.title} className="entry-help-item">
                    <a className="entry-help-link" href={href} onClick={() => setOpen(false)}>
                      <span className="entry-help-item-title">{ex.title}</span>
                      <span className="entry-help-item-note">{ex.note}</span>
                      <code className="entry-help-item-url">{href}</code>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <button
          type="button"
          className={`entry-help-fab${open ? ' is-open' : ''}`}
          onClick={() => setOpen((v) => !v)}
          title="URL 測試範例"
          aria-expanded={open}
          aria-label="開啟 URL 測試範例"
        >
          {open ? '✕' : '?'}
        </button>
      </div>
    </FloatingStackItem>
  );
}

export default EntryUrlExamples;
