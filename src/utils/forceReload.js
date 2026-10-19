/**
 * Clear Cache Storage + unregister Service Workers, then hard-reload with timestamp.
 */
export async function forceReload() {
  try {
    if (typeof caches !== 'undefined' && caches?.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    console.warn('Failed to clear caches:', err);
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    }
  } catch (err) {
    console.warn('Failed to unregister service workers:', err);
  }

  const path = window.location.pathname || '/';
  window.location.href = `${path}?ts=${Date.now()}`;
}
