import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// One of the three metal cards DailyWallet sells.
@immutable
class CardTier {
  const CardTier({
    required this.id,
    required this.name,
    required this.pricePerYear,
    required this.gradient,
    required this.subtitle,
  });

  final String id;
  final String name;
  final int pricePerYear;
  final List<Color> gradient;
  final String subtitle;

  /// `$349`
  String get priceLabel => '\$$pricePerYear';

  /// `$349.00`
  String get priceWithCents => '\$${pricePerYear.toStringAsFixed(2)}';

  double get price => pricePerYear.toDouble();

  static const CardTier platinum = CardTier(
    id: 'platinum',
    name: 'Platinum',
    pricePerYear: 199,
    gradient: CardGradients.platinum,
    subtitle: 'Platinum metal',
  );

  static const CardTier silver = CardTier(
    id: 'silver',
    name: 'Silver',
    pricePerYear: 99,
    gradient: CardGradients.silver,
    subtitle: 'Silver metal',
  );

  static const CardTier gold = CardTier(
    id: 'gold',
    name: 'Gold',
    pricePerYear: 349,
    gradient: CardGradients.gold,
    subtitle: 'Gold metal',
  );

  /// Carousel order.
  static const List<CardTier> all = <CardTier>[platinum, silver, gold];

  static CardTier? byId(String? id) {
    if (id == null) return null;
    for (final CardTier tier in all) {
      if (tier.id == id) return tier;
    }
    return null;
  }

  static int indexOf(CardTier tier) {
    for (int i = 0; i < all.length; i++) {
      if (all[i].id == tier.id) return i;
    }
    return 0;
  }

  @override
  bool operator ==(Object other) => other is CardTier && other.id == id;

  @override
  int get hashCode => id.hashCode;
}
