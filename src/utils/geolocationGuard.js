/**
 * Geolocation requires a secure context (HTTPS or http://localhost / 127.0.0.1).
 * LAN IPs like http://192.168.x.x:3000 are blocked by Chromium.
 */
export function getGeolocationBlockReason() {
  if (typeof window === 'undefined') return '無法使用定位';
  if (!navigator.geolocation) return '此瀏覽器不支援定位';

  const { protocol, hostname, origin } = window.location;
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]';

  if (protocol === 'https:') return null;
  if (protocol === 'http:' && isLocalhost) return null;

  if (window.isSecureContext === false || !isLocalhost) {
    return (
      `目前來源 ${origin} 無權使用 Geolocation。` +
      `請改用 http://localhost:3000（本機）或部署後的 HTTPS 網址；` +
      `勿用區網 IP（例如 192.168.x.x）。`
    );
  }

  return null;
}
