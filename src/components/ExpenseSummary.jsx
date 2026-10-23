import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  catSubcat,
  colorForTag,
  compactAmount,
  currentYearMonth,
  emptyExpenseSummary,
  pendingExpenseSummary,
  fetchExpenseSummary,
  formatMoney,
  formatTimestamp,
  isYearMonthFuture,
  mergeExpenseSummaries,
  normalizeYearMonth,
  readExpenseSummaryCache,
  readYearTotals,
  recordTag,
  shiftYearMonth,
  timestampMs,
  yearMonthsThroughNow,
  yearMonthStatuses,
} from '../utils/expenseSummary';
import { displayFxCodes, fromMyr } from '../utils/fxRates';
import { getMergedQueryParams } from '../utils/expenseQuickUrl';
import ExpenseHeatMap, { heatGeoCount } from './ExpenseHeatMap';
import Holdable from './Holdable';

const FX_PREF_KEY = 'expenseSummary.displayFx';

function readFxPref() {
  try {
    const v = String(localStorage.getItem(FX_PREF_KEY) || 'MYR').toUpperCase();
    return v || 'MYR';
  } catch {
    return 'MYR';
  }
}

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function toggleTag(list, tag) {
  const s = String(tag || '').trim();
  if (!s) return [];
  return list.includes(s) ? list.filter((t) => t !== s) : [...list, s];
}

function donutPath(cx, cy, r0, r1, a0, a1) {
  const sweep = Math.max(0, a1 - a0);
  if (sweep <= 0) return '';
  if (sweep >= 359.9) {
    return [
      `M ${cx} ${cy - r1}`,
      `A ${r1} ${r1} 0 1 1 ${cx + 0.01} ${cy - r1}`,
      `L ${cx + 0.01} ${cy - r0}`,
      `A ${r0} ${r0} 0 1 0 ${cx} ${cy - r0}`,
      'Z',
    ].join(' ');
  }
  const large = sweep > 180 ? 1 : 0;
  const [x0, y0] = polar(cx, cy, r1, a0);
  const [x1, y1] = polar(cx, cy, r1, a1);
  const [x2, y2] = polar(cx, cy, r0, a1);
  const [x3, y3] = polar(cx, cy, r0, a0);
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

function Donut({ slices, total, pickedTags, labelMode, onPick, onEnableMulti }) {
  const cx = 50;
  const cy = 50;
  const r0 = 29;
  const r1 = 48;
  if (!slices.length || !total) {
    return (
      <svg className="expense-donut" viewBox="0 0 100 100" aria-hidden>
        <circle cx={cx} cy={cy} r={(r0 + r1) / 2} fill="none" stroke="var(--border, #333945)" strokeWidth="14" />
      </svg>
    );
  }
  let acc = 0;
  return (
    <svg className="expense-donut" viewBox="0 0 100 100" role="img" aria-label="分類占比">
      {slices.map((s) => {
        const frac = s.amount / total;
        const a0 = acc * 360;
        const a1 = (acc + frac) * 360;
        acc += frac;
        const dim = pickedTags.length > 0 && !pickedTags.includes(s.tag);
        const mid = (a0 + a1) / 2;
        const [lx, ly] = polar(cx, cy, (r0 + r1) / 2, mid);
        const showLabel = frac >= 0.07;
        const label = labelMode === 'amount' ? compactAmount(s.displayAmount) : `${Math.round(frac * 100)}%`;
        return (
          <g key={s.tag}>
            <Holdable
              as="path"
              d={donutPath(cx, cy, r0, r1, a0, a1)}
              fill={s.color}
              opacity={dim ? 0.32 : 1}
              style={{ cursor: 'pointer' }}
              onClick={() => onPick(s.tag)}
              onHold={() => onEnableMulti?.(s.tag)}
            />
            {showLabel ? (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="expense-donut-label"
                pointerEvents="none"
              >
                {label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function YearStrip({ ym, totals, statuses, onPickMonth, fx, multi, pickedYms, onToggleMonth, onEnableMulti }) {
  const year = String(ym).slice(0, 4);
  const cur = Number(String(ym).slice(5, 7)) || 1;
  const bars = Array.from({ length: 12 }, (_, i) => Number(totals[i]) || 0);
  const max = Math.max(1, ...bars);
  const [showAmt, setShowAmt] = useState(false);
  const holdRef = useRef(0);
  const heldRef = useRef(false);
  const picked = pickedYms || [];

  const clearHold = () => {
    if (holdRef.current) {
      window.clearTimeout(holdRef.current);
      holdRef.current = 0;
    }
  };

  return (
    <div
      className={`expense-year-strip${showAmt ? ' is-labeled' : ''}${multi ? ' is-multi' : ''}`}
      role="list"
      aria-label={`${year} 月支出`}
    >
      {bars.map((n, i) => {
        const month = i + 1;
        const nextYm = `${year}-${String(month).padStart(2, '0')}`;
        const on = multi ? picked.includes(nextYm) : month === cur;
        const status = statuses[i] || 'uncached';
        const pending = status === 'uncached';
        const h = n > 0 ? Math.max(10, Math.round((n / max) * (showAmt ? 28 : 34))) : 4;
        return (
          <button
            key={month}
            type="button"
            className={`expense-year-bar${on ? ' is-on' : ''} ${status}${n <= 0 ? ' is-zero' : ''}`}
            style={{ '--h': `${h}px` }}
            aria-label={`${nextYm}${showAmt ? ` ${formatMoney(fromMyr(n, fx))}` : ''}${pending ? ' 未載入' : ''}`}
            title={
              status === 'future'
                ? `${nextYm} · 未發生`
                : multi
                  ? `${nextYm} · 長按可開關多月`
                  : `${nextYm} · ${fx} ${formatMoney(fromMyr(n, fx))}${pending ? ' · 未載入' : ''} · 長按多月`
            }
            onPointerDown={() => {
              if (status === 'future') return;
              heldRef.current = false;
              clearHold();
              holdRef.current = window.setTimeout(() => {
                holdRef.current = 0;
                heldRef.current = true;
                onEnableMulti(nextYm);
              }, 650);
            }}
            onPointerUp={clearHold}
            onPointerLeave={clearHold}
            onPointerCancel={clearHold}
            onClick={() => {
              if (heldRef.current) {
                heldRef.current = false;
                return;
              }
              if (status === 'future') return;
              if (multi) {
                onToggleMonth(nextYm);
                return;
              }
              if (on) setShowAmt((v) => !v);
              else onPickMonth(nextYm);
            }}
          >
            {pending ? <b>?</b> : <b className="is-spacer" />}
            {showAmt ? <em>{n > 0 ? compactAmount(fromMyr(n, fx)) : '0'}</em> : null}
            <i />
            <span>{month}</span>
          </button>
        );
      })}
    </div>
  );
}

function CategoryBars({ slices, total, pickedTags, onPick, onEnableMulti, multi, fx }) {
  const max = Math.max(1, ...slices.map((s) => s.amount));
  if (!slices.length) return null;
  return (
    <div className="expense-bars-wrap">
      <div className="expense-bars-head">
        <span>分類</span>
        <span>筆</span>
        <span />
        <span>金額</span>
        <span>％</span>
      </div>
      <ul className={`expense-bars${pickedTags.length ? ' has-pick' : ''}${multi ? ' is-multi' : ''}`}>
        {slices.map((s) => {
          const on = pickedTags.includes(s.tag);
          const pct = total ? Math.round((s.amount / total) * 100) : 0;
          return (
            <li key={s.tag}>
              <Holdable
                className={`expense-bar-btn${on ? ' is-on' : ''}`}
                title={multi ? `${s.tag} · 長按可開關多項` : `${s.tag} · 長按多選`}
                onClick={() => onPick(s.tag)}
                onHold={() => onEnableMulti?.(s.tag)}
              >
                <span className="expense-bar-name">{s.tag}</span>
                <span className="expense-bar-count">{Number(s.count) || 0}</span>
                <span className="expense-bar-track">
                  <i style={{ width: `${Math.max(4, (s.amount / max) * 100)}%`, background: s.color }} />
                </span>
                <span className="expense-bar-amt">
                  {fromMyr(s.amount, fx).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="expense-bar-pct">{pct}%</span>
              </Holdable>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SORT_KEYS = [
  { id: 'timestamp', label: '時間' },
  { id: 'cat', label: '分類' },
  { id: 'description', label: '說明' },
  { id: 'amount', label: '金額' },
];

function sortValue(row, key) {
  if (key === 'amount') return Number(row.amount) || 0;
  if (key === 'timestamp') return timestampMs(row.timestamp) || Number(row.id) || 0;
  if (key === 'cat') return catSubcat(row).toLowerCase();
  return String(row.description || '').toLowerCase();
}

function DescCell({ id, text, openId, onToggle }) {
  const full = String(text || '').trim() || '—';
  const long = full.length > 28;
  const open = Boolean(id) && openId === id;
  if (!long) return <td>{full}</td>;
  return (
    <td className={open ? 'is-open' : 'is-clip'}>
      <button type="button" onClick={() => onToggle(id)}>
        {full}
      </button>
    </td>
  );
}

function RecordsTable({
  rows,
  currency,
  focusId,
  tags,
  pickedTags,
  multi,
  onToggle,
  onEnableMulti,
  onSelectAll,
  sort,
  onSort,
  onHide,
}) {
  const [openDesc, setOpenDesc] = useState('');
  const allCount = tags.reduce((n, t) => n + (Number(t.count) || 0), 0);
  const picked = pickedTags || [];
  const allOn = tags.length > 0 && picked.length === tags.length;
  const chipCount = picked.length
    ? picked.reduce((n, tag) => n + (Number(tags.find((t) => t.tag === tag)?.count) || 0), 0)
    : allCount;
  return (
    <div className="expense-records">
      <div className="expense-records-toolbar">
        <div className={`expense-records-filters${multi ? ' is-multi' : ''}`}>
          <Holdable
            className={`expense-chip${picked.length === 0 || allOn ? ' is-on' : ''}`}
            title="單擊全部 · 長按全選多項"
            onClick={() => onToggle('')}
            onHold={() => onSelectAll?.()}
          >
            全部
            <em>{allCount}</em>
          </Holdable>
          {tags.map((t) => (
            <Holdable
              key={t.tag}
              className={`expense-chip${picked.includes(t.tag) ? ' is-on' : ''}`}
              title={multi ? `${t.tag} · 長按可開關多項` : `${t.tag} · 長按多選`}
              onClick={() => onToggle(t.tag)}
              onHold={() => onEnableMulti?.(t.tag)}
            >
              {t.tag}
              <em>{t.count}</em>
            </Holdable>
          ))}
        </div>
        <button type="button" className="expense-records-hide" onClick={onHide}>
          隱藏
        </button>
      </div>
      <div className="expense-records-scroller">
        <table className="expense-records-table">
          <thead>
            <tr>
              {SORT_KEYS.map((col) => {
                const on = sort.key === col.id;
                return (
                  <th key={col.id}>
                    <button type="button" onClick={() => onSort(col.id)}>
                      {col.label}
                      {on ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="expense-summary-empty">
                  {chipCount > 0 ? '紀錄未載入' : '沒有紀錄'}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const rid = String(row.id || `${row.timestamp || 'row'}-${i}`);
                return (
                <tr
                  key={rid}
                  className={focusId && String(row.id) === String(focusId) ? 'is-focus' : ''}
                >
                  <td>{formatTimestamp(row.timestamp)}</td>
                  <td>{catSubcat(row)}</td>
                  <DescCell
                    id={rid}
                    text={row.description}
                    openId={openDesc}
                    onToggle={(next) => setOpenDesc((cur) => (cur === next ? '' : next))}
                  />
                  <td className="is-num">
                    {formatMoney(fromMyr(row.amount, currency))}
                    {row.currency &&
                    row.amount_original !== '' &&
                    row.amount_original != null &&
                    String(row.currency).toUpperCase() !== String(currency).toUpperCase() ? (
                      <small>
                        {row.currency} {formatMoney(row.amount_original)}
                      </small>
                    ) : null}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpenseSummary() {
  const q = getMergedQueryParams();
  const focusId = q.get('id') || '';
  const [ym, setYm] = useState(() => normalizeYearMonth(q.get('ym')) || currentYearMonth());
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [pickedTags, setPickedTags] = useState([]);
  const [multiTags, setMultiTags] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [labelMode, setLabelMode] = useState('pct');
  const [fx, setFx] = useState(readFxPref);
  const [sort, setSort] = useState({ key: 'timestamp', dir: 'desc' });
  const [heatOpen, setHeatOpen] = useState(false);
  const [multiMonths, setMultiMonths] = useState(false);
  const [pickedMonths, setPickedMonths] = useState([]);
  const [monthPacks, setMonthPacks] = useState({});
  const [yearBusy, setYearBusy] = useState('');
  const seqRef = useRef(0);
  const yearSeqRef = useRef(0);

  const load = useCallback(
    ({ force = false } = {}) => {
      const seq = ++seqRef.current;
      setErr('');
      if (!force && !focusId) {
        if (isYearMonthFuture(ym)) {
          setData(emptyExpenseSummary(ym));
          setLoading(false);
          return;
        }
        const cached = readExpenseSummaryCache(ym);
        if (cached) {
          setData(cached);
          setLoading(false);
          return;
        }
        setData(pendingExpenseSummary(ym));
      }
      setLoading(true);
      fetchExpenseSummary({ yearmonth: ym, id: focusId || undefined, force })
        .then((next) => {
          if (seq !== seqRef.current) return;
          setData(next);
          const packedYm = normalizeYearMonth(next?.yearmonth) || ym;
          setMonthPacks((prev) => ({ ...prev, [packedYm]: next }));
        })
        .catch((e) => {
          if (seq !== seqRef.current) return;
          setErr(e.message || String(e));
        })
        .finally(() => {
          if (seq === seqRef.current) setLoading(false);
        });
    },
    [ym, focusId]
  );

  useEffect(() => {
    load({ force: false });
  }, [load]);

  useEffect(() => {
    setPickedTags([]);
    setMultiTags(false);
    setShowTable(false);
    setHeatOpen(false);
    const year = String(ym).slice(0, 4);
    setPickedMonths((prev) => prev.filter((m) => String(m).slice(0, 4) === year));
  }, [ym]);

  const ensureMonth = useCallback(async (targetYm) => {
    const key = normalizeYearMonth(targetYm);
    if (!key || isYearMonthFuture(key)) return null;
    const cached = readExpenseSummaryCache(key);
    if (cached) {
      setMonthPacks((prev) => (prev[key] ? prev : { ...prev, [key]: cached }));
      return cached;
    }
    const next = await fetchExpenseSummary({ yearmonth: key });
    setMonthPacks((prev) => ({ ...prev, [key]: next }));
    return next;
  }, []);

  const enableMulti = (seedYm) => {
    const key = normalizeYearMonth(seedYm) || ym;
    setMultiMonths(true);
    setPickedMonths((prev) => {
      const base = prev.length ? prev : [ym];
      return base.includes(key) ? base : [...base, key];
    });
    ensureMonth(key).catch(() => {});
  };

  const toggleMonth = (targetYm) => {
    const key = normalizeYearMonth(targetYm);
    if (!key || isYearMonthFuture(key)) return;
    setPickedMonths((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((m) => m !== key);
        return next.length ? next : prev;
      }
      return [...prev, key].sort();
    });
    ensureMonth(key).catch((e) => setErr(e.message || String(e)));
  };

  const fetchWholeYear = async () => {
    const months = yearMonthsThroughNow(String(ym).slice(0, 4));
    if (
      !window.confirm(
        `會依序抓 ${months[0]}–${months[months.length - 1]}（已快取的會跳過）。全年較久，確定？`
      )
    ) {
      return;
    }
    const seq = ++yearSeqRef.current;
    setMultiMonths(true);
    setPickedMonths(months);
    setErr('');
    for (let i = 0; i < months.length; i += 1) {
      if (seq !== yearSeqRef.current) return;
      const key = months[i];
      setYearBusy(`${key} · ${i + 1}/${months.length}`);
      try {
        await ensureMonth(key);
      } catch (e) {
        if (seq !== yearSeqRef.current) return;
        setErr(e.message || String(e));
        break;
      }
    }
    if (seq === yearSeqRef.current) setYearBusy('');
  };

  const fxCodes = displayFxCodes();

  useEffect(() => {
    if (fx !== 'MYR' && !fxCodes.includes(fx)) setFx('MYR');
    try {
      localStorage.setItem(FX_PREF_KEY, fx);
    } catch {
      /* ignore */
    }
  }, [fx, fxCodes]);

  const viewMonths = useMemo(
    () => (multiMonths && pickedMonths.length ? pickedMonths : [ym]),
    [multiMonths, pickedMonths, ym]
  );
  const merged = useMemo(() => {
    const packs = viewMonths.map((key) => {
      if (monthPacks[key]) return monthPacks[key];
      if (normalizeYearMonth(data?.yearmonth) === key) return data;
      return readExpenseSummaryCache(key);
    });
    return mergeExpenseSummaries(packs.filter(Boolean));
  }, [viewMonths, monthPacks, data]);

  const slices = useMemo(() => {
    const rows = merged.byTag || [];
    return rows.map((row, i) => ({
      ...row,
      color: colorForTag(row.tag, i),
      displayAmount: fromMyr(row.amount, fx),
    }));
  }, [merged, fx]);

  const records = merged.records || [];

  const visibleRows = useMemo(() => {
    const want = pickedTags;
    const filtered = want.length ? records.filter((r) => want.includes(recordTag(r))) : records;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return filtered.slice().sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [records, pickedTags, sort]);

  const dataYm = normalizeYearMonth(data?.yearmonth);
  const monthReady = Boolean(data) && dataYm === ym && data.source !== 'pending';

  const monthStatuses = yearMonthStatuses(String(ym).slice(0, 4));
  const yearTotals = useMemo(() => {
    const y = String(ym).slice(0, 4);
    const stored = readYearTotals(y);
    const incoming = Array.isArray(data?.yearTotals) ? data.yearTotals : [];
    const merged = stored.map((n, i) => {
      const a = Number(incoming[i]) || 0;
      return a > 0 ? a : Number(n) || 0;
    });
    const mi = Number(String(ym).slice(5, 7)) - 1;
    if (data && mi >= 0 && mi < 12 && Number.isFinite(Number(data.total))) {
      merged[mi] = Number(data.total) || 0;
    }
    return merged;
  }, [ym, data]);

  const total = Number(merged.total) || 0;
  const currency = fx;
  const pickedSlices = pickedTags.length ? slices.filter((s) => pickedTags.includes(s.tag)) : [];
  const shownTotal = pickedTags.length
    ? pickedSlices.reduce((n, s) => n + (Number(s.amount) || 0), 0)
    : total;
  const shownCount = pickedTags.length
    ? pickedSlices.reduce((n, s) => n + (Number(s.count) || 0), 0)
    : merged.count || 0;
  const shownPct = total ? Math.round((shownTotal / total) * 1000) / 10 : 0;
  const shownPctLabel = Number.isInteger(shownPct) ? `${shownPct}` : shownPct.toFixed(1);
  const pickLabel =
    !pickedTags.length
      ? viewMonths.length > 1
        ? `${viewMonths.length} 月`
        : '本月'
      : pickedTags.length === 1
        ? pickedTags[0]
        : `${pickedTags.length} 項`;

  const pickTag = (tag) => {
    const s = String(tag || '').trim();
    if (!s) {
      setPickedTags([]);
      setMultiTags(false);
      return;
    }
    setShowTable(true);
    if (multiTags) {
      setPickedTags((prev) => toggleTag(prev, s));
      return;
    }
    setPickedTags([s]);
  };

  const enableMultiTags = (seed) => {
    const s = String(seed || '').trim();
    setMultiTags(true);
    setShowTable(true);
    setPickedTags((prev) => {
      if (!s) return prev;
      if (prev.includes(s)) return prev.length ? prev : [s];
      return [...prev, s];
    });
  };

  const selectAllTags = () => {
    const all = slices.map((s) => s.tag).filter(Boolean);
    setMultiTags(true);
    setShowTable(true);
    setPickedTags(all);
  };

  const onSort = (key) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'amount' || key === 'timestamp' ? 'desc' : 'asc' }
    );
  };

  return (
    <div className="expense-summary">
      <div className="expense-summary-head">
        <button
          type="button"
          className="expense-summary-nav"
          onClick={() => {
            setMultiMonths(false);
            setYm((v) => shiftYearMonth(v, -1));
          }}
        >
          ‹
        </button>
        <strong>{ym}</strong>
        <button
          type="button"
          className="expense-summary-nav"
          onClick={() => {
            setMultiMonths(false);
            setYm((v) => shiftYearMonth(v, 1));
          }}
        >
          ›
        </button>
        <button
          type="button"
          className="calendar-status-refresh expense-summary-refresh"
          aria-label="重抓本月報表"
          onClick={() => {
            if (loading) return;
            if (
              !window.confirm(
                '會重抓本月 Sheets 並重算報表。每日仍會自動更新，還要現在重抓嗎？'
              )
            ) {
              return;
            }
            load({ force: true });
          }}
          disabled={loading}
        >
          <svg
            className={`expense-summary-refresh-icon${loading ? ' is-spin' : ''}`}
            viewBox="0 0 24 24"
            width="14"
            height="14"
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a5 5 0 0 1 5 5 5 5 0 0 1-8.9 3.1L6.7 16.5A7 7 0 1 0 19 12c0-2.04-.76-3.9-2.02-5.35z"
            />
          </svg>
          {loading ? '重抓中…' : '重抓'}
        </button>
      </div>
      {data ? (
        <YearStrip
          ym={ym}
          totals={yearTotals}
          statuses={monthStatuses}
          onPickMonth={(next) => {
            setMultiMonths(false);
            setYm(next);
          }}
          fx={fx}
          multi={multiMonths}
          pickedYms={pickedMonths}
          onToggleMonth={toggleMonth}
          onEnableMulti={enableMulti}
        />
      ) : null}
      {multiMonths ? (
        <div className="expense-year-multi">
          <span>多月 {pickedMonths.length}</span>
          {yearBusy ? <span>{yearBusy}</span> : null}
          <button type="button" className="expense-chip" onClick={fetchWholeYear} disabled={Boolean(yearBusy)}>
            全年
          </button>
          <button
            type="button"
            className="expense-chip"
            onClick={() => {
              yearSeqRef.current += 1;
              setYearBusy('');
              setMultiMonths(false);
              setPickedMonths([]);
            }}
          >
            結束
          </button>
        </div>
      ) : null}

      {err ? <p className="expense-summary-status is-error">{err}</p> : null}

      <div className={`expense-summary-hero${loading && monthReady ? ' is-refreshing' : ''}`}>
        <div className="expense-summary-hero-main">
          <div className={`expense-donut-wrap${pickedTags.length && monthReady ? ' is-picked' : ''}`}>
            <Donut
              slices={monthReady ? slices : []}
              total={monthReady ? total : 0}
              pickedTags={monthReady ? pickedTags : []}
              labelMode={labelMode}
              onPick={monthReady ? pickTag : () => {}}
              onEnableMulti={monthReady ? enableMultiTags : () => {}}
            />
            <div className="expense-summary-total">
              {monthReady && pickedTags.length ? (
                <button
                  type="button"
                  className="expense-summary-total-label is-clear"
                  onClick={() => setPickedTags([])}
                >
                  {pickLabel}
                </button>
              ) : (
                <span className="expense-summary-total-label">
                  {loading && !monthReady ? '讀取中…' : pickLabel}
                </span>
              )}
              {monthReady && pickedTags.length ? (
                <span className="expense-summary-total-share">
                  {shownPctLabel}% of 100%
                </span>
              ) : null}
              <button
                type="button"
                className="expense-summary-total-fx"
                onClick={() => {
                  if (!monthReady) return;
                  const i = Math.max(0, fxCodes.indexOf(fx));
                  setFx(fxCodes[(i + 1) % fxCodes.length] || 'MYR');
                }}
              >
                {monthReady ? `${currency} ${formatMoney(fromMyr(shownTotal, fx))}` : '—'}
              </button>
              {monthReady && pickedTags.length ? (
                <span className="expense-summary-total-share">
                  of {currency} {formatMoney(fromMyr(total, fx))}
                </span>
              ) : null}
              <span className="expense-summary-total-count">
                {monthReady ? `${shownCount} 筆` : loading ? '…' : '0 筆'}
              </span>
            </div>
          </div>
          {monthReady ? (
            <div className="expense-display-toggles">
              <div className="expense-label-toggle" role="group" aria-label="圖上數字">
                <button
                  type="button"
                  className={labelMode === 'pct' ? 'is-on' : ''}
                  onClick={() => setLabelMode('pct')}
                >
                  ％
                </button>
                <button
                  type="button"
                  className={labelMode === 'amount' ? 'is-on' : ''}
                  onClick={() => setLabelMode('amount')}
                >
                  金額
                </button>
              </div>
              <button type="button" className="expense-heat-open" onClick={() => setHeatOpen(true)}>
                地圖
                <em>{heatGeoCount(records)}</em>
              </button>
              {fxCodes.length > 1 ? (
                <div className="expense-label-toggle" role="group" aria-label="顯示幣別">
                  {fxCodes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      className={fx === code ? 'is-on' : ''}
                      onClick={() => setFx(code)}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {monthReady && data.updatedAt ? (
          <p className="expense-summary-updated">
            {data.updatedAt}
            {loading ? ' · 重抓中' : data.source === 'live' ? ' · 即時' : ''}
            {yearBusy ? ` · ${yearBusy}` : ''}
          </p>
        ) : null}
      </div>
      {monthReady ? (
        <>
          <CategoryBars
            slices={slices}
            total={total}
            pickedTags={pickedTags}
            onPick={pickTag}
            onEnableMulti={enableMultiTags}
            multi={multiTags}
            fx={fx}
          />
          {multiTags ? (
            <div className="expense-year-multi expense-cat-multi">
              <span>多項 {pickedTags.length}</span>
              <button type="button" className="expense-chip" onClick={selectAllTags}>
                全選
              </button>
              <button
                type="button"
                className="expense-chip"
                onClick={() => {
                  setMultiTags(false);
                  setPickedTags([]);
                }}
              >
                結束
              </button>
            </div>
          ) : null}
          <ExpenseHeatMap
            records={records}
            slices={slices}
            initialTags={pickedTags}
            fx={fx}
            open={heatOpen}
            onClose={() => setHeatOpen(false)}
          />
          {showTable ? (
            <RecordsTable
              rows={visibleRows}
              currency={currency}
              focusId={focusId}
              tags={slices.map((s) => ({ tag: s.tag, count: Number(s.count) || 0 }))}
              pickedTags={pickedTags}
              multi={multiTags}
              onToggle={pickTag}
              onEnableMulti={enableMultiTags}
              onSelectAll={selectAllTags}
              sort={sort}
              onSort={onSort}
              onHide={() => setShowTable(false)}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default ExpenseSummary;
