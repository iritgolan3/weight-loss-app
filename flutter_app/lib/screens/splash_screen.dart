import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/app_scope.dart';
import '../services/auth_service.dart';
import '../services/wallet_service.dart';
import '../theme/app_theme.dart';
import '../utils/transitions.dart';
import 'home_screen.dart';
import 'passcode_screen.dart';

/// Black wordmark splash. Loads the services, then routes on.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 760),
  );

  late final Animation<double> _fade = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOutCubic,
  );

  late final Animation<double> _scale = Tween<double>(begin: 0.90, end: 1.0).animate(
    CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
  );

  @override
  void initState() {
    super.initState();
    _controller.forward();
    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());
  }

  Future<void> _boot() async {
    final AuthService auth = AppScope.authOf(context);
    final WalletService wallet = AppScope.walletOf(context);
    final Stopwatch clock = Stopwatch()..start();

    await Future.wait<void>(<Future<void>>[auth.load(), wallet.load()]);

    final int remaining = 1200 - clock.elapsedMilliseconds;
    if (remaining > 0) {
      await Future<void>.delayed(Duration(milliseconds: remaining));
    }
    if (!mounted) return;

    // First run sets a passcode, every later open unlocks with it. Nothing
    // else stands between opening the app and using it.
    final Widget next;
    if (!auth.hasPasscode) {
      next = const PasscodeScreen(mode: PasscodeMode.setup, replaceWithHome: true);
    } else if (auth.isLocked) {
      next = const PasscodeScreen(mode: PasscodeMode.unlock, replaceWithHome: true);
    } else {
      next = const HomeScreen();
    }

    Navigator.of(context).pushAndRemoveUntil<void>(
      fadeThroughRoute<void>(next),
      (Route<dynamic> route) => false,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: AppColors.bgDark,
      ),
      child: Scaffold(
        backgroundColor: AppColors.bgDark,
        body: Center(
          child: FadeTransition(
            opacity: _fade,
            child: ScaleTransition(
              scale: _scale,
              child: Text(
                'DailyWallet',
                style: AppTheme.headline(32, color: Colors.white, letterSpacing: -1.0),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
