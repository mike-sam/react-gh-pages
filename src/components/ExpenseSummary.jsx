import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  colorForTag,
  currentYearMonth,
  fetchExpenseSummary,
  normalizeYearMonth,
  shiftYearMonth,
} from '../utils/expenseSummary';
import { getMergedQueryParams } from '../utils/expenseQuickUrl';

function Donut({ slices, total, activeTag, onPick }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  let acc = 0;
  if (!slices.length || !total) {
    return (
      <svg className="expense-donut" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border, #333945)" strokeWidth="14" />
      </svg>
    );
  }
  return (
    <svg className="expense-donut" viewBox="0 0 100 100" role="img" aria-label="分類占比">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border, #333945)" strokeWidth="14" />
      {slices.map((s) => {
        const frac = s.amount / total;
        const dash = frac * c;
        const gap = c - dash;
        const rot = acc * 360 - 90;
        acc += frac;
        const dim = activeTag && activeTag !== s.tag;
        return (
          <circle
            key={s.tag}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={dim ? 10 : 16}
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="butt"
            transform={`rotate(${rot} 50 50)`}
            opacity={dim ? 0.35 : 1}
            style={{ cursor: 'pointer' }}
            onClick={() => onPick(s.tag === activeTag ? '' : s.tag)}
          />
        );
      })}
    </svg>
  );
}

function ExpenseSummary() {
  const q = getMergedQueryParams();
  const focusId = q.get('id') || '';
  const [ym, setYm] = useState(() => normalizeYearMonth(q.get('ym')) || currentYearMonth());
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState('');
  const seqRef = useRef(0);

  const load = useCallback(
    ({ force = false } = {}) => {
      const seq = ++seqRef.current;
      setLoading(true);
      setErr('');
      if (!force) setData(null);
      fetchExpenseSummary({ yearmonth: ym, id: focusId || undefined, force })
        .then((next) => {
          if (seq !== seqRef.current) return;
          setData(next);
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

  const slices = useMemo(() => {
    const rows = data?.byTag || [];
    return rows.map((row, i) => ({
      ...row,
      color: colorForTag(row.tag, i),
    }));
  }, [data]);

  const recent = useMemo(() => {
    const rows = data?.recent || [];
    if (!activeTag) return rows;
    return rows.filter((r) => r.tag === activeTag);
  }, [data, activeTag]);

  const total = Number(data?.total) || 0;
  const currency = recent[0]?.currency || 'MYR';

  return (
    <div className="expense-summary">
      <div className="expense-summary-head">
        <button type="button" className="expense-summary-nav" onClick={() => setYm((v) => shiftYearMonth(v, -1))}>
          ‹
        </button>
        <strong>{ym}</strong>
        <button type="button" className="expense-summary-nav" onClick={() => setYm((v) => shiftYearMonth(v, 1))}>
          ›
        </button>
        <button
          type="button"
          className="calendar-status-refresh"
          onClick={() => load({ force: true })}
          disabled={loading}
        >
          {loading ? '更新中…' : '重新整理'}
        </button>
      </div>
      {data?.updatedAt ? (
        <p className="expense-summary-updated">
          {data.updatedAt}
          {data.source === 'live' ? ' · 即時' : ''}
        </p>
      ) : null}

      {loading && !data ? <p className="expense-summary-status">讀取中…</p> : null}
      {err ? <p className="expense-summary-status is-error">{err}</p> : null}

      {data ? (
        <>
          <div className="expense-summary-hero">
            <Donut slices={slices} total={total} activeTag={activeTag} onPick={setActiveTag} />
            <div className="expense-summary-total">
              <span className="expense-summary-total-label">{activeTag || '本月'}</span>
              <strong>
                {currency}{' '}
                {(activeTag
                  ? slices.find((s) => s.tag === activeTag)?.amount || 0
                  : total
                ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </strong>
              <span className="expense-summary-total-count">{data.count || 0} 筆</span>
            </div>
          </div>
          <ul className="expense-summary-legend">
            {slices.map((s) => (
              <li key={s.tag}>
                <button
                  type="button"
                  className={`expense-summary-legend-btn${activeTag === s.tag ? ' is-on' : ''}`}
                  onClick={() => setActiveTag(activeTag === s.tag ? '' : s.tag)}
                >
                  <i style={{ background: s.color }} />
                  <span>{s.tag}</span>
                  <em>{Number(s.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</em>
                </button>
              </li>
            ))}
          </ul>
          <p className="expense-summary-recent-label">近期</p>
          <ul className="expense-summary-list">
            {recent.length === 0 ? (
              <li className="expense-summary-empty">這個月還沒有紀錄</li>
            ) : (
              recent.map((row) => (
                <li
                  key={row.id}
                  className={`expense-summary-item${focusId && String(row.id) === String(focusId) ? ' is-focus' : ''}`}
                >
                  <span className="expense-summary-item-amount">
                    {row.currency || currency} {Number(row.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  <span className="expense-summary-item-meta">
                    {row.tag}
                    {row.title ? ` · ${row.title}` : ''}
                    {row.description ? ` · ${String(row.description).slice(0, 24)}` : ''}
                  </span>
                </li>
              ))
            )}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export default ExpenseSummary;
