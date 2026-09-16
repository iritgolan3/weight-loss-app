import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

import '../models/card_tier.dart';
import '../theme/app_theme.dart';
import 'glyphs.dart';

/// Every card in the app shares one hero tag, so the card flies between Home,
/// the picker and the confirmation screen.
const String kCardHeroTag = 'daily-wallet-card';

/// Landscape aspect ratio of a physical payment card.
const double kCardAspect = 1.586;

/// The gradient shell of a card: fill, sheen, rounded corners, shadow.
class CardFaceShell extends StatelessWidget {
  const CardFaceShell({
    super.key,
    required this.tier,
    required this.child,
    this.radius = 20,
    this.shadow = true,
  });

  final CardTier tier;
  final Widget child;
  final double radius;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: tier.gradient,
          stops: CardGradients.stops,
        ),
        boxShadow: shadow
            ? const <BoxShadow>[
                BoxShadow(color: Color(0x40000000), blurRadius: 30, offset: Offset(0, 16)),
              ]
            : null,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Stack(
          fit: StackFit.expand,
          children: <Widget>[
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topRight,
                    end: Alignment.bottomLeft,
                    colors: <Color>[Color(0x38FFFFFF), Color(0x0AFFFFFF), Color(0x1A000000)],
                    stops: <double>[0.0, 0.48, 1.0],
                  ),
                ),
              ),
            ),
            child,
          ],
        ),
      ),
    );
  }
}

/// The artwork printed on the card.
///
/// One landscape arrangement serves both presentations: contactless mark at
/// the top right, wordmark at the bottom left, VISA and the tier name at the
/// bottom right. The portrait card is this same frame turned a quarter turn
/// clockwise, which is what lets the hero flight interpolate the turn instead
/// of swapping one layout for another.
class CardContent extends StatelessWidget {
  const CardContent({super.key, required this.tier});

  final CardTier tier;

  /// Metal cards are printed in a dark ink, not white.
  static const Color _inkStrong = Color(0xEB2A2519);
  static const Color _inkSoft = Color(0xB32A2519);

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double w = constraints.maxWidth;
        // The full-bleed home card is the design baseline for type sizes.
        final double s = (w / 392).clamp(0.55, 1.35);

        return Padding(
          padding: EdgeInsets.fromLTRB(w * 0.066, w * 0.055, w * 0.066, w * 0.052),
          child: Stack(
            children: <Widget>[
              Align(
                alignment: Alignment.topRight,
                child: Transform.rotate(
                  angle: -40 * math.pi / 180,
                  child: ContactlessGlyph(size: 33 * s, color: _inkSoft),
                ),
              ),
              Align(
                alignment: Alignment.bottomLeft,
                child: Text(
                  'DailyWallet',
                  style: AppTheme.body(
                    13 * s,
                    color: _inkStrong,
                    weight: FontWeight.w600,
                    letterSpacing: -0.1,
                    height: 1,
                  ),
                ),
              ),
              Align(
                alignment: Alignment.bottomRight,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: <Widget>[
                    VisaMark(fontSize: 26 * s, color: _inkStrong),
                    SizedBox(height: 2 * s),
                    Text(
                      tier.name,
                      style: AppTheme.body(
                        10 * s,
                        color: _inkSoft,
                        weight: FontWeight.w500,
                        letterSpacing: 0.2,
                        height: 1,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// A card face that fills whatever box it is given.
///
/// When [rotated] is true the face is drawn a quarter turn clockwise so it
/// fills a portrait box: the wordmark then reads top-to-bottom down the left
/// edge with the VISA mark at the bottom-left.
class CreditCardWidget extends StatelessWidget {
  const CreditCardWidget({
    super.key,
    required this.tier,
    this.radius = 20,
    this.rotated = false,
    this.shadow = true,
  });

  final CardTier tier;
  final double radius;
  final bool rotated;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    if (!rotated) {
      return CardFaceShell(
        tier: tier,
        radius: radius,
        shadow: shadow,
        child: CardContent(tier: tier),
      );
    }
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double width = constraints.maxWidth;
        final double height = constraints.maxHeight;
        // The face is laid out landscape and turned a quarter turn, so it has
        // to escape the portrait box it is painted into.
        return Transform.rotate(
          angle: math.pi / 2,
          child: OverflowBox(
            minWidth: height,
            maxWidth: height,
            minHeight: width,
            maxHeight: width,
            child: CardFaceShell(
              tier: tier,
              radius: radius,
              shadow: shadow,
              child: CardContent(tier: tier),
            ),
          ),
        );
      },
    );
  }
}

/// The widget every card `Hero` wraps. The flight shuttle reads [turns] off it
/// to know how far the card has to rotate on the way.
class CardHeroChild extends StatelessWidget {
  const CardHeroChild({
    super.key,
    required this.tier,
    this.turns = 0.0,
    this.radius = 20,
  });

  final CardTier tier;

  /// `0.0` for the landscape card, `0.25` for the turned picker card.
  final double turns;

  final double radius;

  @override
  Widget build(BuildContext context) {
    return CreditCardWidget(tier: tier, radius: radius, rotated: turns != 0.0);
  }
}

/// Rotates the card as it flies between routes, counter-sizing the face so the
/// flight starts and ends exactly on the real widgets.
Widget cardHeroFlightShuttle(
  BuildContext flightContext,
  Animation<double> animation,
  HeroFlightDirection direction,
  BuildContext fromHeroContext,
  BuildContext toHeroContext,
) {
  final CardHeroChild from = (fromHeroContext.widget as Hero).child as CardHeroChild;
  final CardHeroChild to = (toHeroContext.widget as Hero).child as CardHeroChild;

  // Pop flights run their route animation backwards; normalise to 0 -> 1.
  final Animation<double> progress =
      direction == HeroFlightDirection.push ? animation : ReverseAnimation(animation);
  final Animation<double> eased =
      CurveTween(curve: Curves.easeInOutCubic).animate(progress);
  final Animation<double> turns =
      Tween<double>(begin: from.turns, end: to.turns).animate(eased);
  final Animation<double> radius =
      Tween<double>(begin: from.radius, end: to.radius).animate(eased);

  return RotationTransition(
    turns: turns,
    child: AnimatedBuilder(
      animation: eased,
      builder: (BuildContext context, Widget? child) {
        // 0 = the box is still landscape, 1 = the box has become portrait.
        final double portraitness = math.min(1.0, turns.value.abs() / 0.25);

        return LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            final double boxWidth = constraints.maxWidth;
            final double boxHeight = constraints.maxHeight;
            // Counter-size the face so the rotated card lands exactly on the
            // destination widget instead of popping at the end of the flight.
            final double faceWidth = lerpDouble(boxWidth, boxHeight, portraitness)!;
            final double faceHeight = lerpDouble(boxHeight, boxWidth, portraitness)!;

            return OverflowBox(
              minWidth: faceWidth,
              maxWidth: faceWidth,
              minHeight: faceHeight,
              maxHeight: faceHeight,
              child: CardFaceShell(
                tier: to.tier,
                radius: radius.value,
                child: CardContent(tier: to.tier),
              ),
            );
          },
        );
      },
    ),
  );
}

/// Convenience wrapper: a card wired up as the shared hero.
class CardHero extends StatelessWidget {
  const CardHero({
    super.key,
    required this.tier,
    this.turns = 0.0,
    this.radius = 20,
  });

  final CardTier tier;
  final double turns;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Hero(
      tag: kCardHeroTag,
      flightShuttleBuilder: cardHeroFlightShuttle,
      child: CardHeroChild(tier: tier, turns: turns, radius: radius),
    );
  }
}
