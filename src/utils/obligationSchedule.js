export const INTEREST_METHODS = {
  none: '無利息（均攤本金）',
  reducing_balance: '餘額遞減（PMT／車貸房貸）',
  flat: '平息（總利息均攤）',
  custom_pmt: '自訂每期金額',
};

export const OBLIGATION_KINDS = {
  loan: '貸款／分期',
  recurring: '固定週期',
  oneoff: '已知單次',
};

export const DIRECTIONS = {
  payable: '應付',
  receivable: '應收',
};

export function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function formatISODate(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return formatISODate(new Date());
}

/** Add calendar months, clamp day to month length. */
export function addMonths(iso, months, dueDay) {
  const raw = String(iso || '').slice(0, 10);
  const parts = raw.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m) return raw;
  const day = Number(dueDay) || d || 1;
  const date = new Date(y, m - 1 + Number(months || 0), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
  return formatISODate(date);
}

export function monthlyInterestRate(annualPct) {
  return (Number(annualPct) || 0) / 100 / 12;
}

/** Standard annuity payment. */
export function computePmt(principal, annualPct, n) {
  const p = Number(principal) || 0;
  const periods = Math.max(1, Number(n) || 1);
  const r = monthlyInterestRate(annualPct);
  if (r === 0) return roundMoney(p / periods);
  const pow = Math.pow(1 + r, periods);
  return roundMoney((p * r * pow) / (pow - 1));
}

/**
 * Preview monthly amount from header fields (before generating rows).
 */
export function previewInstallmentAmount(ob) {
  if (!ob) return 0;
  const n = Math.max(1, Number(ob.termMonths) || 1);
  const p = Number(ob.remainingPrincipal ?? ob.principal) || 0;
  const method = ob.interestMethod || 'none';
  if (ob.kind === 'recurring' || ob.kind === 'oneoff') {
    return roundMoney(ob.installmentAmount || p);
  }
  if (method === 'custom_pmt') return roundMoney(ob.installmentAmount || 0);
  if (method === 'none') return roundMoney(p / n);
  if (method === 'flat') {
    const years = n / 12;
    const totalI = p * ((Number(ob.annualRate) || 0) / 100) * years;
    return roundMoney((p + totalI) / n);
  }
  return computePmt(p, ob.annualRate, n);
}

function newRowId() {
  return `oi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeRow(ob, seq, dueDate, amount, principalPortion, interestPortion, kind = 'regular') {
  return {
    id: newRowId(),
    obligationId: ob.id,
    seq,
    dueDate,
    amount: roundMoney(amount),
    principalPortion: roundMoney(principalPortion),
    interestPortion: roundMoney(interestPortion),
    status: 'pending',
    postedRecordId: '',
    note: '',
    kind,
    updatedAt: Date.now(),
  };
}

function keptRows(existing) {
  return (existing || []).filter(
    (row) => row.status === 'posted' || row.status === 'skipped' || row.kind === 'extra'
  );
}

function lastRegular(existing) {
  return (existing || [])
    .filter((row) => row.kind !== 'extra')
    .sort((a, b) => Number(a.seq) - Number(b.seq))
    .pop();
}

function nextDueAfter(ob, existing) {
  const last = lastRegular(existing);
  const dueDay = Number(ob.dueDay) || Number(String(ob.startDate || '').split('-')[2]) || 1;
  if (last?.dueDate) return addMonths(last.dueDate, 1, dueDay);
  return String(ob.startDate || todayISO()).slice(0, 10);
}

function generateLoanRows(ob, startSeq, startDate, remainingN, remainingPrincipal) {
  const method = ob.interestMethod || 'none';
  const n = Math.max(0, remainingN);
  if (n === 0 || remainingPrincipal <= 0.005) return [];
  let pmt = Number(ob.installmentAmount);
  if (!Number.isFinite(pmt) || pmt <= 0) {
    pmt = previewInstallmentAmount({
      ...ob,
      principal: remainingPrincipal,
      remainingPrincipal,
      termMonths: n,
    });
  }
  const r = monthlyInterestRate(ob.annualRate);
  const dueDay = Number(ob.dueDay) || Number(String(startDate).split('-')[2]) || 1;
  const rows = [];
  let balance = roundMoney(remainingPrincipal);

  if (method === 'flat') {
    const years = n / 12;
    const totalI = roundMoney(balance * ((Number(ob.annualRate) || 0) / 100) * years);
    const prinEach = roundMoney(balance / n);
    const intEach = roundMoney(totalI / n);
    let prinLeft = balance;
    let intLeft = totalI;
    for (let i = 0; i < n; i += 1) {
      const last = i === n - 1;
      const prin = last ? roundMoney(prinLeft) : prinEach;
      const interest = last ? roundMoney(intLeft) : intEach;
      const due = i === 0 ? startDate : addMonths(startDate, i, dueDay);
      rows.push(makeRow(ob, startSeq + i, due, prin + interest, prin, interest));
      prinLeft = roundMoney(prinLeft - prin);
      intLeft = roundMoney(intLeft - interest);
    }
    return rows;
  }

  for (let i = 0; i < n; i += 1) {
    const last = i === n - 1;
    const interest = method === 'none' ? 0 : roundMoney(balance * r);
    let principalPay;
    let amount;
    if (method === 'none') {
      principalPay = last ? balance : roundMoney(balance / (n - i));
      amount = principalPay;
    } else if (method === 'custom_pmt' || method === 'reducing_balance') {
      amount = last ? roundMoney(balance + interest) : roundMoney(pmt);
      principalPay = roundMoney(amount - interest);
      if (principalPay > balance) {
        principalPay = balance;
        amount = roundMoney(principalPay + interest);
      }
      if (principalPay < 0) {
        principalPay = 0;
        amount = interest;
      }
    } else {
      principalPay = last ? balance : roundMoney(balance / (n - i));
      amount = roundMoney(principalPay + interest);
    }
    const due = i === 0 ? startDate : addMonths(startDate, i, dueDay);
    rows.push(makeRow(ob, startSeq + i, due, amount, principalPay, interest));
    balance = roundMoney(balance - principalPay);
    if (balance <= 0.005) break;
  }
  return rows;
}

function generateRecurringRows(ob, startSeq, startDate) {
  const amount = roundMoney(ob.installmentAmount || 0);
  if (amount === 0) return [];
  const dueDay = Number(ob.dueDay) || Number(String(startDate).split('-')[2]) || 1;
  const end = ob.endDate ? String(ob.endDate).slice(0, 10) : addMonths(startDate, 24, dueDay);
  const rows = [];
  let seq = startSeq;
  let due = startDate;
  const guard = startSeq + 120;
  while (due && due <= end && seq < guard) {
    const rowDue = seq === startSeq ? startDate : due;
    rows.push(makeRow(ob, seq, rowDue, amount, 0, 0));
    seq += 1;
    due = addMonths(startDate, seq - startSeq, dueDay);
  }
  return rows;
}

function generateOneoffRow(ob, startSeq, startDate) {
  const amount = roundMoney(ob.installmentAmount || ob.principal || 0);
  return [makeRow(ob, startSeq, startDate, amount, amount, 0)];
}

/**
 * Rebuild pending regular rows; keep posted / skipped / extra.
 * @param {object} ob
 * @param {object[]} existing
 */
export function buildObligationSchedule(ob, existing = []) {
  if (!ob) return [];
  const keep = keptRows(existing);
  const last = lastRegular(keep);
  const startSeq = (Number(last?.seq) || 0) + 1;
  const startDate = nextDueAfter(ob, keep);

  let generated = [];
  if (ob.kind === 'oneoff') {
    const hasRegular = keep.some((row) => row.kind !== 'extra');
    if (!hasRegular) generated = generateOneoffRow(ob, startSeq, startDate || ob.startDate);
  } else if (ob.kind === 'recurring') {
    generated = generateRecurringRows(ob, startSeq, startDate);
  } else {
    const postedCount = keep.filter((row) => row.kind !== 'extra').length;
    const term = Math.max(1, Number(ob.termMonths) || 1);
    const remainingN = Math.max(0, term - postedCount);
    const remaining = roundMoney(ob.remainingPrincipal ?? ob.principal ?? 0);
    generated = generateLoanRows(ob, startSeq, startDate, remainingN, remaining);
  }

  return [...keep, ...generated].sort((a, b) => {
    const d = String(a.dueDate).localeCompare(String(b.dueDate));
    if (d) return d;
    return Number(a.seq) - Number(b.seq);
  });
}

export function applyExtraPayment(ob, schedule, amount, dueDate, note) {
  const pay = roundMoney(amount);
  if (pay <= 0) return { obligation: ob, schedule };
  const extra = makeRow(
    ob,
    0,
    dueDate || todayISO(),
    pay,
    pay,
    0,
    'extra'
  );
  extra.note = note || '提前還';
  const remaining = roundMoney(Math.max(0, (Number(ob.remainingPrincipal ?? ob.principal) || 0) - pay));
  const nextOb = {
    ...ob,
    remainingPrincipal: remaining,
    updatedAt: Date.now(),
    status: remaining <= 0.005 && ob.kind === 'loan' ? 'closed' : ob.status,
  };
  return {
    obligation: nextOb,
    schedule: buildObligationSchedule(nextOb, [...(schedule || []), extra]),
  };
}

export function nextPending(schedule) {
  return (schedule || [])
    .filter((row) => row.status === 'pending')
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0] || null;
}

export function upcomingPending(schedule, withinDays = 30) {
  const today = todayISO();
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + withinDays);
  const limit = formatISODate(limitDate);
  return (schedule || []).filter(
    (row) => row.status === 'pending' && row.dueDate > today && row.dueDate <= limit
  );
}

export function overduePending(schedule) {
  const today = todayISO();
  return (schedule || []).filter((row) => row.status === 'pending' && row.dueDate <= today);
}

export function remainingCount(schedule) {
  return (schedule || []).filter((row) => row.status === 'pending' && row.kind !== 'extra').length;
}
