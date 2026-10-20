import { formatPaymentLabel } from './paymentLabel';

const WALLET_NAMES = /^(tn[cg]|grabpay|setel|shopeepay|paylah|paynow)/i;

export function detectPaymentRegion(option) {
  const blob = [option.card_num, option.bank, option.shortname, option.key]
    .filter(Boolean)
    .join(' ');
  if (/\[SG\]|\bSG\b|singapore/i.test(blob)) return 'SG';
  if (/\[MY\]|\bMY\b|malaysia/i.test(blob)) return 'MY';
  return '';
}

export function detectPaymentCategory(option, id = '') {
  if (!option?.card_num) return null;
  const k = String(option.key || '');
  const idStr = String(id || '');
  if (k === 'Cash' || option.card_num === 'Cash') return 'Cash';
  if (
    k === 'eWallet' ||
    /ewallet/i.test(k) ||
    /ewallet/i.test(idStr) ||
    WALLET_NAMES.test(String(option.card_num)) ||
    WALLET_NAMES.test(String(option.bank || ''))
  ) {
    return 'eWallet';
  }
  if (k === 'Card') return 'Card';
  return 'Card';
}

export function categorizePayments(paymentOptions) {
  const cats = { Cash: [], eWallet: [], Card: [] };
  Object.entries(paymentOptions || {}).forEach(([id, option]) => {
    const cat = detectPaymentCategory(option, id);
    if (!cat) return;
    cats[cat].push({ ...option, region: option.region || detectPaymentRegion(option) });
  });
  if (cats.Cash.length === 0) {
    cats.Cash.push({ key: 'Cash', card_num: 'Cash', bank: 'Cash', shortname: 'Cash' });
  }
  return cats;
}

export function paymentSectionsFromCats(categorized) {
  return ['Cash', 'eWallet', 'Card']
    .filter((cat) => (categorized[cat] || []).length > 0)
    .map((cat) => ({
      id: cat,
      title: cat,
      options: categorized[cat].map((o) => ({
        value: o.card_num,
        label: formatPaymentLabel(o),
      })),
    }));
}
