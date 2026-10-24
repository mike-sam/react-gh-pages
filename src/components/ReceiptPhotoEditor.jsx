import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHistoryOverlay } from '../hooks/useHistoryOverlay';
import {
  FULL_CROP,
  RECEIPT_PRESETS,
  formatReceiptSize,
  formatReceiptSizePair,
  loadReceiptPrefs,
  mapCropForRotate,
  matchReceiptPreset,
  normalizeCrop,
  normalizeRotation,
  orientedReceiptPreview,
  prefsFromPreset,
  renderReceiptPhoto,
  saveReceiptPrefs,
} from '../utils/receiptPhoto';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function RotateIcon({ cw }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      {cw ? (
        <>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 3v5h-5"
          />
        </>
      ) : (
        <>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3v5h5"
          />
        </>
      )}
    </svg>
  );
}

function ExpandIcon({ expanded }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      {expanded ? (
        <>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 3v3a2 2 0 0 1-2 2H3"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8h-3a2 2 0 0 1-2-2V3"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16h3a2 2 0 0 1 2 2v3"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 21v-3a2 2 0 0 1 2-2h3"
          />
        </>
      ) : (
        <>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 3H5a2 2 0 0 0-2 2v3"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8V5a2 2 0 0 0-2-2h-3"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16v3a2 2 0 0 0 2 2h3"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 21h3a2 2 0 0 0 2-2v-3"
          />
        </>
      )}
    </svg>
  );
}

const EDITOR_FS_CSS = `
.receipt-editor-overlay.is-fullscreen {
  z-index: 2500;
  align-items: stretch !important;
  background: var(--bg-elevated, #fff);
}
.receipt-editor-overlay.is-fullscreen .receipt-editor-sheet {
  width: 100%;
  max-height: none;
  height: 100%;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-top: max(12px, env(safe-area-inset-top, 0px));
  padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
}
.receipt-editor-overlay.is-fullscreen .receipt-editor-head,
.receipt-editor-overlay.is-fullscreen .receipt-editor-tabs {
  flex-shrink: 0;
}
.receipt-editor-overlay.is-fullscreen .receipt-crop-stage,
.receipt-editor-overlay.is-fullscreen .receipt-preview-stage {
  flex: 1 1 auto;
  min-height: 0;
  height: 0;
}
.receipt-editor-overlay.is-fullscreen .receipt-crop-frame {
  max-width: 100%;
  max-height: 100%;
}
.receipt-editor-overlay.is-fullscreen .receipt-crop-frame img,
.receipt-editor-overlay.is-fullscreen .receipt-preview-stage img {
  max-width: 100%;
  max-height: calc(100dvh - 17rem);
}
.receipt-editor-overlay.is-fullscreen .receipt-editor-controls {
  flex-shrink: 0;
  max-height: 34vh;
  overflow: auto;
}
.receipt-editor-overlay.is-fullscreen .receipt-editor-hint {
  display: none;
}
`;

function RotateSideButtons({ onLeft, onRight }) {
  const stop = (e) => e.stopPropagation();
  return (
    <>
      <button
        type="button"
        className="receipt-rotate-btn is-left"
        aria-label="左轉"
        onPointerDown={stop}
        onClick={onLeft}
      >
        <RotateIcon />
      </button>
      <button
        type="button"
        className="receipt-rotate-btn is-right"
        aria-label="右轉"
        onPointerDown={stop}
        onClick={onRight}
      >
        <RotateIcon cw />
      </button>
    </>
  );
}

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
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
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
      ev.preventDefault();
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
    window.addEventListener('pointermove', move, { passive: false });
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
  const overlayRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const closeEditor = () => {
    setIsFullscreen(false);
    onClose();
  };

  useHistoryOverlay(true, closeEditor);

  const source = photo?.sourcePreview || photo?.preview;
  const startPrefs = photo?.prefs || loadReceiptPrefs();
  const [crop, setCrop] = useState(() => normalizeCrop(photo?.prefs?.crop || FULL_CROP));
  const [rotation, setRotation] = useState(() => normalizeRotation(photo?.prefs?.rotation));
  const [quality, setQuality] = useState(() => Number(startPrefs.quality) || 0.78);
  const [maxEdge, setMaxEdge] = useState(() => Number(startPrefs.maxEdge) || 1600);
  const [preset, setPreset] = useState(() => startPrefs.preset || matchReceiptPreset(startPrefs));
  const [preview, setPreview] = useState(photo?.preview || source);
  const [viewSrc, setViewSrc] = useState(source);
  const [size, setSize] = useState(photo?.compressedSize || 0);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('crop');
  const latestRef = useRef(photo);
  const stageRef = useRef(null);

  const maxBytes = useMemo(() => {
    const hit = RECEIPT_PRESETS.find((p) => p.id === preset);
    return hit?.maxBytes || startPrefs.maxBytes || 320 * 1024;
  }, [preset, startPrefs.maxBytes]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = prev;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  const toggleFullscreen = () => setIsFullscreen((v) => !v);

  useEffect(() => {
    if (!source) return undefined;
    let alive = true;
    (async () => {
      try {
        const src = await orientedReceiptPreview(source, rotation);
        if (alive) setViewSrc(src || source);
      } catch {
        if (alive) setViewSrc(source);
      }
    })();
    return () => {
      alive = false;
    };
  }, [source, rotation]);

  useEffect(() => {
    if (tab !== 'crop') return undefined;
    const el = stageRef.current;
    if (!el) return undefined;
    const block = (ev) => ev.preventDefault();
    el.addEventListener('touchmove', block, { passive: false });
    el.addEventListener('gesturestart', block, { passive: false });
    return () => {
      el.removeEventListener('touchmove', block);
      el.removeEventListener('gesturestart', block);
    };
  }, [tab]);

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
          rotation,
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
  }, [source, crop, rotation, quality, maxEdge, maxBytes, preset, photo.filename, photo.originalSize, photo.sourceSize]);

  const rotateBy = (delta) => {
    setCrop((c) => mapCropForRotate(c, delta));
    setRotation((r) => normalizeRotation(r + delta));
  };

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
    <div
      ref={overlayRef}
      className={`receipt-editor-overlay${isFullscreen ? ' is-fullscreen' : ''}`}
      style={
        isFullscreen
          ? { alignItems: 'stretch', background: 'var(--bg-elevated, #fff)', zIndex: 2500 }
          : undefined
      }
      role="dialog"
      aria-modal="true"
      aria-label="調整照片"
    >
      <style>{EDITOR_FS_CSS}</style>
      <div
        className="receipt-editor-sheet"
        style={
          isFullscreen
            ? {
                width: '100%',
                maxHeight: 'none',
                height: '100%',
                borderRadius: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }
            : undefined
        }
      >
        <div className="receipt-editor-head">
          <strong>調整照片</strong>
          <span className="receipt-editor-size">
            {busy
              ? `壓縮中…${
                  photo?.originalSize ? ` · 原圖 ${formatReceiptSize(photo.originalSize)}` : ''
                }`
              : `約 ${formatReceiptSizePair(size, photo?.originalSize || photo?.sourceSize)}`}
          </span>
          <button type="button" className="receipt-editor-text" onClick={closeEditor}>
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
          <button
            type="button"
            className={`receipt-editor-fs${isFullscreen ? ' is-on' : ''}`}
            onClick={toggleFullscreen}
            aria-pressed={isFullscreen}
            title={isFullscreen ? '退出全螢幕' : '全螢幕'}
            aria-label={isFullscreen ? '退出全螢幕' : '全螢幕'}
          >
            <ExpandIcon expanded={isFullscreen} />
          </button>
        </div>

        {tab === 'crop' ? (
          <div
            className="receipt-crop-stage"
            ref={stageRef}
            style={isFullscreen ? { flex: '1 1 auto', minHeight: 0, height: 0 } : undefined}
          >
            <RotateSideButtons onLeft={() => rotateBy(-90)} onRight={() => rotateBy(90)} />
            <div className="receipt-crop-frame">
              <img
                src={viewSrc || source}
                alt="裁切"
                draggable={false}
                style={isFullscreen ? { maxWidth: '100%', maxHeight: 'calc(100dvh - 17rem)' } : undefined}
              />
              <CropBox crop={crop} onChange={setCrop} />
            </div>
          </div>
        ) : (
          <div
            className="receipt-preview-stage"
            style={isFullscreen ? { flex: '1 1 auto', minHeight: 0, height: 0 } : undefined}
          >
            <RotateSideButtons onLeft={() => rotateBy(-90)} onRight={() => rotateBy(90)} />
            <img
              src={preview}
              alt="壓縮預覽"
              style={isFullscreen ? { maxWidth: '100%', maxHeight: 'calc(100dvh - 17rem)' } : undefined}
            />
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
            左右旋轉、先裁掉多餘邊，再看壓縮預覽。套用後才寫進送出檔，送出前可再改。
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ReceiptPhotoEditor;
