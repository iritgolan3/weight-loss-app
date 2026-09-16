import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/card_tier.dart';
import '../services/app_scope.dart';
import '../theme/app_theme.dart';
import '../widgets/pos_terminal.dart';
import '../widgets/primary_button.dart';
import '../widgets/summary_card.dart';

/// The success screen: the terminal illustration plays out, then the copy and
/// summary settle in.
class OrderPlacedScreen extends StatefulWidget {
  const OrderPlacedScreen({super.key, required this.tier});

  final CardTier tier;

  @override
  State<OrderPlacedScreen> createState() => _OrderPlacedScreenState();
}

class _OrderPlacedScreenState extends State<OrderPlacedScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2100),
  );

  late final Animation<double> _terminal = CurvedAnimation(
    parent: _controller,
    curve: const Interval(0.0, 0.22, curve: Curves.easeOutBack),
  );

  late final Animation<double> _card = CurvedAnimation(
    parent: _controller,
    curve: const Interval(0.18, 0.45, curve: Curves.easeInOutCubic),
  );

  late final Animation<double> _tick = CurvedAnimation(
    parent: _controller,
    curve: const Interval(0.48, 0.72, curve: Curves.easeInOut),
  );

  late final Animation<double> _receipt = CurvedAnimation(
    parent: _controller,
    curve: const Interval(0.66, 0.92, curve: Curves.easeOutCubic),
  );

  late final Animation<double> _content = CurvedAnimation(
    parent: _controller,
    curve: const Interval(0.55, 0.88, curve: Curves.easeOutCubic),
  );

  bool _completing = false;

  @override
  void initState() {
    super.initState();
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _done() async {
    if (_completing) return;
    setState(() => _completing = true);
    await AppScope.walletOf(context).purchaseCard(widget.tier);
    if (!mounted) return;
    Navigator.of(context).popUntil((Route<dynamic> route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    final CardTier tier = widget.tier;
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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 18, 24, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Center(
                        child: SizedBox(
                          width: 200,
                          child: PosTerminalScene(
                            tier: tier,
                            terminal: _terminal,
                            card: _card,
                            tick: _tick,
                            receipt: _receipt,
                          ),
                        ),
                      ),
                      const SizedBox(height: 30),
                      FadeTransition(
                        opacity: _content,
                        child: SlideTransition(
                          position: Tween<Offset>(
                            begin: const Offset(0, 0.12),
                            end: Offset.zero,
                          ).animate(_content),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: <Widget>[
                              Text(
                                'Order placed',
                                textAlign: TextAlign.center,
                                style: AppTheme.headline(30, letterSpacing: -0.8),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'Your ${tier.name} card is on its way.',
                                textAlign: TextAlign.center,
                                style: AppTheme.body(14.5, color: AppColors.muted, height: 1.5),
                              ),
                              Text(
                                "We'll let you know the moment it ships.",
                                textAlign: TextAlign.center,
                                style: AppTheme.body(14.5, color: AppColors.muted, height: 1.5),
                              ),
                              const SizedBox(height: 26),
                              SummaryCard(
                                rows: <Widget>[
                                  SummaryRowTile(label: 'Paid', value: tier.priceWithCents),
                                  const SummaryRowTile(
                                    label: 'Arrives',
                                    value: '5–7 business days',
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(24, 4, 24, bottomInset + 20),
                child: FadeTransition(
                  opacity: _content,
                  child: PrimaryButton(
                    label: 'Done',
                    enabled: !_completing,
                    onPressed: _completing ? null : _done,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
