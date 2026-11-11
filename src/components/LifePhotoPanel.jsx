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
  DEFAULT_AI_MODELS,
  defaultPromptLibrary,
  aiModelStatusLabel,
  loadAiPrompt,
  loadRememberModel,
  peekAiPrompt,
  promptOptionLabel,
  promptParts,
  promptLibraryWarn,
  promptsForContext,
  applyAiModelChoice,
  saveAiModelChoice,
  saveRememberModel,
  savePromptLibrary,
  sendTelegramPhotos,
  TELEGRAM_TOPICS,
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
  const [promptManage, setPromptManage] = useState(false);
  const [draftCat, setDraftCat] = useState(() => loadExpenseDraft()?.selectedTag || '');
  const [draftSub, setDraftSub] = useState(() => loadExpenseDraft()?.input || '');
  const [promptView, setPromptView] = useState('preview');
  const [promptPending, setPromptPending] = useState(false);
  const promptRef = useRef(null);
  const runLock = useRef(false);
  const modelSeed = useRef(peekAiPrompt());
  const seedPrefer = String(modelSeed.current?.prefer || '');
  const [models, setModels] = useState(
    modelSeed.current?.models?.length ? modelSeed.current.models : DEFAULT_AI_MODELS
  );
  const [prefer, setPrefer] = useState(
    seedPrefer.includes(':') ? seedPrefer.split('|')[0] : 'gemini:gemini-3.5-flash-lite'
  );
  const [rotate, setRotate] = useState(
    Boolean(modelSeed.current?.rotate) || seedPrefer === 'auto' || seedPrefer.endsWith('|rotate')
  );
  const [rememberModel, setRememberModel] = useState(() => loadRememberModel());

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
      if (Array.isArray(data.models) && data.models.length) setModels(data.models);
      if (data.prefer) setPrefer(String(data.prefer).split('|')[0]);
      setRotate(Boolean(data.rotate));
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
      const label = aiModelStatusLabel(data.models, data.prefer);
      setMsg(label ? `已讀取 · ${label}` : '已讀取，未設 APIKey');
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

  const pickModel = async (value) => {
    const sep = String(value || '').indexOf(':');
    if (sep < 1) return;
    setPrefer(value);
    try {
      const saved = rememberModel
        ? await saveAiModelChoice(value.slice(0, sep), value.slice(sep + 1), rotate)
        : applyAiModelChoice(value.slice(0, sep), value.slice(sep + 1), rotate);
      setPrefer(saved);
      if (rememberModel) setMsg('模型已存');
    } catch (err) {
      setMsg(String(err?.message || '模型沒存成').slice(0, 80));
    }
  };

  const toggleRotate = async (checked) => {
    const sep = String(prefer || '').indexOf(':');
    if (sep < 1) return;
    setRotate(checked);
    try {
      if (rememberModel) await saveAiModelChoice(prefer.slice(0, sep), prefer.slice(sep + 1), checked);
      else applyAiModelChoice(prefer.slice(0, sep), prefer.slice(sep + 1), checked);
      setMsg(checked ? '先用這個模型，失敗再試下一個' : '只用這個模型');
    } catch (err) {
      setMsg(String(err?.message || '模型沒存成').slice(0, 80));
    }
  };

  const toggleRemember = async (checked) => {
    setRememberModel(checked);
    saveRememberModel(checked);
    if (!checked) {
      setMsg('這次更換不寫進試算表');
      return;
    }
    const sep = String(prefer || '').indexOf(':');
    if (sep < 1) return;
    try {
      await saveAiModelChoice(prefer.slice(0, sep), prefer.slice(sep + 1), rotate);
      setMsg('已存。之後更換也會寫進設定');
    } catch (err) {
      setMsg(String(err?.message || '模型沒存成').slice(0, 80));
    }
  };

  const runRecord = async ({ keep = false } = {}) => {
    if (runLock.current || busy) return;
    if (!photos.length) {
      setMsg('先拍照或從相冊選圖');
      return;
    }
    runLock.current = true;
    setBusy(true);
    setMsg('已送出，辨識中…');
    if (!keep) setReady(null);
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
      setReady((prev) => ({
        caption: String(parsed.caption || '').trim(),
        topic: parsed.topic || 'General',
        other: parsed.other || '',
        text: parsed.text || '',
        sent: keep && prev?.sent ? prev.sent : false,
        sentCaption: keep && prev?.sent ? prev.sentCaption : '',
      }));
      const extra = parsed.other ? ` · ${parsed.other}` : '';
      setMsg(`${parsed.topic || 'General'} · 已回傳。可改 caption，再上傳 Telegram 或再 prompt${extra}`);
    } catch (err) {
      if (err?.raw) {
        setReady((prev) => ({
          caption: keep && prev ? prev.caption : '',
          topic: keep && prev ? prev.topic : 'General',
          other: keep && prev ? prev.other : '',
          text: String(err.raw),
          sent: keep && prev?.sent ? prev.sent : false,
          sentCaption: keep && prev?.sent ? prev.sentCaption : '',
        }));
      }
      const text = String(err?.message || '分析失敗').split('\n')[0].slice(0, 180);
      setMsg(err?.raw ? '模型有回，但不是預期的 JSON。原文在下面，可自己改 caption。' : text);
    } finally {
      runLock.current = false;
      setBusy(false);
    }
  };

  const pushTelegram = async () => {
    if (runLock.current || busy) return;
    const caption = String(ready?.caption || '').trim();
    if (!caption) {
      setMsg('caption 是空的。Telegram 只會有照片、沒有說明，先寫一句再發。');
      return;
    }
    if (!photos.length) {
      setMsg('沒有照片可發');
      return;
    }
    runLock.current = true;
    setBusy(true);
    setMsg('上傳 Telegram…');
    try {
      await sendTelegramPhotos({
        photos,
        caption,
        topic: ready.topic || 'General',
        mode: photos.length > 1 ? lifeMode : 'individual',
      });
      setReady((row) => (row ? { ...row, sent: true, sentCaption: caption } : row));
      setMsg(`已發到 Telegram · ${ready.topic || 'General'}`);
    } catch (err) {
      setMsg(String(err?.message || 'Telegram 發送失敗').split('\n')[0].slice(0, 180));
    } finally {
      runLock.current = false;
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
            <div className="life-photo-options">
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
            </div>
            <div className="life-photo-flags">
            <label className="ai-model-pick">
              模型
              <select value={prefer} disabled={busy} onChange={(e) => pickModel(e.target.value)}>
                {models.map((model) => (
                  <option key={`${model.provider}:${model.id}`} value={`${model.provider}:${model.id}`}>
                    {`${model.provider === 'openai' ? 'OpenAI' : model.provider === 'mistral' ? 'Mistral' : 'Gemini'} ${model.label}${model.tier ? ` · ${model.tier}` : ''}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="life-photo-check">
              <input
                type="checkbox"
                checked={rotate}
                disabled={busy}
                onChange={(e) => toggleRotate(e.target.checked)}
              />
              自動輪試
            </label>
            <label className="life-photo-check">
              <input
                type="checkbox"
                checked={rememberModel}
                disabled={busy}
                onChange={(e) => toggleRemember(e.target.checked)}
              />
              選擇後保存
            </label>
            </div>
            <div className="life-photo-actions">
            <button
              type="button"
              className="life-photo-action is-go"
              disabled={busy || !logToTelegram}
              onClick={() => runRecord()}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path fill="currentColor" stroke="none" d="M8 1.2l1.1 3.2h3.4L10.2 6.6l1.1 3.2L8 7.8 4.7 9.8l1.1-3.2L3.5 4.4h3.4L8 1.2z" />
                <path d="M3.2 12.4h9.6M4.6 14.2h6.8" />
              </svg>
              {busy ? '辨識中…' : '分析照片'}
            </button>
            <button
              type="button"
              className="life-photo-action"
              disabled={busy || !logToTelegram}
              onClick={openPrompt}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 2.5h7.2L13 5.3V13.5H3z" />
                <path d="M10 2.6V5.4h2.8M5 8h6M5 10.5h4" />
              </svg>
              確認 prompt
            </button>
            </div>
          </div>
          {msg ? <p className="camera-ai-hint">{msg}</p> : null}
          <details className="ai-photo-prompt" ref={promptRef}>
            <summary>
              <span className="ai-photo-prompt-title">AI prompt</span>
              <span className="ai-photo-prompt-sub">
                {logToTelegram ? '回傳後可改，再上傳 Telegram' : '記錄沒勾 · 不會分析'}
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
                  onClick={() => runRecord()}
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
              {promptManage ? (
                <button
                  type="button"
                  className="ai-suggest-copy ai-suggest-delete"
                  disabled={!promptId}
                  onClick={() => {
                    const row = promptList.find((item) => item.id === promptId);
                    if (!row) return;
                    if (!window.confirm(`確定刪除「${promptOptionLabel(row)}」？取消就保留。按儲存才寫進試算表。`)) return;
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
              ) : null}
              <button
                type="button"
                className={`ai-suggest-copy${promptManage ? ' is-on' : ''}`}
                aria-expanded={promptManage}
                onClick={() => setPromptManage((open) => !open)}
              >
                管理
              </button>
            </label>
            {promptManage ? (
              <div className="ai-model-pick">
              <select
                value={promptScope}
                onChange={(e) => setPromptScope(e.target.value)}
                aria-label="新增範圍"
              >
                <option value="any">通用</option>
                <option value="cat" disabled={!String(draftCat || '').trim()}>此分類</option>
                <option value="sub" disabled={!String(draftSub || '').trim()}>此子分類</option>
              </select>
              <button
                type="button"
                className="ai-suggest-copy ai-suggest-add"
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
              {promptLibraryWarn(promptList.length) ? (
                <span className="ai-suggest-hint">{promptLibraryWarn(promptList.length)}</span>
              ) : null}
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
      {ready ? (
        <div className="life-photo-result">
          <label className="life-photo-result-field">
            caption
            <textarea
              rows={4}
              value={ready.caption}
              spellCheck={false}
              onChange={(e) => setReady((row) => (row ? { ...row, caption: e.target.value } : row))}
            />
          </label>
          <label className="life-photo-result-field">
            topic
            <select
              value={ready.topic}
              onChange={(e) => setReady((row) => (row ? { ...row, topic: e.target.value } : row))}
            >
              {TELEGRAM_TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </label>
          {ready.other ? <p className="camera-ai-hint">other：{ready.other}</p> : null}
          <p className="camera-ai-hint">
            {ready.sent
              ? `已發到 Telegram 的 caption：${ready.sentCaption || '（空白）'}`
              : '還沒發到 Telegram'}
          </p>
          {ready.text ? (
            <details className="ai-suggest-prompt-wrap">
              <summary>模型原文</summary>
              <pre className="ai-suggest-prompt">{ready.text}</pre>
            </details>
          ) : null}
          <div className="life-photo-result-actions">
            <button type="button" className="camera-ai-btn" disabled={busy} onClick={pushTelegram}>
              {ready.sent ? '再上傳 Telegram' : '上傳 Telegram'}
            </button>
            <button type="button" className="camera-ai-btn" disabled={busy} onClick={() => runRecord({ keep: true })}>
              {busy ? '辨識中…' : '再 prompt'}
            </button>
          </div>
          <button
            type="button"
            className="camera-ai-btn"
            onClick={() => {
              if (!openExpense(ready.caption, photos, '說明已帶入。選分類後可記帳。', logToTelegram, whenAt)) {
                setMsg('照片沒能帶進記帳，請再試一次');
              }
            }}
          >
            帶到記帳
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default LifePhotoPanel;
