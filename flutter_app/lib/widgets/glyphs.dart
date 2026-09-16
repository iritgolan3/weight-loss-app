import 'package:flutter/material.dart';

import '../models/txn.dart';
import '../theme/app_theme.dart';

/// Line glyph used inside the 44px circle on every transaction row.
///
/// * [TxnType.transfer] - an arrow pointing up and to the right.
/// * [TxnType.topup] - a plus.
/// * [TxnType.conversion] - two horizontal arrows pointing opposite ways.
class TxnGlyph extends StatelessWidget {
  const TxnGlyph({
    super.key,
    required this.type,
    this.size = 18,
    this.color = AppColors.ink,
    this.strokeWidth = 1.6,
  });

  final TxnType type;
  final double size;
  final Color color;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _TxnGlyphPainter(type: type, color: color, strokeWidth: strokeWidth),
      ),
    );
  }
}

class _TxnGlyphPainter extends CustomPainter {
  const _TxnGlyphPainter({
    required this.type,
    required this.color,
    required this.strokeWidth,
  });

  final TxnType type;
  final Color color;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    Offset p(double x, double y) => Offset(x * size.width, y * size.height);

    switch (type) {
      case TxnType.transfer:
        canvas.drawLine(p(0.26, 0.74), p(0.74, 0.26), paint);
        final Path head = Path()
          ..moveTo(p(0.42, 0.26).dx, p(0.42, 0.26).dy)
          ..lineTo(p(0.74, 0.26).dx, p(0.74, 0.26).dy)
          ..lineTo(p(0.74, 0.58).dx, p(0.74, 0.58).dy);
        canvas.drawPath(head, paint);
        break;
      case TxnType.topup:
        canvas.drawLine(p(0.5, 0.24), p(0.5, 0.76), paint);
        canvas.drawLine(p(0.24, 0.5), p(0.76, 0.5), paint);
        break;
      case TxnType.conversion:
        // Top arrow, pointing right.
        canvas.drawLine(p(0.22, 0.36), p(0.76, 0.36), paint);
        final Path right = Path()
          ..moveTo(p(0.62, 0.24).dx, p(0.62, 0.24).dy)
          ..lineTo(p(0.78, 0.36).dx, p(0.78, 0.36).dy)
          ..lineTo(p(0.62, 0.48).dx, p(0.62, 0.48).dy);
        canvas.drawPath(right, paint);
        // Bottom arrow, pointing left.
        canvas.drawLine(p(0.78, 0.64), p(0.24, 0.64), paint);
        final Path left = Path()
          ..moveTo(p(0.38, 0.52).dx, p(0.38, 0.52).dy)
          ..lineTo(p(0.22, 0.64).dx, p(0.22, 0.64).dy)
          ..lineTo(p(0.38, 0.76).dx, p(0.38, 0.76).dy);
        canvas.drawPath(left, paint);
        break;
    }
  }

  @override
  bool shouldRepaint(covariant _TxnGlyphPainter oldDelegate) =>
      oldDelegate.type != type ||
      oldDelegate.color != color ||
      oldDelegate.strokeWidth != strokeWidth;
}

class VisaMark extends StatelessWidget {
  const VisaMark({super.key, this.fontSize = 16, this.color = Colors.white});

  final double fontSize;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Text(
      'VISA',
      style: AppTheme.body(
        fontSize,
        color: color,
        weight: FontWeight.w700,
        letterSpacing: 1.6,
        height: 1,
      ).copyWith(fontStyle: FontStyle.italic),
    );
  }
}
