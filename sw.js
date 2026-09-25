/* This site used to be a different app, which installed a service worker at
   this address. When a phone that ran it checks for an update, it fetches this
   file instead: it takes over, removes itself, and reloads the open tabs so
   they come straight from the network. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: 'window' }); })
      .then(function (tabs) { tabs.forEach(function (t) { t.navigate(t.url); }); })
  );
});
