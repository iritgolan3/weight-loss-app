import 'package:flutter/material.dart';

import '../models/txn.dart';
import '../theme/app_theme.dart';
import '../utils/formatters.dart';
import 'glyphs.dart';

/// One 68px ledger row: glyph circle, title over time, amount.
class TxnRow extends StatelessWidget {
  const TxnRow({super.key, required this.txn, this.onTap});

  static const double height = 68;
  static const double glyphSize = 44;

  /// Dividers start after the glyph circle.
  static const double dividerInset = glyphSize + 14;

  final Txn txn;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        height: height,
        child: Row(
          children: <Widget>[
            Container(
              width: glyphSize,
              height: glyphSize,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.surface,
                border: Border.all(color: AppColors.hairline),
              ),
              child: Center(child: TxnGlyph(type: txn.type)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    txn.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTheme.body(15, weight: FontWeight.w500, height: 1.2),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    txn.time,
                    style: AppTheme.body(12, color: AppColors.muted, height: 1.2),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              formatTxnAmount(txn.amount),
              style: AppTheme.body(
                15,
                color: txn.isCredit ? AppColors.green : AppColors.ink,
                weight: FontWeight.w600,
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The hairline between two ledger rows, inset past the glyph circle.
class TxnDivider extends StatelessWidget {
  const TxnDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(left: TxnRow.dividerInset),
      child: SizedBox(
        height: 1,
        child: ColoredBox(color: AppColors.hairline),
      ),
    );
  }
}
