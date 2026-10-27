import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import TagSelector from '../TagSelector';
import Remark from '../Remark';
import Log from '../Log';
import Output from '../Output';
import '../App.css';
import ExpenseDateTimeRow from '../components/ExpenseDateTimeRow';
import { focusElement } from '../utils/keyboardNavigation';
import PageChrome from '../components/PageChrome';
import AmountTripleRow from '../components/AmountTripleRow';
import TaxAddonStrip, { computeFinalAmount, formatTaxAddonTags } from '../components/TaxAddonStrip';
import CameraAICapture from '../components/CameraAICapture';
import ReceiptPhotoEditor from '../components/ReceiptPhotoEditor';
import { useOfflineQueue } from '../context/QueueContext';
import {
  analyzeReceiptPhoto,
  applyAiSuggestion,
  DEFAULT_RECEIPT_PROMPT_TEMPLATE,
  formatAiCurlCopy,
  formatAiFallbackCopy,
  formatWhen,
  loadAiPrompt,
  parseAiSuggestions,
  recordAiSuggestion,
  receiptPromptFor,
  resolveSuggestionTimes,
  saveAiPrompt,
  suggestionSummary,
} from '../utils/aiSuggest';
import { calendarBlockPayload } from '../utils/calendarTrackUrl';
import { copyText } from '../utils/platform';
import { useSmartLocation } from '../hooks/useSmartLocation';
import { formatRelativeTimeShort, toMapsUrl } from '../utils/locationStorage';
import { labelFromCoveringPlace, pinMerchantIfNearHere, rememberNamedPoint } from '../utils/landmarkRegions';
import {
  asDraftDate,
  clearExpenseDraft,
  loadBootExpenseDraft,
  saveExpenseDraft,
} from '../utils/expenseDraft';
import { getBuildVersion } from '../utils/buildInfo';
import {
  loadExpenseHistory,
  pushExpenseHistory,
  clearExpenseHistory,
} from '../utils/expenseHistory';
import SectionHead from '../components/SectionHead';
import {
  ensureAppBootstrap,
  ensurePaymentOptions,
  readPaymentOptionsCache,
  subscribeAppBootstrap,
  transformPaymentOptions,
} from '../utils/appBootstrap';
import { applyHash, getHashPath, ROUTES } from '../utils/routing';
import {
  parseExpenseQuickDraft,
  clearExpenseQuickQuery,
  getMergedQueryParams,
  resolvePaymentMethod,
} from '../utils/expenseQuickUrl';
import { ObligationsPanel } from './ObligationsPage';
import ExpenseSummary from '../components/ExpenseSummary';
import { invalidateExpenseSummaryCache } from '../utils/expenseSummary';
import { invalidateEatPlacesCache } from '../utils/eatPlaces';
import { formatReceiptSize } from '../utils/receiptPhoto';

function ledgerFromLocation() {
  if (getHashPath() === ROUTES.OBLIGATIONS) return 'scheduled';
  const tab = getMergedQueryParams().get('tab');
  if (tab === 'scheduled') return 'scheduled';
  if (tab === 'summary') return 'summary';
  return 'now';
}

function ExpensePage() {
  const { enqueueAndSend } = useOfflineQueue();
  const { location: smartLoc, mapsUrl, setCachedLocation, resolveForAction } = useSmartLocation();
  const quickAppliedRef = useRef(false);
  const pendingSilentRef = useRef(false);
  const silentAbortRef = useRef(null);
  const [paymentsReady] = useState(true);
  const [boot] = useState(() => loadBootExpenseDraft());
  /** silent countdown UI: armed | sending | aborted | null */
  const [silentPhase, setSilentPhase] = useState(null);
  const [silentRemainMs, setSilentRemainMs] = useState(0);
  const [draftReady, setDraftReady] = useState(false);

  const [selectedTag, setSelectedTag] = useState(boot?.selectedTag || null);
  const [input, setInput] = useState(boot?.input || '');
  const [remark, setRemark] = useState(boot?.remark || '');
  const [carPlate, setCarPlate] = useState(boot?.carPlate || '');
  const [tripInfo, setTripInfo] = useState(boot?.tripInfo || '');
  const [mileage, setMileage] = useState(boot?.mileage || '');
  const [amount, setAmount] = useState(boot?.amount || '');
  const [currency, setCurrency] = useState(boot?.currency || 'MYR');
  const [log, setLog] = useState(() => loadExpenseHistory());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [output, setOutput] = useState(() =>
    boot?.savedAt ? `已還原本機暫存（${formatRelativeTimeShort(boot.savedAt)}）` : ''
  );
  const [selectedDateTime, setSelectedDateTime] = useState(
    () => asDraftDate(boot?.selectedDateTime, new Date())
  );
  const [eventStart, setEventStart] = useState(() => asDraftDate(boot?.eventStart));
  const [eventEnd, setEventEnd] = useState(() => asDraftDate(boot?.eventEnd));
  const [paymentMethod, setPaymentMethod] = useState(boot?.paymentMethod || '');
  const [simpleDescription, setSimpleDescription] = useState(boot?.simpleDescription || '');
  const [photos, setPhotos] = useState(() => (Array.isArray(boot?.photos) ? boot.photos : []));
  const [editPhotoIndex, setEditPhotoIndex] = useState(-1);
  /** When set, submit keeps this id → GAS Replace Into（編輯既有筆） */
  const [editingId, setEditingId] = useState(boot?.editingId ?? null);
  /** Tax/service addons — do not mutate main amount input */
  const [taxAddons, setTaxAddons] = useState(() =>
    Array.isArray(boot?.taxAddons) ? boot.taxAddons : []
  );
  const [paymentOptions, setPaymentOptions] = useState(
    () => transformPaymentOptions(readPaymentOptionsCache({ allowStale: true }))
  );
  const [currencyConversions, setCurrencyConversions] = useState([]);
  const [isAmountManuallySet, setIsAmountManuallySet] = useState(
    () => Boolean(boot?.isAmountManuallySet)
  );
  const [itemizedTotal, setItemizedTotal] = useState(0);
  const [fuelPrice, setFuelPrice] = useState(boot?.fuelPrice || '');
  const [fuelType, setFuelType] = useState(boot?.fuelType || '');
  const [aiBusyIndex, setAiBusyIndex] = useState(-1);
  const [aiError, setAiError] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiMeta, setAiMeta] = useState({ model: '', prompt: '', photoHash: '', photoIndex: -1 });
  const [aiPicked, setAiPicked] = useState(null);
  const [aiCopied, setAiCopied] = useState('');
  const [aiLocMsg, setAiLocMsg] = useState('');
  const [aiTemplate, setAiTemplate] = useState(DEFAULT_RECEIPT_PROMPT_TEMPLATE);
  const [aiTemplateSaved, setAiTemplateSaved] = useState(DEFAULT_RECEIPT_PROMPT_TEMPLATE);
  const [aiTplLoaded, setAiTplLoaded] = useState(false);
  const [aiTplBusy, setAiTplBusy] = useState(false);
  const [aiTplMsg, setAiTplMsg] = useState('');
  const [itemizedImport, setItemizedImport] = useState(() =>
    boot?.itemizedItems?.length
      ? { key: `draft-${boot.savedAt || Date.now()}`, items: boot.itemizedItems }
      : null
  );
  const [calendarEventId, setCalendarEventId] = useState(boot?.calendarEventId || '');
  const [aiCalAsk, setAiCalAsk] = useState(null);
  const [aiPaste, setAiPaste] = useState('');

  const hasUnsavedInput = useMemo(() => {
    const amt = String(amount || '').trim();
    const hasAmount = amt !== '' && amt !== '0' && amt !== '0.00';
    return Boolean(
      selectedTag ||
        String(input || '').trim() ||
        hasAmount ||
        String(remark || '').trim() ||
        String(simpleDescription || '').trim() ||
        String(carPlate || '').trim() ||
        (Array.isArray(photos) && photos.length) ||
        (Array.isArray(taxAddons) && taxAddons.length) ||
        editingId != null
    );
  }, [selectedTag, input, amount, remark, simpleDescription, carPlate, photos, taxAddons, editingId]);

  const ensureAiPromptLoaded = useCallback(async () => {
    if (aiTplLoaded) return aiTemplate;
    setAiTplBusy(true);
    try {
      const data = await loadAiPrompt();
      setAiTemplate(data.template);
      setAiTemplateSaved(data.template);
      setAiTplLoaded(true);
      if (data.model) {
        setAiMeta((m) => (m.model ? m : { ...m, model: data.model }));
      }
      const bits = [];
      if (data.hasGemini) bits.push('Gemini');
      if (data.hasOpenAI) bits.push('OpenAI');
      setAiTplMsg(bits.length ? bits.join(' / ') : '未設 APIKey / OPENAPIKey');
      return data.template;
    } catch (err) {
      setAiTplLoaded(true);
      setAiTplMsg(String(err.message || '讀取失敗').slice(0, 80));
      return aiTemplate;
    } finally {
      setAiTplBusy(false);
    }
  }, [aiTplLoaded, aiTemplate]);

  const saveAiTemplate = async () => {
    setAiTplBusy(true);
    setAiTplMsg('');
    try {
      const text = await saveAiPrompt(aiTemplate);
      setAiTemplate(text);
      setAiTemplateSaved(text);
      setAiTplMsg('已儲存');
      window.setTimeout(() => setAiTplMsg(''), 1600);
    } catch (err) {
      setAiTplMsg(String(err.message || '儲存失敗').slice(0, 80));
    } finally {
      setAiTplBusy(false);
    }
  };

  const askAiForPhoto = async (index) => {
    const photo = photos[index];
    if (!photo?.base64 || aiBusyIndex >= 0) return;
    const tpl = aiTplLoaded ? aiTemplate : await ensureAiPromptLoaded();
    const whenStr = formatWhen(selectedDateTime);
    const localPrompt = receiptPromptFor(selectedTag, input, tpl, whenStr);
    setAiBusyIndex(index);
    setAiError('');
    setAiSuggestions([]);
    setAiCopied('');
    setAiLocMsg('');
    setAiMeta({ model: '', prompt: localPrompt, photoHash: '', photoIndex: index });
    try {
      const result = await analyzeReceiptPhoto(photo, {
        tag: selectedTag,
        title: input,
        promptTemplate: tpl,
        when: whenStr,
      });
      setAiSuggestions(result.suggestions);
      setAiMeta({
        model: result.model,
        prompt: result.prompt || localPrompt,
        photoHash: result.photoHash,
        photoIndex: index,
        tried: result.tried || [],
      });
      if (!result.suggestions.length) setAiError('沒有建議');
    } catch (err) {
      setAiMeta((m) => ({
        ...m,
        model: err?.model || m.model,
        prompt: err?.prompt || m.prompt,
        tried: err?.tried || m.tried || [],
      }));
      setAiError(
        err?.name === 'AbortError' || /逾時/.test(String(err.message || ''))
          ? `逾時（壓縮後 ${formatFileSize(photo.compressedSize || photo.base64?.length || 0)}；Gemini 8s 後改 OpenAI）`
          : String(err.message || 'AI 失敗')
              .split('\n')[0]
              .slice(0, 240)
      );
    } finally {
      setAiBusyIndex(-1);
    }
  };

  const copyAiPrompt = async () => {
    const text = formatAiFallbackCopy({ ...aiMeta, error: aiError });
    if (!text) return;
    const ok = await copyText(text);
    setAiCopied(ok ? '已複製 prompt' : '複製失敗');
    window.setTimeout(() => setAiCopied(''), 1600);
  };

  const copyAiCurl = async () => {
    const text = formatAiCurlCopy({
      model: aiMeta.model,
      prompt: aiMeta.prompt,
      error: aiError,
    });
    if (!text) return;
    const ok = await copyText(text);
    setAiCopied(ok ? '已複製 curl' : '複製失敗');
    window.setTimeout(() => setAiCopied(''), 2200);
  };

  const applyExternalPaste = () => {
    const list = parseAiSuggestions(aiPaste);
    if (!list.length) {
      setAiError('找不到 JSON');
      setAiSuggestions([]);
      setAiPicked(null);
      return;
    }
    setAiError('');
    setAiMeta((m) => ({
      ...m,
      model: 'external',
      tried: ['external'],
    }));
    setAiCalAsk(null);
    setAiCopied('');
    if (list.length === 1) {
      setAiSuggestions([]);
      pickAiSuggestion(list[0]);
      return;
    }
    setAiPicked(null);
    setAiSuggestions(list);
  };

  /** Leaving 交通出行: wipe auto fuel/ODO remark before ItemizedDescription remounts */
  const handleSetSelectedTag = useCallback(
    (next) => {
      const nextVal = typeof next === 'function' ? next(selectedTag) : next;
      if (selectedTag === '交通出行' && nextVal !== '交通出行') {
        setRemark('');
        setSimpleDescription('');
      }
      setSelectedTag(nextVal);
    },
    [selectedTag]
  );

  const pickAiSuggestion = (s) => {
    applyAiSuggestion(s, {
      selectedTag,
      setSelectedTag: handleSetSelectedTag,
      setInput,
      setAmount,
      setIsAmountManuallySet,
      setCurrency,
      setSimpleDescription,
      setRemark,
      setMileage,
      setTripInfo,
      setFuelType,
      setFuelPrice,
      setCarPlate,
      setPaymentMethod,
      paymentOptions,
      selectedDateTime,
      setSelectedDateTime,
      setItemizedImport,
    });
    setAiPicked(s);
    setAiLocMsg('');
    setAiCalAsk(null);
    recordAiSuggestion({
      tag: s.tag || selectedTag || '',
      title: s.title || input || '',
      chosen: s,
      count: aiSuggestions.length,
      model: aiMeta.model,
      photoHash: aiMeta.photoHash,
      label: s.label || '',
    });
    setAiSuggestions([]);
    setAiError('');
    const merchant = String(s?.merchant || '').trim();
    const times = resolveSuggestionTimes(s);
    if (times.calendar && times.eventStart && times.eventEnd) {
      setAiCalAsk({
        start: times.eventStart,
        end: times.eventEnd,
        inferredEnd: Boolean(times.inferredEnd),
        title: [s.title || selectedTag, merchant].filter(Boolean).join(' · ') || 'Trip',
        merchant,
        label: s.label || '',
      });
    }
    if (!merchant) return;
    (async () => {
      let here = smartLoc;
      try {
        here = (await resolveForAction()) || smartLoc;
      } catch {
        here = smartLoc;
      }
      const pinned = await pinMerchantIfNearHere({
        merchant,
        address: s.merchant_address || s.address || '',
        here,
      });
      if (!pinned?.ok || !here) return;
      setCachedLocation({
        lat: here.lat,
        lng: here.lng,
        accuracy: here.accuracy ?? null,
        updatedAt: Date.now(),
        label: merchant,
      });
      setAiLocMsg((prev) => {
        const loc = `已存地點 · ${merchant}${pinned.km != null ? ` ${pinned.km.toFixed(1)}km` : ''}`;
        return prev ? `${prev} · ${loc}` : loc;
      });
    })();
  };

  const confirmAiCalendar = async (ok) => {
    const ask = aiCalAsk;
    setAiCalAsk(null);
    if (!ok || !ask?.start) return;
    const start = ask.start instanceof Date ? ask.start : new Date(ask.start);
    const end = ask.inferredEnd
      ? new Date()
      : ask.end instanceof Date
        ? ask.end
        : new Date(ask.end);
    if (end.getTime() <= start.getTime()) return;
    setEventStart(start);
    setEventEnd(end);
    setSelectedDateTime(end);
    try {
      let here = smartLoc;
      try {
        here = (await resolveForAction()) || smartLoc;
      } catch {
        here = smartLoc;
      }
      const result = await enqueueAndSend(
        calendarBlockPayload({
          title: ask.title || 'Trip',
          start,
          end,
          lat: here?.lat ?? null,
          lng: here?.lng ?? null,
          placeName: here ? labelFromCoveringPlace(here) || here.label || '' : '',
          description: [
            'auto populated by 記賬 / AI',
            ask.merchant ? `商家: ${ask.merchant}` : '',
            ask.label ? `label: ${ask.label}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        })
      );
      const eventId = result?.data?.eventId || '';
      if (eventId) setCalendarEventId(eventId);
      setAiLocMsg((prev) => {
        const cal = result?.sent ? '已寫入行事曆' : '行事曆已暫存';
        return prev ? `${prev} · ${cal}` : cal;
      });
    } catch {
      setAiLocMsg((prev) => (prev ? `${prev} · 行事曆寫入失敗` : '行事曆寫入失敗'));
    }
  };

  const handleCurrencyConversion = (conversion) => {
    setCurrencyConversions((prev) => [...prev, conversion]);
  };
  const handleAmountComplete = () => setIsAmountManuallySet(true);
  const handleItemizedTotalChange = (total) => {
    setItemizedTotal(total || 0);
    if (!isAmountManuallySet && total > 0) setAmount(total.toFixed(2));
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  useEffect(() => {
    const applyFromCache = () => {
      setPaymentOptions(transformPaymentOptions(readPaymentOptionsCache({ allowStale: true })));
    };
    applyFromCache();
    ensureAppBootstrap();
    void ensurePaymentOptions({ force: true }).then((map) => {
      if (map && typeof map === 'object') setPaymentOptions(transformPaymentOptions(map));
      else applyFromCache();
    });
    window.addEventListener('paymentOptionsUpdated', applyFromCache);
    const unsub = subscribeAppBootstrap(applyFromCache);
    return () => {
      window.removeEventListener('paymentOptionsUpdated', applyFromCache);
      unsub();
    };
  }, []);

  // sessionStorage POST bridge (Shortcuts / external)
  useEffect(() => {
    const postData = sessionStorage.getItem('expensePostData');
    if (!postData) return;
    try {
      const data = JSON.parse(postData);
      if (data.txt) setInput(data.txt);
      if (data.cat) setSelectedTag(data.cat);
      if (data.tag) setInput(data.tag);
      if (data.amount) setAmount(data.amount.toString());
      if (data.currency) setCurrency(data.currency);
      if (data.remark) {
        setRemark(data.remark);
        setSimpleDescription(data.remark);
      }
      sessionStorage.removeItem('expensePostData');
    } catch (error) {
      console.error('Error parsing POST data:', error);
    }
  }, []);

  // URL quick entry: #/expense?cat=&subcat=&amount=&desc=&timestamp=&start=&end=&paymentmethod=&currency=&latlong=
  useEffect(() => {
    if (!paymentsReady || quickAppliedRef.current) return;
    const draft = parseExpenseQuickDraft(paymentOptions);
    if (!draft.hasQuickKeys) {
      quickAppliedRef.current = true;
      setDraftReady(true);
      return;
    }
    quickAppliedRef.current = true;

    if (draft.cat) setSelectedTag(draft.cat);
    if (draft.subcat) setInput(draft.subcat);
    if (draft.carPlate) setCarPlate(draft.carPlate);
    if (draft.amount) {
      setAmount(draft.amount);
      setIsAmountManuallySet(true);
    }
    if (draft.desc) {
      setRemark(draft.desc);
      setSimpleDescription(draft.desc);
    }
    if (draft.currency) setCurrency(draft.currency);
    if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
    if (draft.timestamp) setSelectedDateTime(draft.timestamp);
    else if (draft.eventEnd) setSelectedDateTime(draft.eventEnd);
    if (draft.eventStart && draft.eventEnd) {
      setEventStart(draft.eventStart);
      setEventEnd(draft.eventEnd);
    }
    if (draft.latlong) setCachedLocation(draft.latlong);

    if (draft.paymentUnresolved) {
      const raw = getMergedQueryParams().get('paymentmethod') || getMergedQueryParams().get('payment');
      setOutput(`找不到付款方式「${raw}」，請手動選擇後送出`);
    } else if (draft.readyToSubmit) {
      pendingSilentRef.current = true;
      setSilentPhase('armed');
      setOutput('silent：2 秒後自動送出，3 秒內點擊畫面可取消');
    } else if (draft.silent) {
      setOutput('silent 已啟用，但必填未齊或付款無法解析，請補齊後送出');
    } else {
      setOutput('已帶入 URL 參數，確認後請手動送出（自動送出請加 silent=true）');
    }
    setDraftReady(true);
  }, [paymentsReady, paymentOptions, setCachedLocation]);

  useEffect(() => {
    if (!paymentMethod) return;
    const resolved = resolvePaymentMethod(paymentMethod, paymentOptions);
    if (resolved && resolved !== paymentMethod) setPaymentMethod(resolved);
  }, [paymentMethod, paymentOptions]);

  useEffect(() => {
    if (!paymentsReady) return undefined;
    if (!draftReady) {
      setDraftReady(true);
      return undefined;
    }
    if (isSubmitting || silentPhase === 'sending') return undefined;
    const timer = window.setTimeout(() => {
      saveExpenseDraft({
        selectedTag,
        input,
        remark,
        simpleDescription,
        amount,
        currency,
        paymentMethod,
        carPlate,
        mileage,
        tripInfo,
        fuelPrice,
        fuelType,
        taxAddons,
        photos,
        isAmountManuallySet,
        editingId,
        calendarEventId,
        selectedDateTime,
        eventStart,
        eventEnd,
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    paymentsReady,
    draftReady,
    isSubmitting,
    silentPhase,
    selectedTag,
    input,
    remark,
    simpleDescription,
    amount,
    currency,
    paymentMethod,
    carPlate,
    mileage,
    tripInfo,
    fuelPrice,
    fuelType,
    taxAddons,
    photos,
    isAmountManuallySet,
    editingId,
    calendarEventId,
    selectedDateTime,
    eventStart,
    eventEnd,
  ]);

  const formatDateTime = (date = new Date(), format = 'YMDHIS') => {
    const pad = (num) => num.toString().padStart(2, '0');
    const parts = {
      Y: date.getFullYear(),
      M: pad(date.getMonth() + 1),
      D: pad(date.getDate()),
      H: pad(date.getHours()),
      I: pad(date.getMinutes()),
      S: pad(date.getSeconds()),
    };
    if (format === 'YM') return `${parts.Y}${parts.M}`;
    return `${parts.Y}-${parts.M}-${parts.D} ${parts.H}:${parts.I}:${parts.S}`;
  };

  const resetData = () => {
    clearExpenseDraft();
    setInput('');
    setRemark('');
    setAmount('');
    setSelectedTag('');
    setCarPlate('');
    setPaymentMethod('');
    setPhotos([]);
    setMileage('');
    setTripInfo('');
    setSimpleDescription('');
    setIsAmountManuallySet(false);
    setEditingId(null);
    setSelectedDateTime(new Date());
    setEventStart(null);
    setEventEnd(null);
    setTaxAddons([]);
    setAiBusyIndex(-1);
    setAiError('');
    setAiSuggestions([]);
    setAiCopied('');
    setAiLocMsg('');
    setAiMeta({ model: '', prompt: '', photoHash: '', photoIndex: -1 });
    setAiPicked(null);
    setItemizedImport({ key: Date.now(), items: [] });
    setCalendarEventId('');
    setAiCalAsk(null);
    setAiPaste('');
  };

  const fillFromHistory = (entry) => {
    if (!entry) return;
    setEditingId(entry.id ?? entry.timestamp_ms ?? null);
    setInput(entry.title || '');
    const orig =
      entry.amount_original != null && entry.amount_original !== ''
        ? entry.amount_original
        : entry.amount;
    setAmount(orig != null ? String(orig) : '');
    setSelectedTag(entry.tag || '');
    setRemark(entry.remark || '');
    setSimpleDescription(entry.description || entry.remark || '');
    setCurrency(entry.currency || 'MYR');
    setPaymentMethod(
      resolvePaymentMethod(entry.payment_method || '', paymentOptions) ||
        entry.payment_method ||
        ''
    );
    setCarPlate(entry.carPlate || '');
    setMileage(entry.mileage || '');
    setTripInfo(entry.tripInfo || '');
    setFuelPrice(entry.fuelPrice || '');
    setFuelType(entry.fuelType || '');
    setIsAmountManuallySet(true);
    const ts = entry.timestamp_ms || entry.id;
    if (ts) setSelectedDateTime(new Date(Number(ts)));
    const parseExtra = (raw) => {
      if (!raw) return null;
      if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
      const d = new Date(String(raw).replace(' ', 'T'));
      return Number.isNaN(d.getTime()) ? null : d;
    };
    setEventStart(parseExtra(entry.event_start));
    setEventEnd(parseExtra(entry.event_end));
    setOutput('已回填，可修改後再提交（同時間戳會覆蓋更新）');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resolveGeoUrl = () => {
    if (smartLoc) return toMapsUrl(smartLoc.lat, smartLoc.lng, smartLoc.label || '');
    return mapsUrl || '';
  };

  /** Only focus when user submits with incomplete fields — never chase remark after picks */
  const focusFirstIncomplete = () => {
    if (!selectedTag || !input) {
      focusElement('.tag-collapsed-chip, .tag-container .tag, .manual-tag-input', 80);
      return '請選擇分類／項目';
    }
    if (!amount || amount === '0') {
      if (window.showCalculator) window.showCalculator();
      else focusElement('.amount-triple-amount', 80);
      return '請填入金額';
    }
    if (!paymentMethod) {
      focusElement('.amount-triple-payment', 80);
      return '請選擇付款方式';
    }
    return null;
  };

  const submitData = useCallback(async (opts = {}) => {
    const { signal, deferReset = false } = opts;
    const incomplete = focusFirstIncomplete();
    if (incomplete) {
      setOutput(incomplete);
      return false;
    }

    let loc = smartLoc;
    try {
      loc = (await resolveForAction()) || smartLoc;
    } catch {
      loc = smartLoc;
    }
    const geo = loc ? toMapsUrl(loc.lat, loc.lng, loc.label || '') : resolveGeoUrl();
    if (loc?.label && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      rememberNamedPoint({ lat: loc.lat, lng: loc.lng, name: loc.label });
    }
    const weekdayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    // 編輯模式沿用原 id；新筆用當前時間選擇器
    const id = editingId != null ? Number(editingId) : selectedDateTime.getTime();
    const dt = editingId != null ? new Date(Number(editingId)) : selectedDateTime;

    const hasCalendarRange = Boolean(eventStart && eventEnd);

    const contents_for_gsheets = {
      id,
      action: 'upsertExpense',
      timestamp_ms: id,
      timestamp: formatDateTime(dt, 'YMDHIS'),
      yearmonth: formatDateTime(dt, 'YM'),
      day: weekdayNames[dt.getDay()],
      title: input,
      amount: computeFinalAmount(amount, taxAddons),
      amount_input: amount,
      tax_addons: taxAddons,
      tax_tags: formatTaxAddonTags(taxAddons),
      remark,
      description: String(simpleDescription || '').trim(),
      geolocation: geo,
      location_label: loc?.label || '',
      latitude: loc?.lat ?? smartLoc?.lat ?? null,
      longitude: loc?.lng ?? smartLoc?.lng ?? null,
      tag: selectedTag,
      currency,
      payment_method: paymentMethod,
      event_start: eventStart ? formatDateTime(eventStart, 'YMDHIS') : '',
      event_end: eventEnd ? formatDateTime(eventEnd, 'YMDHIS') : '',
      calendar_event_id: calendarEventId || '',
      carPlate,
      mileage,
      tripInfo,
      fuelPrice,
      fuelType,
      photos: photos.map((photo) => photo.uploadedUrl || photo.base64).filter(Boolean),
      photo_urls: photos.map((photo) => photo.uploadedUrl || photo.previewUrl).filter(Boolean),
      ai_suggestion: aiPicked ? JSON.stringify(aiPicked) : '',
    };

    const historyEntry = {
      id,
      timestamp_ms: id,
      title: input,
      amount: computeFinalAmount(amount, taxAddons),
      tag: selectedTag,
      remark,
      description: String(simpleDescription || '').trim(),
      currency,
      payment_method: paymentMethod,
      event_start: eventStart ? formatDateTime(eventStart, 'YMDHIS') : '',
      event_end: eventEnd ? formatDateTime(eventEnd, 'YMDHIS') : '',
      carPlate,
      mileage,
      tripInfo,
      fuelPrice,
      fuelType,
    };

    if (signal?.aborted) {
      setOutput('已取消自動送出，請手動確認後再提交');
      return false;
    }

    setIsSubmitting(true);
    if (!deferReset) {
      setLog(pushExpenseHistory(historyEntry));
      setOutput(editingId != null ? '已加入佇列（更新）…' : '已加入佇列，同步中…');
      resetData();
    } else {
      setOutput('silent：正在送出…');
    }

    try {
      const result = await enqueueAndSend(contents_for_gsheets, { signal });
      if (result.aborted) {
        setOutput('已取消自動送出，請手動確認後再提交');
        return false;
      }
      if (deferReset) {
        setLog(pushExpenseHistory(historyEntry));
        resetData();
      }
      invalidateExpenseSummaryCache(formatDateTime(dt, 'YM'));
      if (selectedTag === '餐饮美食') invalidateEatPlacesCache();
      setOutput(
        result.sent
          ? hasCalendarRange
            ? '已送出 · 已寫入行事曆'
            : '已送出'
          : hasCalendarRange
            ? '已暫存佇列 · 含行事曆'
            : '目前離線或網路異常，已暫存於本機佇列，稍後自動同步'
      );
      return true;
    } catch (error) {
      setOutput(`佇列錯誤: ${error.toString()}`);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    editingId,
    selectedDateTime,
    eventStart,
    eventEnd,
    calendarEventId,
    input,
    amount,
    taxAddons,
    remark,
    simpleDescription,
    smartLoc,
    selectedTag,
    currency,
    paymentMethod,
    carPlate,
    mileage,
    tripInfo,
    fuelPrice,
    fuelType,
    photos,
    aiPicked,
    enqueueAndSend,
    mapsUrl,
    resolveForAction,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitDataRef = useRef(submitData);
  submitDataRef.current = submitData;

  // silent=true: 3s buffer, send at 2s; any click within 3s aborts → manual submit
  useEffect(() => {
    if (!pendingSilentRef.current) return undefined;
    if (!selectedTag || !input || !amount || amount === '0') return undefined;
    if (!paymentMethod) return undefined;

    pendingSilentRef.current = false;
    const ac = new AbortController();
    silentAbortRef.current = ac;
    let cancelled = false;
    let sendTimer = 0;
    let windowTimer = 0;
    const startedAt = Date.now();
    setSilentPhase('armed');
    setSilentRemainMs(3000);

    const tick = window.setInterval(() => {
      const left = Math.max(0, 3000 - (Date.now() - startedAt));
      setSilentRemainMs(left);
    }, 100);

    const cleanupListeners = () => {
      window.clearTimeout(sendTimer);
      window.clearTimeout(windowTimer);
      window.clearInterval(tick);
      document.removeEventListener('pointerdown', onPointer, true);
    };

    const abortSilent = () => {
      if (cancelled) return;
      cancelled = true;
      ac.abort();
      cleanupListeners();
      setSilentPhase('aborted');
      setSilentRemainMs(0);
      setOutput('已取消自動送出，請手動確認後再提交');
    };

    const onPointer = () => {
      abortSilent();
    };

    document.addEventListener('pointerdown', onPointer, true);

    sendTimer = window.setTimeout(async () => {
      if (cancelled || ac.signal.aborted) return;
      setSilentPhase('sending');
      const ok = await submitDataRef.current({ signal: ac.signal, deferReset: true });
      if (cancelled || ac.signal.aborted) {
        setSilentPhase('aborted');
        setOutput('已取消自動送出，請手動確認後再提交');
        return;
      }
      if (ok) {
        setSilentPhase(null);
        clearExpenseQuickQuery();
      } else if (!ac.signal.aborted) {
        setSilentPhase(null);
      }
    }, 2000);

    windowTimer = window.setTimeout(() => {
      document.removeEventListener('pointerdown', onPointer, true);
      window.clearInterval(tick);
      setSilentRemainMs(0);
    }, 3000);

    return () => {
      // Unmount only — do not abort in-flight silent send on dep churn
      cleanupListeners();
    };
  }, [selectedTag, input, amount, paymentMethod]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (silentPhase === 'armed' || silentPhase === 'sending') {
      silentAbortRef.current?.abort();
      setSilentPhase('aborted');
      setSilentRemainMs(0);
      setOutput('已取消自動送出，請手動確認後再提交');
      return;
    }
    await submitData();
  };

  const clearAmountSection = () => {
    setSelectedDateTime(new Date());
    setEventStart(null);
    setEventEnd(null);
    setCurrency('MYR');
    setAmount('');
    setPaymentMethod('');
    setIsAmountManuallySet(false);
    setTaxAddons([]);
  };

  const clearDescriptionSection = () => {
    setRemark('');
    setSimpleDescription('');
    setCarPlate('');
    setMileage('');
    setTripInfo('');
    setFuelPrice('');
    setFuelType('');
    setPhotos([]);
    setItemizedImport({ key: Date.now(), items: [] });
  };

  const clearAllWithConfirm = () => {
    if (!window.confirm('確定要全部清空嗎？分類、金額、備註都會清除。')) return;
    resetData();
    setOutput('');
  };

  const silentSec = Math.ceil(silentRemainMs / 1000);
  const [ledger, setLedger] = useState(ledgerFromLocation);

  useEffect(() => {
    const sync = () => setLedger(ledgerFromLocation());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const goLedger = (next) => {
    setLedger(next);
    const hash =
      next === 'scheduled'
        ? '#/expense?tab=scheduled'
        : next === 'summary'
          ? '#/expense?tab=summary'
          : '#/expense';
    applyHash(hash, {
      replace: true,
      state: window.history.state,
    });
  };

  return (
    <PageChrome title="記帳">
      <div className="app-container expense-page">
        <div className="ledger-tabs" role="tablist" aria-label="記帳方式">
          <button
            type="button"
            role="tab"
            aria-selected={ledger === 'now'}
            className={`ledger-tab${ledger === 'now' ? ' is-active' : ''}`}
            onClick={() => goLedger('now')}
          >
            <svg className="ledger-tab-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                fill="currentColor"
                d="M7 3h10a2 2 0 0 1 2 2v14l-7-3-7 3V5a2 2 0 0 1 2-2zm2 5v2h6V8H9zm0 4v2h6v-2H9z"
              />
            </svg>
            單筆
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ledger === 'scheduled'}
            className={`ledger-tab${ledger === 'scheduled' ? ' is-active' : ''}`}
            onClick={() => goLedger('scheduled')}
          >
            <svg className="ledger-tab-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                fill="currentColor"
                d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5a5 5 0 0 1-8.9 3.1L6.7 17.5A7 7 0 0 0 19 13c0-3.87-3.13-7-7-7zm-7 7c0-1.07.24-2.08.67-3L4.24 8.57A8.96 8.96 0 0 0 3 13a7 7 0 0 0 12.3 4.5l-1.4-1.4A5 5 0 0 1 5 13z"
              />
            </svg>
            排程
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ledger === 'summary'}
            className={`ledger-tab${ledger === 'summary' ? ' is-active' : ''}`}
            aria-label="報表"
            onClick={() => goLedger('summary')}
          >
            <svg className="ledger-tab-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                fill="currentColor"
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"
              />
            </svg>
            報表
          </button>
        </div>

        {ledger === 'scheduled' ? (
          <ObligationsPanel />
        ) : ledger === 'summary' ? (
          <ExpenseSummary />
        ) : (
          <>
        {(silentPhase === 'armed' || silentPhase === 'sending') && (
          <div className="silent-submit-banner" role="status">
            <div className="silent-submit-banner-main">
              {silentPhase === 'sending'
                ? '正在自動送出…點擊畫面可取消'
                : `silent 自動送出倒數 ${silentSec}s（2s 送出）· 點擊畫面取消`}
            </div>
            <button
              type="button"
              className="silent-submit-cancel"
              onClick={() => {
                silentAbortRef.current?.abort();
                setSilentPhase('aborted');
                setSilentRemainMs(0);
                setOutput('已取消自動送出，請手動確認後再提交');
              }}
            >
              取消
            </button>
          </div>
        )}
        <div className={`step-section${!(selectedTag && String(input || '').trim()) ? ' is-incomplete' : ''}`}>
          <TagSelector
            input={input}
            setInput={setInput}
            setRemark={setRemark}
            setAmount={setAmount}
            selectedTag={selectedTag}
            setSelectedTag={handleSetSelectedTag}
          />
        </div>

        <div className="step-section amount-block">
          <SectionHead title="時間／金額／付款" onClear={clearAmountSection} />
          <div className="amount-datetime-slot">
            <ExpenseDateTimeRow
              value={selectedDateTime}
              onChange={setSelectedDateTime}
              eventStart={eventStart}
              setEventStart={setEventStart}
              eventEnd={eventEnd}
              setEventEnd={setEventEnd}
            />
          </div>
          <AmountTripleRow
            currency={currency}
            setCurrency={setCurrency}
            amount={amount}
            setAmount={setAmount}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            paymentOptions={paymentOptions}
            onAmountComplete={handleAmountComplete}
            selectedTag={selectedTag}
            input={input}
            carPlate={carPlate}
            setCarPlate={setCarPlate}
          />
          <TaxAddonStrip
            amount={amount}
            addons={taxAddons}
            setAddons={setTaxAddons}
          />
        </div>

        <div className="remark-row">
          <div className="remark-container-wrapper remark-container-wrapper--polished">
            <SectionHead
              title="備註說明"
              onClear={clearDescriptionSection}
              leading={
                <CameraAICapture
                  onPhotoReady={(photoData) => {
                    setPhotos((prev) => {
                      const next = [...prev, photoData];
                      setEditPhotoIndex(next.length - 1);
                      return next;
                    });
                  }}
                />
              }
            />
            <details
              className="ai-photo-prompt"
              onToggle={(e) => {
                if (e.currentTarget.open) ensureAiPromptLoaded();
              }}
            >
              <summary>
                <span className="ai-photo-prompt-title">📷 AI prompt</span>
                <span className="ai-photo-prompt-sub">照片建議 · 也可貼外部回傳 JSON</span>
                {aiTemplate !== aiTemplateSaved ? (
                  <span className="ai-photo-prompt-chip">未儲存</span>
                ) : null}
              </summary>
              <div className="ai-suggest-hint">{'{{tag}} {{title}} {{cats}} {{subcats}} {{fields}} {{hints}} {{when}}'}</div>
              <textarea
                className="ai-suggest-tpl"
                rows={10}
                value={aiTemplate}
                onChange={(e) => setAiTemplate(e.target.value)}
                spellCheck={false}
              />
              <div className="ai-suggest-meta">
                <button
                  type="button"
                  className="ai-suggest-copy"
                  disabled={aiTplBusy}
                  onClick={() => setAiTemplate(DEFAULT_RECEIPT_PROMPT_TEMPLATE)}
                >
                  預設
                </button>
                <button
                  type="button"
                  className="ai-suggest-copy"
                  disabled={aiTplBusy || aiTemplate === aiTemplateSaved}
                  onClick={saveAiTemplate}
                >
                  {aiTplBusy ? '…' : '儲存'}
                </button>
                <button type="button" className="ai-suggest-copy" onClick={copyAiCurl}>
                  {aiCopied === '已複製 curl' ? aiCopied : '複製 curl'}
                </button>
                {aiTplMsg ? <span className="ai-suggest-hint">{aiTplMsg}</span> : null}
              </div>
              <div className="ai-suggest-hint">外部 AI 回傳貼這裡，啰嗦文字會忽略，只讀 JSON</div>
              <textarea
                className="ai-suggest-tpl ai-suggest-paste"
                rows={5}
                value={aiPaste}
                onChange={(e) => setAiPaste(e.target.value)}
                placeholder='{"suggestions":[{...}]}'
                spellCheck={false}
              />
              <div className="ai-suggest-meta">
                <button
                  type="button"
                  className="ai-suggest-copy"
                  disabled={!String(aiPaste || '').trim()}
                  onClick={applyExternalPaste}
                >
                  套用 JSON
                </button>
              </div>
            </details>
            <Remark
              input={input}
              setInput={setInput}
              remark={remark}
              setCarPlate={setCarPlate}
              carPlate={carPlate}
              setRemark={setRemark}
              amount={amount}
              selectedTag={selectedTag}
              onItemizedTotalChange={handleItemizedTotalChange}
              mileage={mileage}
              setMileage={setMileage}
              tripInfo={tripInfo}
              setTripInfo={setTripInfo}
              simpleDescription={simpleDescription}
              setSimpleDescription={setSimpleDescription}
              itemizedImport={itemizedImport}
              hideDescriptionHeader
              onFuelDataChange={({ fuelPrice: fp, fuelType: ft }) => {
                setFuelPrice(fp);
                setFuelType(ft);
              }}
            />

            {currencyConversions.length > 0 && (
              <div className="currency-history">
                <h4>汇率换算记录:</h4>
                {currencyConversions.map((conversion, index) => (
                  <div key={index} className="conversion-record">
                    {conversion.originalAmount} {conversion.from} → {conversion.convertedAmount}{' '}
                    {conversion.to} (汇率: {conversion.rate})
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {photos.length > 0 && (
          <div className="photos-display-row">
            <div className="photos-grid">
              {photos.map((photo, index) => (
                <div
                  key={index}
                  className={`photo-display-item${aiBusyIndex === index ? ' is-ai-busy' : ''}${aiPicked && aiMeta.photoIndex === index ? ' is-ai-picked' : ''}`}
                >
                  <button
                    type="button"
                    className="photo-display-open"
                    onClick={() => setEditPhotoIndex(index)}
                    title="裁切／調壓縮"
                  >
                    <img src={photo.preview} alt={`照片 ${index + 1}`} className="photo-display-img" />
                  </button>
                  <div className="photo-display-info">
                    <span className="photo-display-name">{photo.filename}</span>
                    <span className="photo-display-size">
                      {`送出 ${formatReceiptSize(photo.compressedSize || photo.originalSize)}`}
                      {photo.originalSize
                        ? ` · 原圖 ${formatReceiptSize(photo.originalSize)}`
                        : ''}
                    </span>
                  </div>
                  <div className="photo-display-actions">
                    <button
                      type="button"
                      className="photo-ai-btn"
                      onClick={() => setEditPhotoIndex(index)}
                    >
                      裁切／壓縮
                    </button>
                    <button
                      type="button"
                      className="photo-ai-btn"
                      disabled={aiBusyIndex >= 0}
                      onClick={() => askAiForPhoto(index)}
                    >
                      {aiBusyIndex === index ? '辨識中…' : '建議'}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="photo-display-remove"
                    onClick={() => {
                      const next = photos.filter((_, i) => i !== index);
                      setPhotos(next);
                      if (editPhotoIndex === index) setEditPhotoIndex(-1);
                      else if (editPhotoIndex > index) setEditPhotoIndex((n) => n - 1);
                      if (aiMeta.photoIndex === index) {
                        setAiSuggestions([]);
                        setAiError('');
                        setAiCopied('');
                        setAiMeta({ model: '', prompt: '', photoHash: '', photoIndex: -1 });
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {editPhotoIndex >= 0 && photos[editPhotoIndex] ? (
          <ReceiptPhotoEditor
            photo={photos[editPhotoIndex]}
            onClose={() => setEditPhotoIndex(-1)}
            onApply={(next) => {
              setPhotos((list) => list.map((p, i) => (i === editPhotoIndex ? next : p)));
              setEditPhotoIndex(-1);
            }}
          />
        ) : null}
        {(aiError || aiMeta.prompt || aiSuggestions.length > 0 || aiCalAsk || aiPicked) && (
          <div className="ai-suggest-follow">
            {(aiError || aiMeta.prompt || aiSuggestions.length > 0) && (
              <div className="ai-suggest-panel">
                {aiError ? <div className="ai-suggest-error">{aiError}</div> : null}
                <div className="ai-suggest-meta">
                  <span className="ai-suggest-model">
                    {aiBusyIndex >= 0
                      ? 'model 辨識中'
                      : aiMeta.model
                        ? aiMeta.tried && aiMeta.tried.length > 1 && aiMeta.tried[0] !== aiMeta.model
                          ? `${aiMeta.model}（備援）`
                          : aiMeta.model
                        : 'model 未回傳'}
                  </span>
                  {aiMeta.prompt ? (
                    <button type="button" className="ai-suggest-copy" onClick={copyAiPrompt}>
                      {aiCopied === '已複製 prompt' ? aiCopied : '複製 prompt'}
                    </button>
                  ) : null}
                  {aiMeta.prompt || (photos[0] && photos[0].base64) ? (
                    <button type="button" className="ai-suggest-copy" onClick={copyAiCurl}>
                      {aiCopied === '已複製 curl' ? aiCopied : '複製 curl'}
                    </button>
                  ) : null}
                </div>
                {aiError ? (
                  <div className="ai-suggest-hint">
                    建議直打 Gemini，8 秒內沒回就改 OpenAI。複製 curl 不含照片。
                  </div>
                ) : null}
                {aiMeta.prompt ? (
                  <details className="ai-suggest-prompt-wrap">
                    <summary>照片辨識 · 實際送出</summary>
                    <pre className="ai-suggest-prompt">{aiMeta.prompt}</pre>
                  </details>
                ) : null}
                {aiSuggestions.length > 0 ? (
                  <>
                    <div className="ai-suggest-head">選一筆填入欄位</div>
                    <div className="ai-suggest-list">
                      {aiSuggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          className="ai-suggest-card"
                          onClick={() => pickAiSuggestion(s)}
                        >
                          {suggestionSummary(s)}
                          {Array.isArray(s.items) && s.items.length ? (
                            <div className="ai-suggest-items">
                              {s.items
                                .slice(0, 4)
                                .map((it) => it.name)
                                .filter(Boolean)
                                .join('、')}
                              {s.items.length > 4 ? '…' : ''}
                            </div>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            )}
            {aiCalAsk ? (
              <div className="ai-suggest-ask">
                <div>
                  {aiCalAsk.inferredEnd
                    ? `掃描到開始 ${formatWhen(aiCalAsk.start)}，用現在當結束並寫入行事曆？`
                    : `掃描到 ${formatWhen(aiCalAsk.start)} → ${formatWhen(aiCalAsk.end)}，寫入行事曆？`}
                </div>
                <div className="ai-suggest-ask-actions">
                  <button type="button" className="ai-suggest-copy" onClick={() => confirmAiCalendar(true)}>
                    寫入
                  </button>
                  <button type="button" className="ai-suggest-copy" onClick={() => confirmAiCalendar(false)}>
                    不用
                  </button>
                </div>
              </div>
            ) : null}
            {aiPicked && aiSuggestions.length === 0 && !aiError ? (
              <div className="ai-suggest-picked">
                已套用{aiPicked.label ? ` · ${aiPicked.label}` : ''}
                {aiLocMsg ? ` · ${aiLocMsg}` : ''}
              </div>
            ) : null}
          </div>
        )}

        {editingId != null && (
          <div className="expense-editing-banner">
            編輯模式 · 提交後將覆蓋原紀錄
            <button type="button" className="expense-editing-cancel" onClick={resetData}>
              取消編輯
            </button>
          </div>
        )}
        {hasUnsavedInput && editingId == null && (
          <div className="expense-draft-banner">
            本機暫存 · 關掉或切頁後可繼續 · 全部清空才會丟
          </div>
        )}

        <div className="submit-section submit-section--actions">
          <button type="button" className="submit submit--ghost" onClick={clearAllWithConfirm}>
            全部清空
          </button>
          <button
            type="button"
            className="submit submit--primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !amount || !selectedTag || !input}
          >
            {isSubmitting
              ? '佇列中…'
              : !amount || !selectedTag || !input
                ? !amount
                  ? '請填入金額'
                  : '請先完成分類'
                : editingId != null
                  ? '更新並送出'
                  : '提交'}
          </button>
        </div>

        <Log
          log={log}
          onSelect={fillFromHistory}
          onClear={() => {
            clearExpenseHistory();
            setLog([]);
          }}
        />
        <Output output={output} />

        <div className="expense-footer-meta">
          <span className="expense-version-foot">v{getBuildVersion()}</span>
        </div>
          </>
        )}
      </div>
    </PageChrome>
  );
}

export default ExpensePage;
