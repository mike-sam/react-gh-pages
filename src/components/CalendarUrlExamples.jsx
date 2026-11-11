import React, { useEffect, useRef, useState } from 'react';
import { FloatingStackItem } from '../context/FloatingStackContext';
import {
  CALENDAR_TRACK_PARAMS,
  buildCalendarTrackUrl,
  calendarTrackUrlExamples,
} from '../utils/calendarTrackUrl';
import HelpParamTable from './HelpParamTable';
import { prettyUrl } from '../utils/routing';

function CalendarUrlExamples({ liveUrl }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const copyText = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied('');
    }
  };

  return (
    <FloatingStackItem id="calendar-url-help" order={5}>
      <div
        className="entry-help-wrap"
        ref={wrapRef}
        tabIndex={-1}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
        }}
      >
        {open && (
          <div className="entry-help-panel entry-help-panel--wide" role="dialog" aria-label="行事曆 URL 說明">
            <div className="entry-help-panel-head">
              <strong>行事曆 GAS URL</strong>
              <span className="entry-help-badge">Get Contents · 勿 Open</span>
            </div>
            <p className="entry-help-hint">
              後台自動化打下面的 GAS 網址，用 Get Contents of URL（GET，Follow Redirects 打開）。不要 Open URL，也不要打這個網站：Get Contents 不會跑網頁。開頁面自己按按鈕那條路不變。
            </p>

            <h3 className="entry-help-section">參數</h3>
            <HelpParamTable rows={CALENDAR_TRACK_PARAMS} />

            <h3 className="entry-help-section">範例（複製，不要開瀏覽器）</h3>
            {liveUrl ? (
              <div className="calendar-url-item">
                <div className="calendar-url-item-head">
                  <strong>目前表單（append 預覽）</strong>
                  <button type="button" className="calendar-url-copy" onClick={() => copyText('live', liveUrl)}>
                    {copied === 'live' ? '已複製' : '複製'}
                  </button>
                </div>
                <code className="calendar-url-code">{prettyUrl(liveUrl)}</code>
              </div>
            ) : null}
            <ul className="entry-help-list">
              {calendarTrackUrlExamples().map((ex) => {
                const href = buildCalendarTrackUrl(ex.params);
                return (
                  <li key={ex.title} className="entry-help-item">
                    <div className="entry-help-link">
                      <div className="calendar-url-item-head">
                        <span className="entry-help-item-title">{ex.title}</span>
                        <button type="button" className="calendar-url-copy" onClick={() => copyText(ex.title, href)}>
                          {copied === ex.title ? '已複製' : '複製'}
                        </button>
                      </div>
                      <span className="entry-help-item-note">{ex.note}</span>
                      <code className="entry-help-item-url">{prettyUrl(href)}</code>
                    </div>
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
          title="URL 參數與範例"
          aria-expanded={open}
          aria-label="開啟行事曆 URL 說明"
        >
          {open ? '✕' : '?'}
        </button>
      </div>
    </FloatingStackItem>
  );
}

export default CalendarUrlExamples;
