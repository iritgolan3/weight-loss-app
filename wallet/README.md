# DailyWallet

A banking wallet app recreated from a design reference: balance and
transactions, a metal card picker, a card-order checkout, and an animated
order-confirmation screen — behind a passcode and biometric lock. No email,
no sign-up: the passcode is the credential.

Built as a plain web app (no framework, no build step) that installs to a
phone home screen as a PWA. A Flutter port of the same app lives in
[`../flutter_app`](../flutter_app).

## Running it

Any static server works; ES modules and WebCrypto both need a real origin,
so opening `index.html` from the filesystem will not work.

```sh
cd wallet
python3 -m http.server 8099
# then open http://127.0.0.1:8099
```

`localhost` counts as a secure context, so password hashing and biometrics
work in development exactly as they do in production.

### Deploying

The folder is entirely static. Pushing it to a branch GitHub Pages serves
is enough — no build, no environment variables. Every path is relative, so
it works from a subdirectory such as `/wallet/` as happily as from a
domain root.

## The screens

| Screen | What it does |
| --- | --- |
| **Splash** | Brand mark, then routes to passcode setup, the lock screen, or home |
| **Passcode** | Six-digit entry, spring-filling dots, shake on a wrong code, biometric key |
| **Home** | Greeting, balance, card, recent transactions, floating nav pill |
| **Card picker** | Snapping carousel of turned cards — Platinum $199, Silver $99, Gold $349 |
| **Confirm order** | Order summary; the pay button morphs into a spinner |
| **Order placed** | Animated card terminal, receipt and tick, then back to home |
| **Profile** | Device, biometric enrolment, change passcode, lock now |
| **Sync** | Optional email sign-in, shown only when a backend is configured |

## Sizing

Every length is authored in `rem` against a **440 x 956pt reference phone**,
and `html`'s font size scales with viewport width
(`clamp(0.8125rem, 3.6364vw, 1.0625rem)`). A 375pt iPhone SE therefore gets
the same design at 85%, rather than 440pt-sized type crammed onto a smaller
screen. On desktop the shell is pinned to the reference width, so the scale
is exactly 1.

Width scaling alone is not enough, because a short phone is not just a
narrow one — an SE is 1.78:1 against the reference's 2.17:1. Two things
absorb that:

- the card picker sizes its card to the carousel's own height
  (`min(28rem, 90cqh)`) rather than to a fixed breakpoint, so it is as large
  as will fit;
- the order-placed illustration is `flex: 1` with a max height, so it yields
  space instead of pushing the Done button off the bottom;
- under `max-height: 740px` the home screen tightens its vertical rhythm to
  hand those pixels back to the transaction list.

## The animations

The card is a single element that travels between screens rather than two
elements cross-fading. `js/hero.js` measures its box in the outgoing and
incoming screens, flies a clone between them, and interpolates the quarter
turn along the way — which is what makes the home → picker move read as a
physical card being turned. `js/router.js` cross-fades the dark and light
backdrops underneath it.

Home opens with a cascade: greeting, balance, card, then the sheet rising,
the rows dealing in behind it, and the nav pill springing up last. The
balance counts to its new value rather than snapping whenever money moves.

Everything else is built from the same handful of primitives: staggered
entrances (`stagger()`), the pay button's width morph into a dot spinner,
the carousel's scroll-driven falloff — neighbours shrink, sink and dim so
the stack reads with depth — and the terminal's scripted sequence in
`js/ui/terminal.js`: body settles, card slides into the slot, receipt
prints, tick strokes itself on.

One trap worth knowing about: a CSS animation with `both` fill pins the
properties it touches, beating later declarations. The home entrance
therefore clears its own class before any navigation, or the hero exit
cross-fade would have nothing to fade.

All motion is Web Animations or CSS transitions, and all of it collapses to
near-zero duration under `prefers-reduced-motion`.

## How the money works

The wallet is **simulated**. Balance, transactions, transfers, top-ups,
conversions and card purchases are all real application state — they
persist, they add up, the card fee is genuinely deducted — but no real
money moves and no payment network is involved. Nothing here takes card
numbers or payment credentials.

State is namespaced per account, so two accounts on one device never see
each other's data.

## How getting in works

A device profile is created on first run, the app asks for a six-digit
passcode, and that is the whole sign-up. There is no email field anywhere in
the entry path.

The passcode is never stored. It gets a random 16-byte salt and a
PBKDF2-SHA256 derivation at 210,000 iterations (`js/auth.js`), and unlocking
compares derivations rather than secrets, in constant time.

### Face and fingerprint

Biometric unlock is WebAuthn with `authenticatorAttachment: 'platform'` and
`userVerification: 'required'`. That asks the device for **its own** sensor,
which is Face ID or Touch ID on an iPhone, Touch ID on a Mac, Windows Hello,
or a fingerprint or face on Android. There is no web API to request one
modality over the other — the platform picks the sensor it has, and Android's
prompt lets the user switch between enrolled ones. The app therefore names
both, and shows a face mark on iOS and a fingerprint elsewhere. The
credential never leaves the device and is used only as proof of presence.

Two rules govern the implementation, and breaking either is what makes
biometrics "not work" on a phone:

1. **Both calls need live user activation.** Safari on iOS rejects WebAuthn
   without it, and activation does not survive a `setTimeout` or a slow
   `await`. So nothing is ever fired on screen entry: unlocking needs a tap
   on the prompt or the keypad key, and enrolling needs a tap in Profile.
2. **The relying-party ID must be a real domain.** `localhost` works for
   development and any HTTPS host works in production, but a bare IP such as
   `127.0.0.1` is rejected outright — serve the dev server on `localhost`.

Failures are translated from the DOMException name into something actionable
rather than swallowed, and a failed or dismissed scan always leaves the
passcode working.

The lock re-arms on reload and after the app has been backgrounded for a
minute. Profile also offers **Lock now**.

### Turning on cloud accounts

Out of the box everything is on-device. To make one account work across
devices, create a free Supabase project and fill in `js/config.js`:

```js
export const config = {
  supabase: {
    url: 'https://xxxxxxxxxxxx.supabase.co',
    anonKey: 'your-anon-key',
  },
};
```

The anon key is publishable and safe in client code **provided row-level
security is on**. Create the wallet table and its policies:

```sql
create table public.wallets (
  user_id    uuid primary key references auth.users on delete cascade,
  balance    numeric      not null default 22000,
  txns       jsonb        not null default '[]'::jsonb,
  card       text         not null default 'platinum',
  updated_at timestamptz  not null default now()
);

alter table public.wallets enable row level security;

create policy "own wallet: read"   on public.wallets
  for select using (auth.uid() = user_id);
create policy "own wallet: write"  on public.wallets
  for insert with check (auth.uid() = user_id);
create policy "own wallet: update" on public.wallets
  for update using (auth.uid() = user_id);
```

Profile then grows a **Sync across devices** row — the only place an email is
ever asked for, and only because a cloud account needs one. The wallet is
pulled on sign-in and pushed (debounced) after every change. Passcode entry
is unaffected: it stays a device lock, hashed on the device, never uploaded.
Never put a service-role key in `config.js`.

With `config.js` left blank, that row does not appear and the app never
mentions email at all.

## Layout

```
wallet/
  index.html          app shell
  manifest.json       PWA manifest
  sw.js               offline cache
  css/
    fonts.css         self-hosted Poppins (latin subset, 48 KB)
    tokens.css        colours, geometry, motion curves
    base.css          reset, device frame, screen stack
    components.css    card, buttons, rows, nav pill, keypad, sheet
    screens.css       per-screen layout
  js/
    main.js           routes and wiring
    router.js         screen stack and transitions
    hero.js           shared-element card flight
    store.js          wallet state and persistence
    auth.js           accounts, passcode, WebAuthn
    backend.js        optional Supabase adapter
    config.js         backend credentials (blank by default)
    dom.js  icons.js
    ui/               card, amount sheet, terminal illustration
    screens/          one module per screen
  assets/
    fonts/            Poppins woff2
    icon*.png/svg     app icons
```

## Notes

The Visa mark is set as styled text rather than a reproduction of the
trademarked logo artwork. Swap `.card__visa` for licensed artwork if this
is ever used beyond a personal project.
