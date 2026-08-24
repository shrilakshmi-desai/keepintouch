/**
 * Registers the service worker that makes the app installable.
 *
 * Installability is not cosmetic here: iOS only delivers Web Push to a PWA that
 * has been added to the home screen, so this is a prerequisite for reminders in
 * the browser, not just a nicety.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // Service workers require a secure context. localhost counts as secure, so
  // this still registers during local development.
  if (!window.isSecureContext) return;

  // Registering after load keeps the worker from competing with the app bundle
  // for bandwidth on a first visit.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[pwa] service worker registration failed:', error);
    });
  });
}
