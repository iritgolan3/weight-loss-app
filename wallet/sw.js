/* Offline shell. Bump CACHE whenever the asset list below changes. */

const CACHE = 'dailywallet-v6';

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/fonts.css',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/screens.css',
  './js/main.js',
  './js/router.js',
  './js/hero.js',
  './js/store.js',
  './js/auth.js',
  './js/backend.js',
  './js/config.js',
  './js/dom.js',
  './js/icons.js',
  './js/ui/card.js',
  './js/ui/controls.js',
  './js/ui/sheet.js',
  './js/ui/terminal.js',
  './js/screens/splash.js',
  './js/screens/auth.js',
  './js/screens/passcode.js',
  './js/screens/home.js',
  './js/screens/pick.js',
  './js/screens/confirm.js',
  './js/screens/done.js',
  './js/screens/settings.js',
  './js/screens/cards.js',
  './js/screens/addcard.js',
  './js/screens/carddetail.js',
  './assets/fonts/poppins-400.woff2',
  './assets/fonts/poppins-500.woff2',
  './assets/fonts/poppins-600.woff2',
  './assets/fonts/poppins-700.woff2',
  './assets/fonts/poppins-700-italic.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== location.origin) return;

  // Fonts are immutable: serve from cache first.
  if (url.pathname.endsWith('.woff2')) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
    return;
  }

  // App shell: network-first so a deploy is picked up, cache as the fallback.
  event.respondWith(
    fetch(request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html'))),
  );
});
