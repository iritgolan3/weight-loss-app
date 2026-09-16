import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// A single round key with an ink ripple.
class KeypadKey extends StatelessWidget {
  const KeypadKey({
    super.key,
    required this.child,
    this.onTap,
    this.size = 74,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        customBorder: const CircleBorder(),
        splashColor: AppColors.ripple,
        highlightColor: const Color(0x0D000000),
        onTap: onTap,
        child: SizedBox(
          width: size,
          height: size,
          child: Center(child: child),
        ),
      ),
    );
  }
}

/// The 3 x 4 keypad: 1-9, then [leading] / 0 / backspace.
class NumericKeypad extends StatelessWidget {
  const NumericKeypad({
    super.key,
    required this.onDigit,
    required this.onBackspace,
    this.leading,
    this.keySize = 74,
    this.digitSize = 26,
    this.foreground = AppColors.ink,
    this.rowSpacing = 4,
  });

  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;

  /// Bottom-left key: the biometric button on the passcode screen, the decimal
  /// point on the amount sheets.
  final Widget? leading;

  final double keySize;
  final double digitSize;
  final Color foreground;
  final double rowSpacing;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        _row(<String>['1', '2', '3']),
        SizedBox(height: rowSpacing),
        _row(<String>['4', '5', '6']),
        SizedBox(height: rowSpacing),
        _row(<String>['7', '8', '9']),
        SizedBox(height: rowSpacing),
        Row(
          children: <Widget>[
            Expanded(
              child: Center(
                child: leading ?? SizedBox(width: keySize, height: keySize),
              ),
            ),
            Expanded(child: Center(child: _digit('0'))),
            Expanded(
              child: Center(
                child: KeypadKey(
                  size: keySize,
                  onTap: onBackspace,
                  child: Icon(Icons.backspace_outlined, size: 22, color: foreground),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _row(List<String> digits) {
    return Row(
      children: <Widget>[
        for (final String digit in digits) Expanded(child: Center(child: _digit(digit))),
      ],
    );
  }

  Widget _digit(String digit) {
    return KeypadKey(
      size: keySize,
      onTap: () => onDigit(digit),
      child: Text(
        digit,
        style: AppTheme.body(
          digitSize,
          color: foreground,
          weight: FontWeight.w500,
          height: 1,
          letterSpacing: -0.5,
        ),
      ),
    );
  }
}
