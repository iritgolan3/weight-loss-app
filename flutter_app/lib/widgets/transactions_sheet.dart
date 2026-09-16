import 'package:flutter/material.dart';

import '../models/txn.dart';
import '../services/app_scope.dart';
import '../services/wallet_service.dart';
import '../theme/app_theme.dart';
import 'txn_row.dart';

/// The full ledger, opened from "See all" on the home screen.
Future<void> showTransactionsSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppColors.surface,
    barrierColor: const Color(0x73000000),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (BuildContext sheetContext) => const TransactionsSheet(),
  );
}

class TransactionsSheet extends StatelessWidget {
  const TransactionsSheet({super.key});

  @override
  Widget build(BuildContext context) {
    final WalletService wallet = AppScope.walletOf(context);

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.94,
      builder: (BuildContext context, ScrollController controller) {
        return ListenableBuilder(
          listenable: wallet,
          builder: (BuildContext context, Widget? child) {
            final List<Txn> items = wallet.transactions;
            return Column(
              children: <Widget>[
                const SizedBox(height: 12),
                Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.hairline,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 20),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Row(
                    children: <Widget>[
                      Text('All transactions', style: AppTheme.headline(22)),
                      const Spacer(),
                      Text(
                        '${items.length}',
                        style: AppTheme.body(14, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: ListView.separated(
                    controller: controller,
                    padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
                    itemCount: items.length,
                    separatorBuilder: (BuildContext context, int index) => const TxnDivider(),
                    itemBuilder: (BuildContext context, int index) => TxnRow(txn: items[index]),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
