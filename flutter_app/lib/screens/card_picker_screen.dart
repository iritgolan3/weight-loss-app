import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/card_tier.dart';
import '../services/app_scope.dart';
import '../theme/app_theme.dart';
import '../utils/transitions.dart';
import '../widgets/credit_card_widget.dart';
import '../widgets/primary_button.dart';
import 'confirm_order_screen.dart';

/// The carousel of metal cards. Cards are drawn rotated a quarter turn so the
/// wordmark runs up the left edge.
class CardPickerScreen extends StatefulWidget {
  const CardPickerScreen({super.key});

  @override
  State<CardPickerScreen> createState() => _CardPickerScreenState();
}

class _CardPickerScreenState extends State<CardPickerScreen> {
  late final PageController _controller;
  bool _initialised = false;
  int _index = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_initialised) {
      _initialised = true;
      _index = CardTier.indexOf(AppScope.walletOf(context).activeCard);
      _controller = PageController(viewportFraction: 0.72, initialPage: _index);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  CardTier get _tier => CardTier.all[_index];

  double get _page {
    if (_controller.hasClients && _controller.position.haveDimensions) {
      return _controller.page ?? _index.toDouble();
    }
    return _index.toDouble();
  }

  void _choose() {
    Navigator.of(context).push<void>(
      slideUpRoute<void>(ConfirmOrderScreen(tier: _tier)),
    );
  }

  @override
  Widget build(BuildContext context) {
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
            children: <Widget>[
              const SizedBox(
                width: double.infinity,
                height: 48,
                child: Align(alignment: Alignment.centerLeft, child: BackChevron()),
              ),
              const SizedBox(height: 14),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 260),
                child: Text(
                  _tier.name,
                  key: ValueKey<String>('name-${_tier.id}'),
                  style: AppTheme.headline(30, letterSpacing: -0.8),
                ),
              ),
              const SizedBox(height: 6),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 260),
                child: RichText(
                  key: ValueKey<String>('price-${_tier.id}'),
                  text: TextSpan(
                    children: <TextSpan>[
                      TextSpan(
                        text: _tier.priceLabel,
                        style: AppTheme.body(18, weight: FontWeight.w600),
                      ),
                      TextSpan(
                        text: ' / year',
                        style: AppTheme.body(18, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 22),
              Expanded(
                child: PageView.builder(
                  controller: _controller,
                  itemCount: CardTier.all.length,
                  onPageChanged: (int index) => setState(() => _index = index),
                  itemBuilder: (BuildContext context, int index) {
                    final CardTier tier = CardTier.all[index];
                    final bool focused = index == _index;
                    return AnimatedBuilder(
                      animation: _controller,
                      builder: (BuildContext context, Widget? child) {
                        final double delta = math.min(1.0, (_page - index).abs());
                        return Opacity(
                          opacity: lerpDouble(1.0, 0.5, delta)!,
                          child: Transform.scale(
                            scale: lerpDouble(1.0, 0.86, delta)!,
                            child: child,
                          ),
                        );
                      },
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          child: AspectRatio(
                            aspectRatio: 1 / kCardAspect,
                            child: focused
                                ? CardHero(tier: tier, turns: 0.25)
                                : CreditCardWidget(tier: tier, rotated: true),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  for (int i = 0; i < CardTier.all.length; i++)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeOutCubic,
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: i == _index ? 22 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: i == _index ? AppColors.ink : AppColors.indicatorInactive,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 26),
              Padding(
                padding: EdgeInsets.fromLTRB(24, 0, 24, bottomInset + 20),
                child: PrimaryButton(
                  onPressed: _choose,
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 260),
                    child: Text(
                      'Choose ${_tier.name}',
                      key: ValueKey<String>('cta-${_tier.id}'),
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
            ],
          ),
        ),
      ),
    );
  }
}
