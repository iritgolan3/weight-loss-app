import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/error_codes.dart' as auth_error;
import 'package:local_auth/local_auth.dart';

import '../services/app_scope.dart';
import '../services/auth_service.dart';
import '../theme/app_theme.dart';
import '../utils/transitions.dart';
import '../widgets/numeric_keypad.dart';
import '../widgets/primary_button.dart';
import 'home_screen.dart';

enum PasscodeMode { unlock, setup }

/// Six-digit passcode: unlock an existing session, or choose + confirm a new
/// code.
class PasscodeScreen extends StatefulWidget {
  const PasscodeScreen({
    super.key,
    required this.mode,
    this.replaceWithHome = false,
  });

  final PasscodeMode mode;

  /// After a successful entry, clear the stack and show Home.
  final bool replaceWithHome;

  @override
  State<PasscodeScreen> createState() => _PasscodeScreenState();
}

class _PasscodeScreenState extends State<PasscodeScreen> with SingleTickerProviderStateMixin {
  static const int _length = 6;

  final LocalAuthentication _localAuth = LocalAuthentication();

  late final AnimationController _shake = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 500),
  );

  String _entered = '';
  String? _firstEntry;
  bool _confirming = false;
  bool _checking = false;
  bool _biometricAvailable = false;
  List<BiometricType> _biometrics = const <BiometricType>[];
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.mode == PasscodeMode.unlock) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _probeBiometrics());
    }
  }

  @override
  void dispose() {
    _shake.dispose();
    super.dispose();
  }

  String get _title {
    if (widget.mode == PasscodeMode.unlock) return 'Enter your passcode';
    return _confirming ? 'Confirm your passcode' : 'Choose a passcode';
  }

  String get _hint {
    if (widget.mode == PasscodeMode.unlock) return 'Six digits keeps your wallet yours.';
    return _confirming ? 'Type it once more to be sure.' : 'Pick six digits you will remember.';
  }

  // --- Entry ----------------------------------------------------------------

  void _onDigit(String digit) {
    if (_checking || _entered.length >= _length) return;
    setState(() {
      _error = null;
      _entered = '$_entered$digit';
    });
    if (_entered.length == _length) {
      _checking = true;
      Future<void>.delayed(const Duration(milliseconds: 160), _evaluate);
    }
  }

  void _onBackspace() {
    if (_checking || _entered.isEmpty) return;
    setState(() {
      _error = null;
      _entered = _entered.substring(0, _entered.length - 1);
    });
  }

  Future<void> _evaluate() async {
    if (!mounted) return;
    final AuthService auth = AppScope.authOf(context);
    final String code = _entered;

    if (widget.mode == PasscodeMode.unlock) {
      // The derivation runs in a background isolate, so this can await.
      final bool valid = await auth.verifyPasscode(code);
      if (!mounted) return;
      if (valid) {
        auth.unlock();
        _finish();
      } else {
        _reject('That passcode is not right.');
      }
      return;
    }

    if (!_confirming) {
      setState(() {
        _firstEntry = code;
        _confirming = true;
        _entered = '';
        _checking = false;
      });
      return;
    }

    if (code == _firstEntry) {
      await auth.setPasscode(code);
      if (!mounted) return;
      _finish();
    } else {
      setState(() {
        _firstEntry = null;
        _confirming = false;
      });
      _reject('Those did not match. Start again.');
    }
  }

  void _reject(String message) {
    HapticFeedback.mediumImpact();
    _shake.forward(from: 0);
    setState(() {
      _error = message;
      _entered = '';
      _checking = false;
    });
  }

  void _finish() {
    if (!mounted) return;
    if (widget.replaceWithHome) {
      Navigator.of(context).pushAndRemoveUntil<void>(
        fadeThroughRoute<void>(const HomeScreen()),
        (Route<dynamic> route) => false,
      );
    } else {
      Navigator.of(context).pop(true);
    }
  }

  // --- Biometrics -----------------------------------------------------------

  Future<void> _probeBiometrics() async {
    bool available = false;
    List<BiometricType> enrolled = const <BiometricType>[];
    try {
      final bool supported = await _localAuth.isDeviceSupported();
      final bool canCheck = await _localAuth.canCheckBiometrics;
      // canCheckBiometrics only reports hardware. Asking what is actually
      // enrolled is what separates "has a sensor" from "can be used".
      enrolled = await _localAuth.getAvailableBiometrics();
      available = supported && canCheck && enrolled.isNotEmpty;
    } on PlatformException {
      available = false;
    } on MissingPluginException {
      available = false;
    }
    if (!mounted) return;
    setState(() {
      _biometricAvailable = available;
      _biometrics = enrolled;
    });
  }

  /// Names the sensors this device actually has enrolled.
  ///
  /// Android from API 30 reports strength (`strong`/`weak`) rather than the
  /// modality, so both are named there; iOS reports face or fingerprint.
  String get _biometricLabel {
    final bool face = _biometrics.contains(BiometricType.face);
    final bool print = _biometrics.contains(BiometricType.fingerprint);
    final bool apple = Platform.isIOS;

    if (face && print) return apple ? 'Face ID or Touch ID' : 'face or fingerprint';
    if (face) return apple ? 'Face ID' : 'face unlock';
    if (print) return apple ? 'Touch ID' : 'fingerprint';
    if (_biometrics.contains(BiometricType.strong) ||
        _biometrics.contains(BiometricType.weak)) {
      return 'fingerprint or face unlock';
    }
    return 'biometric unlock';
  }

  /// Turns a plugin error code into something worth showing a person.
  String _biometricFailure(PlatformException e) {
    switch (e.code) {
      case auth_error.notEnrolled:
        return 'No face or fingerprint is set up on this device yet.';
      case auth_error.notAvailable:
        return 'This device does not offer face or fingerprint unlock.';
      case auth_error.passcodeNotSet:
        return 'Set a device passcode first, then biometrics can be used.';
      case auth_error.lockedOut:
        return 'Too many attempts. Wait a moment, or use your passcode.';
      case auth_error.permanentlyLockedOut:
        return 'Biometrics are locked. Unlock the device itself, then retry.';
      case auth_error.biometricOnlyNotSupported:
        return 'This device cannot limit the prompt to biometrics.';
      default:
        return 'Biometrics are unavailable right now. Use your passcode.';
    }
  }

  Future<void> _useBiometrics() async {
    bool ok = false;
    String? failure;
    try {
      ok = await _localAuth.authenticate(
        localizedReason: 'Unlock your wallet with $_biometricLabel',
        options: const AuthenticationOptions(
          // No device-credential fallback: the app has its own passcode, and
          // the keypad is right there behind the prompt.
          biometricOnly: true,
          stickyAuth: true,
        ),
      );
      if (!ok) failure = 'Not recognised. Try again, or use your passcode.';
    } on PlatformException catch (e) {
      failure = _biometricFailure(e);
    } on MissingPluginException {
      failure = 'Biometrics are not wired up in this build.';
    }
    if (!mounted) return;
    if (ok) {
      AppScope.authOf(context).unlock();
      _finish();
    } else {
      setState(() => _error = failure);
    }
  }

  // --- UI -------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final bool canPop = Navigator.of(context).canPop();

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: AppColors.bg,
      ),
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: <Widget>[
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: canPop ? const BackChevron() : const SizedBox.shrink(),
                  ),
                ),
                const SizedBox(height: 22),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 240),
                  child: Text(
                    _title,
                    key: ValueKey<String>(_title),
                    textAlign: TextAlign.center,
                    style: AppTheme.headline(26, letterSpacing: -0.6),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 36,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 220),
                    child: Text(
                      _error ?? _hint,
                      key: ValueKey<String>(_error ?? _hint),
                      textAlign: TextAlign.center,
                      style: AppTheme.body(
                        13,
                        color: _error != null ? AppColors.danger : AppColors.muted,
                        weight: _error != null ? FontWeight.w500 : FontWeight.w400,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 26),
                _dots(),
                const Spacer(),
                NumericKeypad(
                  onDigit: _onDigit,
                  onBackspace: _onBackspace,
                  leading: widget.mode == PasscodeMode.unlock && _biometricAvailable
                      ? KeypadKey(
                          onTap: _useBiometrics,
                          semanticLabel: 'Unlock with $_biometricLabel',
                          child: Icon(
                            // Face-only devices get the face mark.
                            _biometrics.contains(BiometricType.face) &&
                                    !_biometrics.contains(BiometricType.fingerprint)
                                ? Icons.face_retouching_natural_outlined
                                : Icons.fingerprint,
                            size: 27,
                            color: AppColors.ink,
                          ),
                        )
                      : null,
                ),
                const SizedBox(height: 28),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _dots() {
    return AnimatedBuilder(
      animation: _shake,
      builder: (BuildContext context, Widget? child) {
        final double t = _shake.value;
        final double dx = t == 0 ? 0.0 : math.sin(t * math.pi * 4) * 10 * (1 - t);
        return Transform.translate(offset: Offset(dx, 0), child: child);
      },
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          for (int i = 0; i < _length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 9),
              child: AnimatedScale(
                scale: i < _entered.length ? 1.0 : 0.72,
                duration: const Duration(milliseconds: 360),
                curve: Curves.elasticOut,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i < _entered.length ? AppColors.ink : Colors.transparent,
                    border: Border.all(
                      color: i < _entered.length ? AppColors.ink : AppColors.indicatorInactive,
                      width: 1.4,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
