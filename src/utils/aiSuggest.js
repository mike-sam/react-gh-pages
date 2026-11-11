import { API_ENDPOINTS } from '../config';
import { getExpenseTagPack } from './expenseTags';

export { compressReceiptFile, fileToDataUrl } from './receiptPhoto';

export const RECEIPT_COMPRESS = {
  maxSizeMB: 0.32,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.78,
};

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const GEMINI_BUDGET_MS = 8000;
const OPENAI_BUDGET_MS = 18000;
const START_ROLE_RE = /^(start|begin|in|入場|入场|開始|开始|开台|開台|入園|入园|time\s*in)$/i;
const END_ROLE_RE = /^(end|out|exit|離場|离场|結束|结束|結帳|结帐|time\s*out)$/i;

/** Gemini responseSchema (v1beta uppercase types). Lite 若不吃會 400，呼叫端再重試無 schema。 */
export const GEMINI_SUGGESTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    suggestions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          tag: { type: 'STRING' },
          title: { type: 'STRING' },
          amount: { type: 'NUMBER' },
          currency: { type: 'STRING' },
          merchant: { type: 'STRING' },
          merchant_address: { type: 'STRING' },
          description: { type: 'STRING' },
          payment_method: { type: 'STRING' },
          receipt_time: { type: 'STRING' },
          time_role: { type: 'STRING' },
          event_start: { type: 'STRING' },
          event_end: { type: 'STRING' },
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                unitPrice: { type: 'NUMBER' },
                quantity: { type: 'NUMBER' },
                amount: { type: 'NUMBER' },
              },
            },
          },
          carPlate: { type: 'STRING' },
          mileage: { type: 'NUMBER' },
          tripInfo: { type: 'NUMBER' },
          fuelType: { type: 'STRING' },
          fuelPrice: { type: 'NUMBER' },
        },
      },
    },
  },
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
    FIELD('items', '明細', '[{name, unitPrice, quantity, amount}]，收據有品項列才填'),
    FIELD('receipt_time', '照片時間', 'yyyy-MM-dd HH:mm，開立/印出時間'),
    FIELD('time_role', '時間角色', 'printed（預設）| start（入場/開台/停車入場）| end（離場）'),
    FIELD('event_start', '開始時間', 'yyyy-MM-dd HH:mm，time_role=start 或照片有開始欄才填'),
    FIELD('event_end', '結束時間', 'yyyy-MM-dd HH:mm，照片有結束欄才填；只有開始則省略')
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
  const foodSubs = (getExpenseTagPack().subcats['餐饮美食'] || []).join('、');
  const lines = [];
  if (whenStr) lines.push(`記帳時間: ${whenStr}`);
  lines.push(
    '有品項列則填 items:[{name,unitPrice,quantity,amount}]：name 字串，unitPrice/quantity/amount 用 number。quantity 看得到才填否則 1。amount 是該列小計。不要把整張總額當單一 item。沒有列就省略 items。'
  );
  lines.push(
    '時間：receipt_time 一律填印出時間（yyyy-MM-dd HH:mm）。入場/IN/開台/停車入場 → time_role=start 且 event_start=該時間，不要填 event_end。一般收據開立時間 → time_role=printed。照片同時有開始+結束才填 event_start 與 event_end。看不清就省略，不要猜。'
  );
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
  '6. 收據有品項列時 suggestions[].items 必填；沒有列才省略。數字欄位用 number。',
  '7. 回傳只能是 JSON，格式：',
  '{"suggestions":[{"label":"含稅總額","tag":"餐饮美食","title":"午餐","amount":25.5,"currency":"MYR","merchant":"店名","items":[{"name":"Nasi Lemak","unitPrice":8.5,"quantity":2,"amount":17}],"receipt_time":"2026-10-24 12:30","time_role":"printed"}]}',
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
    .replace(/\{\{\s*hints\s*\}\}/gi, vars.hints)
    .replace(/\{\{\s*latlng\s*\}\}/gi, lifePromptVars(ctx).latlng || '無')
    .replace(/\{\{\s*kg\s*\}\}/gi, lifePromptVars(ctx).kg)
    .replace(/\{\{\s*dailyKcal\s*\}\}/gi, lifePromptVars(ctx).dailyKcal);
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
    allowedTags: getExpenseTagPack().cats,
    allowedSubcats: getExpenseTagPack().subcats,
  });
}

/** Split a template into literal text and the values that replace {{tag}} etc. */
export function receiptPromptParts(template, { tag, title, when, lat, lng, kg } = {}) {
  const vars = {
    ...receiptPromptVars({
      tag: tag || '',
      title: title || '',
      when: when || '',
      fields: fieldsForExpense(tag, title),
      allowedTags: getExpenseTagPack().cats,
      allowedSubcats: getExpenseTagPack().subcats,
    }),
    ...lifePromptVars({ when, lat, lng, kg }),
  };
  const src = String(template || '');
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const parts = [];
  let last = 0;
  let match = re.exec(src);
  while (match) {
    if (match.index > last) parts.push({ kind: 'text', text: src.slice(last, match.index) });
    const key = String(match[1] || '');
    const value = vars[key] != null ? String(vars[key]) : '';
    parts.push({
      kind: 'slot',
      key,
      text: value.trim() ? value : '空',
      empty: !value.trim(),
    });
    last = match.index + match[0].length;
    match = re.exec(src);
  }
  if (last < src.length) parts.push({ kind: 'text', text: src.slice(last) });
  return parts;
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

/** PowerShell here-string + curl.exe so Content-Length is real. Inline -d "{\\"...\\"}" gets eaten → Google 411. */
function formatPowershellCurlPost(url, contentType, body, extraHeaders = []) {
  const json = JSON.stringify(body || {});
  const hs = [`-H ${JSON.stringify(`Content-Type: ${contentType}`)}`]
    .concat(extraHeaders.map((h) => `-H ${JSON.stringify(h)}`))
    .join(' ');
  return [
    `$curlBody = @'`,
    json,
    `'@`,
    `curl.exe -sS -L ${hs} --data-binary $curlBody ${JSON.stringify(url)}`,
  ].join('\n');
}

/** Endpoint ping only — no image bytes. Key is never included. */
export function formatGeminiCurl({ model } = {}) {
  const m = String(model || '').trim() || 'gemini-3.5-flash-lite';
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

export function formatOpenAiCurl({ model } = {}) {
  const m = String(model || '').trim() || DEFAULT_OPENAI_MODEL;
  const body = { model: m, messages: [{ role: 'user', content: 'ping' }] };
  return [
    `# OpenAI ping · 貼到 PowerShell · curl.exe`,
    `# model: ${m} · 把 YOUR_OPENAI_API_KEY 換成 KeyValueConfig AI / OPENAPIKey`,
    formatPowershellCurlPost('https://api.openai.com/v1/chat/completions', 'application/json', body, [
      'Authorization: Bearer YOUR_OPENAI_API_KEY',
    ]),
  ].join('\n');
}

export function formatAiCurlCopy({
  model,
  prompt,
  error,
} = {}) {
  const usedModel = String(model || '').trim() || 'gemini-3.5-flash-lite';
  const bits = [
    `# model: ${model || '未回傳（curl 用 ' + usedModel + '）'}`,
    `# 不含照片；瀏覽器直打 Gemini / OpenAI，不經 GAS`,
    error ? `# error: ${error}` : '',
    '',
    formatGeminiCurl({ model: /gpt/i.test(usedModel) ? 'gemini-3.5-flash-lite' : usedModel }),
    '',
    formatOpenAiCurl({ model: /gpt/i.test(usedModel) ? usedModel : DEFAULT_OPENAI_MODEL }),
  ];
  return bits.filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== '')).join('\n').trim();
}

function attachAiMeta(err, extra) {
  const e = err instanceof Error ? err : new Error(String(err?.message || err || 'AI 建議失敗'));
  if (extra?.model != null) e.model = extra.model;
  if (extra?.prompt != null) e.prompt = extra.prompt;
  if (extra?.tried != null) e.tried = extra.tried;
  if (extra?.submitted != null) e.submitted = extra.submitted;
  if (extra?.httpStatus != null) e.httpStatus = extra.httpStatus;
  if (extra?.responseHead != null) e.responseHead = extra.responseHead;
  return e;
}

/** 便宜的在前。KeyValueConfig AI/Models 可整份換掉。 */
export const DEFAULT_AI_MODELS = [
  { id: 'gemini-3.5-flash-lite', provider: 'gemini', label: 'Flash Lite', tier: '最便宜' },
  { id: 'gemini-3.8-flash', provider: 'gemini', label: 'Flash', tier: '較準' },
  { id: 'gpt-4o-mini', provider: 'openai', label: '4o mini', tier: '便宜' },
];

export function parseAiModels(raw) {
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(list)) return DEFAULT_AI_MODELS.slice();
    const out = list
      .map((row) => ({
        id: String(row?.id || '').trim(),
        provider: String(row?.provider || '').trim().toLowerCase(),
        label: String(row?.label || row?.id || '').trim(),
        tier: String(row?.tier || '').trim(),
      }))
      .filter((row) => row.id && (row.provider === 'gemini' || row.provider === 'openai'));
    return out.length ? out : DEFAULT_AI_MODELS.slice();
  } catch {
    return DEFAULT_AI_MODELS.slice();
  }
}

/** 這次網頁還開著才算數。不寫 localStorage，iOS webview 關掉就沒了。 */
const aiKeys = {
  gemini: '',
  openai: '',
  geminiModel: '',
  openaiModel: DEFAULT_OPENAI_MODEL,
  prefer: 'gemini',
};

function canonicalizeGeminiModel(name) {
  let slug = String(name || '')
    .trim()
    .replace(/^models\//i, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^(gemini)-(\d+)-(\d+)/, '$1-$2.$3');
  if (slug === 'gemini-2.5-flash-lite' || slug === 'gemini-2.0-flash-lite') return 'gemini-3.5-flash-lite';
  if (slug === 'gemini-2.5-flash' || slug === 'gemini-2.0-flash') return 'gemini-3.8-flash';
  return /^gemini-[\w.-]+$/.test(slug) ? slug : 'gemini-3.5-flash-lite';
}

function geminiBrowserModels(preferred) {
  const p = canonicalizeGeminiModel(preferred);
  const out = [];
  const push = (m) => {
    if (m && out.indexOf(m) === -1) out.push(m);
  };
  push(p || 'gemini-3.5-flash-lite');
  push('gemini-3.5-flash-lite');
  return out;
}

function aiProviderOrder() {
  const first = aiKeys.prefer === 'openai' ? 'openai' : 'gemini';
  return first === 'openai' ? ['openai', 'gemini'] : ['gemini', 'openai'];
}

async function fetchJson(url, init, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, credentials: 'omit', cache: 'no-cache' });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, text };
  } finally {
    clearTimeout(t);
  }
}

function looksLikeSuggestion(s) {
  return !!(
    s &&
    (s.tag ||
      s.title ||
      s.label ||
      s.merchant ||
      s.currency ||
      s.receipt_time ||
      s.event_start ||
      s.time_role ||
      (s.amount != null && s.amount !== '') ||
      (Array.isArray(s.items) && s.items.length))
  );
}

function sliceBalancedJson(s, start) {
  const open = s[start];
  if (open !== '{' && open !== '[') return '';
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i += 1) {
    const c = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return '';
}

/** Pull JSON objects/arrays out of rambling model text. Ignores prose. */
export function extractJsonFragments(text) {
  const s = String(text || '');
  const seen = new Set();
  const out = [];
  const push = (chunk) => {
    const t = String(chunk || '').trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  const fence = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m;
  while ((m = fence.exec(s))) push(m[1]);
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] !== '{' && s[i] !== '[') continue;
    const chunk = sliceBalancedJson(s, i);
    if (chunk.length < 2) continue;
    push(chunk);
    i += chunk.length - 1;
  }
  return out;
}

function listFromParsed(obj) {
  let list = [];
  const usedItemsAsSuggestions =
    obj &&
    Array.isArray(obj.items) &&
    obj.items.some(looksLikeSuggestion) &&
    !Array.isArray(obj.suggestions);
  if (Array.isArray(obj)) list = obj;
  else if (obj && Array.isArray(obj.suggestions)) list = obj.suggestions;
  else if (usedItemsAsSuggestions) list = obj.items;
  else if (obj && typeof obj === 'object') list = [obj];
  const topItems = normalizeAiItems(
    obj && (obj.line_items || obj.lineItems || (!usedItemsAsSuggestions && !Array.isArray(obj) ? obj.items : null))
  );
  return list
    .filter((s) => s && typeof s === 'object' && looksLikeSuggestion(s))
    .slice(0, 8)
    .map((s) => stampSuggestionTimes(attachItems(s, topItems)));
}

function scoreSuggestions(list) {
  if (!Array.isArray(list) || !list.length) return 0;
  return list.reduce((n, s) => {
    if (!s || typeof s !== 'object') return n;
    return (
      n +
      1 +
      (s.amount != null && s.amount !== '' ? 3 : 0) +
      (Array.isArray(s.items) ? Math.min(s.items.length, 8) : 0) +
      (s.merchant ? 2 : 0) +
      (s.tag || s.title ? 1 : 0)
    );
  }, 0);
}

/** Printed receipt time vs activity start. Start-only → caller uses now as end. */
export function resolveSuggestionTimes(s, now = new Date()) {
  if (!s) return { receiptTime: null, eventStart: null, eventEnd: null, calendar: false };
  const role = String(s.time_role || s.timeRole || '').trim();
  const startRaw = s.event_start || s.eventStart || s.start_time || s.startTime || '';
  const endRaw = s.event_end || s.eventEnd || s.end_time || s.endTime || '';
  const printedRaw = s.receipt_time || s.receiptTime || s.time || '';
  const start = parseReceiptTime(startRaw, now);
  const end = parseReceiptTime(endRaw, now);
  const printed = parseReceiptTime(printedRaw, now);
  const isStart = START_ROLE_RE.test(role);
  const isEnd = END_ROLE_RE.test(role);
  const minMs = 2 * 60 * 1000;
  const alreadyInferred = s.inferredEnd === true;

  if (alreadyInferred) {
    const startOnly = start || printed;
    if (startOnly && now.getTime() - startOnly.getTime() >= minMs) {
      return {
        receiptTime: now,
        eventStart: startOnly,
        eventEnd: now,
        calendar: true,
        inferredEnd: true,
      };
    }
  }

  if (start && end && end.getTime() > start.getTime()) {
    return {
      receiptTime: printed || end,
      eventStart: start,
      eventEnd: end,
      calendar: true,
      inferredEnd: false,
    };
  }
  const startOnly = start || (isStart ? printed : null);
  if (startOnly && !end && !isEnd) {
    if (now.getTime() - startOnly.getTime() >= minMs && startOnly.getTime() <= now.getTime() + minMs) {
      return {
        receiptTime: now,
        eventStart: startOnly,
        eventEnd: now,
        calendar: true,
        inferredEnd: true,
      };
    }
  }
  if (isEnd && (end || printed)) {
    return { receiptTime: end || printed, eventStart: null, eventEnd: null, calendar: false };
  }
  if (printed) return { receiptTime: printed, eventStart: null, eventEnd: null, calendar: false };
  return { receiptTime: null, eventStart: null, eventEnd: null, calendar: false };
}

function stampSuggestionTimes(s) {
  const times = resolveSuggestionTimes(s);
  return {
    ...s,
    receipt_time: times.receiptTime ? formatWhen(times.receiptTime) : s.receipt_time || '',
    event_start: times.eventStart ? formatWhen(times.eventStart) : '',
    event_end: times.eventEnd ? formatWhen(times.eventEnd) : '',
    calendar: times.calendar,
    inferredEnd: Boolean(times.inferredEnd),
  };
}

function asFiniteNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const s = String(v ?? '').trim();
  if (!s) return NaN;
  const n = parseFloat(s.replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/** Receipt line items → ItemizedDescription rows (name / unitPrice / quantity / subtotal). */
export function normalizeAiItems(raw) {
  if (!Array.isArray(raw) || !raw.length) return [];
  const out = [];
  raw.forEach((it) => {
    if (typeof it === 'string') {
      const s = it.trim();
      if (!s) return;
      const m = s.match(/^(.*?)[\s:：]+(-?\d+(?:[.,]\d+)?)\s*$/);
      if (m && m[1].trim()) {
        const amt = asFiniteNumber(m[2]);
        out.push({
          name: m[1].trim(),
          unitPrice: amt > 0 ? amt : 0,
          quantity: 1,
          subtotal: amt > 0 ? amt : 0,
        });
      } else {
        out.push({ name: s, unitPrice: 0, quantity: 1, subtotal: 0 });
      }
      return;
    }
    if (!it || typeof it !== 'object') return;
    const name = String(
      it.name || it.title || it.item || it.desc || it.description || it.product || ''
    ).trim();
    const qtyN = asFiniteNumber(it.quantity ?? it.qty ?? it.count ?? it.unit_count);
    const unitN = asFiniteNumber(it.unitPrice ?? it.unit_price ?? it.price ?? it.unit ?? it.rate);
    const amtN = asFiniteNumber(
      it.amount ?? it.subtotal ?? it.total ?? it.line_total ?? it.sum ?? it.lineTotal
    );
    if (!name && !(amtN > 0)) return;
    const quantity = qtyN > 0 ? qtyN : 1;
    let subtotal = amtN > 0 ? amtN : NaN;
    let unitPrice = unitN > 0 ? unitN : NaN;
    if (!(unitPrice > 0) && subtotal > 0) {
      unitPrice = quantity ? +(subtotal / quantity).toFixed(2) : subtotal;
    }
    if (!(subtotal > 0) && unitPrice > 0) subtotal = +(unitPrice * quantity).toFixed(2);
    out.push({
      name: name || '項目',
      unitPrice: unitPrice > 0 ? unitPrice : 0,
      quantity,
      subtotal: subtotal > 0 ? subtotal : 0,
    });
  });
  return out.slice(0, 40);
}

export function formatItemizedLines(items) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => String(it?.name || '').trim())
    .map((it) => `${String(it.name).trim()}: ${it.unitPrice} × ${it.quantity} = ${it.subtotal}`)
    .join('\n');
}

function attachItems(s, fallbackItems) {
  const nested = normalizeAiItems(s.items || s.line_items || s.lineItems);
  if (nested.length) return { ...s, items: nested };
  if (fallbackItems && fallbackItems.length) return { ...s, items: fallbackItems };
  return s;
}

export function parseAiSuggestions(text) {
  const fragments = extractJsonFragments(text);
  const whole = String(text || '').trim();
  if (whole && !fragments.includes(whole)) fragments.unshift(whole);
  let best = [];
  let bestScore = -1;
  fragments.forEach((frag) => {
    let obj;
    try {
      obj = JSON.parse(frag);
    } catch {
      return;
    }
    const list = listFromParsed(obj);
    const score = scoreSuggestions(list);
    if (score > bestScore) {
      best = list;
      bestScore = score;
    }
  });
  return best;
}

function extractGeminiText(data) {
  const parts = ((((data || {}).candidates || [])[0] || {}).content || {}).parts || [];
  let out = '';
  parts.forEach((p) => {
    if (p && p.text) out += p.text;
  });
  if (!out) {
    const block = data && data.promptFeedback && data.promptFeedback.blockReason;
    throw new Error(block ? `Gemini blocked: ${block}` : 'Gemini 無內容');
  }
  return out;
}

function geminiHttpError(status, data, text) {
  const msg = String((data && data.error && data.error.message) || '').trim();
  return `Gemini HTTP ${status}${msg ? `: ${msg}` : text ? `: ${String(text).slice(0, 120)}` : ''}`;
}

async function callGeminiBrowser({ apiKey, models, mimeType, base64, prompt, budgetMs, images, schema }) {
  const tried = [];
  const t0 = Date.now();
  let lastErr = '';
  const parts = [{ text: prompt }, { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64 } }];
  (images || []).forEach((img) => {
    if (img?.base64) {
      parts.push({ inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.base64 } });
    }
  });
  for (let i = 0; i < models.length; i += 1) {
    const left = budgetMs - (Date.now() - t0);
    if (left < 1500) break;
    const m = models[i];
    tried.push(m);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const makeBody = (withSchema) => ({
      contents: [{ parts }],
      generationConfig: withSchema
        ? {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: schema && typeof schema === 'object' ? schema : GEMINI_SUGGESTION_SCHEMA,
          }
        : { temperature: 0.2, responseMimeType: 'application/json' },
    });
    try {
      const wantSchema = schema !== false && !/lite/i.test(m);
      let res = await fetchJson(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(makeBody(wantSchema)),
        },
        left
      );
      if (wantSchema && !res.ok && res.status === 400) {
        const left2 = budgetMs - (Date.now() - t0);
        if (left2 > 1500) {
          res = await fetchJson(
            url,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(makeBody(false)),
            },
            left2
          );
        }
      }
      if (res.ok && res.data) {
        return { text: extractGeminiText(res.data), model: m, tried };
      }
      lastErr = geminiHttpError(res.status, res.data, res.text);
      if (res.status === 401 || res.status === 403) break;
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (err?.name === 'AbortError' || /aborted/i.test(msg)) {
        lastErr = 'Gemini 逾時';
        break;
      }
      lastErr = /Failed to fetch|NetworkError/i.test(msg) ? 'Gemini Failed to fetch（CORS）' : msg;
      if (/CORS|Failed to fetch/i.test(lastErr)) break;
    }
  }
  const e = new Error(lastErr || 'Gemini 失敗');
  e.tried = tried;
  throw e;
}

async function callOpenAiBrowser({ apiKey, model, mimeType, base64, prompt, timeoutMs, images, detail }) {
  const m = String(model || '').trim() || DEFAULT_OPENAI_MODEL;
  const body = {
    model: m,
    temperature: 0.2,
    max_tokens: 2500,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType || 'image/jpeg'};base64,${base64}`,
              detail: detail || 'low',
            },
          },
          ...(images || [])
            .filter((img) => img?.base64)
            .map((img) => ({
              type: 'image_url',
              image_url: {
                url: `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}`,
                detail: detail || 'low',
              },
            })),
        ],
      },
    ],
  };
  try {
    const res = await fetchJson(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      timeoutMs
    );
    if (!res.ok) {
      const msg = String((res.data && res.data.error && res.data.error.message) || '').trim();
      throw new Error(`OpenAI HTTP ${res.status}${msg ? `: ${msg}` : ''}`);
    }
    const text = String(((((res.data || {}).choices || [])[0] || {}).message || {}).content || '');
    if (!text.trim()) throw new Error('OpenAI 無內容');
    return { text, model: m };
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (err?.name === 'AbortError' || /aborted/i.test(msg)) throw new Error('OpenAI 逾時');
    if (/Failed to fetch|NetworkError/i.test(msg)) throw new Error('OpenAI Failed to fetch（瀏覽器 CORS 擋了）');
    throw err instanceof Error ? err : new Error(msg);
  }
}

async function photoHash(b64) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(b64 || '').slice(0, 12000)));
    return [...new Uint8Array(buf).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return String(b64 || '').length ? `len${String(b64).length}` : '';
  }
}

let aiPromptSnapshot = null;

/** 這次網頁已經讀過就回傳，沒讀過是 null。不會打 GAS。 */
export function peekAiPrompt() {
  return aiPromptSnapshot;
}

export async function loadAiPrompt() {
  const data = await postGasJson({ action: 'getAiPrompt' }, 20000);
  if (!data || data.success !== true || data.action !== 'getAiPrompt') {
    throw new Error(data?.error || '請重新部署 Apps Script');
  }
  aiKeys.gemini = String(data.geminiKey || '').trim();
  aiKeys.openai = String(data.openaiKey || '').trim();
  aiKeys.geminiModel = canonicalizeGeminiModel(data.model);
  aiKeys.openaiModel = String(data.openaiModel || '').trim() || DEFAULT_OPENAI_MODEL;
  const preferRaw = String(data.prefer || '').trim();
  const preferSep = preferRaw.indexOf(':');
  if (preferSep > 0) {
    aiKeys.prefer = preferRaw.slice(0, preferSep) === 'openai' ? 'openai' : 'gemini';
    const preferId = preferRaw.slice(preferSep + 1);
    if (aiKeys.prefer === 'openai' && preferId) aiKeys.openaiModel = preferId;
    if (aiKeys.prefer === 'gemini' && preferId) aiKeys.geminiModel = canonicalizeGeminiModel(preferId);
  }
  const stored = String(data.template || '').trim();
  let promptsRaw = data.prompts;
  if (promptsRaw == null || String(promptsRaw).trim() === '') {
    try {
      const row = await postGasJson({ action: 'getKeyValue', group: 'AI', key: 'Prompts' }, 20000);
      if (row?.success && row.value != null) promptsRaw = row.value;
    } catch {
      /* 沒有這列就用三份通用 */
    }
  }
  const result = {
    template: stored || data.defaultTemplate || DEFAULT_RECEIPT_PROMPT_TEMPLATE,
    stored: Boolean(stored),
    defaultTemplate: data.defaultTemplate || DEFAULT_RECEIPT_PROMPT_TEMPLATE,
    model: aiKeys.geminiModel,
    models: parseAiModels(data.models),
    prompts: parsePromptLibrary(promptsRaw, stored || data.defaultTemplate || DEFAULT_RECEIPT_PROMPT_TEMPLATE),
    prefer: `${aiKeys.prefer}:${aiKeys.prefer === 'openai' ? aiKeys.openaiModel : aiKeys.geminiModel}`,
    hasGemini: Boolean(aiKeys.gemini),
    hasOpenAI: Boolean(aiKeys.openai),
  };
  aiPromptSnapshot = result;
  return result;
}

export async function saveAiModelChoice(provider, id) {
  const which = provider === 'openai' ? 'openai' : 'gemini';
  const modelId = String(id || '').trim();
  if (!modelId) throw new Error('沒有模型');
  aiKeys.prefer = which;
  if (which === 'openai') aiKeys.openaiModel = modelId;
  else aiKeys.geminiModel = canonicalizeGeminiModel(modelId);
  const value = `${which}:${which === 'gemini' ? aiKeys.geminiModel : aiKeys.openaiModel}`;
  const data = await postGasJson({ action: 'setKeyValue', group: 'AI', key: 'Prefer', value }, 20000);
  if (!data || data.success !== true) throw new Error(data?.error || '模型沒寫進設定');
  return value;
}

export async function savePromptLibrary(list) {
  const rows = Array.isArray(list) ? list : [];
  const value = JSON.stringify(rows);
  const data = await postGasJson({ action: 'setKeyValue', group: 'AI', key: 'Prompts', value }, 20000);
  if (!data || data.success !== true) throw new Error(data?.error || 'prompt 沒寫進設定');
  const general = rows.find((row) => row.mode === 'expense' && !row.cat && !row.subcat);
  if (general?.template) {
    try {
      await saveAiPrompt(general.template);
    } catch {
      /* 清單已寫入。舊的單筆 Prompt 沒同步不影響下拉 */
    }
  }
  return rows;
}

export async function saveAiPrompt(template) {
  const text = (String(template || '').trim() || DEFAULT_RECEIPT_PROMPT_TEMPLATE).slice(0, 8000);
  const data = await postGasJson({ action: 'setAiPrompt', template: text }, 20000);
  if (!data || data.success !== true || String(data.group) !== 'AI') {
    throw new Error(data?.error || '請重新部署 Apps Script');
  }
  return text;
}

export async function analyzeReceiptPhoto(photo, { tag, title, promptTemplate, when, lat, lng, kg, schema, images } = {}) {
  if (!photo?.base64) throw new Error('沒有圖片');
  const prompt = fillReceiptPrompt(promptTemplate, {
    tag: tag || '',
    title: title || '',
    when: when || '',
    lat,
    lng,
    kg,
    fields: fieldsForExpense(tag, title),
    allowedTags: getExpenseTagPack().cats,
    allowedSubcats: getExpenseTagPack().subcats,
  });
  const mimeType = photo.type || 'image/jpeg';
  const base64 = photo.base64;
  const tried = [];
  const fail = (err, model, submitted) => {
    throw attachAiMeta(err instanceof Error ? err : new Error(String(err?.message || err || 'AI 建議失敗')), {
      model: model || '',
      prompt,
      tried,
      submitted: Boolean(submitted),
    });
  };
  if (!aiKeys.gemini && !aiKeys.openai) {
    fail(new Error('按「讀取設定」才會打 getAiPrompt。這次沒送到模型，Telegram 也不會發'), '', false);
  }

  let lastErr = '';
  const runGemini = async () => {
    const gemini = await callGeminiBrowser({
      apiKey: aiKeys.gemini,
      models: geminiBrowserModels(aiKeys.geminiModel),
      mimeType,
      base64,
      prompt,
      budgetMs: GEMINI_BUDGET_MS,
      schema,
      images,
    });
    tried.push(...(gemini.tried || [gemini.model]));
    return {
      suggestions: parseAiSuggestions(gemini.text),
      text: gemini.text,
      model: gemini.model,
      tried,
      prompt,
      photoHash: await photoHash(base64),
    };
  };
  const runOpenAi = async () => {
    const openai = await callOpenAiBrowser({
      apiKey: aiKeys.openai,
      model: aiKeys.openaiModel,
      mimeType,
      base64,
      prompt,
      timeoutMs: OPENAI_BUDGET_MS,
      images,
    });
    tried.push(openai.model);
    return {
      suggestions: parseAiSuggestions(openai.text),
      text: openai.text,
      model: openai.model,
      tried,
      prompt,
      photoHash: await photoHash(base64),
    };
  };
  for (const provider of aiProviderOrder()) {
    if (provider === 'gemini' && aiKeys.gemini) {
      try {
        return await runGemini();
      } catch (err) {
        tried.push(...(err?.tried || ['gemini']));
        lastErr = String(err?.message || err || 'Gemini 失敗');
      }
    }
    if (provider === 'openai' && aiKeys.openai) {
      try {
        return await runOpenAi();
      } catch (err) {
        tried.push(aiKeys.openaiModel || DEFAULT_OPENAI_MODEL);
        lastErr = [lastErr, String(err?.message || err || 'OpenAI 失敗')].filter(Boolean).join(' · ');
      }
    }
  }

  fail(new Error(lastErr || 'AI 建議失敗'), tried[tried.length - 1] || '', true);
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
  const tags = getExpenseTagPack().cats;
  if (tags.includes(s)) return s;
  const found = tags.find((t) => t === s || s.includes(t) || t.includes(s));
  return found || '';
}

function matchTitle(tag, raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const list = getExpenseTagPack().subcats[tag] || [];
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
  if (s.calendar && s.event_start && s.event_end) bits.push(`${s.event_start}→${s.event_end}`);
  else if (s.receipt_time) bits.push(s.receipt_time);
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
  const items = normalizeAiItems(s.items || s.line_items || s.lineItems);
  if (items.length) {
    const lines = formatItemizedLines(items);
    if (setters.setRemark) setters.setRemark(lines);
    setters.setItemizedImport?.({ key: Date.now(), items });
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
  const times = resolveSuggestionTimes(s, new Date());
  if (times.receiptTime && setters.setSelectedDateTime) {
    setters.setSelectedDateTime(times.receiptTime);
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

export const TELEGRAM_TOPICS = ['General', 'Foods', 'Receipts', 'Med', 'Viridien', 'Car'];

const LIFE_THREADS = { General: '*1', Foods: 6, Receipts: 11, Med: 35, Viridien: 55, Car: 102 };
const LIFE_TPL_KEY = 'lifePhotoPromptTpl';

/** 記錄用。{{when}} {{latlng}} {{kg}} {{dailyKcal}} 會在預覽和送出時代入。 */
export const DEFAULT_LIFE_PROMPT_TEMPLATE = [
  '你是照片記錄助手。只根據實際看得到的照片內容，回傳一個 JSON。',
  '讀不到圖：caption 空字串，topic 用 General，other 寫「無法讀取照片內容」。不要用「一張日常生活照片」充數。',
  'caption 用簡體中文，描述主體和場景，不要用「这是一张照片」開頭。不要猜拍攝時間。',
  '拍攝時間（只有食物才可用來加 hashtag，禁止用現在時間代替）：{{when}}',
  '目前位置：{{latlng}}',
  '體重 kg：{{kg}}。步行 5km/h 約 3.5 MET，慢跑 8km/h 約 8.3 MET。每分鐘 kcal ≈ MET×3.5×體重÷200。步行約 1300 步/公里。結果取整數。',
  '只有畫面裡真的有食物或飲料才加這段，非食物禁止出現：',
  '🍽️ 热量：约XXX kcal',
  '🍬 糖分：约XX g',
  '🚶 步行消耗：约XXXX步',
  '🏃 慢跑消耗：约XX分钟',
  '依據體重，食物照片再加一行：每日建議攝取：约{{dailyKcal}} kcal（體重×30 的粗估，不是醫囑）。',
  '份量看不清就寫估算。糖分是估計總糖，不是游離糖。不要用一餐判斷全天超標。',
  '食物 hashtag 只在有可靠拍攝時間時加，前面一個空格：05:00–10:59 #breakfast，11:00–16:59 #lunch，17:00–21:59 #dinner，22:00–04:59 #supper。',
  '不要辨認車牌，不要抄寫車牌，不要加任何車牌 hashtag。',
  'topic 只能是 General、Foods、Receipts、Med、Viridien、Car。收據優先 Receipts。食物優先 Foods。照片主要是汽車、維修或路況才用 Car。不確定用 General。',
  '有經緯度才在 caption 最後加「 - http://maps.google.com/maps?q=lat,lng」。不要猜座標。',
  '只回 JSON：{"caption":"","topic":"General","other":""}',
  `topic 對照（General 的 thread 是 *1 不是 1）：${JSON.stringify(LIFE_THREADS)}`,
].join('\n');

export function loadLifePromptTemplate() {
  try {
    const saved = sessionStorage.getItem(LIFE_TPL_KEY);
    if (saved && saved.trim()) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_LIFE_PROMPT_TEMPLATE;
}

export function saveLifePromptTemplate(text) {
  const next = String(text || '');
  try {
    if (!next.trim() || next === DEFAULT_LIFE_PROMPT_TEMPLATE) sessionStorage.removeItem(LIFE_TPL_KEY);
    else sessionStorage.setItem(LIFE_TPL_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

export function lifePromptVars({ when, lat, lng, kg } = {}) {
  const weight = Number(kg) > 0 ? Number(kg) : 65;
  const latlng = lat != null && lng != null ? `${lat},${lng}` : '';
  return {
    when: String(when || '').trim(),
    latlng,
    kg: String(weight),
    dailyKcal: String(Math.round(weight * 30)),
  };
}

/** Replace {{key}} for preview marks or the text actually sent. Empty slots become 無. */
export function promptParts(template, vars) {
  const src = String(template || '');
  const bag = vars && typeof vars === 'object' ? vars : {};
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const parts = [];
  let last = 0;
  let match = re.exec(src);
  while (match) {
    if (match.index > last) parts.push({ kind: 'text', text: src.slice(last, match.index) });
    const key = match[1];
    const value = bag[key] != null ? String(bag[key]) : '';
    parts.push({
      kind: 'slot',
      key,
      text: value.trim() ? value : '無',
      empty: !value.trim(),
    });
    last = match.index + match[0].length;
    match = re.exec(src);
  }
  if (last < src.length) parts.push({ kind: 'text', text: src.slice(last) });
  return parts;
}

export function fillPromptSlots(template, vars) {
  return promptParts(template, vars)
    .map((part) => part.text)
    .join('');
}

/** 記錄用。記帳收據 prompt 分開，不混在這支。沿用這一頁改過的模板。 */
const PROMPT_MODES = ['expense', 'record', 'both'];

/** A+B。一次回傳記錄 caption 和一筆記賬 suggestion，不用只記賬那份。 */
export const DEFAULT_BOTH_PROMPT_TEMPLATE = [
  '你是記帳兼照片記錄助手。只根據照片，回傳一個 JSON，同時包含記錄和一筆記賬。',
  '記錄：caption 用簡體中文，描述主體和場景，不要用「这是一张照片」開頭。不要猜拍攝時間，不要辨認車牌，不要加車牌 hashtag。',
  '拍攝時間（只有食物才可用來加 hashtag）：{{when}}',
  '目前位置：{{latlng}}',
  '體重 kg：{{kg}}。步行 5km/h 約 3.5 MET，慢跑 8km/h 約 8.3 MET。每分鐘 kcal ≈ MET×3.5×體重÷200。結果取整數。',
  '只有畫面裡真的有食物或飲料才加：🍽️ 热量、🍬 糖分、🚶 步行消耗、🏃 慢跑消耗，以及每日建議攝取約{{dailyKcal}} kcal（體重×30，不是醫囑）。',
  '食物 hashtag 只在有可靠拍攝時間時加：05:00–10:59 #breakfast，11:00–16:59 #lunch，17:00–21:59 #dinner，22:00–04:59 #supper。',
  'topic 只能是 General、Foods、Receipts、Med、Viridien、Car。收據優先 Receipts。食物優先 Foods。不確定用 General。',
  '有經緯度才在 caption 最後加「 - http://maps.google.com/maps?q=lat,lng」。',
  '記賬：目前分類 {{tag}}，目前子分類 {{title}}。允許分類：{{cats}}。允許子分類：{{subcats}}。需要欄位：{{fields}}。{{hints}}',
  'suggestions 只給 1 筆。tag/title 必須在允許清單內；已選的優先沿用。金額用 number。有品項才填 items。',
  '只回這一個 JSON：',
  '{"caption":"","topic":"General","other":"","suggestions":[{"label":"含稅總額","tag":"餐饮美食","title":"午餐","amount":25.5,"currency":"MYR","merchant":"店名","items":[{"name":"Nasi Lemak","unitPrice":8.5,"quantity":2,"amount":17}]}]}',
].join('\n');

/** 一格約 24 份。超過 20 份先提示，還是可以新增。 */
export function promptLibraryWarn(count) {
  const n = Number(count) || 0;
  if (n <= 20) return '';
  return `已有 ${n} 份，試算表一格大約到 24 份`;
}

/** 三份通用。cat／subcat 空白＝不限分類。試算表 AI/Prompts 可整份換掉。 */
export function defaultPromptLibrary(receiptTemplate) {
  const receipt = String(receiptTemplate || '').trim() || DEFAULT_RECEIPT_PROMPT_TEMPLATE;
  return [
    { id: 'expense', label: '只記賬', mode: 'expense', cat: '', subcat: '', template: receipt },
    { id: 'record', label: '只記錄', mode: 'record', cat: '', subcat: '', template: DEFAULT_LIFE_PROMPT_TEMPLATE },
    { id: 'both', label: '記賬＋記錄', mode: 'both', cat: '', subcat: '', template: DEFAULT_BOTH_PROMPT_TEMPLATE },
  ];
}

export function parsePromptLibrary(raw, receiptTemplate) {
  const fallback = defaultPromptLibrary(receiptTemplate);
  try {
    const list = typeof raw === 'string' ? (String(raw).trim() ? JSON.parse(raw) : []) : raw;
    if (!Array.isArray(list) || !list.length) return fallback;
    const out = list
      .map((row, index) => ({
        id: String(row?.id || `p${index}`).trim(),
        label: String(row?.label || row?.id || 'prompt').trim(),
        mode: PROMPT_MODES.includes(row?.mode) ? row.mode : 'expense',
        cat: String(row?.cat || '').trim(),
        subcat: String(row?.subcat || '').trim(),
        template: String(row?.template || ''),
      }))
      .filter((row) => row.id && row.label);
    const receipt = String(receiptTemplate || '').trim() || DEFAULT_RECEIPT_PROMPT_TEMPLATE;
    out.forEach((row) => {
      if (row.id === 'both' && !row.cat && !row.subcat && row.template.trim() === receipt) {
        row.template = DEFAULT_BOTH_PROMPT_TEMPLATE;
      }
    });
    return out.length ? out : fallback;
  } catch {
    return fallback;
  }
}

/** 子分類專用優先，其次分類，最後通用。其他分類的不出現。 */
export function promptsForContext(list, { mode, cat, subcat } = {}) {
  const same = (Array.isArray(list) ? list : []).filter((row) => row.mode === mode);
  const wantCat = String(cat || '').trim();
  const wantSub = String(subcat || '').trim();
  const subHits = wantCat && wantSub ? same.filter((row) => row.cat === wantCat && row.subcat === wantSub) : [];
  const catHits = wantCat ? same.filter((row) => row.cat === wantCat && !row.subcat) : [];
  const general = same.filter((row) => !row.cat && !row.subcat);
  return [...subHits, ...catHits, ...general];
}

export function promptOptionLabel(row) {
  if (!row) return '';
  const where = !row.cat ? '通用' : row.subcat ? `${row.cat}/${row.subcat}` : row.cat;
  return `${row.label} · ${where}`;
}

export function lifePhotoPrompt({ when, lat, lng, kg } = {}, template) {
  const src = String(template || '').trim() || loadLifePromptTemplate();
  return fillPromptSlots(src, lifePromptVars({ when, lat, lng, kg }));
}

export function parseLifePhotoJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI 沒有回 JSON');
  const data = JSON.parse(raw.slice(start, end + 1));
  const topic = TELEGRAM_TOPICS.includes(data.topic) ? data.topic : 'General';
  return {
    caption: String(data.caption || '').trim(),
    topic,
    other: String(data.other || '').trim(),
  };
}

export async function analyzeLifePhoto(photos, prompt) {
  const list = (Array.isArray(photos) ? photos : [photos]).filter((p) => p?.base64).slice(0, 6);
  const photo = list[0];
  if (!photo?.base64) throw new Error('沒有圖片');
  if (!aiKeys.gemini && !aiKeys.openai) {
    const err = new Error('按「讀取設定」才會打 getAiPrompt。這次沒送到模型，Telegram 也不會發');
    err.submitted = false;
    throw err;
  }
  const mimeType = photo.type || 'image/jpeg';
  const images = list.slice(1).map((p) => ({ mimeType: p.type || 'image/jpeg', base64: p.base64 }));
  let text = '';
  let geminiErr = '';
  for (const provider of aiProviderOrder()) {
    if (text) break;
    if (provider === 'gemini' && aiKeys.gemini) {
      try {
        const gemini = await callGeminiBrowser({
          apiKey: aiKeys.gemini,
          models: geminiBrowserModels(aiKeys.geminiModel),
          mimeType,
          base64: photo.base64,
          images,
          prompt,
          schema: false,
          budgetMs: 22000,
        });
        text = gemini.text;
      } catch (err) {
        geminiErr = String(err?.message || err || '');
      }
    }
    if (provider === 'openai' && aiKeys.openai && !text) {
      const openai = await callOpenAiBrowser({
        apiKey: aiKeys.openai,
        model: aiKeys.openaiModel,
        mimeType,
        base64: photo.base64,
        images,
        detail: 'auto',
        prompt,
        timeoutMs: 25000,
      });
      text = openai.text;
    }
  }
  if (!text) throw new Error(geminiErr || '按「讀取設定」才會打 getAiPrompt');
  return parseLifePhotoJson(text);
}

export async function sendTelegramPhotos({ photos, caption, topic, mode }) {
  const data = await postGasJson(
    {
      action: 'sendTelegram',
      photos: (photos || []).map((p) => ({ base64: p.base64, mime: p.type || 'image/jpeg' })),
      caption: caption || '',
      topic: topic || 'General',
      mode: mode || '',
    },
    90000
  );
  if (!data || data.success !== true) throw new Error(data?.error || 'Telegram 發送失敗');
  return data;
}
