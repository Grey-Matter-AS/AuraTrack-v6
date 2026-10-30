// Loaded into the generated service worker (vite.config.js → workbox.importScripts).
// Tapping a reminder opens AuraTrack (or brings it to the front) on the home screen, where today's
// doses and the wellbeing check-in are.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.target || 'home';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        client.postMessage({ type: 'auratrack-notification-open', target });
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(self.registration.scope);
  })());
});
