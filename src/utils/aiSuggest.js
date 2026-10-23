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
    FIELD('merchant_address', '分店/地址', '照片上看得到才填'),
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
  keys.push(
    FIELD('items', '明細', '[{name, amount}]，收據有列才填'),
    FIELD('receipt_time', '照片時間', 'yyyy-MM-dd HH:mm，照片上看得到才填')
  );
  return keys;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatWhen(d) {
  const dt = d instanceof Date ? d : new Date(d || '');
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

export function mealTitleForHour(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return '';
  if (h >= 5 && h <= 10) return '早餐';
  if (h >= 11 && h <= 15) return '午餐';
  return '晚餐';
}

export function receiptHints({ tag, when } = {}) {
  const whenStr = String(when || '').trim();
  const hm = whenStr.match(/\b(\d{1,2}):(\d{2})\b/);
  const meal = hm ? mealTitleForHour(Number(hm[1])) : '';
  const foodSubs = (SECONDARY_TAGS['餐饮美食'] || []).join('、');
  const lines = [];
  if (whenStr) lines.push(`記帳時間: ${whenStr}`);
  lines.push('有品項列則 OCR 到 items:[{name,amount}] 填入明細；沒有列就省略 items。');
  lines.push('照片若印有日期/時間，填 receipt_time（yyyy-MM-dd HH:mm）；看不清就省略，不要猜。');
  lines.push('商家名填 merchant；有分店/地址才填 merchant_address。不要填經緯度。');
  if (!tag || tag === '餐饮美食') {
    const suggest = meal ? `依時間建議 ${meal}` : '依時間選早/午/晚餐';
    lines.push(
      `餐饮美食 title 只能是：${foodSubs}。${suggest}（05–10 早餐、11–15 午餐、16–04 晚餐）；外帶/外送用外卖，明顯多人用聚餐。`
    );
  }
  return lines.join('\n');
}

export function parseReceiptTime(raw, fallbackDate) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const fallback =
    fallbackDate instanceof Date && !Number.isNaN(fallbackDate.getTime()) ? fallbackDate : new Date();
  const asDate = (y, mo, d, hh, mm) => {
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh) || 0, Number(mm) || 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return asDate(m[1], m[2], m[3], m[4], m[5]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return asDate(m[3], m[2], m[1], m[4], m[5]);
  m = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (m) {
    let hh = Number(m[1]);
    const ap = (m[3] || '').toLowerCase();
    if (ap === 'pm' && hh < 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
    return asDate(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate(), hh, m[2]);
  }
  const native = new Date(s);
  return Number.isNaN(native.getTime()) ? null : native;
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

function fetchErrorMessage(err) {
  const name = err && err.name;
  const msg = String(err?.message || err || '');
  if (name === 'AbortError' || /aborted/i.test(msg)) return '逾時';
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return 'Failed to fetch：瀏覽器沒連上 Apps Script（localhost 常見 CORS／302）。用「複製 curl」測 Gemini / GAS（不含照片）。';
  }
  return msg || 'AI 建議失敗';
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
    if (!text || !String(text).trim()) {
      throw attachAiMeta(new Error('伺服器空回應'), { httpStatus: res.status, responseHead: '' });
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw attachAiMeta(new Error('伺服器回傳不是 JSON（請重新部署 Apps Script）'), {
        httpStatus: res.status,
        responseHead: String(text).slice(0, 240),
      });
    }
    return data;
  } catch (err) {
    if (err?.httpStatus != null || err?.responseHead != null) throw err;
    throw attachAiMeta(new Error(fetchErrorMessage(err)), {
      httpStatus: 0,
      responseHead: '',
    });
  } finally {
    clearTimeout(t);
  }
}

export const DEFAULT_RECEIPT_PROMPT_TEMPLATE = [
  '你是記帳助理。根據收據／發票照片填欄位。',
  '目前分類: {{tag}}',
  '目前子分類: {{title}}',
  '允許分類: {{cats}}',
  '允許子分類:',
  '{{subcats}}',
  '需要欄位:',
  '{{fields}}',
  '{{hints}}',
  '規則:',
  '1. 回傳 JSON：{"suggestions":[{...}]}，1～4 筆。金額有含稅/未稅/折扣時可給多筆。',
  '2. 每筆含短 label（如「含稅總額」）。數字用 number。未知欄位省略。',
  '3. currency 用 ISO（MYR/SGD/USD/CNY/TWD/HKD）。fuelType 僅 ron95 或 ron97。',
  '4. tag/title 必須是允許清單內的值；已選分類優先沿用，除非收據明顯不符。',
  '5. 只根據照片，不要編造商家名以外的長文。',
].join('\n');

export function receiptPromptVars({ tag, title, fields, allowedTags, allowedSubcats, when } = {}) {
  const list = Array.isArray(fields) ? fields : [];
  let fieldLines = list
    .map((f) => {
      if (!f) return '';
      const key = f.key || '';
      const label = f.label || key;
      const hint = f.hint ? ` — ${f.hint}` : '';
      return `- ${key} (${label})${hint}`;
    })
    .filter(Boolean);
  if (!fieldLines.length) {
    fieldLines = [
      '- amount (金額) — 數字，不含幣符',
      '- currency (幣別) — ISO，如 MYR/SGD/USD',
      '- merchant (商家)',
      '- description (說明)',
      '- tag (分類)',
      '- title (子分類)',
    ];
  }
  const cats = Array.isArray(allowedTags) ? allowedTags.join('、') : '';
  const subMap = allowedSubcats && typeof allowedSubcats === 'object' ? allowedSubcats : {};
  const subLines = Object.keys(subMap).map((k) => {
    const arr = Array.isArray(subMap[k]) ? subMap[k] : [];
    return `${k}: ${arr.join('、')}`;
  });
  return {
    tag: tag || '未選',
    title: title || '未選',
    cats,
    subcats: subLines.join('\n'),
    fields: fieldLines.join('\n'),
    when: String(when || '').trim(),
    hints: receiptHints({ tag, when }),
  };
}

export function fillReceiptPrompt(template, ctx) {
  const vars = receiptPromptVars(ctx);
  let src = String(template || '').trim() || DEFAULT_RECEIPT_PROMPT_TEMPLATE;
  if (src.length > 8000) src = src.slice(0, 8000);
  const hasPh = /\{\{\s*[a-z]+\s*\}\}/i.test(src);
  const hadHints = /\{\{\s*hints\s*\}\}/i.test(src);
  let out = src
    .replace(/\{\{\s*tag\s*\}\}/gi, vars.tag)
    .replace(/\{\{\s*title\s*\}\}/gi, vars.title)
    .replace(/\{\{\s*cats\s*\}\}/gi, vars.cats)
    .replace(/\{\{\s*subcats\s*\}\}/gi, vars.subcats)
    .replace(/\{\{\s*fields\s*\}\}/gi, vars.fields)
    .replace(/\{\{\s*when\s*\}\}/gi, vars.when)
    .replace(/\{\{\s*hints\s*\}\}/gi, vars.hints);
  if (!hasPh) {
    out += `\n\n目前分類: ${vars.tag}\n目前子分類: ${vars.title}${
      vars.cats ? `\n允許分類: ${vars.cats}` : ''
    }${vars.subcats ? `\n允許子分類:\n${vars.subcats}` : ''}\n需要欄位:\n${vars.fields}`;
  }
  if (!hadHints && vars.hints) out += `\n${vars.hints}`;
  return out;
}

export function receiptPromptFor(tag, title, template, when) {
  return fillReceiptPrompt(template, {
    tag: tag || '',
    title: title || '',
    when: when || '',
    fields: fieldsForExpense(tag, title),
    allowedTags: EXPENSE_TAGS,
    allowedSubcats: SECONDARY_TAGS,
  });
}

export function formatAiFallbackCopy({ model, prompt, error } = {}) {
  return [
    `model: ${model || '未回傳'}`,
    error ? `error: ${error}` : '',
    '請根據收據照片填欄位。圖請另外附上。',
    '',
    prompt || '',
  ]
    .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n')
    .trim();
}

function stripPhotoFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return { action: 'analyzeReceipt' };
  const next = { ...payload };
  delete next.photo;
  delete next.base64;
  delete next.inlineData;
  delete next.inline_data;
  return next;
}

/** PowerShell here-string + curl.exe so Content-Length is real. Inline -d "{\\"...\\"}" gets eaten → Google 411. */
function formatPowershellCurlPost(url, contentType, body) {
  const json = JSON.stringify(body || {});
  return [
    `$curlBody = @'`,
    json,
    `'@`,
    `curl.exe -sS -L -H ${JSON.stringify(`Content-Type: ${contentType}`)} --data-binary $curlBody ${JSON.stringify(url)}`,
  ].join('\n');
}

/** Endpoint ping only — no image bytes. Key is never included. */
export function formatGeminiCurl({ model } = {}) {
  const m = String(model || '').trim() || 'gemini-3.8-flash';
  const body = {
    contents: [{ parts: [{ text: 'ping' }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=YOUR_GEMINI_API_KEY`;
  return [
    `# Gemini ping · 貼到 PowerShell · curl.exe（不要用 curl 別名）`,
    `# model: ${m} · 把 YOUR_GEMINI_API_KEY 換成 KeyValueConfig AI / APIKey`,
    formatPowershellCurlPost(url, 'application/json', body),
  ].join('\n');
}

export function formatGasAnalyzeCurl({ url, payload } = {}) {
  const endpoint = String(url || API_ENDPOINTS.GSHEET_SUBMIT);
  const ping = new URL(endpoint);
  ping.searchParams.set('action', 'calendarPing');
  const src = stripPhotoFromPayload(payload);
  const body = { action: src.action || 'analyzeReceipt' };
  if (src.access) body.access = src.access;
  if (src.k) body.k = src.k;
  return [
    `# GAS ping GET（無 POST，不會 411）`,
    `curl.exe -sS -L ${JSON.stringify(ping.toString())}`,
    `# GAS analyzeReceipt ping（不含照片）`,
    formatPowershellCurlPost(endpoint, 'text/plain;charset=utf-8', body),
  ].join('\n');
}

export function formatAiCurlCopy({
  model,
  prompt,
  error,
  gasUrl,
  gasPayload,
} = {}) {
  const usedModel = String(model || '').trim() || 'gemini-3.8-flash';
  const bits = [
    `# model: ${model || '未回傳（curl 用 ' + usedModel + '）'}`,
    `# 不含照片 base64，只測 endpoint`,
    error ? `# error: ${error}` : '',
    '',
    formatGeminiCurl({ model: usedModel }),
    '',
    formatGasAnalyzeCurl({ url: gasUrl, payload: gasPayload }),
  ];
  return bits.filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== '')).join('\n').trim();
}

function attachAiMeta(err, extra) {
  const e = err instanceof Error ? err : new Error(String(err?.message || err || 'AI 建議失敗'));
  if (extra?.model != null) e.model = extra.model;
  if (extra?.prompt != null) e.prompt = extra.prompt;
  if (extra?.tried != null) e.tried = extra.tried;
  if (extra?.httpStatus != null) e.httpStatus = extra.httpStatus;
  if (extra?.responseHead != null) e.responseHead = extra.responseHead;
  return e;
}

export async function loadAiPrompt() {
  const data = await postGasJson({ action: 'getAiPrompt' }, 20000);
  if (!data || data.success !== true || data.action !== 'getAiPrompt') {
    throw new Error(data?.error || '請重新部署 Apps Script');
  }
  const stored = String(data.template || '').trim();
  return {
    template: stored || data.defaultTemplate || DEFAULT_RECEIPT_PROMPT_TEMPLATE,
    stored: Boolean(stored),
    defaultTemplate: data.defaultTemplate || DEFAULT_RECEIPT_PROMPT_TEMPLATE,
    model: data.model || '',
  };
}

export async function saveAiPrompt(template) {
  const text = (String(template || '').trim() || DEFAULT_RECEIPT_PROMPT_TEMPLATE).slice(0, 8000);
  const data = await postGasJson({ action: 'setAiPrompt', template: text }, 20000);
  if (!data || data.success !== true || String(data.group) !== 'AI') {
    throw new Error(data?.error || '請重新部署 Apps Script');
  }
  return text;
}

export async function analyzeReceiptPhoto(photo, { tag, title, promptTemplate, when } = {}) {
  if (!photo?.base64) throw new Error('沒有圖片');
  const payload = {
    action: 'analyzeReceipt',
    photo: photo.base64,
    mimeType: photo.type || 'image/jpeg',
    tag: tag || '',
    title: title || '',
    when: when || '',
    fields: fieldsForExpense(tag, title),
    allowedTags: EXPENSE_TAGS,
    allowedSubcats: SECONDARY_TAGS,
    promptTemplate: String(promptTemplate || '').trim().slice(0, 8000),
  };
  const prompt = fillReceiptPrompt(payload.promptTemplate, payload);
  try {
    const data = await postGasJson(payload, 90000);
    if (!data || data.success !== true) {
      throw attachAiMeta(new Error(data?.error || 'AI 建議失敗'), {
        model: data?.model || '',
        prompt: data?.prompt || prompt,
        tried: data?.tried || [],
      });
    }
    const suggestions = Array.isArray(data.suggestions)
      ? data.suggestions.filter((s) => s && typeof s === 'object')
      : [];
    return {
      suggestions,
      model: data.model || '',
      tried: data.tried || [],
      prompt: data.prompt || prompt,
      photoHash: data.photoHash || '',
    };
  } catch (err) {
    throw attachAiMeta(err, {
      model: err?.model || '',
      prompt: err?.prompt || prompt,
      tried: err?.tried || [],
    });
  }
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
  if (Array.isArray(s.items) && s.items.length) bits.push(`${s.items.length}項`);
  if (s.receipt_time) bits.push(s.receipt_time);
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
  if (s.receipt_time && setters.setSelectedDateTime) {
    const parsed = parseReceiptTime(s.receipt_time, setters.selectedDateTime);
    if (parsed) setters.setSelectedDateTime(parsed);
  }
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
