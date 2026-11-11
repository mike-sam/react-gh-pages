import React, { useEffect, useMemo, useRef, useState } from 'react';
import CameraAICapture from './CameraAICapture';
import { useSmartLocation } from '../hooks/useSmartLocation';
import { API_ENDPOINTS } from '../config';
import { hydrateDraftPhotos, loadExpenseDraft, saveExpenseDraft } from '../utils/expenseDraft';
import { applyHash, hrefFor, ROUTES } from '../utils/routing';
import {
  analyzeLifePhoto,
  DEFAULT_LIFE_PROMPT_TEMPLATE,
  lifePhotoPrompt,
  lifePromptVars,
  loadLifePromptTemplate,
  promptParts,
  saveLifePromptTemplate,
  sendTelegramPhotos,
} from '../utils/aiSuggest';

function draftPhotos(list) {
  return (list || []).map((photo) => {
    const next = { ...photo };
    delete next.sourcePreview;
    if (next.uploadedUrl) delete next.base64;
    return next;
  });
}

const NOTICE_KEY = 'lifePhotoNotice';
const RECORD_KEY = 'lifePhotoRecord';

function openExpense(caption, photos, notice, record) {
  const prev = loadExpenseDraft() || {};
  const saved = saveExpenseDraft({
    ...prev,
    simpleDescription: caption || prev.simpleDescription || '',
    photos: draftPhotos(photos),
    selectedDateTime: prev.selectedDateTime || new Date(),
  });
  if (!saved) return false;
  try {
    if (notice) sessionStorage.setItem(NOTICE_KEY, notice);
    else sessionStorage.removeItem(NOTICE_KEY);
    sessionStorage.setItem(RECORD_KEY, record ? '1' : '0');
  } catch {
    /* ignore */
  }
  applyHash(hrefFor(ROUTES.EXPENSE), { state: { fromHome: true } });
  return true;
}

/** 首頁拍照。有圖才出現記錄／記賬。勾記賬才進入記帳頁。 */
function writeSharedPhotos(list) {
  const prev = loadExpenseDraft() || {};
  saveExpenseDraft({
    ...prev,
    photos: list,
    simpleDescription: prev.simpleDescription || '',
    selectedDateTime: prev.selectedDateTime || new Date(),
  });
}

function LifePhotoPanel() {
  const { location } = useSmartLocation();
  const [photos, setPhotos] = useState(() => hydrateDraftPhotos(loadExpenseDraft()?.photos));
  const [logToTelegram, setLogToTelegram] = useState(() => {
    try {
      return sessionStorage.getItem(RECORD_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const photosReady = useRef(false);
  const [keepExpense, setKeepExpense] = useState(false);
  const [lifeMode, setLifeMode] = useState('album');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [ready, setReady] = useState(null);
  const [kg, setKg] = useState(65);
  const [lifeTpl, setLifeTpl] = useState(() => loadLifePromptTemplate());
  const [promptView, setPromptView] = useState('preview');
  const [promptPending, setPromptPending] = useState(false);
  const promptRef = useRef(null);

  useEffect(() => {
    if (!photosReady.current) {
      photosReady.current = true;
      return undefined;
    }
    writeSharedPhotos(photos);
    return undefined;
  }, [photos]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const url = new URL(API_ENDPOINTS.KEY_VALUE);
        url.searchParams.set('action', 'getKeyValue');
        url.searchParams.set('group', 'Telegram');
        url.searchParams.set('key', 'Kg');
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data = await res.json();
        const n = Number(data?.value);
        if (!cancel && data?.success && n > 0) setKg(n);
      } catch {
        /* 沒讀到就用 65 */
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const lifeVars = useMemo(
    () => lifePromptVars({ lat: location?.lat, lng: location?.lng, kg }),
    [location?.lat, location?.lng, kg]
  );
  const lifePreview = useMemo(() => promptParts(lifeTpl, lifeVars), [lifeTpl, lifeVars]);

  const openPrompt = () => {
    setPromptPending(true);
    setPromptView('preview');
    const el = promptRef.current;
    if (el) {
      el.open = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const goExpenseNow = () => {
    if (!photos.length) {
      setMsg('先拍照或從相冊選圖');
      setKeepExpense(false);
      return;
    }
    if (!openExpense('', photos, '', logToTelegram)) {
      setKeepExpense(false);
      setMsg('照片沒能帶進記帳，請再試一次');
    }
  };

  const runRecord = async () => {
    if (busy) return;
    if (!photos.length) {
      setMsg('先拍照或從相冊選圖');
      return;
    }
    setBusy(true);
    setMsg('辨識中…');
    setReady(null);
    setPromptPending(false);
    try {
      const prompt = lifePhotoPrompt({
        lat: location?.lat,
        lng: location?.lng,
        kg,
      });
      const parsed = await analyzeLifePhoto(photos, prompt);
      let nextPhotos = photos;
      if (logToTelegram) {
        setMsg('上傳 Telegram…');
        const sent = await sendTelegramPhotos({
          photos,
          caption: parsed.caption,
          topic: parsed.topic,
          mode: photos.length > 1 ? lifeMode : 'individual',
        });
        const urls = Array.isArray(sent.urls) ? sent.urls : [];
        nextPhotos = photos.map((p, i) => (urls[i] ? { ...p, uploadedUrl: urls[i] } : p));
      }
      const extra = parsed.other ? ` · ${parsed.other}` : '';
      setPhotos(nextPhotos);
      setReady({ caption: parsed.caption, photos: nextPhotos });
      setMsg(`${parsed.topic}${logToTelegram ? ' · 已發到 Telegram' : ''}${extra}`);
    } catch (err) {
      setMsg(String(err?.message || '分析失敗').split('\n')[0].slice(0, 180));
    } finally {
      setBusy(false);
    }
  };

  const onExpenseCheck = (checked) => {
    setKeepExpense(checked);
    if (!checked) return;
    goExpenseNow();
  };

  return (
    <div className="life-photo-panel">
      <CameraAICapture
        lighter={logToTelegram}
        onPhotoReady={(photo) => setPhotos((prev) => [...prev, photo])}
      />
      {photos.length > 0 ? (
        <>
          <div className="life-photo-thumbs">
            {photos.map((photo, index) => (
              <div key={`${photo.filename}-${index}`} className="life-photo-thumb">
                <img src={photo.preview || photo.uploadedUrl} alt="" />
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="life-photo-bar">
            <label className="life-photo-check">
              <input
                type="checkbox"
                checked={logToTelegram}
                onChange={(e) => setLogToTelegram(e.target.checked)}
              />
              記錄
            </label>
              <label className="life-photo-check">
                <input
                  type="checkbox"
                  checked={keepExpense}
                  disabled={busy}
                  onChange={(e) => onExpenseCheck(e.target.checked)}
                />
                記賬
              </label>
            {photos.length > 1 ? (
              <select
                className="life-photo-mode"
                value={lifeMode}
                onChange={(e) => setLifeMode(e.target.value)}
              >
                <option value="album">相簿</option>
                <option value="individual">分張</option>
              </select>
            ) : null}
            <button
              type="button"
              className="camera-ai-btn"
              disabled={busy || !logToTelegram}
              onClick={openPrompt}
            >
              {busy ? '處理中…' : promptPending ? '確認 prompt' : '分析照片'}
            </button>
          </div>
          <details className="ai-photo-prompt" ref={promptRef}>
            <summary>
              <span className="ai-photo-prompt-title">AI prompt</span>
              <span className="ai-photo-prompt-sub">
                {logToTelegram ? '記錄 · 送出時推 Telegram' : '記錄沒勾 · 不會推'}
              </span>
              {lifeTpl !== DEFAULT_LIFE_PROMPT_TEMPLATE ? (
                <span className="ai-photo-prompt-chip">已改</span>
              ) : null}
            </summary>
            {promptPending ? (
              <div className="ai-prompt-send">
                <span>還沒送出。可先看 Preview 或改 Edit，按送出才會用 token。</span>
                <button
                  type="button"
                  className="ai-prompt-send-btn"
                  disabled={busy || !logToTelegram}
                  onClick={runRecord}
                >
                  {busy ? '辨識中…' : '送出'}
                </button>
                <button
                  type="button"
                  className="ai-suggest-copy"
                  disabled={busy}
                  onClick={() => setPromptPending(false)}
                >
                  取消
                </button>
              </div>
            ) : null}
            <div className="ai-prompt-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={promptView === 'edit'}
                className={`ai-prompt-tab${promptView === 'edit' ? ' is-active' : ''}`}
                onClick={() => setPromptView('edit')}
              >
                Edit
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={promptView === 'preview'}
                className={`ai-prompt-tab${promptView === 'preview' ? ' is-active' : ''}`}
                onClick={() => setPromptView('preview')}
              >
                Preview
              </button>
            </div>
            {promptView === 'preview' ? (
              <pre className="ai-prompt-preview">
                {lifePreview.map((part, index) =>
                  part.kind === 'slot' ? (
                    <mark
                      key={`${part.key}-${index}`}
                      className={`ai-prompt-slot${part.empty ? ' is-empty' : ''}`}
                      title={`{{${part.key}}}`}
                    >
                      {part.text}
                    </mark>
                  ) : (
                    <span key={`t-${index}`}>{part.text}</span>
                  )
                )}
              </pre>
            ) : (
              <textarea
                className="ai-suggest-tpl"
                rows={10}
                value={lifeTpl}
                onChange={(e) => setLifeTpl(saveLifePromptTemplate(e.target.value))}
                spellCheck={false}
              />
            )}
            <div className="ai-suggest-meta">
              <button
                type="button"
                className="ai-suggest-copy"
                onClick={() => setLifeTpl(saveLifePromptTemplate(DEFAULT_LIFE_PROMPT_TEMPLATE))}
              >
                預設
              </button>
            </div>
          </details>
        </>
      ) : (
        <p className="camera-ai-hint">先拍照或從相冊選圖。勾記賬會進入記帳頁。</p>
      )}
      {msg ? <p className="camera-ai-hint">{msg}</p> : null}
      {ready ? (
        <button
          type="button"
          className="camera-ai-btn"
          onClick={() => {
            if (!openExpense(ready.caption, ready.photos, '說明已帶入。選分類後可記帳。', logToTelegram)) {
              setMsg('照片沒能帶進記帳，請再試一次');
            }
          }}
        >
          帶到記帳
        </button>
      ) : null}
    </div>
  );
}

export default LifePhotoPanel;
