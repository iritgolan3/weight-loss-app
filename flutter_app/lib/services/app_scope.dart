import 'package:flutter/widgets.dart';

import 'auth_service.dart';
import 'wallet_service.dart';

/// Hands the two services down the tree. State itself lives in the
/// `ChangeNotifier`s and is read with `ListenableBuilder`.
class AppScope extends InheritedWidget {
  const AppScope({
    super.key,
    required this.auth,
    required this.wallet,
    required super.child,
  });

  final AuthService auth;
  final WalletService wallet;

  static AppScope of(BuildContext context) {
    final AppScope? scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'No AppScope found above this widget.');
    return scope!;
  }

  static AuthService authOf(BuildContext context) => of(context).auth;

  static WalletService walletOf(BuildContext context) => of(context).wallet;

  @override
  bool updateShouldNotify(AppScope oldWidget) =>
      auth != oldWidget.auth || wallet != oldWidget.wallet;
}
