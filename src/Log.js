import React from 'react';

function formatAgo(ts) {
  if (!ts) return '';
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return '剛剛';
  if (sec < 3600) return `${Math.floor(sec / 60)} 分前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小時前`;
  return `${Math.floor(sec / 86400)} 天前`;
}

/**
 * Clickable expense history — tap a row to refill the form for edit.
 */
function Log({ log = [], onSelect, onClear }) {
  if (!log.length) {
    return (
      <div className="expense-history">
        <div className="expense-history-head">
          <span className="expense-history-title">最近紀錄</span>
        </div>
        <p className="expense-history-empty">提交後會出現在這裡，點一下可回填編輯</p>
      </div>
    );
  }

  return (
    <div className="expense-history">
      <div className="expense-history-head">
        <span className="expense-history-title">最近紀錄</span>
        {onClear && (
          <button type="button" className="expense-history-clear" onClick={onClear}>
            清除列表
          </button>
        )}
      </div>
      <ul className="expense-history-list">
        {log.map((entry) => (
          <li key={String(entry.id)}>
            <button
              type="button"
              className="expense-history-item"
              onClick={() => onSelect?.(entry)}
            >
              <div className="expense-history-row">
                <span className="expense-history-amount">
                  {entry.currency || 'MYR'} {entry.amount}
                </span>
                <span className="expense-history-ago">{formatAgo(entry.savedAt)}</span>
              </div>
              <div className="expense-history-meta">
                <span className="expense-history-tag">{entry.tag}</span>
                <span className="expense-history-title-text">{entry.title}</span>
              </div>
              {(entry.remark || entry.payment_method) && (
                <div className="expense-history-sub">
                  {[entry.payment_method, entry.remark].filter(Boolean).join(' · ')}
                </div>
              )}
              <span className="expense-history-hint">點擊回填編輯</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Log;
