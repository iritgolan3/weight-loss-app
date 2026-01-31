const CACHE_NAME = 'weight-loss-v1';
const urlsToCache = [
  '/weight-loss-app.html',
  'https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&display=swap'
];

// Install service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Fetch from cache
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Activate and clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/weight-loss-app.html')
  );
});

// Background sync for reminders (if supported)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-reminders') {
    event.waitUntil(checkAndSendReminders());
  }
});

async function checkAndSendReminders() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // Water reminders (8 AM to 8 PM)
  if (hour >= 8 && hour < 20 && minute === 0) {
    self.registration.showNotification('שתי מים! 💧', {
      body: 'זמן לשתות כוס מים!',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">💧</text></svg>',
      vibrate: [200, 100, 200],
      tag: 'water-reminder',
      requireInteraction: false
    });
  }
  
  // Meal reminders
  const mealTimes = [
    { hour: 8, minute: 0, name: 'ארוחת בוקר' },
    { hour: 11, minute: 0, name: 'נשנוש' },
    { hour: 13, minute: 30, name: 'ארוחת צהריים' },
    { hour: 17, minute: 0, name: 'נשנוש' },
    { hour: 20, minute: 0, name: 'ארוחת ערב' }
  ];
  
  mealTimes.forEach(time => {
    if (hour === time.hour && minute === time.minute) {
      self.registration.showNotification('זמן לרשום ארוחה! 🍽️', {
        body: `זמן לרשום את ${time.name}`,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">🍽️</text></svg>',
        vibrate: [200, 100, 200],
        tag: 'meal-reminder',
        requireInteraction: true
      });
    }
  });
  
  // Thursday weigh-in
  if (now.getDay() === 4 && hour === 8 && minute === 0) {
    self.registration.showNotification('זמן שקילה! ⚖️', {
      body: 'יום חמישי - זמן שקילה שבועית!',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">⚖️</text></svg>',
      vibrate: [200, 100, 200],
      tag: 'weigh-in-reminder',
      requireInteraction: true
    });
  }
}
