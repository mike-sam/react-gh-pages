/**
 * Register the Cache-First Service Worker (production only).
 */
export function registerSW() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator)) return;

  const swUrl = `${process.env.PUBLIC_URL || ''}/sw.js`;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        console.log('[SW] registered:', reg.scope);
        // Check for updates periodically
        setInterval(() => {
          reg.update().catch(() => {});
        }, 60 * 60 * 1000);
      })
      .catch((err) => {
        console.warn('[SW] registration failed:', err);
      });
  });
}
