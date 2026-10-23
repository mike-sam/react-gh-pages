import React, { useRef, useState } from 'react';
import { compressReceiptFile } from '../utils/aiSuggest';

/** 📷 拍照 / 🖼️ 相冊 → 壓縮後交給記帳表單。AI 建議在照片上另按。 */
function CameraAICapture({ onPhotoReady }) {
  const cameraRef = useRef(null);
  const albumRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');

  const processFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setHint('壓縮中…');
    try {
      const photo = await compressReceiptFile(file);
      onPhotoReady?.(photo);
      const kb = Math.max(1, Math.round((photo.compressedSize || 0) / 1024));
      setHint(`${kb} KB`);
    } catch (err) {
      setHint(err.message || '處理失敗');
    } finally {
      setBusy(false);
      setTimeout(() => setHint(''), 2500);
    }
  };

  const onCameraChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    processFile(file);
  };

  const onAlbumChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    processFile(file);
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
