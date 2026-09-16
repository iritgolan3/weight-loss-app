import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/card_tier.dart';
import '../services/app_scope.dart';
import '../services/auth_service.dart';
import '../services/wallet_service.dart';
import '../theme/app_theme.dart';
import '../utils/formatters.dart';
import '../utils/transitions.dart';
import '../widgets/credit_card_widget.dart';
import '../widgets/primary_button.dart';
import 'passcode_screen.dart';

/// Account details, the active card and the two account actions.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _changePasscode(BuildContext context) async {
    final bool? changed = await Navigator.of(context).push<bool>(
      slideUpRoute<bool>(const PasscodeScreen(mode: PasscodeMode.setup)),
    );
    if (!context.mounted || changed != true) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.ink,
        margin: const EdgeInsets.all(24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        content: Text(
          'Passcode updated.',
          style: AppTheme.body(14, color: Colors.white, weight: FontWeight.w500),
        ),
      ),
    );
  }

  /// Re-arms the passcode gate without touching the wallet.
  void _lockNow(BuildContext context) {
    AppScope.authOf(context).lock();
    Navigator.of(context).pushAndRemoveUntil<void>(
      fadeThroughRoute<void>(
        const PasscodeScreen(mode: PasscodeMode.unlock, replaceWithHome: true),
      ),
      (Route<dynamic> route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final AuthService auth = AppScope.authOf(context);
    final WalletService wallet = AppScope.walletOf(context);
    final double bottomInset = MediaQuery.of(context).padding.bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: AppColors.bg,
      ),
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          bottom: false,
          child: ListenableBuilder(
            listenable: Listenable.merge(<Listenable>[auth, wallet]),
            builder: (BuildContext context, Widget? child) {
              final String title = auth.displayName;
              final CardTier tier = wallet.activeCard;

              return SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(24, 0, 24, bottomInset + 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    const SizedBox(
                      height: 48,
                      child: Align(alignment: Alignment.centerLeft, child: BackChevron()),
                    ),
                    const SizedBox(height: 14),
                    Text('Profile', style: AppTheme.headline(32, letterSpacing: -1.0)),
                    const SizedBox(height: 26),
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: const <BoxShadow>[
                          BoxShadow(color: Color(0x0D000000), blurRadius: 20, offset: Offset(0, 8)),
                        ],
                      ),
                      child: Row(
                        children: <Widget>[
                          Container(
                            width: 48,
                            height: 48,
                            decoration: const BoxDecoration(
                              color: AppColors.ink,
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              title.isEmpty ? 'D' : title.substring(0, 1).toUpperCase(),
                              style: AppTheme.body(
                                18,
                                color: Colors.white,
                                weight: FontWeight.w600,
                                height: 1,
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(
                                  'This device',
                                  style: AppTheme.body(12, color: AppColors.muted),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTheme.body(15, weight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 26),
                    Text(
                      'Your card',
                      style: AppTheme.body(13, color: AppColors.muted),
                    ),
                    const SizedBox(height: 12),
                    AspectRatio(
                      aspectRatio: kCardAspect,
                      child: CreditCardWidget(tier: tier),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: <Widget>[
                        Text(
                          tier.subtitle,
                          style: AppTheme.body(14, weight: FontWeight.w600),
                        ),
                        const Spacer(),
                        Text(
                          wallet.ownedCard == null
                              ? 'Not ordered yet'
                              : '${tier.priceLabel} / year',
                          style: AppTheme.body(13, color: AppColors.muted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: <Widget>[
                        Text('Balance', style: AppTheme.body(14, weight: FontWeight.w600)),
                        const Spacer(),
                        Text(
                          formatBalance(wallet.balance),
                          style: AppTheme.body(13, color: AppColors.muted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),
                    _ActionRow(
                      label: 'Change passcode',
                      icon: Icons.lock_outline,
                      onTap: () => _changePasscode(context),
                    ),
                    const SizedBox(height: 12),
                    _ActionRow(
                      label: 'Lock now',
                      icon: Icons.lock_person_outlined,
                      onTap: () => _lockNow(context),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    super.key,
    required this.label,
    required this.icon,
    required this.onTap,
    this.danger = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final Color tone = danger ? AppColors.danger : AppColors.ink;
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        splashColor: AppColors.ripple,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
          child: Row(
            children: <Widget>[
              Icon(icon, size: 19, color: tone),
              const SizedBox(width: 14),
              Text(
                label,
                style: AppTheme.body(15, color: tone, weight: FontWeight.w500),
              ),
              const Spacer(),
              const Icon(Icons.chevron_right, size: 20, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}
