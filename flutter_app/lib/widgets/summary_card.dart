import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// One label / value line inside a [SummaryCard].
class SummaryRowTile extends StatelessWidget {
  const SummaryRowTile({
    super.key,
    required this.label,
    required this.value,
    this.emphasiseLabel = false,
  });

  final String label;
  final String value;

  /// `Total today` prints its label in ink rather than muted.
  final bool emphasiseLabel;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 58,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18),
        child: Row(
          children: <Widget>[
            Text(
              label,
              style: AppTheme.body(
                14,
                color: emphasiseLabel ? AppColors.ink : AppColors.muted,
                weight: emphasiseLabel ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
            const Spacer(),
            Text(
              value,
              style: AppTheme.body(14.5, weight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}

/// White card, 20px radius, rows separated by hairlines.
class SummaryCard extends StatelessWidget {
  const SummaryCard({super.key, required this.rows, this.autoDividers = true});

  final List<Widget> rows;

  /// When false the caller supplies its own dividers, so each row can animate
  /// in together with the hairline above it.
  final bool autoDividers;

  @override
  Widget build(BuildContext context) {
    final List<Widget> children = <Widget>[];
    for (int i = 0; i < rows.length; i++) {
      if (i > 0 && autoDividers) {
        children.add(
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 18),
            child: SizedBox(height: 1, child: ColoredBox(color: AppColors.hairline)),
          ),
        );
      }
      children.add(rows[i]);
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const <BoxShadow>[
          BoxShadow(color: Color(0x0D000000), blurRadius: 20, offset: Offset(0, 8)),
        ],
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: children),
    );
  }
}
