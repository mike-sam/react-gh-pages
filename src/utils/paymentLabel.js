/** Display label for payment option (shortname + last4 for cards) */
export function formatPaymentLabel(option) {
  if (!option) return '';
  if (option.key === 'eWallet' || option.key === 'Cash' || option.card_num === 'Cash') {
    return String(option.card_num).replace(/\[[A-Z]{2}\]/g, '').trim();
  }
  const short = option.shortname || option.bank || (option.key !== 'Card' ? option.key : '');
  const num = String(option.card_num);
  const tail = num.length > 4 ? num.slice(-4) : num;
  const region = option.region ? `${option.region} ` : '';
  if (short && short !== num) return `${region}${short} ${tail}`.trim();
  return `${region}${num}`.trim();
}
