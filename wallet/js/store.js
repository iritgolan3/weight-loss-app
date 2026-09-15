/* Wallet state: balance, transactions and the card the user owns.
   Everything persists to localStorage, namespaced per signed-in account so
   two accounts on the same device never see each other's money. */

const KEY = ns => `dw:wallet:${ns}`;

const SEED = () => ([
  { id: 't1', title: 'Transfer',   time: '4:07pm',  amount: -1050, type: 'transfer' },
  { id: 't2', title: 'Top up',     time: '12:07pm', amount:  2400, type: 'topup'    },
  { id: 't3', title: 'Conversion', time: '4:07pm',  amount:  -950, type: 'convert'  },
  { id: 't4', title: 'Transfer',   time: '4:07pm',  amount: -1050, type: 'transfer' },
  { id: 't5', title: 'Top up',     time: '9:15am',  amount:  1200, type: 'topup'    },
  { id: 't6', title: 'Conversion', time: '2:41pm',  amount:  -470, type: 'convert'  },
]);

const fresh = () => ({ balance: 22000, txns: SEED(), card: 'platinum' });

class Store extends EventTarget {
  #ns = 'guest';
  #s = fresh();

  /** Point the store at an account and load (or seed) its data. */
  use(ns) {
    this.#ns = ns || 'guest';
    try {
      const raw = localStorage.getItem(KEY(this.#ns));
      this.#s = raw ? { ...fresh(), ...JSON.parse(raw) } : fresh();
    } catch {
      this.#s = fresh();
    }
    this.#emit();
  }

  /** Merge a snapshot fetched from the cloud backend. */
  hydrate(snapshot) {
    if (!snapshot) return;
    this.#s = { ...fresh(), ...snapshot };
    this.#save();
    this.#emit();
  }

  get state()   { return this.#s; }
  get balance() { return this.#s.balance; }
  get txns()    { return this.#s.txns; }
  get card()    { return this.#s.card; }

  #save() {
    try { localStorage.setItem(KEY(this.#ns), JSON.stringify(this.#s)); } catch { /* private mode */ }
  }

  #emit() { this.dispatchEvent(new CustomEvent('change')); }

  #commit(txn) {
    this.#s.txns.unshift({ id: `t${Date.now()}`, time: clockLabel(), ...txn });
    this.#s.balance += txn.amount;
    this.#save();
    this.#emit();
  }

  transfer(amount)  { this.#commit({ title: 'Transfer', amount: -Math.abs(amount), type: 'transfer' }); }
  topUp(amount)     { this.#commit({ title: 'Top up',   amount:  Math.abs(amount), type: 'topup'    }); }
  convert(amount)   { this.#commit({ title: 'Conversion', amount: -Math.abs(amount), type: 'convert' }); }

  /** Buying a card charges its annual fee and switches the displayed face. */
  buyCard(tier, fee) {
    this.#s.card = tier.id;
    this.#commit({ title: `${tier.name} card`, amount: -Math.abs(fee), type: 'card' });
  }

  reset() { this.#s = fresh(); this.#save(); this.#emit(); }
}

/** Current wall-clock in the `4:07pm` style the design uses. */
export function clockLabel(d = new Date()) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m}${ap}`;
}

/** `1050` -> `$1,050.00`; `22000` -> `$22,000` when cents are not wanted. */
export function money(n, { cents = true } = {}) {
  const v = Math.abs(n);
  return '$' + v.toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

export const store = new Store();
