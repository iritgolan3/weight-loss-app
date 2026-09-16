import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'screens/splash_screen.dart';
import 'services/app_scope.dart';
import 'services/auth_service.dart';
import 'services/wallet_service.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(statusBarColor: Colors.transparent),
  );
  runApp(const DailyWalletApp());
}

class DailyWalletApp extends StatefulWidget {
  const DailyWalletApp({super.key});

  @override
  State<DailyWalletApp> createState() => _DailyWalletAppState();
}

class _DailyWalletAppState extends State<DailyWalletApp> {
  final AuthService _auth = AuthService();
  final WalletService _wallet = WalletService();

  @override
  void dispose() {
    _wallet.dispose();
    _auth.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      auth: _auth,
      wallet: _wallet,
      child: MaterialApp(
        title: 'DailyWallet',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        home: const SplashScreen(),
      ),
    );
  }
}
