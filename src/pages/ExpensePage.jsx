import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import TagSelector from '../TagSelector';
import Remark from '../Remark';
import Log from '../Log';
import Output from '../Output';
import '../App.css';
import { EXPENSE_TAGS } from '../config';
import ExpenseDateTimeRow from '../components/ExpenseDateTimeRow';
import { focusElement } from '../utils/keyboardNavigation';
import PageChrome from '../components/PageChrome';
import AmountTripleRow from '../components/AmountTripleRow';
import TaxAddonStrip, { computeFinalAmount, formatTaxAddonTags } from '../components/TaxAddonStrip';
import CameraAICapture from '../components/CameraAICapture';
import { useOfflineQueue } from '../context/QueueContext';
import { useSmartLocation } from '../hooks/useSmartLocation';
import { toMapsUrl } from '../utils/locationStorage';
import { rememberNamedPoint } from '../utils/landmarkRegions';
import { getBuildVersion } from '../utils/buildInfo';
import {
  loadExpenseHistory,
  pushExpenseHistory,
  clearExpenseHistory,
} from '../utils/expenseHistory';
import SectionHead from '../components/SectionHead';
import {
  DEFAULT_PAYMENT_OPTIONS,
  ensureAppBootstrap,
  readPaymentOptionsCache,
  subscribeAppBootstrap,
} from '../utils/appBootstrap';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import { applyHash, getHashPath, ROUTES } from '../utils/routing';
import {
  parseExpenseQuickDraft,
  clearExpenseQuickQuery,
  getMergedQueryParams,
} from '../utils/expenseQuickUrl';
import { ObligationsPanel } from './ObligationsPage';
import ExpenseSummary from '../components/ExpenseSummary';
import { invalidateExpenseSummaryCache } from '../utils/expenseSummary';

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
  /** silent countdown UI: armed | sending | aborted | null */
  const [silentPhase, setSilentPhase] = useState(null);
  const [silentRemainMs, setSilentRemainMs] = useState(0);

  const [selectedTag, setSelectedTag] = useState(null);
  const tags = EXPENSE_TAGS;
  const [input, setInput] = useState('');
  const [remark, setRemark] = useState('');
  const [carPlate, setCarPlate] = useState('');
  const [tripInfo, setTripInfo] = useState('');
  const [mileage, setMileage] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [log, setLog] = useState(() => loadExpenseHistory());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [output, setOutput] = useState('');
  const [selectedDateTime, setSelectedDateTime] = useState(new Date());
  const [eventStart, setEventStart] = useState(null);
  const [eventEnd, setEventEnd] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [simpleDescription, setSimpleDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  /** When set, submit keeps this id → GAS Replace Into（編輯既有筆） */
  const [editingId, setEditingId] = useState(null);
  /** Tax/service addons — do not mutate main amount input */
  const [taxAddons, setTaxAddons] = useState([]);
  const [paymentOptions, setPaymentOptions] = useState(
    () => readPaymentOptionsCache({ allowStale: true }) || DEFAULT_PAYMENT_OPTIONS
  );
  const [currencyConversions, setCurrencyConversions] = useState([]);
  const [isAmountManuallySet, setIsAmountManuallySet] = useState(false);
  const [itemizedTotal, setItemizedTotal] = useState(0);
  const [fuelPrice, setFuelPrice] = useState('');
  const [fuelType, setFuelType] = useState('');

  /** Guard reload only for cat / subcat / amount / 備註 — ignore payment, date, plate, etc. */
  const hasUnsavedInput = useMemo(() => {
    const amt = String(amount || '').trim();
    const hasAmount = amt !== '' && amt !== '0' && amt !== '0.00';
    return Boolean(
      selectedTag ||
        String(input || '').trim() ||
        hasAmount ||
        String(remark || '').trim() ||
        String(simpleDescription || '').trim()
    );
  }, [selectedTag, input, amount, remark, simpleDescription]);

  useUnsavedGuard(hasUnsavedInput, { whenPath: ROUTES.EXPENSE });

  const handlePhotoChange = (photosData) => setPhotos(photosData);
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
    ensureAppBootstrap();
    return subscribeAppBootstrap(() => {
      const cached = readPaymentOptionsCache({ allowStale: true });
      if (cached) setPaymentOptions(cached);
    });
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

  // URL quick entry: #/expense?cat=&subcat=&amount=&desc=&timestamp=&paymentmethod=&currency=&latlong=
  useEffect(() => {
    if (!paymentsReady || quickAppliedRef.current) return;
    const draft = parseExpenseQuickDraft(paymentOptions);
    if (!draft.hasQuickKeys) {
      quickAppliedRef.current = true;
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
  }, [paymentsReady, paymentOptions, setCachedLocation]);

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
  };

  const fillFromHistory = (entry) => {
    if (!entry) return;
    setEditingId(entry.id ?? entry.timestamp_ms ?? null);
    setInput(entry.title || '');
    setAmount(entry.amount != null ? String(entry.amount) : '');
    setSelectedTag(entry.tag || '');
    setRemark(entry.remark || '');
    setSimpleDescription(entry.description || entry.remark || '');
    setCurrency(entry.currency || 'MYR');
    setPaymentMethod(entry.payment_method || '');
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
      latitude: loc?.lat ?? smartLoc?.lat ?? null,
      longitude: loc?.lng ?? smartLoc?.lng ?? null,
      tag: selectedTag,
      currency,
      payment_method: paymentMethod,
      event_start: eventStart ? formatDateTime(eventStart, 'YMDHIS') : '',
      event_end: eventEnd ? formatDateTime(eventEnd, 'YMDHIS') : '',
      carPlate,
      mileage,
      tripInfo,
      fuelPrice,
      fuelType,
      photos: photos.map((photo) => photo.uploadedUrl || photo.base64).filter(Boolean),
      photo_urls: photos.map((photo) => photo.uploadedUrl || photo.previewUrl).filter(Boolean),
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
            tags={tags}
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
                    setPhotos((prev) => [...prev, photoData]);
                    handlePhotoChange([...photos, photoData]);
                  }}
                  onExtracted={() => {}}
                />
              }
            />
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
                <div key={index} className="photo-display-item">
                  <img src={photo.preview} alt={`照片 ${index + 1}`} className="photo-display-img" />
                  <div className="photo-display-info">
                    <span className="photo-display-name">{photo.filename}</span>
                    <span className="photo-display-size">{formatFileSize(photo.originalSize)}</span>
                  </div>
                  <button
                    type="button"
                    className="photo-display-remove"
                    onClick={() => {
                      const newPhotos = photos.filter((_, i) => i !== index);
                      setPhotos(newPhotos);
                      handlePhotoChange(newPhotos);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
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
