/**
 * Detect iOS / iPadOS (including iPad desktop-class UA).
 */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ may report as MacIntel with touch
  if (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) {
    return true;
  }
  return false;
}

/**
 * Build shortcuts:// deep link.
 * @param {string} name Shortcut name as shown in the Shortcuts app
 * @param {string} text Plain-text input for the shortcut
 */
export function buildShortcutUrl(name, text) {
  return (
    'shortcuts://run-shortcut?name=' +
    encodeURIComponent(name) +
    '&input=text&text=' +
    encodeURIComponent(text)
  );
}

export function openShortcut(name, text) {
  const url = buildShortcutUrl(name, text);
  window.location.href = url;
  return url;
}

export async function copyText(text) {
  const value = String(text || '');
  const tryExec = () => {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.cssText =
      'position:fixed;top:0;left:0;width:2px;height:2px;padding:0;border:none;outline:none;background:transparent;opacity:0.01;z-index:99999';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  };
  if (tryExec()) return true;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** iOS: run-shortcut whatsapp.recordCar. Android: whatsapp://. Desktop: wa.me. */
export function openWhatsAppShare(text, shortcutName) {
  const body = String(text || '');
  if (isIOS()) {
    const name = shortcutName || 'whatsapp.recordCar';
    return openShortcut(name, body);
  }
  const encoded = encodeURIComponent(body);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const web = `https://wa.me/?text=${encoded}`;
  if (/Android/i.test(ua)) {
    const started = Date.now();
    window.location.href = `whatsapp://send?text=${encoded}`;
    window.setTimeout(() => {
      if (document.visibilityState === 'visible' && Date.now() - started >= 400) {
        window.location.href = web;
      }
    }, 1400);
    return;
  }
  window.open(web, '_blank', 'noopener,noreferrer');
}

/** iOS Shortcuts text input: same fields as the GAS calendar URL. */
export function stringifyCalendarTrackInput(payload) {
  return JSON.stringify({
    action: 'trackCalendar',
    op: payload.op,
    title: payload.title || payload.event || '',
    event: payload.event || payload.title || '',
    prefix: payload.prefix || '',
    timestamp: payload.timestamp,
    timestampMs: payload.timestampMs,
    latitude: payload.latitude ?? payload.lat ?? null,
    longitude: payload.longitude ?? payload.lng ?? null,
    placeName: payload.placeName || '',
    days: payload.days,
  });
}
