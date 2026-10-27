/** Display label for payment option (shortname + last4 for cards) */

export function cardDigits(num) {
  return String(num ?? '').replace(/\D/g, '');
}

export function cardLast4(num) {
  const d = cardDigits(num);
  return d.length >= 4 ? d.slice(-4) : d;
}

export function looksLikeCardNumber(s) {
  const raw = String(s ?? '').trim();
  if (!raw) return false;
  const d = cardDigits(raw);
  return d.length >= 4 && d.length <= 19 && d === raw.replace(/[\s-]/g, '');
}

function isInternalPaymentId(s) {
  return /^(Card|HistCard)_/i.test(String(s || '').trim());
}

/**
 * CardDetails / dedicated PAYMENT_OPTIONS keys look like `[SG][CIMB] World Master`.
 * Prefer Bank ShortFont + Card name; ignore PAN-like strings.
 */
export function catalogShortname(value, id = '') {
  if (!value || typeof value !== 'object') {
    const fallback = String(id || '').trim();
    return looksLikeCardNumber(fallback) ? '' : stripCatalogDecor(fallback);
  }
  const explicit = String(value.shortname || '').trim();
  if (
    explicit &&
    !looksLikeCardNumber(explicit) &&
    !isInternalPaymentId(explicit)
  ) {
    return stripCatalogDecor(explicit);
  }

  const card = String(value.card || '').trim();
  const bank = String(value.bank || '').trim();
  const fromBank = parseCatalogKey(bank);
  if (fromBank.shortname) return fromBank.shortname;

  if (card && !looksLikeCardNumber(card)) return card;
  if (bank && !looksLikeCardNumber(bank)) return stripCatalogDecor(bank);

  const idStr = String(id || '').trim();
  if (!idStr || /^(Card|HistCard)_/i.test(idStr) || looksLikeCardNumber(idStr)) return '';
  const fromId = parseCatalogKey(idStr);
  if (fromId.shortname) return fromId.shortname;
  return '';
}

export function catalogRegion(value, id = '') {
  const blob = [
    value?.region,
    value?.bank,
    value?.shortname,
    value?.card,
    id,
  ]
    .filter(Boolean)
    .join(' ');
  const m = String(blob).match(/\[([A-Za-z]{2})\]/);
  if (m) return m[1].toUpperCase();
  return String(value?.region || '').trim();
}

function parseCatalogKey(raw) {
  const s = String(raw || '').trim();
  if (!s || looksLikeCardNumber(s)) return { region: '', shortname: '' };
  const m = s.match(/^\[([A-Za-z]{2})\]\[([^\]]+)\]\s*(.*)$/);
  if (!m) return { region: '', shortname: stripCatalogDecor(s) };
  const shortBank = m[2].trim();
  const rest = m[3].trim();
  const shortname = [shortBank, rest].filter(Boolean).join(' ');
  return { region: m[1].toUpperCase(), shortname };
}

function stripCatalogDecor(s) {
  return String(s || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatPaymentLabel(option) {
  if (!option) return '';
  if (option.key === 'eWallet' || option.key === 'Cash' || option.card_num === 'Cash') {
    return String(option.card_num).replace(/\[[A-Z]{2}\]/g, '').trim();
  }
  const short = catalogShortname(option);
  const num = String(option.card_num || '');
  const tail = cardLast4(num) || num;
  const region = option.region || catalogRegion(option);
  const prefix = region ? `${region} ` : '';
  if (short) return `${prefix}${short} ${tail}`.trim();
  return `${prefix}${tail}`.trim();
}
