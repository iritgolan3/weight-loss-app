# DailyWallet

An animated banking and card-ordering app built with Flutter. Black home
screen with the balance and metal card, a rotated card carousel, a staggered
order-confirmation flow with a morphing pay button, and a hand-drawn POS
terminal success animation. A six-digit passcode is the only credential —
there is no email and no sign-up.

> **Authored without a Flutter SDK.** This project was written file by file in
> an environment that had no Flutter or Dart toolchain installed, so it has
> never been compiled, run, or analysed. Treat the first `flutter run` as the
> first real build: expect to fix the occasional import or API nit rather than
> a working binary on the first try.

## Running it

There are no `android/`, `ios/` or other platform folders in the repository —
only the Dart sources and `pubspec.yaml`. Generate the native shells first:

```bash
cd flutter_app

# 1. Generate the platform folders in place (keeps lib/ and pubspec.yaml).
flutter create . --platforms=ios,android

# 2. Fetch packages.
flutter pub get

# 3. Run on a connected device or simulator.
flutter run
```

`flutter create .` reads the existing `pubspec.yaml`, so the package stays
named `daily_wallet` and your `lib/` is left untouched.

Optional sanity checks:

```bash
flutter analyze
dart format --output=none --set-exit-if-changed .
```

## Requirements

* Flutter `>=3.22.0`, Dart `>=3.4.0 <4.0.0`
* Packages: `google_fonts`, `shared_preferences`, `local_auth`, `crypto`,
  `cupertino_icons`

Poppins is pulled at runtime by `google_fonts`, so there are no font binaries
and no `assets:` section to wire up. The first launch needs a network
connection to fetch the font; after that it is cached on device.

### Biometrics: face and fingerprint

Both modalities are covered. `getAvailableBiometrics()` reports what is
actually enrolled, and the app names and illustrates it accordingly — Face ID
or Touch ID on iOS, "fingerprint or face unlock" on Android (which from API 30
reports sensor *strength* rather than modality, so both are named). Android's
BiometricPrompt lets the user switch between enrolled sensors itself.

The key only appears when the device is supported, can check biometrics **and**
has something enrolled — `canCheckBiometrics` alone reports hardware, not
enrolment, so it would offer a key that could never succeed. Failures are
mapped from the plugin's `auth_error` codes to messages that say what to do
(nothing enrolled, locked out, no device passcode, and so on) rather than a
single generic line.

`biometricOnly: true` means there is no device-credential fallback; the app's
own passcode keypad is behind the prompt anyway.

**Both platforms need native setup, or the key will never appear:**

* **Android** — make `MainActivity` extend `FlutterFragmentActivity` in
  `android/app/src/main/kotlin/.../MainActivity.kt`, and add
  `<uses-permission android:name="android.permission.USE_BIOMETRIC"/>` to
  `android/app/src/main/AndroidManifest.xml`.
* **iOS** — add `NSFaceIDUsageDescription` to `ios/Runner/Info.plist`.
  **Face ID silently fails without it**; Touch ID does not need it.

## Structure

```
lib/
  main.dart                     app shell, services, MaterialApp
  theme/app_theme.dart          palette, card gradients, Poppins text styles
  models/
    card_tier.dart              Platinum / Silver / Gold
    txn.dart                    ledger entry + seed data
  services/
    app_scope.dart              InheritedWidget handing the services down
    auth_service.dart           device profile + PBKDF2 passcode
    wallet_service.dart         balance, ledger, owned card
  screens/
    splash_screen.dart          wordmark, loads state, routes on
    passcode_screen.dart        six-dot passcode, keypad, biometrics
    home_screen.dart            balance, card, ledger sheet, nav pill
    card_picker_screen.dart     rotated card carousel
    confirm_order_screen.dart   staggered summary + morphing pay button
    order_placed_screen.dart    POS terminal animation
    profile_screen.dart         device, card, passcode, lock now
  widgets/
    credit_card_widget.dart     card face + hero flight (with rotation)
    pos_terminal.dart           CustomPaint terminal, receipt and tick
    bottom_nav_pill.dart        floating navigation pill
    ...
  utils/
    formatters.dart             money and clock formatting
    transitions.dart            page route transitions
```

## The card face

One landscape arrangement serves both presentations — contactless mark top
right, wordmark bottom left, VISA and the tier name bottom right — and the
picker simply turns that whole frame a quarter turn **clockwise**. Keeping a
single arrangement is what lets the hero flight interpolate the turn rather
than cross-fade one layout into another, and it matches the reference design,
where the wordmark reads top-to-bottom down the left edge of the turned card.

There is no chip and no card number on the face; the reference cards are bare
metal with dark ink.

## Security note

The passcode is the only credential and it is never stored in the clear. It
gets a random salt from `Random.secure()`; only the salt and a
PBKDF2-HMAC-SHA256 derivation of `salt + passcode` are written to
`shared_preferences`, and comparisons run in constant time.

The derivation runs in a background isolate via `compute`, so the work factor
(`kPbkdf2Iterations`, 100,000) does not block the UI. It is lower than the
210,000 the web app uses because `package:crypto` is pure Dart rather than a
platform primitive — raise it if you move to a native KDF. A production app
would also keep the derived material in the platform keystore.
