import imageCompression from 'browser-image-compression';
import { API_ENDPOINTS, EXPENSE_TAGS, SECONDARY_TAGS } from '../config';

export const RECEIPT_COMPRESS = {
  maxSizeMB: 0.18,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.72,
};

const FIELD = (key, label, hint) => ({ key, label, hint });

export function fieldsForExpense(tag, subcat) {
  const keys = [
    FIELD('tag', '分類', '必須是允許清單'),
    FIELD('title', '子分類', '必須是該分類下的允許值'),
    FIELD('amount', '金額', '數字，不含幣符'),
    FIELD('currency', '幣別', 'ISO：MYR/SGD/USD/CNY/TWD/HKD'),
    FIELD('merchant', '商家'),
    FIELD('description', '說明'),
    FIELD('payment_method', '付款方式'),
  ];
  if (!tag || tag === '交通出行') {
    keys.push(FIELD('carPlate', '車牌'));
  }
  if (tag === '交通出行' && subcat === '打油') {
    keys.push(
      FIELD('fuelType', '油品', 'ron95 或 ron97'),
      FIELD('fuelPrice', '油價/升', '數字'),
      FIELD('liters', '升數', '數字'),
      FIELD('mileage', 'ODO', '數字'),
      FIELD('tripInfo', '行程km', '數字')
    );
  } else if (tag === '交通出行') {
    keys.push(FIELD('mileage', 'ODO', '數字'));
  }
  return keys;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function splitDataUrl(dataUrl) {
  const raw = String(dataUrl || '');
  const i = raw.indexOf(',');
  if (i === -1) return { preview: `data:image/jpeg;base64,${raw}`, base64: raw };
  return { preview: raw, base64: raw.slice(i + 1) };
}

export async function compressReceiptFile(file) {
  if (!file) return null;
  let out = file;
  try {
    out = await imageCompression(file, RECEIPT_COMPRESS);
  } catch {
    try {
      out = await imageCompression(file, { ...RECEIPT_COMPRESS, useWebWorker: false });
    } catch {
      if (file.size > 400 * 1024) throw new Error('圖片壓縮失敗，請換一張較小的圖');
      out = file;
    }
  }
  const dataUrl = await fileToDataUrl(out);
  const { preview, base64 } = splitDataUrl(dataUrl);
  return {
    preview,
    base64,
    filename: (file.name || `photo_${Date.now()}`).replace(/\.[^.]+$/, '') + '.jpg',
    originalSize: file.size,
    compressedSize: out.size || file.size,
    type: 'image/jpeg',
  };
}

async function postGasJson(payload, timeoutMs = 55000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API_ENDPOINTS.GSHEET_SUBMIT, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-cache',
      credentials: 'omit',
    });
    const text = await res.text();
    if (!text || !String(text).trim()) throw new Error('伺服器空回應');
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('伺服器回傳不是 JSON（請重新部署 Apps Script）');
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

export async function analyzeReceiptPhoto(photo, { tag, title } = {}) {
  if (!photo?.base64) throw new Error('沒有圖片');
  const payload = {
    action: 'analyzeReceipt',
    photo: photo.base64,
    mimeType: photo.type || 'image/jpeg',
    tag: tag || '',
    title: title || '',
    fields: fieldsForExpense(tag, title),
    allowedTags: EXPENSE_TAGS,
    allowedSubcats: SECONDARY_TAGS,
  };
  const data = await postGasJson(payload);
  if (!data || data.success !== true) {
    throw new Error(data?.error || 'AI 建議失敗');
  }
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions.filter((s) => s && typeof s === 'object') : [];
  return {
    suggestions,
    model: data.model || '',
    photoHash: data.photoHash || '',
  };
}

export function recordAiSuggestion(body) {
  return postGasJson(
    {
      action: 'recordAiSuggestion',
      ...body,
    },
    20000
  ).catch(() => null);
}

function asAmount(v) {
  if (v == null || v === '') return '';
  const n = Number(String(v).replace(/,/g, '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n) || n === 0) return String(v).trim();
  return n.toFixed(2);
}

function matchTag(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (EXPENSE_TAGS.includes(s)) return s;
  const found = EXPENSE_TAGS.find((t) => t === s || s.includes(t) || t.includes(s));
  return found || '';
}

function matchTitle(tag, raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const list = SECONDARY_TAGS[tag] || [];
  if (list.includes(s)) return s;
  const found = list.find((t) => t === s || s.includes(t) || t.includes(s));
  return found || '';
}

export function suggestionSummary(s) {
  if (!s) return '';
  const bits = [];
  if (s.label) bits.push(s.label);
  if (s.amount != null && s.amount !== '') bits.push(`${s.amount}${s.currency ? ` ${s.currency}` : ''}`);
  if (s.merchant) bits.push(s.merchant);
  if (s.tag || s.title) bits.push([s.tag, s.title].filter(Boolean).join(' / '));
  return bits.join(' · ') || '建議';
}

export function applyAiSuggestion(s, setters) {
  if (!s || !setters) return;
  const tag = matchTag(s.tag) || setters.selectedTag || '';
  if (matchTag(s.tag) && setters.setSelectedTag) setters.setSelectedTag(matchTag(s.tag));
  const title = matchTitle(tag, s.title);
  if (title && setters.setInput) setters.setInput(title);
  else if (s.title && !title && setters.setSimpleDescription && !s.description && !s.merchant) {
    setters.setSimpleDescription(String(s.title));
  }
  if (s.amount != null && s.amount !== '' && setters.setAmount) {
    setters.setAmount(asAmount(s.amount));
    setters.setIsAmountManuallySet?.(true);
  }
  if (s.currency && setters.setCurrency) setters.setCurrency(String(s.currency).toUpperCase());
  const desc = [s.description, s.merchant && s.description ? null : s.merchant].filter(Boolean).join(' ');
  if (desc && setters.setSimpleDescription) setters.setSimpleDescription(String(desc).trim());
  if (Array.isArray(s.items) && s.items.length && setters.setRemark) {
    const lines = s.items.map((it) => {
      if (typeof it === 'string') return it;
      if (!it) return '';
      const name = it.name || it.title || it.item || '';
      const amt = it.amount != null ? it.amount : '';
      return [name, amt].filter((x) => x !== '').join(' ');
    });
    setters.setRemark(lines.filter(Boolean).join('\n'));
  } else if (s.remark && setters.setRemark) {
    setters.setRemark(String(s.remark));
  }
  if (s.mileage != null && s.mileage !== '' && setters.setMileage) setters.setMileage(String(s.mileage));
  if (s.tripInfo != null && s.tripInfo !== '' && setters.setTripInfo) setters.setTripInfo(String(s.tripInfo));
  if (s.fuelType && setters.setFuelType) {
    const ft = String(s.fuelType).toLowerCase().replace(/\s+/g, '');
    setters.setFuelType(ft.includes('97') ? 'ron97' : 'ron95');
  }
  if (s.fuelPrice != null && s.fuelPrice !== '' && setters.setFuelPrice) setters.setFuelPrice(String(s.fuelPrice));
  if (s.carPlate && setters.setCarPlate) setters.setCarPlate(String(s.carPlate).toUpperCase());
  if ((s.payment_method || s.payment) && setters.setPaymentMethod && setters.paymentOptions) {
    const raw = String(s.payment_method || s.payment).trim();
    const opts = Object.values(setters.paymentOptions || {});
    const hit = opts.find((o) => {
      const bag = [o.card_num, o.shortname, o.bank, o.key].filter(Boolean).map((x) => String(x).toLowerCase());
      return bag.includes(raw.toLowerCase()) || bag.some((b) => raw.toLowerCase().includes(b));
    });
    if (hit?.card_num) setters.setPaymentMethod(hit.card_num);
  }
}
