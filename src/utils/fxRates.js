const FX_KEY = 'fxRates.v1';

export function readFxRates() {
  try {
    const raw = localStorage.getItem(FX_KEY);
    if (!raw) return { date: '', rates: { MYR: 1 }, source: '' };
    const parsed = JSON.parse(raw);
    const rates = parsed && parsed.rates && typeof parsed.rates === 'object' ? parsed.rates : {};
    return {
      date: String(parsed.date || ''),
      rates: { MYR: 1, ...rates },
      source: String(parsed.source || ''),
    };
  } catch {
    return { date: '', rates: { MYR: 1 }, source: '' };
  }
}

export function writeFxRates(payload) {
  if (!payload || typeof payload !== 'object') return readFxRates();
  const rec = {
    date: String(payload.date || ''),
    rates: { MYR: 1, ...(payload.rates || {}) },
    source: String(payload.source || ''),
  };
  try {
    localStorage.setItem(FX_KEY, JSON.stringify(rec));
  } catch {
    /* ignore */
  }
  return rec;
}

export function myrPerUnit(currency) {
  const cur = String(currency || 'MYR').trim().toUpperCase() || 'MYR';
  if (cur === 'MYR') return 1;
  const rate = Number(readFxRates().rates[cur]);
  return rate > 0 ? rate : 0;
}

export function toMyr(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const cur = String(currency || 'MYR').trim().toUpperCase() || 'MYR';
  if (cur === 'MYR') return Math.round(n * 100) / 100;
  const rate = myrPerUnit(cur);
  if (!(rate > 0)) return 0;
  return Math.round(n * rate * 100) / 100;
}

export const FX_DISPLAY_CODES = ['MYR', 'SGD', 'USD', 'TWD', 'CNY', 'EUR'];

export function fromMyr(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const cur = String(currency || 'MYR').trim().toUpperCase() || 'MYR';
  if (cur === 'MYR') return Math.round(n * 100) / 100;
  const rate = myrPerUnit(cur);
  if (!(rate > 0)) return 0;
  return Math.round((n / rate) * 100) / 100;
}

export function displayFxCodes() {
  const rates = readFxRates().rates || {};
  return FX_DISPLAY_CODES.filter((c) => c === 'MYR' || Number(rates[c]) > 0);
}
