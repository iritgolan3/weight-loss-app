import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/card_tier.dart';
import '../theme/app_theme.dart';
import '../utils/transitions.dart';
import '../widgets/credit_card_widget.dart';
import '../widgets/primary_button.dart';
import '../widgets/summary_card.dart';
import 'order_placed_screen.dart';

/// Review and pay. The summary rows stagger in, and the pay button morphs into
/// a loading pill when pressed.
class ConfirmOrderScreen extends StatefulWidget {
  const ConfirmOrderScreen({super.key, required this.tier});

  final CardTier tier;

  @override
  State<ConfirmOrderScreen> createState() => _ConfirmOrderScreenState();
}

class _ConfirmOrderScreenState extends State<ConfirmOrderScreen> with TickerProviderStateMixin {
  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  );

  late final AnimationController _morph = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 350),
  );

  late final AnimationController _dots = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );

  late final List<Animation<double>> _rows;
  late final Animation<double> _panel;
  late final Animation<double> _button;

  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _panel = CurvedAnimation(
      parent: _entrance,
      curve: const Interval(0.33, 0.60, curve: Curves.easeOutCubic),
    );
    _rows = List<Animation<double>>.generate(4, (int i) {
      final double begin = 0.35 + i * 0.06;
      return CurvedAnimation(
        parent: _entrance,
        curve: Interval(begin, math.min(1.0, begin + 0.35), curve: Curves.easeOutCubic),
      );
    });
    _button = CurvedAnimation(
      parent: _entrance,
      curve: const Interval(0.86, 1.0, curve: Curves.easeOutCubic),
    );
    _entrance.forward();
  }

  @override
  void dispose() {
    _entrance.dispose();
    _morph.dispose();
    _dots.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    HapticFeedback.lightImpact();
    _dots.repeat();
    await _morph.forward();
    await Future<void>.delayed(const Duration(milliseconds: 1250));
    if (!mounted) return;
    Navigator.of(context).pushReplacement<void, void>(
      fadeThroughRoute<void>(OrderPlacedScreen(tier: widget.tier)),
    );
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
              const SizedBox(
                height: 48,
                child: Align(alignment: Alignment.centerLeft, child: BackChevron()),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('Confirm order', style: AppTheme.headline(32, letterSpacing: -1.0)),
                      const SizedBox(height: 8),
                      Text(
                        'Review your new card before you pay.',
                        style: AppTheme.body(14.5, color: AppColors.muted),
                      ),
                      const SizedBox(height: 26),
                      AspectRatio(
                        aspectRatio: kCardAspect,
                        child: CardHero(tier: tier),
                      ),
                      const SizedBox(height: 26),
                      _summary(tier),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(24, 4, 24, bottomInset + 20),
                child: FadeTransition(
                  opacity: _button,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      _payButton(tier),
                      const SizedBox(height: 14),
                      _helperLine(),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _summary(CardTier tier) {
    final List<List<String>> lines = <List<String>>[
      <String>['Card', tier.subtitle],
      <String>['Annual fee', tier.priceWithCents],
      <String>['Delivery', 'Free · 5–7 days'],
      <String>['Total today', tier.priceWithCents],
    ];

    return FadeTransition(
      opacity: _panel,
      child: SummaryCard(
        autoDividers: false,
        rows: <Widget>[
          for (int i = 0; i < lines.length; i++)
            AnimatedBuilder(
              animation: _rows[i],
              builder: (BuildContext context, Widget? child) {
                final double t = _rows[i].value;
                return Opacity(
                  opacity: t,
                  child: Transform.translate(offset: Offset(0, 16 * (1 - t)), child: child),
                );
              },
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  if (i > 0)
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 18),
                      child: SizedBox(height: 1, child: ColoredBox(color: AppColors.hairline)),
                    ),
                  SummaryRowTile(
                    label: lines[i][0],
                    value: lines[i][1],
                    emphasiseLabel: i == lines.length - 1,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _payButton(CardTier tier) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double fullWidth = constraints.maxWidth;
        return AnimatedBuilder(
          animation: Listenable.merge(<Listenable>[_morph, _dots]),
          builder: (BuildContext context, Widget? child) {
            final double t = Curves.easeInOutCubic.transform(_morph.value);
            final double width = lerpDouble(fullWidth, 56, t)!;
            final double labelOpacity = math.max(0.0, math.min(1.0, 1 - t * 1.8));

            return Center(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _submitting ? null : _submit,
                child: Container(
                  width: width,
                  height: 56,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    color: AppColors.ink,
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: const <BoxShadow>[
                      BoxShadow(color: Color(0x1A000000), blurRadius: 18, offset: Offset(0, 8)),
                    ],
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: <Widget>[
                      if (labelOpacity > 0)
                        OverflowBox(
                          minWidth: fullWidth,
                          maxWidth: fullWidth,
                          minHeight: 56,
                          maxHeight: 56,
                          child: Opacity(
                            opacity: labelOpacity,
                            child: Center(
                              child: Text(
                                'Order · ${tier.priceWithCents}',
                                maxLines: 1,
                                style: AppTheme.body(
                                  16,
                                  color: Colors.white,
                                  weight: FontWeight.w600,
                                  letterSpacing: -0.2,
                                  height: 1,
                                ),
                              ),
                            ),
                          ),
                        ),
                      if (t > 0)
                        Opacity(
                          opacity: Curves.easeIn.transform(t),
                          child: _bouncingDots(),
                        ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _bouncingDots() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        for (int i = 0; i < 3; i++)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: Transform.translate(
              offset: Offset(0, -5 * _bounce(i)),
              child: const SizedBox(
                width: 6,
                height: 6,
                child: DecoratedBox(
                  decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                ),
              ),
            ),
          ),
      ],
    );
  }

  double _bounce(int index) {
    final double phase = (_dots.value - index * 0.15) % 1.0;
    return phase < 0.5 ? math.sin(phase * 2 * math.pi) : 0.0;
  }

  Widget _helperLine() {
    return SizedBox(
      height: 20,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 260),
        child: _submitting
            ? Text(
                'Confirming your payment…',
                key: const ValueKey<String>('confirming'),
                style: AppTheme.body(12, color: AppColors.muted),
              )
            : Row(
                key: const ValueKey<String>('secure'),
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  const Icon(Icons.lock_outline, size: 13, color: AppColors.muted),
                  const SizedBox(width: 6),
                  Text(
                    'Secure payment · Cancel anytime',
                    style: AppTheme.body(12, color: AppColors.muted),
                  ),
                ],
              ),
      ),
    );
  }
}
