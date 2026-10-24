import imageCompression from 'browser-image-compression';

export const RECEIPT_PREFS_KEY = 'receiptPhotoPrefs';
export const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 };

export const RECEIPT_SOURCE_OPTS = {
  maxSizeMB: 2.4,
  maxWidthOrHeight: 2400,
  initialQuality: 0.9,
  fileType: 'image/jpeg',
  useWebWorker: true,
};

export const RECEIPT_PRESETS = [
  { id: 'sharp', label: '清晰', quality: 0.86, maxEdge: 1920, maxBytes: 480 * 1024 },
  { id: 'balanced', label: '適中', quality: 0.78, maxEdge: 1600, maxBytes: 320 * 1024 },
  { id: 'small', label: '較小', quality: 0.66, maxEdge: 1100, maxBytes: 160 * 1024 },
];

export const DEFAULT_RECEIPT_PREFS = {
  preset: 'balanced',
  quality: 0.78,
  maxEdge: 1600,
  maxBytes: 320 * 1024,
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function normalizeCrop(crop) {
  let w = clamp(Number(crop?.w), 0.08, 1);
  let h = clamp(Number(crop?.h), 0.08, 1);
  if (!Number.isFinite(w)) w = 1;
  if (!Number.isFinite(h)) h = 1;
  const x = clamp(Number(crop?.x) || 0, 0, 1 - w);
  const y = clamp(Number(crop?.y) || 0, 0, 1 - h);
  return { x, y, w, h };
}

export function isFullCrop(crop) {
  const c = normalizeCrop(crop);
  return c.x <= 0.002 && c.y <= 0.002 && c.w >= 0.996 && c.h >= 0.996;
}

export function loadReceiptPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECEIPT_PREFS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_RECEIPT_PREFS };
    const preset = RECEIPT_PRESETS.find((p) => p.id === raw.preset);
    return {
      preset: preset?.id || 'custom',
      quality: clamp(Number(raw.quality) || DEFAULT_RECEIPT_PREFS.quality, 0.45, 0.92),
      maxEdge: clamp(Number(raw.maxEdge) || DEFAULT_RECEIPT_PREFS.maxEdge, 800, 2400),
      maxBytes: clamp(Number(raw.maxBytes) || DEFAULT_RECEIPT_PREFS.maxBytes, 80 * 1024, 800 * 1024),
    };
  } catch {
    return { ...DEFAULT_RECEIPT_PREFS };
  }
}

export function saveReceiptPrefs(prefs) {
  const next = {
    preset: prefs?.preset || 'custom',
    quality: clamp(Number(prefs?.quality) || DEFAULT_RECEIPT_PREFS.quality, 0.45, 0.92),
    maxEdge: clamp(Number(prefs?.maxEdge) || DEFAULT_RECEIPT_PREFS.maxEdge, 800, 2400),
    maxBytes: clamp(Number(prefs?.maxBytes) || DEFAULT_RECEIPT_PREFS.maxBytes, 80 * 1024, 800 * 1024),
  };
  try {
    localStorage.setItem(RECEIPT_PREFS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function prefsFromPreset(id) {
  const preset = RECEIPT_PRESETS.find((p) => p.id === id) || RECEIPT_PRESETS[1];
  return {
    preset: preset.id,
    quality: preset.quality,
    maxEdge: preset.maxEdge,
    maxBytes: preset.maxBytes,
  };
}

export function matchReceiptPreset(prefs) {
  const hit = RECEIPT_PRESETS.find(
    (p) =>
      Math.abs(p.quality - Number(prefs?.quality)) < 0.02 &&
      Math.abs(p.maxEdge - Number(prefs?.maxEdge)) < 8
  );
  return hit?.id || 'custom';
}

export function formatReceiptSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatReceiptSizePair(compressed, original) {
  const out = formatReceiptSize(compressed);
  const src = Number(original) || 0;
  if (!src) return out;
  return `${out} · 原圖 ${formatReceiptSize(src)}`;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function splitDataUrl(dataUrl) {
  const raw = String(dataUrl || '');
  const i = raw.indexOf(',');
  if (i === -1) return { preview: `data:image/jpeg;base64,${raw}`, base64: raw };
  return { preview: raw, base64: raw.slice(i + 1) };
}

async function compressOnce(file, opts) {
  try {
    return await imageCompression(file, opts);
  } catch {
    return await imageCompression(file, { ...opts, useWebWorker: false });
  }
}

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('無法讀取圖片'));
    img.src = src;
  });
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    const done = (blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const { base64 } = splitDataUrl(dataUrl);
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        resolve(new Blob([bytes], { type: 'image/jpeg' }));
      } catch (err) {
        reject(err);
      }
    };
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(done, 'image/jpeg', quality);
    } else {
      done(null);
    }
  });
}

async function blobToPhoto(blob, meta) {
  const dataUrl = await fileToDataUrl(blob);
  const { preview, base64 } = splitDataUrl(dataUrl);
  return {
    preview,
    base64,
    filename: meta.filename,
    originalSize: meta.originalSize,
    sourceSize: meta.sourceSize,
    compressedSize: blob.size,
    type: 'image/jpeg',
    sourcePreview: meta.sourcePreview,
    prefs: {
      preset: meta.preset,
      quality: meta.quality,
      maxEdge: meta.maxEdge,
      maxBytes: meta.maxBytes,
      crop: normalizeCrop(meta.crop),
    },
  };
}

export async function prepareReceiptSource(file) {
  if (!file) return null;
  let out = file;
  try {
    out = await compressOnce(file, RECEIPT_SOURCE_OPTS);
  } catch {
    out = file;
  }
  const dataUrl = await fileToDataUrl(out);
  const { preview } = splitDataUrl(dataUrl);
  return {
    sourcePreview: preview,
    filename: (file.name || `photo_${Date.now()}`).replace(/\.[^.]+$/, '') + '.jpg',
    originalSize: file.size,
    sourceSize: out.size || file.size,
  };
}

export async function renderReceiptPhoto({
  sourcePreview,
  filename = `photo_${Date.now()}.jpg`,
  originalSize = 0,
  sourceSize = 0,
  crop = FULL_CROP,
  quality = DEFAULT_RECEIPT_PREFS.quality,
  maxEdge = DEFAULT_RECEIPT_PREFS.maxEdge,
  maxBytes = DEFAULT_RECEIPT_PREFS.maxBytes,
  preset = 'custom',
} = {}) {
  if (!sourcePreview) throw new Error('沒有原圖');
  const img = await loadHtmlImage(sourcePreview);
  const box = normalizeCrop(crop);
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  const sx = Math.round(box.x * nw);
  const sy = Math.round(box.y * nh);
  const sw = Math.max(1, Math.round(box.w * nw));
  const sh = Math.max(1, Math.round(box.h * nh));
  const edge = Math.max(sw, sh);
  const cap = clamp(Number(maxEdge) || DEFAULT_RECEIPT_PREFS.maxEdge, 640, 2400);
  const scale = edge > cap ? cap / edge : 1;
  const tw = Math.max(1, Math.round(sw * scale));
  const th = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);

  let q = clamp(Number(quality) || DEFAULT_RECEIPT_PREFS.quality, 0.45, 0.92);
  const budget = clamp(Number(maxBytes) || DEFAULT_RECEIPT_PREFS.maxBytes, 80 * 1024, 900 * 1024);
  let blob = await canvasToJpegBlob(canvas, q);
  while (blob.size > budget && q > 0.5) {
    q = Math.max(0.5, q - 0.07);
    blob = await canvasToJpegBlob(canvas, q);
  }
  return blobToPhoto(blob, {
    filename,
    originalSize,
    sourceSize: sourceSize || originalSize,
    sourcePreview,
    preset,
    quality,
    maxEdge: cap,
    maxBytes: budget,
    crop: box,
  });
}

export async function compressReceiptFile(file, prefs) {
  const source = await prepareReceiptSource(file);
  const next = { ...DEFAULT_RECEIPT_PREFS, ...loadReceiptPrefs(), ...(prefs || {}) };
  return renderReceiptPhoto({
    ...source,
    quality: next.quality,
    maxEdge: next.maxEdge,
    maxBytes: next.maxBytes,
    preset: next.preset,
    crop: FULL_CROP,
  });
}
