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

/** iOS Shortcuts text input: same fields as the GAS calendar URL. */
export function stringifyCalendarTrackInput(payload) {
  return JSON.stringify({
    action: 'trackCalendar',
    op: payload.op,
    title: payload.title || '',
    prefix: payload.prefix || '',
    timestamp: payload.timestamp,
    latitude: payload.latitude ?? payload.lat ?? null,
    longitude: payload.longitude ?? payload.lng ?? null,
    endExisting: payload.endExisting,
    startHome: payload.startHome,
    all: payload.all,
  });
}
