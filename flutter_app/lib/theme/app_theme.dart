import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// The DailyWallet palette. Every colour in the product comes from here.
class AppColors {
  const AppColors._();

  /// Primary text, black surfaces, buttons.
  static const Color ink = Color(0xFF0B0B0B);

  /// Home screen top section.
  static const Color bgDark = Color(0xFF000000);

  /// Light page background (warm off-white).
  static const Color bg = Color(0xFFF4F2F0);

  /// Cards, sheets.
  static const Color surface = Color(0xFFFFFFFF);

  /// Secondary text.
  static const Color muted = Color(0xFF9A9A9E);

  /// Dividers.
  static const Color hairline = Color(0xFFECEAE8);

  /// Credit amounts, success accent.
  static const Color green = Color(0xFF2BC96B);

  // --- Supporting tones -----------------------------------------------------

  /// Inline validation errors.
  static const Color danger = Color(0xFFD64545);

  /// Circular header buttons on the dark home section.
  static const Color darkChip = Color(0xFF202020);

  /// Inactive glyphs inside the floating navigation pill.
  static const Color navInactive = Color(0xFF8A8A8A);

  /// Inactive page-indicator dots.
  static const Color indicatorInactive = Color(0xFFD5D3D0);

  /// Translucent black used for ripples on light surfaces.
  static const Color ripple = Color(0x14000000);

  /// Soft shadow used under the floating pill and the cards.
  static const Color shadow = Color(0x1F000000);
}

/// Card face gradients, 135deg: top-left -> bottom-right.
class CardGradients {
  const CardGradients._();

  static const List<Color> platinum = <Color>[
    Color(0xFFD5D4CF),
    Color(0xFFB0AEA8),
    Color(0xFF8E8B85),
  ];

  static const List<Color> silver = <Color>[
    Color(0xFFC9C7C0),
    Color(0xFFA7A59D),
    Color(0xFF827E78),
  ];

  static const List<Color> gold = <Color>[
    Color(0xFFD8C89C),
    Color(0xFFC0AA79),
    Color(0xFF9A8863),
  ];

  static const List<double> stops = <double>[0.0, 0.55, 1.0];
}

class AppTheme {
  const AppTheme._();

  static ThemeData get light {
    final ThemeData base = ThemeData.light(useMaterial3: true);
    final TextTheme text = GoogleFonts.poppinsTextTheme(base.textTheme).apply(
      bodyColor: AppColors.ink,
      displayColor: AppColors.ink,
    );

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.bg,
      canvasColor: AppColors.bg,
      textTheme: text,
      primaryTextTheme: text,
      splashColor: AppColors.ripple,
      highlightColor: Colors.transparent,
      colorScheme: const ColorScheme.light(
        primary: AppColors.ink,
        onPrimary: Colors.white,
        secondary: AppColors.ink,
        onSecondary: Colors.white,
        surface: AppColors.surface,
        onSurface: AppColors.ink,
        error: AppColors.danger,
        onError: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        foregroundColor: AppColors.ink,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.hairline,
        thickness: 1,
        space: 1,
      ),
    );
  }

  /// Display / headline style used by the big titles across the product.
  static TextStyle headline(double size, {Color color = AppColors.ink, double letterSpacing = -0.8}) {
    return GoogleFonts.poppins(
      fontSize: size,
      fontWeight: FontWeight.w600,
      color: color,
      letterSpacing: letterSpacing,
      height: 1.15,
    );
  }

  static TextStyle body(
    double size, {
    Color color = AppColors.ink,
    FontWeight weight = FontWeight.w400,
    double letterSpacing = 0,
    double height = 1.3,
  }) {
    return GoogleFonts.poppins(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
    );
  }
}
