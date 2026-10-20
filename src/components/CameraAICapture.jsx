import React, { useRef, useState } from 'react';
import { useOfflineQueue } from '../context/QueueContext';

/**
 * 📷 拍照（相機）+ 🖼️ 相冊 → Base64 → GAS analyzeReceipt。
 * 不依賴本機 OCR 函式庫。
 */
function CameraAICapture({ onExtracted, onPhotoReady }) {
  const cameraRef = useRef(null);
  const albumRef = useRef(null);
  const { enqueueAndSend } = useOfflineQueue();
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve({ preview: result, base64 });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const processFile = async (file) => {
    if (!file) return;

    setBusy(true);
    setHint('處理照片中…');
    try {
      const { preview, base64 } = await fileToBase64(file);
      onPhotoReady?.({
        preview,
        base64,
        filename: file.name,
        originalSize: file.size,
        type: file.type,
      });

      const id = Date.now();
      await enqueueAndSend({
        id,
        action: 'analyzeReceipt',
        photo: base64,
        mimeType: file.type || 'image/jpeg',
      });

      setHint('已送出辨識（後端 AI）');
      onExtracted?.({ raw: true });
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
