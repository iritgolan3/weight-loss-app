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
| **Settings** | Setup checklist, cards, currency, security, alerts, data, about |
| **Cards** | The stack: tap to open, drag to reorder, magnifier to add or remove |
| **Add card** | Order a DailyWallet card, or add one you already have |
| **Card** | Freeze, default, spending limits, payment controls, remove |
| **Sync** | Optional email sign-in, shown only when a backend is configured |

## Sizing

There is no device mock-up. The app fills whatever it is given, up to 480px,
and the page carries the active screen's own background out to the window
edge — so a wide window shows the app, not a picture of a phone sitting on a
desk.

Every length is authored in `rem` against a **440 x 956pt reference phone**,
and `html`'s font size scales with viewport width
(`clamp(0.8125rem, 3.6364vw, 1.0906rem)`). A 375pt iPhone SE gets the same
design at 85%; the cap matches what a 480px-wide app wants (16 x 480/440),
so the proportions hold at every width without a breakpoint.

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

## Settings, and which of them a payment app actually needs

Every setting here changes behaviour. Nothing is a switch that only moves.
Freezing a card refuses the next payment, a spending limit refuses an
over-limit one before any money moves, turning payment alerts off really
does silence them, and the currency setting re-denominates every amount in
the app. `store.spend()` is the single gate all of that runs through.

The Settings screen opens with a **setup checklist** that names anything
required which is not yet configured — the app checking itself rather than
leaving you to work it out. It clears to a green line when nothing is
outstanding.

### What is genuinely required

**Required by payments regulation** (PSD2/SCA in the EU and UK, and the
equivalent elsewhere):

| Setting | Why |
| --- | --- |
| Passcode | One of the two authentication factors |
| Face or fingerprint | The second factor — inherence |
| Auto-lock | Bounds how long an unlocked session stays open |
| Payment alerts | Account holders must be told when money moves |
| Spending limits | Customers must be able to set and change payment limits |
| Freeze card | Immediate ability to stop a card being used |
| Payment controls | Per-channel consent (online, contactless, ATM, abroad) |

**Required by data protection law** (GDPR and similar):

| Setting | Why |
| --- | --- |
| Export my data | Right to portability — the real wallet JSON, copyable |
| Erase everything | Right to erasure — wipes wallet, cards and passcode |
| Product news off by default | Marketing must be opt-in, never pre-ticked |

**Required by the app stores:** Apple requires any app with account creation
to offer account deletion in-app — that is what *Erase everything* is.

**Required by people, if not by law:** default card, card removal, currency,
reduce motion, and knowing what the app is.

### What a real payment app has that this one cannot

These need a licensed issuer and a backend, so they are deliberately absent
rather than faked:

- **Identity verification (KYC/AML).** A real wallet cannot hold money until
  identity is checked.
- **Statements.** Payment accounts must provide periodic statements.
- **Disputes and chargebacks.** A regulated path to challenge a transaction.
- **Complaints and ombudsman referral.** Required disclosure in most markets.
- **Fees and exchange-rate disclosure**, in the pre-contract format regulators
  specify.
- **Deposit protection disclosure.** This app claims none, because it has
  none. Any such badge here would be a false statement.
- **3-D Secure**, tokenisation, and real card provisioning to Apple/Google Pay.

### Adding cards

Two routes: order a DailyWallet card through the existing metal-card flow, or
add a card you already have.

The add-card form validates properly — Luhn checksum, issuer-range brand
detection, 4-6-5 grouping for Amex, real month and expiry checks, and a
brand-correct security-code length. It is also unambiguous about being a
demo: it says so in the form, offers a test number so nobody needs to type a
real one, and **stores only the brand, last four digits and expiry**. The
full number and the security code are discarded at submit and never written
to storage — asserted by a test that reads localStorage back and checks the
number is absent.

## Choosing a card is not buying one

The same carousel serves two different acts, and the difference matters.

Tapping your card on Home opens it in **select** mode: it holds the cards
already in your wallet, the subtitle shows the last four and the expiry
rather than a price, and the button reads *Use this card* — or *Already your
card*, disabled, for the one you are on. Choosing sets your default and takes
you back. Nothing is bought, nothing is charged.

**Order** mode is reached from Cards → Add a card → Order a DailyWallet card.
That is where the three metals appear with their annual fee and where
*Choose Gold* leads on to Confirm order and payment, exactly as in the
reference.

Same layout, same turned card, same dots and the same button. Only the
subtitle and the verb change, because looking at your wallet should never
cost anything.

## The card stack

Cards overlap like a real wallet, each showing its top strip with the name and
last four — the only part of a covered card you can see, so that is where the
identity lives. Tapping one opens it, and the face itself flies through to the
detail screen as the same element rather than a screen sliding over. Press and
drag reorders the stack; the others slide out of the way and the order sticks.

The magnifier turns on manage mode: a search field across name, brand, last
four and tier, a remove control on each card, and a row to add another.

The faces are lightly three-dimensional. Each sits on a perspective plane and
leans towards the finger, with a specular highlight tracking the same point.
The lean is written to custom properties rather than the transform, so the
quarter turn in the card picker and the hero flight keep control of their own
transforms and nothing fights.

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

### Everything stays on the phone

The wallet — balance, ledger, cards, settings — is sealed with AES-GCM under
a key derived from the passcode (PBKDF2-SHA256, 310,000 iterations). The key
is held in memory and never written anywhere, so a closed app leaves nothing
readable behind: no card, no last four, no balance, no merchant. A test dumps
localStorage and asserts none of it is legible, that a wrong passcode does not
open it, and that tampered ciphertext is refused rather than trusted.

Card numbers are never stored at all. The add-card form keeps the brand, the
last four and the expiry; the full number and the CVC are dropped at submit.
Nothing is transmitted — there is no server unless you configure syncing
yourself.

Biometric unlock gets its own path through the **WebAuthn PRF extension**,
which lets the authenticator return a stable secret after a scan. Where PRF
is supported the data key is wrapped under that secret, so a face or finger
opens a cold start. Where it is not, the passcode is what decrypts, and the
lock screen says so instead of failing without explanation.

### Why Face ID may say it cannot run

If biometrics seem broken, this is almost always why: **a cross-origin frame
cannot use WebAuthn unless the page embedding it delegates
`publickey-credentials-create` and `publickey-credentials-get` through
Permissions-Policy.** An embedded preview usually does not.

The trap is that the capability check lies. In that situation
`isUserVerifyingPlatformAuthenticatorAvailable()` still answers `true`, so an
app offers the button, and only the real call fails — with `NotAllowedError`,
the same error name a user gets for dismissing the prompt. Reported as "you
cancelled", it looks like a bug in the app.

So the app now reads the policy up front with
`document.featurePolicy.allowsFeature(...)`, treats a frame that may not ask
as *unavailable* with the reason shown, and separates that case from a real
dismissal. **Open the app in its own tab or from the home screen and
biometrics work normally.**

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
