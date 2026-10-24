import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHistoryOverlay } from '../hooks/useHistoryOverlay';
import {
  FULL_CROP,
  RECEIPT_PRESETS,
  formatReceiptSize,
  formatReceiptSizePair,
  loadReceiptPrefs,
  matchReceiptPreset,
  normalizeCrop,
  prefsFromPreset,
  renderReceiptPhoto,
  saveReceiptPrefs,
} from '../utils/receiptPhoto';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function CropBox({ crop, onChange }) {
  const box = normalizeCrop(crop);
  const drag = useRef(null);
  const wrapRef = useRef(null);
  const boxRef = useRef(box);
  boxRef.current = box;

  const onPointerDown = (kind) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    drag.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...boxRef.current },
      pw: Math.max(1, rect.width),
      ph: Math.max(1, rect.height),
    };
    const move = (ev) => {
      const d = drag.current;
      if (!d) return;
      const dx = (ev.clientX - d.startX) / d.pw;
      const dy = (ev.clientY - d.startY) / d.ph;
      const o = d.origin;
      const next = { ...o };
      if (d.kind === 'move') {
        next.x = o.x + dx;
        next.y = o.y + dy;
      } else {
        if (d.kind.includes('w')) {
          next.x = o.x + dx;
          next.w = o.w - dx;
        }
        if (d.kind.includes('e')) next.w = o.w + dx;
        if (d.kind.includes('n')) {
          next.y = o.y + dy;
          next.h = o.h - dy;
        }
        if (d.kind.includes('s')) next.h = o.h + dy;
      }
      onChange(normalizeCrop(next));
    };
    const end = () => {
      drag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  return (
    <div ref={wrapRef} className="receipt-crop-layer">
      <div
        className="receipt-crop-box"
        style={{
          left: `${box.x * 100}%`,
          top: `${box.y * 100}%`,
          width: `${box.w * 100}%`,
          height: `${box.h * 100}%`,
        }}
        onPointerDown={onPointerDown('move')}
      >
        {HANDLES.map((h) => (
          <span
            key={h}
            className={`receipt-crop-handle is-${h}`}
            onPointerDown={onPointerDown(h)}
          />
        ))}
      </div>
    </div>
  );
}

function ReceiptPhotoEditor({ photo, onApply, onClose }) {
  useHistoryOverlay(true, onClose);
  const source = photo?.sourcePreview || photo?.preview;
  const startPrefs = photo?.prefs || loadReceiptPrefs();
  const [crop, setCrop] = useState(() => normalizeCrop(photo?.prefs?.crop || FULL_CROP));
  const [quality, setQuality] = useState(() => Number(startPrefs.quality) || 0.78);
  const [maxEdge, setMaxEdge] = useState(() => Number(startPrefs.maxEdge) || 1600);
  const [preset, setPreset] = useState(() => startPrefs.preset || matchReceiptPreset(startPrefs));
  const [preview, setPreview] = useState(photo?.preview || source);
  const [size, setSize] = useState(photo?.compressedSize || 0);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('crop');
  const latestRef = useRef(photo);

  const maxBytes = useMemo(() => {
    const hit = RECEIPT_PRESETS.find((p) => p.id === preset);
    return hit?.maxBytes || startPrefs.maxBytes || 320 * 1024;
  }, [preset, startPrefs.maxBytes]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (!source) return undefined;
    let alive = true;
    setBusy(true);
    const t = window.setTimeout(async () => {
      try {
        const out = await renderReceiptPhoto({
          sourcePreview: source,
          filename: photo.filename,
          originalSize: photo.originalSize,
          sourceSize: photo.sourceSize,
          crop,
          quality,
          maxEdge,
          maxBytes,
          preset,
        });
        if (!alive) return;
        latestRef.current = out;
        setPreview(out.preview);
        setSize(out.compressedSize);
      } catch (err) {
        console.warn(err);
      } finally {
        if (alive) setBusy(false);
      }
    }, 220);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [source, crop, quality, maxEdge, maxBytes, preset, photo.filename, photo.originalSize, photo.sourceSize]);

  const pickPreset = (id) => {
    const next = prefsFromPreset(id);
    setPreset(next.preset);
    setQuality(next.quality);
    setMaxEdge(next.maxEdge);
  };

  const apply = () => {
    const out = latestRef.current;
    if (!out) return;
    saveReceiptPrefs({
      preset,
      quality,
      maxEdge,
      maxBytes,
    });
    onApply(out);
  };

  if (!source) return null;

  return createPortal(
    <div className="receipt-editor-overlay" role="dialog" aria-modal="true" aria-label="調整照片">
      <div className="receipt-editor-sheet">
        <div className="receipt-editor-head">
          <strong>調整照片</strong>
          <span className="receipt-editor-size">
            {busy
              ? `壓縮中…${
                  photo?.originalSize ? ` · 原圖 ${formatReceiptSize(photo.originalSize)}` : ''
                }`
              : `約 ${formatReceiptSizePair(size, photo?.originalSize || photo?.sourceSize)}`}
          </span>
          <button type="button" className="receipt-editor-text" onClick={onClose}>
            取消
          </button>
          <button type="button" className="receipt-editor-apply" disabled={busy} onClick={apply}>
            套用
          </button>
        </div>

        <div className="receipt-editor-tabs" role="tablist" aria-label="照片檢視">
          <button
            type="button"
            className={tab === 'crop' ? 'is-on' : ''}
            onClick={() => setTab('crop')}
          >
            裁切
          </button>
          <button
            type="button"
            className={tab === 'preview' ? 'is-on' : ''}
            onClick={() => setTab('preview')}
          >
            壓縮預覽
          </button>
        </div>

        {tab === 'crop' ? (
          <div className="receipt-crop-stage">
            <div className="receipt-crop-frame">
              <img src={source} alt="裁切" draggable={false} />
              <CropBox crop={crop} onChange={setCrop} />
            </div>
          </div>
        ) : (
          <div className="receipt-preview-stage">
            <img src={preview} alt="壓縮預覽" />
          </div>
        )}

        <div className="receipt-editor-controls">
          <div className="receipt-editor-presets">
            {RECEIPT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={preset === p.id ? 'is-on' : ''}
                onClick={() => pickPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
            <button type="button" className="receipt-editor-text" onClick={() => setCrop(FULL_CROP)}>
              重設裁切
            </button>
          </div>
          <label className="receipt-editor-slider">
            <span>畫質 {Math.round(quality * 100)}%</span>
            <input
              type="range"
              min="50"
              max="92"
              value={Math.round(quality * 100)}
              onChange={(e) => {
                setPreset('custom');
                setQuality(Number(e.target.value) / 100);
              }}
            />
          </label>
          <label className="receipt-editor-slider">
            <span>長邊 {maxEdge} px</span>
            <input
              type="range"
              min="800"
              max="2000"
              step="40"
              value={maxEdge}
              onChange={(e) => {
                setPreset('custom');
                setMaxEdge(Number(e.target.value));
              }}
            />
          </label>
          <p className="receipt-editor-hint">
            先裁掉多餘邊，再看壓縮預覽是否還能讀。套用後才寫進送出檔，送出前可再改。
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ReceiptPhotoEditor;
