import 'dart:math' as math;
import 'dart:ui' show PathMetric, lerpDouble;

import 'package:flutter/material.dart';

import '../models/card_tier.dart';
import '../theme/app_theme.dart';
import 'credit_card_widget.dart';

/// The card-terminal illustration on the "Order placed" screen.
///
/// Everything is drawn with widgets and `CustomPaint`; there are no image
/// assets. The four animations run in sequence: the terminal scales up with a
/// slight overshoot, the card slides down into the slot, a green tick strokes
/// itself on, then the receipt slides out from behind the top.
class PosTerminalScene extends StatelessWidget {
  const PosTerminalScene({
    super.key,
    required this.tier,
    required this.terminal,
    required this.card,
    required this.tick,
    required this.receipt,
  });

  /// The card being inserted.
  final CardTier tier;

  /// 0 -> 1, already curved with an overshoot.
  final Animation<double> terminal;

  /// 0 -> 1 slide into the slot.
  final Animation<double> card;

  /// 0 -> 1 stroke-on of the tick.
  final Animation<double> tick;

  /// 0 -> 1 slide of the receipt.
  final Animation<double> receipt;

  static const double aspect = 240 / 340;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: aspect,
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) {
          final double w = constraints.maxWidth;
          final double h = constraints.maxHeight;
          final double cardWidth = w * 0.55;
          final double cardHeight = cardWidth / kCardAspect;

          return AnimatedBuilder(
            animation: Listenable.merge(<Listenable>[terminal, card, tick, receipt]),
            builder: (BuildContext context, Widget? _) {
              final double scale = lerpDouble(0.8, 1.0, terminal.value)!;
              final double cardTop = lerpDouble(-0.02 * h, 0.355 * h, card.value)!;
              final double receiptTop = lerpDouble(0.30 * h, 0.035 * h, receipt.value)!;
              final double tickSize = w * 0.20;

              return Opacity(
                opacity: terminal.value.clamp(0.0, 1.0).toDouble(),
                child: Transform.scale(
                  scale: scale,
                  child: Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.identity()
                      ..setEntry(3, 2, 0.0012)
                      ..rotateX(0.10)
                      ..rotateZ(-0.03),
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: <Widget>[
                        // Receipt, behind everything.
                        Positioned(
                          left: w * 0.21,
                          top: receiptTop,
                          width: w * 0.58,
                          height: h * 0.34,
                          child: Opacity(
                            opacity: receipt.value == 0 ? 0.0 : 1.0,
                            child: Transform.rotate(
                              angle: -0.035,
                              child: const CustomPaint(painter: _ReceiptPainter()),
                            ),
                          ),
                        ),
                        // The card being inserted, behind the terminal shell.
                        Positioned(
                          left: (w - cardWidth) / 2,
                          top: cardTop,
                          width: cardWidth,
                          height: cardHeight,
                          child: CreditCardWidget(tier: tier, radius: 8, shadow: false),
                        ),
                        // The terminal itself.
                        Positioned.fill(
                          child: CustomPaint(
                            painter: _TerminalPainter(tickProgress: tick.value),
                          ),
                        ),
                        // The tick, stroked onto the terminal screen.
                        Positioned(
                          left: (w - tickSize) / 2,
                          top: h * 0.615 - tickSize / 2,
                          width: tickSize,
                          height: tickSize,
                          child: CustomPaint(painter: _TickPainter(progress: tick.value)),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _TerminalPainter extends CustomPainter {
  const _TerminalPainter({required this.tickProgress});

  final double tickProgress;

  @override
  void paint(Canvas canvas, Size size) {
    final double w = size.width;
    final double h = size.height;

    RRect rr(double l, double t, double r, double b, double radius) {
      return RRect.fromRectAndRadius(
        Rect.fromLTRB(l * w, t * h, r * w, b * h),
        Radius.circular(radius),
      );
    }

    // Ground shadow.
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(w * 0.5, h * 0.965),
        width: w * 0.74,
        height: h * 0.045,
      ),
      Paint()
        ..color = const Color(0x1A000000)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
    );

    // Head: the raised plate that holds the card slot.
    canvas.drawRRect(
      rr(0.108, 0.353, 0.892, 0.506, w * 0.058),
      Paint()..color = const Color(0xFF1A1A1A),
    );

    // Card slot.
    canvas.drawRRect(
      rr(0.216, 0.374, 0.784, 0.400, w * 0.014),
      Paint()..color = const Color(0xFF000000),
    );
    canvas.drawRRect(
      rr(0.216, 0.374, 0.784, 0.400, w * 0.014),
      Paint()
        ..color = const Color(0xFF3D3D3D)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );

    // Body.
    canvas.drawRRect(
      rr(0.142, 0.482, 0.858, 0.95, w * 0.108),
      Paint()..color = AppColors.ink,
    );

    // A soft isometric highlight down the left cheek of the body.
    canvas.drawRRect(
      rr(0.142, 0.482, 0.30, 0.95, w * 0.108),
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: <Color>[Color(0x1FFFFFFF), Color(0x00FFFFFF)],
        ).createShader(Rect.fromLTRB(0.142 * w, 0.482 * h, 0.30 * w, 0.95 * h)),
    );

    // Screen.
    canvas.drawRRect(
      rr(0.242, 0.541, 0.758, 0.690, w * 0.042),
      Paint()..color = Colors.white,
    );

    // Screen text lines, which fade away as the tick strokes on.
    final double lineAlpha = (1 - tickProgress).clamp(0.0, 1.0).toDouble();
    if (lineAlpha > 0.01) {
      final Paint line = Paint()
        ..color = Color.fromRGBO(213, 211, 208, lineAlpha)
        ..style = PaintingStyle.stroke
        ..strokeWidth = h * 0.014
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(Offset(w * 0.30, h * 0.592), Offset(w * 0.60, h * 0.592), line);
      canvas.drawLine(Offset(w * 0.30, h * 0.638), Offset(w * 0.50, h * 0.638), line);
    }

    // Keypad.
    const double keyW = 0.117;
    const double keyH = 0.040;
    const double gapX = 0.050;
    const double gapY = 0.022;
    const double startX = 0.2745;
    const double startY = 0.715;
    final Paint key = Paint()..color = AppColors.bg;
    for (int row = 0; row < 4; row++) {
      for (int col = 0; col < 3; col++) {
        final double left = startX + col * (keyW + gapX);
        final double top = startY + row * (keyH + gapY);
        canvas.drawRRect(
          rr(left, top, left + keyW, top + keyH, w * 0.022),
          key,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _TerminalPainter oldDelegate) =>
      oldDelegate.tickProgress != tickProgress;
}

class _ReceiptPainter extends CustomPainter {
  const _ReceiptPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final double w = size.width;
    final double h = size.height;

    final Path paper = Path()..moveTo(0, h);
    // Torn top edge.
    const int teeth = 7;
    final double step = w / teeth;
    paper.lineTo(0, h * 0.06);
    for (int i = 0; i < teeth; i++) {
      paper.lineTo(step * (i + 0.5), i.isEven ? 0 : h * 0.045);
      paper.lineTo(step * (i + 1), i.isEven ? h * 0.045 : 0);
    }
    paper.lineTo(w, h);
    paper.close();

    canvas.drawPath(
      paper,
      Paint()
        ..color = const Color(0x1A000000)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
    );
    canvas.drawPath(paper, Paint()..color = Colors.white);
    canvas.drawPath(
      paper,
      Paint()
        ..color = AppColors.hairline
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );

    final Paint line = Paint()
      ..color = const Color(0xFFD5D3D0)
      ..style = PaintingStyle.stroke
      ..strokeWidth = h * 0.028
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(w * 0.16, h * 0.26), Offset(w * 0.84, h * 0.26), line);
    canvas.drawLine(Offset(w * 0.16, h * 0.42), Offset(w * 0.62, h * 0.42), line);
    canvas.drawLine(Offset(w * 0.16, h * 0.58), Offset(w * 0.74, h * 0.58), line);

    canvas.drawLine(
      Offset(w * 0.16, h * 0.76),
      Offset(w * 0.52, h * 0.76),
      Paint()
        ..color = AppColors.green
        ..style = PaintingStyle.stroke
        ..strokeWidth = h * 0.034
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant _ReceiptPainter oldDelegate) => false;
}

class _TickPainter extends CustomPainter {
  const _TickPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) return;
    final double s = math.min(size.width, size.height);

    final Path tick = Path()
      ..moveTo(s * 0.20, s * 0.52)
      ..lineTo(s * 0.42, s * 0.74)
      ..lineTo(s * 0.82, s * 0.28);

    final Paint paint = Paint()
      ..color = AppColors.green
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.11
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final Path drawn = Path();
    for (final PathMetric metric in tick.computeMetrics()) {
      drawn.addPath(
        metric.extractPath(0, metric.length * progress.clamp(0.0, 1.0)),
        Offset.zero,
      );
    }
    canvas.drawPath(drawn, paint);
  }

  @override
  bool shouldRepaint(covariant _TickPainter oldDelegate) => oldDelegate.progress != progress;
}
