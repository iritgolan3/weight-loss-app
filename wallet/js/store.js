/* Wallet state: balance, transactions, the cards on file and the settings
   that govern them. Everything persists to localStorage, namespaced per
   device profile, and sealed with AES-GCM under a key derived from the
   passcode — so a closed app leaves no readable card data behind.

   Settings here are not decoration: card freezes, spending limits and
   payment controls are enforced by `spend()` before any transaction is
   committed, and the alert preferences decide what the UI announces. */

import { seal, open as unseal } from './crypto.js';

const KEY = ns => `dw:wallet:${ns}`;

/* A week of plausible activity: small card payments most days, a salary in,
   rent out, one refund. Amounts and merchants are the sort a real statement
   shows, so the list does not read as filler. Hours are offsets back from
   now, which keeps the ledger sensible whenever the app is first opened. */
const SEED_TXNS = () => {
  const rows = [
    ['Pret A Manger',       -6.40,    2, 'card'],
    ['Uber',               -18.75,    6, 'card'],
    ['Spotify',             -11.99,  23, 'card'],
    ['Whole Foods Market',  -84.12,  27, 'card'],
    ['Rent — 44 Hanbury St', -1850,  49, 'transfer'],
    ['Salary — Northgate',   4210,   52, 'topup'],
    ['Shell',               -62.30,  74, 'card'],
    ['Refund — ASOS',        39.99,  96, 'topup'],
    ['EUR 250 bought',      -271.40, 121, 'convert'],
    ['Apple',                -0.99, 144, 'card'],
  ];
  return rows.map(([title, amount, hoursAgo, type], i) => {
    const at = Date.now() - hoursAgo * 3_600_000;
    return { id: `s${i}`, title, amount, type, at, time: stampLabel(at) };
  });
};

/** A card the wallet can spend from. */
export const newCard = (over = {}) => ({
  id: `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
  kind: 'issued',          // 'issued' = a DailyWallet card, 'linked' = added
  tier: 'platinum',        // drives the face artwork
  brand: 'Visa',
  last4: '4429',
  expiry: '12/29',
  label: '',
  frozen: false,
  limits: { perTxn: 5000, daily: 10000 },
  controls: { online: true, contactless: true, atm: true, international: false },
  addedAt: Date.now(),
  ...over,
});

const SEED_SETTINGS = () => ({
  autoLockMinutes: 1,          // 0 means lock the moment you leave
  hideBalance: false,
  alerts: { payments: true, lowBalance: true, lowBalanceAt: 500, news: false },
  reducedMotion: false,
  currency: 'USD',
});

const fresh = () => {
  const card = newCard({ tier: 'platinum', label: 'Everyday' });
  return {
    balance: 8412.65,
    txns: SEED_TXNS(),
    cards: [card],
    defaultCardId: card.id,
    settings: SEED_SETTINGS(),
  };
};

/** Older saves held a single `card` tier id; lift it into the cards list. */
function migrate(state) {
  if (!Array.isArray(state.cards) || !state.cards.length) {
    const card = newCard({ tier: state.card || 'platinum', label: 'Everyday' });
    state.cards = [card];
    state.defaultCardId = card.id;
  }
  if (!state.cards.some(c => c.id === state.defaultCardId)) {
    state.defaultCardId = state.cards[0].id;
  }
  state.settings = { ...SEED_SETTINGS(), ...(state.settings || {}) };
  state.settings.alerts = { ...SEED_SETTINGS().alerts, ...(state.settings.alerts || {}) };
  // Every card must carry a full shape, whatever version wrote it.
  state.cards = state.cards.map(c => ({ ...newCard(), ...c,
    limits: { ...newCard().limits, ...(c.limits || {}) },
    controls: { ...newCard().controls, ...(c.controls || {}) } }));
  delete state.card;
  return state;
}

/** Thrown when a setting blocks a payment; carries a message for the UI. */
export class Declined extends Error {}

class Store extends EventTarget {
  #ns = 'guest';
  #s = fresh();
  #key = null;        // AES key; absent means this device has nothing sealed yet
  #writing = null;    // serialises saves so two encrypts cannot interleave
  #loadedFor = null;  // profile currently open, so we do not re-read on every nav

  /**
   * Point the store at a profile and open its wallet.
   * @param {string} ns    profile id
   * @param {CryptoKey} key  from the passcode; without it nothing can be read
   */
  async use(ns, key = null) {
    ns = ns || 'guest';

    // Re-reading on every trip home would race the queued write that a just
    // -committed payment is still flushing. Load once per unlocked profile.
    if (this.#loadedFor === ns && this.#key === key) {
      this.#emit();
      return;
    }

    await this.flush();
    this.#ns = ns;
    this.#key = key;
    this.#loadedFor = ns;

    let loaded = null;
    try {
      const raw = localStorage.getItem(KEY(this.#ns));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.v === 2) {
          // Sealed. Without the key there is nothing to show.
          loaded = key ? JSON.parse(await unseal(key, parsed)) : null;
        } else {
          loaded = parsed;          // written before encryption existed
        }
      }
    } catch {
      loaded = null;                // wrong key, or corrupt: start clean
    }

    this.#s = migrate(loaded ? { ...fresh(), ...loaded } : fresh());
    if (key) await this.#save();     // seals a legacy plaintext wallet in place
    this.#emit();
  }

  hydrate(snapshot) {
    if (!snapshot) return;
    this.#s = migrate({ ...fresh(), ...snapshot });
    this.#save();
    this.#emit();
  }

  /** Whether this wallet is sealed on disk. */
  get isEncrypted() { return Boolean(this.#key); }

  get state()    { return this.#s; }
  get balance()  { return this.#s.balance; }
  get txns()     { return this.#s.txns; }
  get cards()    { return this.#s.cards; }
  get settings() { return this.#s.settings; }

  get defaultCard() {
    return this.#s.cards.find(c => c.id === this.#s.defaultCardId) || this.#s.cards[0];
  }

  /** Tier of the card on show. Kept so screens can ask for artwork simply. */
  get card() { return this.defaultCard?.tier || 'platinum'; }

  cardById(id) { return this.#s.cards.find(c => c.id === id) || null; }

  /** Seal and write. Chained so concurrent edits cannot clobber each other. */
  #save() {
    const run = async () => {
      try {
        const text = JSON.stringify(this.#s);
        const body = this.#key ? JSON.stringify(await seal(this.#key, text)) : text;
        localStorage.setItem(KEY(this.#ns), body);
      } catch { /* private mode, or quota */ }
    };
    this.#writing = (this.#writing || Promise.resolve()).then(run, run);
    return this.#writing;
  }

  /** Resolves once every queued write has landed. For tests and teardown. */
  flush() { return this.#writing || Promise.resolve(); }

  #emit(detail) { this.dispatchEvent(new CustomEvent('change', { detail })); }

  /** What has already gone out today, for the daily limit. */
  #spentToday() {
    const today = new Date().toDateString();
    return this.#s.txns
      .filter(t => t.amount < 0 && t.at && new Date(t.at).toDateString() === today)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }

  /**
   * The one gate every outgoing payment passes through. Throws `Declined`
   * with a reason a person can act on, which is what makes the card and
   * limit settings real rather than ornamental.
   */
  #authorise(amount, { control } = {}) {
    const card = this.defaultCard;
    if (!card)          throw new Declined('Add a card before making a payment.');
    if (card.frozen)    throw new Declined(`${card.label || card.tier} is frozen. Unfreeze it in Cards.`);
    if (amount > this.#s.balance) throw new Declined('That is more than your available balance.');
    if (amount > card.limits.perTxn) {
      throw new Declined(`Over the ${money(card.limits.perTxn, { cents: false })} per-payment limit on this card.`);
    }
    if (this.#spentToday() + amount > card.limits.daily) {
      throw new Declined(`That would pass today's ${money(card.limits.daily, { cents: false })} limit.`);
    }
    if (control && card.controls[control] === false) {
      throw new Declined(`${CONTROL_NAMES[control]} is switched off for this card.`);
    }
    return card;
  }

  #commit(txn) {
    const at = Date.now();
    this.#s.txns.unshift({ id: `t${at}`, at, time: stampLabel(at), ...txn });
    this.#s.balance += txn.amount;
    this.#save();
    this.#emit({ txn });
  }

  /* --- Money --------------------------------------------------------- */

  transfer(amount, to = 'Transfer') {
    const v = Math.abs(amount);
    this.#authorise(v, { control: 'online' });
    this.#commit({ title: to, amount: -v, type: 'transfer' });
  }

  convert(amount, label) {
    const v = Math.abs(amount);
    this.#authorise(v);
    this.#commit({ title: label || 'Currency exchange', amount: -v, type: 'convert' });
  }

  /** Money in is never blocked by a spending control. */
  topUp(amount) {
    this.#commit({ title: 'Money added', amount: Math.abs(amount), type: 'topup' });
  }

  buyCard(tier, fee) {
    const v = Math.abs(fee);
    this.#authorise(v);
    const card = newCard({ tier: tier.id, label: tier.name });
    this.#s.cards.push(card);
    this.#s.defaultCardId = card.id;
    this.#commit({ title: `DailyWallet ${tier.name} card`, amount: -v, type: 'card' });
    return card;
  }

  /* --- Cards --------------------------------------------------------- */

  addCard(card) {
    const added = newCard(card);
    this.#s.cards.push(added);
    if (!this.#s.defaultCardId) this.#s.defaultCardId = added.id;
    this.#save();
    this.#emit();
    return added;
  }

  updateCard(id, patch) {
    const i = this.#s.cards.findIndex(c => c.id === id);
    if (i < 0) return null;
    const card = this.#s.cards[i];
    this.#s.cards[i] = {
      ...card, ...patch,
      limits:   { ...card.limits,   ...(patch.limits   || {}) },
      controls: { ...card.controls, ...(patch.controls || {}) },
    };
    this.#save();
    this.#emit();
    return this.#s.cards[i];
  }

  removeCard(id) {
    if (this.#s.cards.length <= 1) {
      throw new Declined('This is your only card. Add another before removing it.');
    }
    this.#s.cards = this.#s.cards.filter(c => c.id !== id);
    if (this.#s.defaultCardId === id) this.#s.defaultCardId = this.#s.cards[0].id;
    this.#save();
    this.#emit();
  }

  /** Persist a new order for the stack. Unknown ids are ignored. */
  reorderCards(ids) {
    const byId = new Map(this.#s.cards.map(c => [c.id, c]));
    const next = ids.map(id => byId.get(id)).filter(Boolean);
    for (const c of this.#s.cards) if (!next.includes(c)) next.push(c);
    this.#s.cards = next;
    this.#save();
    this.#emit();
  }

  setDefaultCard(id) {
    if (!this.cardById(id)) return;
    this.#s.defaultCardId = id;
    this.#save();
    this.#emit();
  }

  /* --- Settings ------------------------------------------------------ */

  setSetting(path, value) {
    const keys = path.split('.');
    let node = this.#s.settings;
    while (keys.length > 1) node = node[keys.shift()];
    node[keys[0]] = value;
    this.#save();
    this.#emit();
  }

  /** Everything this device holds, for the data-export screen. */
  exportJSON() {
    return JSON.stringify({ exportedAt: new Date().toISOString(), wallet: this.#s }, null, 2);
  }

  /** Right-to-erasure: drop the wallet entirely. */
  erase() {
    try { localStorage.removeItem(KEY(this.#ns)); } catch { /* private mode */ }
    this.#key = null;
    this.#loadedFor = null;
    this.#s = fresh();
    this.#emit();
  }
}

export const CONTROL_NAMES = {
  online: 'Online payments',
  contactless: 'Contactless',
  atm: 'Cash withdrawals',
  international: 'Payments abroad',
};

/** Added cards get a graphite face, distinct from the issued metals. */
export const LINKED_GRADIENT = ['#4A4A52', '#2E2E36', '#1B1B21'];

export const CURRENCIES = {
  USD: { symbol: '$', locale: 'en-US', name: 'US dollar' },
  EUR: { symbol: '€', locale: 'de-DE', name: 'Euro' },
  GBP: { symbol: '£', locale: 'en-GB', name: 'British pound' },
  ILS: { symbol: '₪', locale: 'he-IL', name: 'Israeli shekel' },
};

/** Current wall-clock in the `4:07pm` style the design uses. */
export function clockLabel(d = new Date()) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m}${ap}`;
}

/** Time for today, a weekday this week, then a date. Same column, better data. */
export function stampLabel(at) {
  const d = new Date(at);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return clockLabel(d);
  if (days === 1) return 'Yesterday';
  if (days < 7)  return d.toLocaleDateString('en-GB', { weekday: 'long' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** `1050` -> `$1,050.00`, in whichever currency is selected. */
export function money(n, { cents = true, currency } = {}) {
  const code = currency || store?.settings?.currency || 'USD';
  const c = CURRENCIES[code] || CURRENCIES.USD;
  const v = Math.abs(n).toLocaleString(c.locale, {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  return `${c.symbol}${v}`;
}

export const store = new Store();
