import React, { useEffect, useRef, useState } from 'react';
import { FloatingStackItem } from '../context/FloatingStackContext';
import HelpParamTable from './HelpParamTable';
import {
  VEHICLE_URL_PARAMS,
  buildVehiclePageUrl,
  vehicleUrlExamples,
} from '../utils/vehicleShare';

function VehicleUrlExamples({ liveUrl }) {
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

  const copyHref = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied('');
    }
  };

  return (
    <FloatingStackItem id="vehicle-url-help" order={5}>
      <div
        className="entry-help-wrap"
        ref={wrapRef}
        tabIndex={-1}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
        }}
      >
        {open && (
          <div className="entry-help-panel entry-help-panel--wide" role="dialog" aria-label="車輛 URL 說明">
            <div className="entry-help-panel-head">
              <strong>車輛 URL</strong>
              <span className="entry-help-badge">#/vehicles</span>
            </div>
            <p className="entry-help-hint">
              silent 會自動儲存；帶 send 則接著 WhatsApp。無 silent 只帶入，需自己按儲存。
            </p>

            <h3 className="entry-help-section">參數</h3>
            <HelpParamTable rows={VEHICLE_URL_PARAMS} />

            {liveUrl ? (
              <>
                <h3 className="entry-help-section">目前車輛</h3>
                <div className="calendar-url-item">
                  <div className="calendar-url-item-head">
                    <strong>帶入目前座標</strong>
                    <button type="button" className="calendar-url-copy" onClick={() => copyHref('live', liveUrl)}>
                      {copied === 'live' ? '已複製' : '複製'}
                    </button>
                  </div>
                  <code className="calendar-url-code">{liveUrl}</code>
                </div>
              </>
            ) : null}

            <h3 className="entry-help-section">範例</h3>
            <ul className="entry-help-list">
              {vehicleUrlExamples().map((ex) => {
                const href = buildVehiclePageUrl(ex.query);
                return (
                  <li key={ex.title} className="entry-help-item">
                    {ex.silent ? (
                      <div className="entry-help-link">
                        <div className="calendar-url-item-head">
                          <span className="entry-help-item-title">{ex.title}</span>
                          <button
                            type="button"
                            className="calendar-url-copy"
                            onClick={() => copyHref(ex.title, href)}
                          >
                            {copied === ex.title ? '已複製' : '複製'}
                          </button>
                        </div>
                        <span className="entry-help-item-note">{ex.note}</span>
                        <code className="entry-help-item-url">{href}</code>
                      </div>
                    ) : (
                      <a className="entry-help-link" href={href} onClick={() => setOpen(false)}>
                        <span className="entry-help-item-title">{ex.title}</span>
                        <span className="entry-help-item-note">{ex.note}</span>
                        <code className="entry-help-item-url">{href}</code>
                      </a>
                    )}
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
          aria-label="開啟車輛 URL 說明"
        >
          {open ? '✕' : '?'}
        </button>
      </div>
    </FloatingStackItem>
  );
}

export default VehicleUrlExamples;
