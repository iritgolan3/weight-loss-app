import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// PBKDF2 work factor. Pure-Dart HMAC is slower than a platform primitive, so
/// this is lower than a server would use while still making a guess expensive;
/// the derivation runs off the UI thread so the delay is not felt.
const int kPbkdf2Iterations = 100000;

/// PBKDF2-HMAC-SHA256, run in a background isolate via [compute].
///
/// Top-level because [compute] entry points must be, and takes its two inputs
/// as a list because the isolate boundary only carries simple values.
/// `dkLen` equals SHA-256's output length, so one block covers the whole key
/// and `F = U1 xor U2 xor ... xor Uc` is the entire derivation.
String derivePbkdf2(List<String> saltThenSecret) {
  final Hmac hmac = Hmac(sha256, utf8.encode(saltThenSecret[1]));
  final List<int> block = <int>[...utf8.encode(saltThenSecret[0]), 0, 0, 0, 1];

  List<int> u = hmac.convert(block).bytes;
  final List<int> out = List<int>.of(u);

  for (int i = 1; i < kPbkdf2Iterations; i++) {
    u = hmac.convert(u).bytes;
    for (int j = 0; j < out.length; j++) {
      out[j] ^= u[j];
    }
  }
  return out.map((int b) => b.toRadixString(16).padLeft(2, '0')).join();
}

/// A single persisted account. The raw password is never stored: only a random
/// per-account salt and a PBKDF2-SHA256 derivation of `salt + password`.
@immutable
class StoredAccount {
  const StoredAccount({
    required this.email,
    required this.salt,
    required this.hash,
    this.passcodeSalt,
    this.passcodeHash,
  });

  final String email;
  final String salt;
  final String hash;
  final String? passcodeSalt;
  final String? passcodeHash;

  bool get hasPasscode => passcodeHash != null && passcodeSalt != null;

  StoredAccount copyWith({String? passcodeSalt, String? passcodeHash}) {
    return StoredAccount(
      email: email,
      salt: salt,
      hash: hash,
      passcodeSalt: passcodeSalt ?? this.passcodeSalt,
      passcodeHash: passcodeHash ?? this.passcodeHash,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'email': email,
        'salt': salt,
        'hash': hash,
        'passcodeSalt': passcodeSalt,
        'passcodeHash': passcodeHash,
      };

  factory StoredAccount.fromJson(Map<String, dynamic> json) => StoredAccount(
        email: json['email'] as String,
        salt: json['salt'] as String,
        hash: json['hash'] as String,
        passcodeSalt: json['passcodeSalt'] as String?,
        passcodeHash: json['passcodeHash'] as String?,
      );
}

/// Email + password accounts, persisted with `shared_preferences`.
class AuthService extends ChangeNotifier {
  static const String _accountsKey = 'dw_accounts';
  static const String _currentKey = 'dw_current_user';

  final Map<String, StoredAccount> _accounts = <String, StoredAccount>{};
  String? _currentEmail;
  bool _locked = false;
  bool _loaded = false;

  bool get isLoaded => _loaded;

  bool get hasAccount => _accounts.isNotEmpty;

  String? get currentUser => _currentEmail;

  bool get isSignedIn => _currentEmail != null;

  StoredAccount? get _current => _currentEmail == null ? null : _accounts[_currentEmail];

  bool get hasPasscode => _current?.hasPasscode ?? false;

  /// A session is locked when a signed-in account has a passcode and the app
  /// has not been unlocked since launch.
  bool get isLocked => _locked && hasPasscode;

  Future<void> load() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String? raw = prefs.getString(_accountsKey);
    _accounts.clear();
    if (raw != null && raw.isNotEmpty) {
      final Map<String, dynamic> decoded = jsonDecode(raw) as Map<String, dynamic>;
      decoded.forEach((String key, dynamic value) {
        _accounts[key] = StoredAccount.fromJson(Map<String, dynamic>.from(value as Map));
      });
    }
    final String? current = prefs.getString(_currentKey);
    _currentEmail = current != null && _accounts.containsKey(current) ? current : null;
    // Every cold start begins locked when the account is protected.
    _locked = hasPasscode;
    _loaded = true;
    notifyListeners();
  }

  // --- Validation -----------------------------------------------------------

  static final RegExp _emailPattern = RegExp(r'^[\w.+-]+@[\w-]+\.[\w.-]+$');

  static String? validateEmail(String value) {
    final String email = value.trim();
    if (email.isEmpty) return 'Enter your email address.';
    if (!_emailPattern.hasMatch(email)) return 'That email address does not look right.';
    return null;
  }

  static String? validatePassword(String value) {
    if (value.isEmpty) return 'Enter your password.';
    if (value.length < 8) return 'Use at least 8 characters.';
    return null;
  }

  // --- Credentials ----------------------------------------------------------

  static String _newSalt() {
    final Random random = Random.secure();
    final List<int> bytes = List<int>.generate(16, (_) => random.nextInt(256));
    return base64Url.encode(bytes);
  }

  static Future<String> _digest(String salt, String secret) =>
      compute(derivePbkdf2, <String>[salt, secret]);

  /// Compares in constant time so a near-miss costs the same as a wild guess.
  static bool _same(String a, String b) {
    if (a.length != b.length) return false;
    int diff = 0;
    for (int i = 0; i < a.length; i++) {
      diff |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return diff == 0;
  }

  /// Returns `null` on success, otherwise a message for the UI.
  Future<String?> signUp(String email, String password) async {
    final String key = email.trim().toLowerCase();
    final String? emailError = validateEmail(key);
    if (emailError != null) return emailError;
    final String? passwordError = validatePassword(password);
    if (passwordError != null) return passwordError;
    if (_accounts.containsKey(key)) {
      return 'An account already exists for that email.';
    }
    final String salt = _newSalt();
    _accounts[key] =
        StoredAccount(email: key, salt: salt, hash: await _digest(salt, password));
    _currentEmail = key;
    _locked = false;
    await _persist();
    notifyListeners();
    return null;
  }

  /// Returns `null` on success, otherwise a message for the UI.
  Future<String?> signIn(String email, String password) async {
    final String key = email.trim().toLowerCase();
    final String? emailError = validateEmail(key);
    if (emailError != null) return emailError;
    final String? passwordError = validatePassword(password);
    if (passwordError != null) return passwordError;
    final StoredAccount? account = _accounts[key];
    final String probe = await _digest(account?.salt ?? _newSalt(), password);
    if (account == null || !_same(probe, account.hash)) {
      return 'Email or password is incorrect.';
    }
    _currentEmail = key;
    _locked = account.hasPasscode;
    await _persist();
    notifyListeners();
    return null;
  }

  Future<void> signOut() async {
    _currentEmail = null;
    _locked = false;
    await _persist();
    notifyListeners();
  }

  // --- Passcode -------------------------------------------------------------

  Future<void> setPasscode(String code) async {
    final StoredAccount? account = _current;
    if (account == null) return;
    final String salt = _newSalt();
    _accounts[account.email] = account.copyWith(
      passcodeSalt: salt,
      passcodeHash: await _digest(salt, code),
    );
    _locked = false;
    await _persist();
    notifyListeners();
  }

  Future<bool> verifyPasscode(String code) async {
    final StoredAccount? account = _current;
    if (account == null || !account.hasPasscode) return false;
    return _same(await _digest(account.passcodeSalt!, code), account.passcodeHash!);
  }

  void lock() {
    if (_locked) return;
    _locked = true;
    notifyListeners();
  }

  void unlock() {
    if (!_locked) return;
    _locked = false;
    notifyListeners();
  }

  Future<void> _persist() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final Map<String, dynamic> encoded = <String, dynamic>{
      for (final MapEntry<String, StoredAccount> entry in _accounts.entries)
        entry.key: entry.value.toJson(),
    };
    await prefs.setString(_accountsKey, jsonEncode(encoded));
    if (_currentEmail == null) {
      await prefs.remove(_currentKey);
    } else {
      await prefs.setString(_currentKey, _currentEmail!);
    }
  }
}
