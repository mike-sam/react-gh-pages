import React, { useEffect, useMemo, useRef, useState } from 'react';
import CameraAICapture from './CameraAICapture';
import MobileFriendlyDateTime from './MobileFriendlyDateTime';
import { useSmartLocation } from '../hooks/useSmartLocation';
import { API_ENDPOINTS } from '../config';
import {
  asDraftDate,
  durablePhotoUrl,
  hydrateDraftPhotos,
  loadExpenseDraft,
  saveExpenseDraft,
} from '../utils/expenseDraft';
import { applyHash, hrefFor, ROUTES } from '../utils/routing';
import {
  analyzeLifePhoto,
  formatWhen,
  lifePhotoPrompt,
  lifePromptVars,
  defaultPromptLibrary,
  loadAiPrompt,
  peekAiPrompt,
  promptOptionLabel,
  promptParts,
  promptLibraryWarn,
  promptsForContext,
  savePromptLibrary,
  sendTelegramPhotos,
} from '../utils/aiSuggest';

function draftPhotos(list) {
  return (list || []).map((photo) => {
    const next = { ...photo };
    delete next.sourcePreview;
    if (durablePhotoUrl(next.uploadedUrl)) delete next.base64;
    else if (/^https:\/\/api\.telegram\.org\/file\/bot/i.test(String(next.uploadedUrl || ''))) {
      delete next.uploadedUrl;
    }
    return next;
  });
}

const NOTICE_KEY = 'lifePhotoNotice';
const RECORD_KEY = 'lifePhotoRecord';
let kgCache = 0;

function seedRecordPrompt() {
  const cached = peekAiPrompt();
  const list = cached?.prompts?.length ? cached.prompts : defaultPromptLibrary();
  const best = promptsForContext(list, { mode: 'record' })[0];
  return {
    list,
    fetched: Boolean(cached),
    id: best?.id || '',
    template: best?.template || '',
  };
}

function openExpense(caption, photos, notice, record, when) {
  const prev = loadExpenseDraft() || {};
  const saved = saveExpenseDraft({
    ...prev,
    simpleDescription: caption || prev.simpleDescription || '',
    photos: draftPhotos(photos),
    selectedDateTime: when || prev.selectedDateTime || new Date(),
  });
  if (!saved) return false;
  try {
    if (notice) sessionStorage.setItem(NOTICE_KEY, notice);
    else sessionStorage.removeItem(NOTICE_KEY);
    sessionStorage.setItem(RECORD_KEY, record ? '1' : '0');
  } catch {
    /* ignore */
  }
  applyHash(hrefFor(ROUTES.EXPENSE), { state: { fromHome: true, fromPhoto: true } });
  return true;
}

/** 首頁拍照。有圖才出現記錄／記賬。勾記賬才進入記帳頁。 */
function writeSharedPhotos(list, when) {
  const prev = loadExpenseDraft() || {};
  saveExpenseDraft({
    ...prev,
    photos: list,
    simpleDescription: prev.simpleDescription || '',
    selectedDateTime: when || prev.selectedDateTime || new Date(),
  });
}

function LifePhotoPanel() {
  const { location } = useSmartLocation();
  const [photos, setPhotos] = useState(() => hydrateDraftPhotos(loadExpenseDraft()?.photos));
  const [whenAt, setWhenAt] = useState(() => asDraftDate(loadExpenseDraft()?.selectedDateTime, new Date()));
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
  const [kg, setKg] = useState(kgCache || 65);
  const seeded = useRef(seedRecordPrompt());
  const [lifeTpl, setLifeTpl] = useState(seeded.current.template);
  const [lifeSaved, setLifeSaved] = useState(seeded.current.template);
  const [promptList, setPromptList] = useState(seeded.current.list);
  const [promptFetched, setPromptFetched] = useState(seeded.current.fetched);
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptId, setPromptId] = useState(seeded.current.id);
  const [promptScope, setPromptScope] = useState('any');
  const [draftCat, setDraftCat] = useState(() => loadExpenseDraft()?.selectedTag || '');
  const [draftSub, setDraftSub] = useState(() => loadExpenseDraft()?.input || '');
  const [promptView, setPromptView] = useState('preview');
  const [promptPending, setPromptPending] = useState(false);
  const promptRef = useRef(null);

  useEffect(() => {
    if (!photosReady.current) {
      photosReady.current = true;
      return undefined;
    }
    writeSharedPhotos(photos, whenAt);
    return undefined;
  }, [photos, whenAt]);

  const shownPrompts = useMemo(
    () => promptsForContext(promptList, { mode: 'record' }),
    [promptList]
  );

  useEffect(() => {
    if (!shownPrompts.length) return undefined;
    if (shownPrompts.some((row) => row.id === promptId)) return undefined;
    const best = shownPrompts[0];
    setPromptId(best.id);
    setLifeTpl(best.template);
    setLifeSaved(best.template);
    setPromptScope('any');
    return undefined;
  }, [shownPrompts, promptId]);

  const fetchAiConfig = async () => {
    if (promptBusy) return;
    setPromptBusy(true);
    setMsg('讀取設定…');
    try {
      const data = await loadAiPrompt();
      const list = Array.isArray(data.prompts) ? data.prompts : [];
      setPromptList(list);
      setPromptFetched(true);
      if (lifeTpl === lifeSaved) {
        const best = promptsForContext(list, { mode: 'record' })[0];
        if (best) {
          setPromptId(best.id);
          setLifeTpl(best.template);
          setLifeSaved(best.template);
        }
      }
      if (!(kgCache > 0)) {
        try {
          const url = new URL(API_ENDPOINTS.KEY_VALUE);
          url.searchParams.set('action', 'getKeyValue');
          url.searchParams.set('group', 'Telegram');
          url.searchParams.set('key', 'Kg');
          const res = await fetch(url.toString());
          const row = await res.json();
          const n = Number(row?.value);
          if (row?.success && n > 0) {
            kgCache = n;
            setKg(n);
          }
        } catch {
          /* 體重維持 65 */
        }
      }
      const keys = [data.hasGemini ? 'Gemini' : '', data.hasOpenAI ? 'OpenAI' : ''].filter(Boolean).join(' / ');
      setMsg(keys ? `已讀取 · ${keys}` : '已讀取，未設 APIKey');
    } catch (err) {
      setMsg(String(err?.message || '讀取失敗').slice(0, 80));
    } finally {
      setPromptBusy(false);
    }
  };

  const lifeVars = useMemo(
    () => lifePromptVars({ when: formatWhen(whenAt), lat: location?.lat, lng: location?.lng, kg }),
    [whenAt, location?.lat, location?.lng, kg]
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
    if (!openExpense('', photos, '', logToTelegram, whenAt)) {
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
      const prompt = lifePhotoPrompt(
        {
          when: formatWhen(whenAt),
          lat: location?.lat,
          lng: location?.lng,
          kg,
        },
        lifeTpl
      );
      const parsed = await analyzeLifePhoto(photos, prompt);
      let nextPhotos = photos;
      if (logToTelegram) {
        setMsg('上傳 Telegram…');
        await sendTelegramPhotos({
          photos,
          caption: parsed.caption,
          topic: parsed.topic,
          mode: photos.length > 1 ? lifeMode : 'individual',
        });
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
          <MobileFriendlyDateTime
            compact
            title="拍攝時間"
            value={whenAt}
            onChange={setWhenAt}
          />
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
              {lifeTpl !== lifeSaved ? <span className="ai-photo-prompt-chip">未儲存</span> : null}
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
            <label className="ai-model-pick">
              Prompt
              <select
                value={promptId}
                onChange={(e) => {
                  const row = promptList.find((item) => item.id === e.target.value);
                  if (!row) return;
                  setPromptId(row.id);
                  setLifeTpl(row.template);
                  setLifeSaved(row.template);
                }}
              >
                {shownPrompts.map((row) => (
                  <option key={row.id} value={row.id}>
                    {promptOptionLabel(row)}
                  </option>
                ))}
              </select>
              <select
                value="any"
                onChange={() => setPromptScope('any')}
                aria-label="新增範圍"
              >
                <option value="any">通用</option>
                <option value="cat" disabled>此分類</option>
                <option value="sub" disabled>此子分類</option>
              </select>
              <button
                type="button"
                className="ai-suggest-copy"
                onClick={() => {
                  const name = String(window.prompt('這份 prompt 的名稱') || '').trim();
                  if (!name) return;
                  const cat = promptScope === 'any' ? '' : draftCat;
                  const subcat = promptScope === 'sub' ? draftSub : '';
                  if (promptScope !== 'any' && !cat) {
                    setMsg('記帳頁還沒有分類，先用通用');
                    return;
                  }
                  const row = {
                    id: `p${Date.now()}`,
                    label: name,
                    mode: 'record',
                    cat,
                    subcat,
                    template: lifeTpl,
                  };
                  const nextLen = promptList.length + 1;
                  setPromptList((prev) => [...prev, row]);
                  setPromptId(row.id);
                  setLifeSaved('');
                  const warn = promptLibraryWarn(nextLen);
                  setMsg(warn ? `${warn}。按儲存才寫進試算表` : '已加到清單，按儲存才寫進試算表');
                }}
              >
                新增
              </button>
              <button
                type="button"
                className="ai-suggest-copy ai-suggest-delete"
                disabled={!promptId}
                onClick={() => {
                  const row = promptList.find((item) => item.id === promptId);
                  if (!row) return;
                  if (!window.confirm(`刪除「${row.label}」？按儲存才寫進試算表。`)) return;
                  const next = promptList.filter((item) => item.id !== row.id);
                  const best = promptsForContext(next, { mode: 'record' })[0];
                  setPromptList(next);
                  if (best) {
                    setPromptId(best.id);
                    setLifeTpl(best.template);
                  }
                  setLifeSaved('');
                  const warn = promptLibraryWarn(next.length);
                  setMsg(warn ? `${warn}。按儲存才寫進試算表` : '已從清單移除，按儲存才寫進試算表');
                }}
              >
                刪除
              </button>
              {promptLibraryWarn(promptList.length) ? (
                <span className="ai-suggest-hint">{promptLibraryWarn(promptList.length)}</span>
              ) : null}
            </label>
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
                onChange={(e) => setLifeTpl(e.target.value)}
                spellCheck={false}
              />
            )}
            <div className="ai-suggest-meta">
              <button
                type="button"
                className="ai-suggest-copy"
                disabled={promptBusy}
                onClick={fetchAiConfig}
              >
                {promptBusy ? '…' : promptFetched ? '重讀設定' : '讀取設定'}
              </button>
              <button
                type="button"
                className="ai-suggest-copy"
                onClick={() => {
                  const general = promptList.find((row) => row.mode === 'record' && !row.cat);
                  if (general) setLifeTpl(general.template);
                }}
              >
                預設
              </button>
              <button
                type="button"
                className="ai-suggest-copy"
                disabled={busy || lifeTpl === lifeSaved}
                onClick={async () => {
                  try {
                    const next = promptList.map((row) =>
                      row.id === promptId ? { ...row, template: lifeTpl } : row
                    );
                    const saved = await savePromptLibrary(next);
                    setPromptList(saved);
                    setLifeSaved(lifeTpl);
                    setMsg('已儲存到 AI / Prompts');
                  } catch (err) {
                    setMsg(String(err?.message || '儲存失敗').slice(0, 80));
                  }
                }}
              >
                儲存
              </button>
            </div>
          </details>
        </>
      ) : (
        <p className="camera-ai-hint">先拍照或從相冊選圖。勾記賬會進入記帳頁，上方可回到這裡。</p>
      )}
      {msg ? <p className="camera-ai-hint">{msg}</p> : null}
      {ready ? (
        <button
          type="button"
          className="camera-ai-btn"
          onClick={() => {
            if (!openExpense(ready.caption, ready.photos, '說明已帶入。選分類後可記帳。', logToTelegram, whenAt)) {
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
