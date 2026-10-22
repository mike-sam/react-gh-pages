import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageChrome from '../components/PageChrome';
import TagSelector from '../TagSelector';
import { useOfflineQueue } from '../context/QueueContext';
import { EXPENSE_TAGS } from '../config';
import {
  DIRECTIONS,
  INTEREST_METHODS,
  OBLIGATION_KINDS,
  applyExtraPayment,
  buildObligationSchedule,
  nextPending,
  overduePending,
  previewInstallmentAmount,
  remainingCount,
  todayISO,
  upcomingPending,
} from '../utils/obligationSchedule';
import {
  deleteObligationLocal,
  fetchObligationsFromCloud,
  isObligationFetchFresh,
  loadObligations,
  mergeObligationsFromCloud,
  newObligationId,
  obligationDeletePayload,
  obligationUpsertPayload,
  upsertObligationLocal,
} from '../utils/obligations';
import '../App.css';

function money(n, currency = 'MYR') {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const sign = v < 0 ? '-' : '';
  return `${sign}${currency} ${Math.abs(v).toFixed(2)}`;
}

function kindPreset(kind) {
  if (kind === 'recurring') return { tag: '居家生活', title: '房租', interestMethod: 'none', termMonths: 12 };
  if (kind === 'oneoff') return { tag: '其他', title: '', interestMethod: 'none', termMonths: 1 };
  return { tag: '交通出行', title: '车贷', interestMethod: 'reducing_balance', termMonths: 60 };
}

function emptyDraft() {
  const startDate = todayISO();
  return {
    id: newObligationId(),
    kind: 'loan',
    direction: 'payable',
    name: '',
    tag: '',
    title: '',
    principal: '',
    remainingPrincipal: '',
    interestMethod: 'reducing_balance',
    annualRate: '',
    termMonths: 60,
    installmentAmount: '',
    startDate,
    endDate: '',
    dueDay: Number(startDate.split('-')[2]) || 1,
    currency: 'MYR',
    paymentMethod: '',
    note: '',
    status: 'active',
    schedule: [],
  };
}

function draftToObligation(draft) {
  const principal = Number(draft.principal) || 0;
  const remaining =
    draft.remainingPrincipal === '' || draft.remainingPrincipal == null
      ? principal
      : Number(draft.remainingPrincipal) || 0;
  const ob = {
    ...draft,
    principal,
    remainingPrincipal: remaining,
    annualRate: Number(draft.annualRate) || 0,
    termMonths: Math.max(1, Number(draft.termMonths) || 1),
    installmentAmount: Number(draft.installmentAmount) || 0,
    dueDay: Number(draft.dueDay) || Number(String(draft.startDate).split('-')[2]) || 1,
    title: String(draft.title || '').trim(),
    name: String(draft.name || '').trim() || String(draft.title || '').trim(),
  };
  if (!ob.installmentAmount) ob.installmentAmount = previewInstallmentAmount(ob);
  ob.schedule = buildObligationSchedule(ob, draft.schedule || []);
  return ob;
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" className={`entry-chip${active ? ' active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

function ObligationForm({ draft, setDraft, onCancel, onSave, saving }) {
  const preview = useMemo(() => previewInstallmentAmount(draftToObligation(draft)), [draft]);
  const canSave = Boolean(String(draft.tag || '').trim() && String(draft.title || '').trim());

  const setKind = (kind) => {
    const preset = kindPreset(kind);
    setDraft((d) => ({
      ...d,
      kind,
      ...preset,
      title: d.kind === kind ? d.title : preset.title,
      tag: d.kind === kind ? d.tag : preset.tag,
      interestMethod: kind === 'loan' ? d.interestMethod || preset.interestMethod : 'none',
    }));
  };

  return (
    <div className="obligation-panel">
      <label className="entry-field-label">類型</label>
      <div className="entry-chip-row">
        {Object.entries(OBLIGATION_KINDS).map(([key, label]) => (
          <Chip key={key} active={draft.kind === key} onClick={() => setKind(key)}>
            {label}
          </Chip>
        ))}
      </div>

      <label className="entry-field-label">方向</label>
      <div className="entry-chip-row">
        {Object.entries(DIRECTIONS).map(([key, label]) => (
          <Chip key={key} active={draft.direction === key} onClick={() => setDraft((d) => ({ ...d, direction: key }))}>
            {label}
          </Chip>
        ))}
      </div>

      <div className="obligation-tag-block">
        <TagSelector
          input={draft.title}
          setInput={(next) =>
            setDraft((d) => ({
              ...d,
              title: typeof next === 'function' ? next(d.title) : next,
            }))
          }
          setRemark={() => {}}
          setAmount={() => {}}
          selectedTag={draft.tag}
          setSelectedTag={(next) =>
            setDraft((d) => ({
              ...d,
              tag: typeof next === 'function' ? next(d.tag) : next,
            }))
          }
          tags={EXPENSE_TAGS}
        />
      </div>
      <p className="obligation-empty">到期入帳會用這個主分類／子分類，和「單筆」同一套。</p>

      <label className="entry-field-label">顯示名稱（可空，預設用子分類）</label>
      <input
        className="entry-text-input"
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        placeholder={draft.title ? draft.title : '如：Myvi 車貸'}
      />

      {draft.kind === 'loan' && (
        <>
          <label className="entry-field-label">計息方式</label>
          <div className="entry-chip-row">
            {Object.entries(INTEREST_METHODS).map(([key, label]) => (
              <Chip
                key={key}
                active={draft.interestMethod === key}
                onClick={() => setDraft((d) => ({ ...d, interestMethod: key }))}
              >
                {label}
              </Chip>
            ))}
          </div>
          <label className="entry-field-label">本金</label>
          <input
            className="entry-text-input"
            type="number"
            inputMode="decimal"
            value={draft.principal}
            onChange={(e) => setDraft((d) => ({ ...d, principal: e.target.value, remainingPrincipal: e.target.value }))}
            placeholder="35000"
          />
          {draft.interestMethod !== 'none' && (
            <>
              <label className="entry-field-label">年利率 %</label>
              <input
                className="entry-text-input"
                type="number"
                inputMode="decimal"
                value={draft.annualRate}
                onChange={(e) => setDraft((d) => ({ ...d, annualRate: e.target.value }))}
                placeholder="3.5"
              />
            </>
          )}
          <label className="entry-field-label">期數（月）</label>
          <input
            className="entry-text-input"
            type="number"
            inputMode="numeric"
            value={draft.termMonths}
            onChange={(e) => setDraft((d) => ({ ...d, termMonths: e.target.value }))}
          />
        </>
      )}

      {(draft.kind !== 'loan' || draft.interestMethod === 'custom_pmt') && (
        <>
          <label className="entry-field-label">{draft.kind === 'loan' ? '自訂每期金額' : '每期／金額'}</label>
          <input
            className="entry-text-input"
            type="number"
            inputMode="decimal"
            value={draft.installmentAmount}
            onChange={(e) => setDraft((d) => ({ ...d, installmentAmount: e.target.value }))}
            placeholder="1200"
          />
        </>
      )}

      <label className="entry-field-label">{draft.kind === 'oneoff' ? '到期日' : '首期日'}</label>
      <input
        className="entry-text-input"
        type="date"
        value={draft.startDate}
        onChange={(e) =>
          setDraft((d) => ({
            ...d,
            startDate: e.target.value,
            dueDay: Number(String(e.target.value).split('-')[2]) || d.dueDay,
          }))
        }
      />
      {draft.kind === 'recurring' && (
        <>
          <label className="entry-field-label">結束日（可空，預先排 24 個月）</label>
          <input
            className="entry-text-input"
            type="date"
            value={draft.endDate}
            onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
          />
        </>
      )}
      {draft.kind !== 'oneoff' && (
        <>
          <label className="entry-field-label">每月幾號</label>
          <input
            className="entry-text-input"
            type="number"
            min={1}
            max={31}
            value={draft.dueDay}
            onChange={(e) => setDraft((d) => ({ ...d, dueDay: e.target.value }))}
          />
        </>
      )}

      <label className="entry-field-label">備註</label>
      <input
        className="entry-text-input"
        value={draft.note}
        onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
        placeholder="可隨時改"
      />

      <div className="obligation-preview">
        預估每期 {money(preview, draft.currency || 'MYR')}
        {draft.direction === 'receivable' ? ' · 應收（入帳為負數）' : ' · 應付'}
      </div>

      <div className="obligation-actions">
        <button type="button" className="cancel-btn" onClick={onCancel}>
          取消
        </button>
        <button type="button" className="confirm-btn" onClick={onSave} disabled={saving || !canSave}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </div>
  );
}

function ObligationDetail({ ob, onBack, onChange, onDelete, saving }) {
  const [extra, setExtra] = useState('');
  const [rate, setRate] = useState(String(ob.annualRate || ''));
  const [noteDraft, setNoteDraft] = useState({});
  const schedule = ob.schedule || [];
  const next = nextPending(schedule);

  return (
    <div className="obligation-panel">
      <button type="button" className="obligation-back" onClick={onBack}>
        ← 列表
      </button>
      <h2 className="obligation-detail-title">{ob.name}</h2>
      <p className="obligation-detail-meta">
        {DIRECTIONS[ob.direction]} · {OBLIGATION_KINDS[ob.kind]} · {ob.tag}/{ob.title}
      </p>
      <div className="obligation-stats">
        {ob.kind === 'loan' && (
          <div>
            <span>剩餘本金</span>
            <strong>{money(ob.remainingPrincipal, ob.currency)}</strong>
          </div>
        )}
        <div>
          <span>下期</span>
          <strong>{next ? `${next.dueDate} · ${money(next.amount, ob.currency)}` : '無'}</strong>
        </div>
        <div>
          <span>未入帳期數</span>
          <strong>{remainingCount(schedule)}</strong>
        </div>
      </div>

      {ob.note ? <p className="obligation-note">{ob.note}</p> : null}

      {ob.kind === 'loan' && ob.status === 'active' && (
        <div className="obligation-tools">
          <label className="entry-field-label">提前還（減少本金並重算未入帳）</label>
          <div className="obligation-inline">
            <input
              className="entry-text-input"
              type="number"
              inputMode="decimal"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="金額"
            />
            <button
              type="button"
              className="confirm-btn"
              disabled={saving || !(Number(extra) > 0)}
              onClick={() => {
                const nextState = applyExtraPayment(ob, schedule, Number(extra), todayISO());
                onChange(nextState.obligation);
                setExtra('');
              }}
            >
              記入提前還
            </button>
          </div>
          <label className="entry-field-label">改年利率並重算未入帳期數</label>
          <div className="obligation-inline">
            <input
              className="entry-text-input"
              type="number"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
            <button
              type="button"
              className="confirm-btn"
              disabled={saving}
              onClick={() => {
                const nextOb = {
                  ...ob,
                  annualRate: Number(rate) || 0,
                  installmentAmount:
                    ob.interestMethod === 'custom_pmt' ? ob.installmentAmount : 0,
                };
                if (!nextOb.installmentAmount) {
                  nextOb.installmentAmount = previewInstallmentAmount(nextOb);
                }
                nextOb.schedule = buildObligationSchedule(nextOb, schedule);
                onChange(nextOb);
              }}
            >
              重算
            </button>
          </div>
        </div>
      )}

      <div className="obligation-sched-head">期數（應 → 已由每天 0:00 入帳）</div>
      <ul className="obligation-sched">
        {schedule.map((row) => (
          <li key={row.id} className={`obligation-sched-row is-${row.status}`}>
            <div>
              <div className="obligation-sched-main">
                {row.kind === 'extra' ? '提前還' : `第 ${row.seq} 期`} · {row.dueDate}
              </div>
              <div className="obligation-sched-sub">
                {money(row.amount, ob.currency)}
                {row.interestPortion ? ` · 息 ${row.interestPortion}` : ''}
                {row.principalPortion ? ` · 本 ${row.principalPortion}` : ''}
                {row.status === 'posted'
                  ? ' · 已入帳'
                  : row.status === 'skipped'
                    ? ' · 已跳過'
                    : ' · 應'}
              </div>
              {row.status === 'pending' && (
                <input
                  className="entry-text-input"
                  value={noteDraft[row.id] ?? row.note}
                  placeholder="此期備註"
                  onChange={(e) => setNoteDraft((m) => ({ ...m, [row.id]: e.target.value }))}
                  onBlur={() => {
                    const note = noteDraft[row.id];
                    if (note == null || note === row.note) return;
                    onChange({
                      ...ob,
                      schedule: schedule.map((s) => (s.id === row.id ? { ...s, note } : s)),
                    });
                  }}
                />
              )}
            </div>
            {row.status === 'pending' && (
              <button
                type="button"
                className="obligation-skip"
                onClick={() =>
                  onChange({
                    ...ob,
                    schedule: schedule.map((s) => (s.id === row.id ? { ...s, status: 'skipped' } : s)),
                  })
                }
              >
                跳過
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="obligation-actions">
        {ob.status !== 'closed' && (
          <button
            type="button"
            className="cancel-btn"
            onClick={() => onChange({ ...ob, status: ob.status === 'paused' ? 'active' : 'paused' })}
          >
            {ob.status === 'paused' ? '恢復' : '暫停入帳'}
          </button>
        )}
        {ob.status !== 'closed' && (
          <button type="button" className="cancel-btn" onClick={() => onChange({ ...ob, status: 'closed' })}>
            結束
          </button>
        )}
        <button type="button" className="landmark-delete-btn" onClick={() => onDelete(ob.id)}>
          刪除
        </button>
      </div>
    </div>
  );
}

function ObligationsPage() {
  return (
    <PageChrome title="記帳">
      <div className="app-container feature-page">
        <ObligationsPanel />
      </div>
    </PageChrome>
  );
}

export function ObligationsPanel() {
  const { enqueueAndSend } = useOfflineQueue();
  const [list, setList] = useState(() => loadObligations());
  const [view, setView] = useState('list');
  const [draft, setDraft] = useState(emptyDraft);
  const [selectedId, setSelectedId] = useState(null);
  const [syncNote, setSyncNote] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = list.find((row) => row.id === selectedId) || null;

  const persist = useCallback(
    (ob, { rebuildSchedule = false } = {}) => {
      const saved = upsertObligationLocal(ob, { rebuildSchedule });
      setList(loadObligations());
      const payload = obligationUpsertPayload(saved);
      if (payload) enqueueAndSend(payload);
      return saved;
    },
    [enqueueAndSend]
  );

  const syncFromCloud = useCallback(async ({ force = false } = {}) => {
    if (!force && isObligationFetchFresh()) {
      setSyncNote('本機快取仍有效（1h）');
      setList(loadObligations());
      return;
    }
    setSyncNote('同步中…');
    try {
      const cloud = await fetchObligationsFromCloud();
      mergeObligationsFromCloud(cloud);
      setList(loadObligations());
      setSyncNote(`已同步 ${cloud.length} 筆預定交易`);
    } catch (err) {
      console.warn(err);
      setSyncNote('雲端同步失敗，使用本機');
      setList(loadObligations());
    }
  }, []);

  useEffect(() => {
    syncFromCloud({ force: false });
  }, [syncFromCloud]);

  const upcoming = useMemo(() => {
    const rows = [];
    list.forEach((ob) => {
      if (ob.status !== 'active') return;
      upcomingPending(ob.schedule, 45).forEach((inst) => {
        rows.push({ ob, inst });
      });
    });
    return rows.sort((a, b) => String(a.inst.dueDate).localeCompare(String(b.inst.dueDate)));
  }, [list]);

  const overdue = useMemo(() => {
    const rows = [];
    list.forEach((ob) => {
      if (ob.status !== 'active') return;
      overduePending(ob.schedule).forEach((inst) => rows.push({ ob, inst }));
    });
    return rows;
  }, [list]);

  const saveDraft = () => {
    const ob = draftToObligation(draft);
    if (!ob.name) return;
    setSaving(true);
    try {
      persist(ob);
      setSelectedId(ob.id);
      setView('detail');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    if (!window.confirm('刪除這筆預定交易？已入帳的紀錄會保留。')) return;
    deleteObligationLocal(id);
    setList(loadObligations());
    enqueueAndSend(obligationDeletePayload(id));
    setView('list');
    setSelectedId(null);
  };

  return (
    <div className="obligation-page">
        {view === 'list' && (
          <>
            <div className="obligation-toolbar">
              <button
                type="button"
                className="submit submit--primary"
                onClick={() => {
                  setDraft(emptyDraft());
                  setView('form');
                }}
              >
                ＋ 新增
              </button>
              <button type="button" className="submit submit--ghost" onClick={() => syncFromCloud({ force: true })}>
                同步
              </button>
            </div>
            {syncNote && <div className="location-gps-hint">{syncNote}</div>}
            <p className="obligation-lead">
              到期前只排程，不進記帳。每天 0:00 把到期的「應」寫成「已」。應收以負金額入帳。
            </p>

            {overdue.length > 0 && (
              <section className="obligation-section">
                <h3>已到期未入帳</h3>
                <ul className="obligation-list">
                  {overdue.map(({ ob, inst }) => (
                    <li key={inst.id}>
                      <button
                        type="button"
                        className="obligation-card is-overdue"
                        onClick={() => {
                          setSelectedId(ob.id);
                          setView('detail');
                        }}
                      >
                        <span>
                          {ob.name}
                          <small>
                            {inst.dueDate} · {inst.kind === 'extra' ? '提前還' : `第${inst.seq}期`}
                          </small>
                        </span>
                        <strong>{money(ob.direction === 'receivable' ? -inst.amount : inst.amount, ob.currency)}</strong>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="obligation-section">
              <h3>即將到期（45 天）</h3>
              {upcoming.length === 0 ? (
                <p className="obligation-empty">沒有即將到期的預定交易</p>
              ) : (
                <ul className="obligation-list">
                  {upcoming.map(({ ob, inst }) => (
                    <li key={inst.id}>
                      <button
                        type="button"
                        className={`obligation-card is-${ob.direction}`}
                        onClick={() => {
                          setSelectedId(ob.id);
                          setView('detail');
                        }}
                      >
                        <span>
                          {ob.name}
                          <small>
                            {DIRECTIONS[ob.direction]} · {inst.dueDate}
                          </small>
                        </span>
                        <strong>{money(inst.amount, ob.currency)}</strong>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="obligation-section">
              <h3>全部預定</h3>
              {list.length === 0 ? (
                <p className="obligation-empty">尚未建立。可新增房租、車貸或已知單次支出。</p>
              ) : (
                <ul className="obligation-list">
                  {list.map((ob) => {
                    const next = nextPending(ob.schedule);
                    return (
                      <li key={ob.id}>
                        <button
                          type="button"
                          className={`obligation-card is-${ob.direction}${ob.status !== 'active' ? ' is-idle' : ''}`}
                          onClick={() => {
                            setSelectedId(ob.id);
                            setView('detail');
                          }}
                        >
                          <span>
                            {ob.name}
                            <small>
                              {DIRECTIONS[ob.direction]} · {OBLIGATION_KINDS[ob.kind]} · {ob.status}
                              {next ? ` · 下期 ${next.dueDate}` : ''}
                            </small>
                          </span>
                          <strong>
                            {ob.kind === 'loan'
                              ? money(ob.remainingPrincipal, ob.currency)
                              : next
                                ? money(next.amount, ob.currency)
                                : ob.status}
                          </strong>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        {view === 'form' && (
          <ObligationForm
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            onCancel={() => setView('list')}
            onSave={saveDraft}
          />
        )}

        {view === 'detail' && selected && (
          <ObligationDetail
            ob={selected}
            saving={saving}
            onBack={() => {
              setView('list');
              setSelectedId(null);
            }}
            onChange={(nextOb) => persist(nextOb)}
            onDelete={handleDelete}
          />
        )}
        {view === 'detail' && !selected && (
          <p className="obligation-empty">
            找不到這筆預定交易。
            <button type="button" className="cancel-btn" onClick={() => setView('list')}>
              回列表
            </button>
          </p>
        )}
    </div>
  );
}

export default ObligationsPage;
