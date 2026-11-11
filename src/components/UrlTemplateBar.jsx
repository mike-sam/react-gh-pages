import React, { useState } from 'react';
import { prettyUrl } from '../utils/routing';
import { copyText } from '../utils/platform';

/** Shows a readable URL. Copy uses the encoded one, including access. */
export default function UrlTemplateBar({ pageUrl, gasUrl, pageNote, gasNote }) {
  const [which, setWhich] = useState('page');
  const [copied, setCopied] = useState(false);
  const encoded = which === 'gas' ? gasUrl : pageUrl;
  if (!encoded) return null;

  return (
    <div className="url-template">
      <div className="url-template-head">
        <span className="entry-field-label">複製</span>
        <span className="entry-chip-row">
          <button
            type="button"
            className={`entry-chip${which === 'page' ? ' active' : ''}`}
            onClick={() => setWhich('page')}
          >
            頁面
          </button>
          <button
            type="button"
            className={`entry-chip${which === 'gas' ? ' active' : ''}`}
            onClick={() => setWhich('gas')}
          >
            GAS
          </button>
        </span>
        <button
          type="button"
          className="calendar-url-copy"
          onClick={async () => {
            const ok = await copyText(encoded);
            setCopied(ok);
          }}
        >
          {copied ? '已複製' : '複製'}
        </button>
      </div>
      <p className="calendar-lookback-caption">{which === 'gas' ? gasNote : pageNote}</p>
      <code className="entry-help-item-url">{prettyUrl(encoded)}</code>
    </div>
  );
}
