import { Router } from './router.js';
import { auth } from './auth.js';
import { store, Declined } from './store.js';
import { remote } from './backend.js';
import { toast } from './dom.js';

import { splashScreen }  from './screens/splash.js';
import { authScreen }    from './screens/auth.js';
import { passcodeScreen } from './screens/passcode.js';
import { homeScreen }    from './screens/home.js';
import { pickScreen }    from './screens/pick.js';
import { confirmScreen } from './screens/confirm.js';
import { doneScreen }    from './screens/done.js';
import { settingsScreen, applyReducedMotion } from './screens/settings.js';
import { cardsScreen }      from './screens/cards.js';
import { addCardScreen }    from './screens/addcard.js';
import { cardDetailScreen } from './screens/carddetail.js';

const router = new Router(
  document.getElementById('screens'),
  document.getElementById('hero-layer'),
);

/* --- Navigation intents ------------------------------------------------ */

const goHome = async (mode = 'fade') => {
  // Namespaced by the device profile, so attaching an email later never
  // looks like the wallet reset itself. The key comes from the passcode, so
  // this only ever runs after the lock screen.
  await store.use(auth.profileId, auth.dataKey);
  applyReducedMotion(store.settings.reducedMotion);
  syncDown();                       // no-op unless a backend is configured
  return router.go('home', {}, { mode });
};

/* --- Optional cloud sync ------------------------------------------------
   The app is fully usable without a backend; when one is configured these
   two hooks pull the wallet on sign-in and push it after every change. */

async function syncDown() {
  const s = auth.session;
  if (!remote.enabled || !s?.token || !s.userId) return;
  try {
    store.hydrate(await remote.loadWallet(s.token, s.userId));
  } catch {
    toast('Could not reach your account — showing the copy on this device.');
  }
}

let pushTimer;
store.addEventListener('change', () => {
  const s = auth.session;
  if (!remote.enabled || !s?.token || !s.userId) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    remote.saveWallet(s.token, s.userId, store.state).catch(() => { /* retried on next change */ });
  }, 800);
});

const goPasscode = (mode, extra = {}) =>
  router.go('passcode', { mode, ...extra }, { mode: 'fade' });

router
  .register('splash',  () => splashScreen({ onDone: boot }))

  // Reached only from Profile, and only when a cloud backend is configured.
  .register('auth',    () => authScreen({
    onDone: () => router.go('profile', {}, { mode: 'fade' }),
    onCancel: () => router.back(),
  }))

  .register('passcode', params => passcodeScreen({
    mode: params.mode,
    onDone: () => (params.returnTo
      ? router.go(params.returnTo, {}, { mode: 'fade' })
      : goHome()),
  }))

  .register('home',    () => homeScreen({
    onPickCard: () => router.go('pick', { start: store.card }, { mode: 'hero' }),
    onProfile:  () => router.go('settings', {}, { mode: 'push' }),
  }))

  .register('pick',    params => pickScreen({
    start: params.start,
    onBack:   () => router.back({ hero: true }),
    onChoose: tier => router.go('confirm', { tier }, { mode: 'hero' }),
  }))

  .register('confirm', params => confirmScreen({
    tier: params.tier,
    onBack: () => router.back({ hero: true }),
    onPaid: tier => router.go('done', { tier }, { mode: 'fade' }),
  }))

  .register('done',    params => doneScreen({
    tier: params.tier,
    onDone: () => {
      try {
        store.buyCard(params.tier, params.tier.price);
        goHome();
        if (store.settings.alerts.payments) toast(`${params.tier.name} card added`);
      } catch (err) {
        goHome();
        toast(err instanceof Declined ? err.message : 'That order could not be completed.');
      }
    },
  }))

  .register('settings', () => settingsScreen({
    onBack: () => router.back(),
    onChangePasscode: () =>
      router.go('passcode', { mode: 'set', returnTo: 'settings' }, { mode: 'push' }),
    onCards: () => router.go('cards', {}, { mode: 'push' }),
    onSync: () => router.go('auth', {}, { mode: 'push' }),
    onStopSync: () => { auth.stopSync(); router.go('settings', {}, { mode: 'fade' }); },
    onLock: () => { auth.lock(); goPasscode('unlock'); },
    // Erasing removes the passcode too, so the app starts over from setup.
    onErased: () => { toast('Everything on this device was erased'); boot(); },
  }))

  .register('cards',   () => cardsScreen({
    onBack: () => router.back(),
    onAdd:  () => router.go('addcard', {}, { mode: 'push' }),
    onCard: id => {
      // Mark the tapped face so the flight picks up that card, not the stack.
      router.current?.markHero?.(id);
      router.go('carddetail', { cardId: id }, { mode: 'hero' });
    },
  }))

  .register('addcard', () => addCardScreen({
    onBack:  () => router.back(),
    onAdded: () => router.back(),
    onOrder: () => router.go('pick', { start: store.card }, { mode: 'push' }),
  }))

  .register('carddetail', params => cardDetailScreen({
    cardId: params.cardId,
    onBack: () => router.back({ hero: true }),
  }));

/* --- Boot -------------------------------------------------------------- */

/* First run sets a passcode, every later open unlocks with it. Nothing else
   stands between opening the app and using it. */
function boot() {
  auth.boot();
  if (!auth.hasPasscode) return goPasscode('set');
  if (auth.isLocked)     return goPasscode('unlock');
  return goHome();
}

/* Re-arm the passcode gate when the app has been in the background a while,
   which is what a native app would do. */
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  const away = Date.now() - hiddenAt;
  const after = (store.settings?.autoLockMinutes ?? 1) * 60_000;
  if (hiddenAt && away >= after && auth.hasPasscode && !auth.isLocked && !router.busy) {
    auth.lock();
    goPasscode('unlock');
  }
});

/* Browser back maps to the in-app back stack. */
history.replaceState({ depth: 1 }, '');
window.addEventListener('popstate', () => {
  if (router.depth > 1) {
    const flying = ['pick', 'confirm', 'carddetail'];
    router.back({ hero: flying.includes(router.current?.name) });
  }
  history.pushState({ depth: router.depth }, '');
});

router.go('splash', {}, { mode: 'none' });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ }));
}
