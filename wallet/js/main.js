import { Router } from './router.js';
import { auth } from './auth.js';
import { store } from './store.js';
import { remote } from './backend.js';
import { toast } from './dom.js';

import { splashScreen }  from './screens/splash.js';
import { authScreen }    from './screens/auth.js';
import { passcodeScreen } from './screens/passcode.js';
import { homeScreen }    from './screens/home.js';
import { pickScreen }    from './screens/pick.js';
import { confirmScreen } from './screens/confirm.js';
import { doneScreen }    from './screens/done.js';
import { profileScreen } from './screens/profile.js';

const router = new Router(
  document.getElementById('screens'),
  document.getElementById('hero-layer'),
);

/* --- Navigation intents ------------------------------------------------ */

const goHome = (mode = 'fade') => {
  store.use(auth.email || 'guest');
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

const goAuth = () => router.go('auth', {}, { mode: 'fade' });

/** After signing in: set a passcode if there isn't one, otherwise straight in. */
const afterSignIn = () =>
  auth.hasPasscode() ? goHome() : router.go('passcode', { mode: 'set' }, { mode: 'fade' });

router
  .register('splash',  () => splashScreen({ onDone: boot }))

  .register('auth',    () => authScreen({ onDone: afterSignIn }))

  .register('passcode', params => passcodeScreen({
    mode: params.mode,
    onDone: () => (params.returnTo === 'profile' ? router.go('profile', {}, { mode: 'fade' }) : goHome()),
  }))

  .register('home',    () => homeScreen({
    onPickCard: () => router.go('pick', { start: store.card }, { mode: 'hero' }),
    onProfile:  () => router.go('profile', {}, { mode: 'push' }),
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
      store.buyCard(params.tier, params.tier.price);
      goHome();
      toast(`${params.tier.name} card added`);
    },
  }))

  .register('profile', () => profileScreen({
    onBack: () => router.back(),
    onChangePasscode: () =>
      router.go('passcode', { mode: 'set', returnTo: 'profile' }, { mode: 'push' }),
    onSignOut: () => { auth.signOut(); goAuth(); },
  }));

/* --- Boot -------------------------------------------------------------- */

function boot() {
  auth.boot();
  if (!auth.user)                          return goAuth();
  if (auth.isLocked && auth.hasPasscode()) return router.go('passcode', { mode: 'unlock' }, { mode: 'fade' });
  return goHome();
}

/* Re-arm the passcode gate when the app has been in the background a while,
   which is what a native app would do. */
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  const away = Date.now() - hiddenAt;
  if (hiddenAt && away > 60_000 && auth.user && auth.hasPasscode() && !router.busy) {
    auth.lock();
    router.go('passcode', { mode: 'unlock' }, { mode: 'fade' });
  }
});

/* Browser back maps to the in-app back stack. */
history.replaceState({ depth: 1 }, '');
window.addEventListener('popstate', () => {
  if (router.depth > 1) { router.back({ hero: router.current?.name !== 'profile' }); }
  history.pushState({ depth: router.depth }, '');
});

router.go('splash', {}, { mode: 'none' });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ }));
}
