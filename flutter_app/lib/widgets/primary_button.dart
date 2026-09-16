import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// The full-width black pill used at the bottom of nearly every screen:
/// 56px tall, 28px radius, white label.
class PrimaryButton extends StatefulWidget {
  const PrimaryButton({
    super.key,
    this.label,
    this.child,
    this.onPressed,
    this.height = 56,
    this.background = AppColors.ink,
    this.foreground = Colors.white,
    this.enabled = true,
  }) : assert(label != null || child != null, 'Give the button a label or a child.');

  final String? label;
  final Widget? child;
  final VoidCallback? onPressed;
  final double height;
  final Color background;
  final Color foreground;
  final bool enabled;

  @override
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton> {
  bool _down = false;

  bool get _active => widget.enabled && widget.onPressed != null;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: _active ? (TapDownDetails _) => setState(() => _down = true) : null,
      onTapCancel: _active ? () => setState(() => _down = false) : null,
      onTapUp: _active
          ? (TapUpDetails _) {
              setState(() => _down = false);
              widget.onPressed!.call();
            }
          : null,
      child: AnimatedScale(
        scale: _down ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 140),
        curve: Curves.easeOutCubic,
        child: AnimatedOpacity(
          opacity: _active ? 1 : 0.45,
          duration: const Duration(milliseconds: 180),
          child: Container(
            height: widget.height,
            width: double.infinity,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: widget.background,
              borderRadius: BorderRadius.circular(widget.height / 2),
              boxShadow: const <BoxShadow>[
                BoxShadow(color: Color(0x1A000000), blurRadius: 18, offset: Offset(0, 8)),
              ],
            ),
            child: widget.child ??
                Text(
                  widget.label!,
                  style: AppTheme.body(
                    16,
                    color: widget.foreground,
                    weight: FontWeight.w600,
                    letterSpacing: -0.2,
                    height: 1,
                  ),
                ),
          ),
        ),
      ),
    );
  }
}

/// The plain back chevron used at the top-left of the inner screens.
class BackChevron extends StatelessWidget {
  const BackChevron({super.key, this.onTap, this.color = AppColors.ink});

  final VoidCallback? onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap ?? () => Navigator.of(context).maybePop(),
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(Icons.arrow_back_ios_new, size: 18, color: color),
        ),
      ),
    );
  }
}
