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

/// The device profile. No email and no password: the passcode is the only
/// credential, so the app is usable the moment it opens.
///
/// The passcode is never stored. A random salt plus a PBKDF2-SHA256
/// derivation is kept, and comparisons run on derivations in constant time.
class AuthService extends ChangeNotifier {
  static const String _profileKey = 'dw_profile';

  String _profileId = '';
  String? _passcodeSalt;
  String? _passcodeHash;
  bool _locked = false;
  bool _loaded = false;

  bool get isLoaded => _loaded;

  /// Stable id for this install, used to namespace anything device-scoped.
  String get profileId => _profileId;

  bool get hasPasscode => _passcodeSalt != null && _passcodeHash != null;

  /// Locked when a passcode exists and the app has not been unlocked since
  /// launch.
  bool get isLocked => _locked && hasPasscode;

  /// The home screen greeting. Matches the reference design.
  String get displayName => 'DailyWallet';

  Future<void> load() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final String? raw = prefs.getString(_profileKey);

    if (raw != null && raw.isNotEmpty) {
      final Map<String, dynamic> json = jsonDecode(raw) as Map<String, dynamic>;
      _profileId = json['id'] as String? ?? _newId();
      _passcodeSalt = json['passcodeSalt'] as String?;
      _passcodeHash = json['passcodeHash'] as String?;
    } else {
      _profileId = _newId();
      await _persist();
    }

    // Every cold start begins locked once a passcode is set.
    _locked = hasPasscode;
    _loaded = true;
    notifyListeners();
  }

  // --- Derivation -----------------------------------------------------------

  static String _newId() {
    final Random random = Random.secure();
    return List<String>.generate(
      12,
      (_) => random.nextInt(16).toRadixString(16),
    ).join();
  }

  static String _newSalt() {
    final Random random = Random.secure();
    return List<String>.generate(
      32,
      (_) => random.nextInt(16).toRadixString(16),
    ).join();
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

  // --- Passcode -------------------------------------------------------------

  Future<void> setPasscode(String code) async {
    final String salt = _newSalt();
    _passcodeSalt = salt;
    _passcodeHash = await _digest(salt, code);
    _locked = false;
    await _persist();
    notifyListeners();
  }

  Future<bool> verifyPasscode(String code) async {
    if (!hasPasscode) return false;
    final bool ok = _same(await _digest(_passcodeSalt!, code), _passcodeHash!);
    if (ok) {
      _locked = false;
      notifyListeners();
    }
    return ok;
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
    await prefs.setString(
      _profileKey,
      jsonEncode(<String, dynamic>{
        'id': _profileId,
        'passcodeSalt': _passcodeSalt,
        'passcodeHash': _passcodeHash,
      }),
    );
  }
}
