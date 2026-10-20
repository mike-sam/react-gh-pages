/**
 * Register Service Worker (production only).
 * On update found → activate ASAP and reload once so Safari leaves stale shells.
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

        // If a waiting worker is already there (previous visit), activate it
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state !== 'installed') return;
            if (navigator.serviceWorker.controller) {
              // New content available — reload once to pick up network-first HTML
              window.location.reload();
            }
          });
        });

        setInterval(() => {
          reg.update().catch(() => {});
        }, 15 * 60 * 1000);
      })
      .catch((err) => {
        console.warn('[SW] registration failed:', err);
      });

    // When the controlling SW changes after skipWaiting/claim, reload once
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
