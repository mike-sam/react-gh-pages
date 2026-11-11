import React, { useRef, useState } from 'react';
import { compressReceiptFile, formatReceiptSizePair, TELEGRAM_COMPRESS } from '../utils/receiptPhoto';

/** 📷 拍照 / 🖼️ 相冊 → 先做成可再裁切／調壓縮的工作圖。 */
function CameraAICapture({ onPhotoReady, lighter }) {
  const cameraRef = useRef(null);
  const albumRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');

  const processFile = async (file, { openEditor = true } = {}) => {
    if (!file) return;
    setBusy(true);
    setHint('處理中…');
    try {
      const photo = await compressReceiptFile(file, lighter ? TELEGRAM_COMPRESS : undefined);
      onPhotoReady?.(photo, { openEditor });
      setHint(`${formatReceiptSizePair(photo.compressedSize, photo.originalSize)} · 可再裁切`);
    } catch (err) {
      setHint(err.message || '處理失敗');
    } finally {
      setBusy(false);
      setTimeout(() => setHint(''), 2800);
    }
  };

  const onCameraChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    processFile(file, { openEditor: true });
  };

  const onAlbumChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const openEditor = files.length <= 1;
    for (let i = 0; i < files.length; i += 1) {
      await processFile(files[i], { openEditor });
    }
  };

  return (
    <div className="camera-ai-capture">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onCameraChange}
      />
      <input
        ref={albumRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onAlbumChange}
      />
      <button
        type="button"
        className="camera-ai-btn"
        disabled={busy}
        onClick={() => cameraRef.current?.click()}
      >
        {busy ? '處理中…' : '📷 拍照'}
      </button>
      <button
        type="button"
        className="camera-ai-btn"
        disabled={busy}
        onClick={() => albumRef.current?.click()}
      >
        {busy ? '處理中…' : '🖼️ 相冊'}
      </button>
      {hint && <span className="camera-ai-hint">{hint}</span>}
    </div>
  );
}

export default CameraAICapture;
