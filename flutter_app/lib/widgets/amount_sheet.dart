import 'package:flutter/material.dart';

import '../services/app_scope.dart';
import '../services/wallet_service.dart';
import '../theme/app_theme.dart';
import '../utils/formatters.dart';
import 'numeric_keypad.dart';
import 'primary_button.dart';

enum AmountSheetMode { transfer, topUp }

/// Modal amount pad. Commits a real transaction to the wallet.
Future<bool?> showAmountSheet(BuildContext context, {required AmountSheetMode mode}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppColors.surface,
    barrierColor: const Color(0x73000000),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (BuildContext sheetContext) => AmountSheet(mode: mode),
  );
}

class AmountSheet extends StatefulWidget {
  const AmountSheet({super.key, required this.mode});

  final AmountSheetMode mode;

  @override
  State<AmountSheet> createState() => _AmountSheetState();
}

class _AmountSheetState extends State<AmountSheet> {
  String _input = '';
  String? _error;
  bool _busy = false;

  bool get _isTransfer => widget.mode == AmountSheetMode.transfer;

  String get _title => _isTransfer ? 'Transfer' : 'Top up';

  String get _action => _isTransfer ? 'Send money' : 'Add money';

  double get _amount => double.tryParse(_input.isEmpty ? '0' : _input) ?? 0;

  void _onDigit(String digit) {
    setState(() {
      _error = null;
      if (digit == '.') {
        if (_input.contains('.')) return;
        _input = _input.isEmpty ? '0.' : '$_input.';
        return;
      }
      if (_input.contains('.') && _input.split('.').last.length >= 2) return;
      if (_input.replaceAll('.', '').length >= 9) return;
      if (_input == '0') {
        _input = digit;
      } else {
        _input = '$_input$digit';
      }
    });
  }

  void _onBackspace() {
    setState(() {
      _error = null;
      if (_input.isNotEmpty) {
        _input = _input.substring(0, _input.length - 1);
      }
    });
  }

  Future<void> _commit(WalletService wallet) async {
    final double amount = _amount;
    if (amount <= 0) {
      setState(() => _error = 'Enter an amount first.');
      return;
    }
    if (_isTransfer && amount > wallet.balance) {
      setState(() => _error = 'That is more than your available balance.');
      return;
    }
    setState(() => _busy = true);
    if (_isTransfer) {
      await wallet.transfer(amount);
    } else {
      await wallet.topUp(amount);
    }
    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final WalletService wallet = AppScope.walletOf(context);

    return ListenableBuilder(
      listenable: wallet,
      builder: (BuildContext context, Widget? child) {
        return SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.hairline,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Text(_title, style: AppTheme.headline(24)),
                const SizedBox(height: 4),
                Text(
                  'Available ${formatBalance(wallet.balance)}',
                  style: AppTheme.body(13, color: AppColors.muted),
                ),
                const SizedBox(height: 22),
                Center(
                  child: Text(
                    '\$${_input.isEmpty ? '0' : _input}',
                    maxLines: 1,
                    style: AppTheme.headline(
                      42,
                      color: _input.isEmpty ? AppColors.muted : AppColors.ink,
                      letterSpacing: -1.5,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 22,
                  child: Center(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 200),
                      child: _error == null
                          ? const SizedBox.shrink()
                          : Text(
                              _error!,
                              key: ValueKey<String>(_error!),
                              style: AppTheme.body(
                                12.5,
                                color: AppColors.danger,
                                weight: FontWeight.w500,
                              ),
                            ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                NumericKeypad(
                  keySize: 66,
                  digitSize: 24,
                  onDigit: _onDigit,
                  onBackspace: _onBackspace,
                  leading: KeypadKey(
                    size: 66,
                    onTap: () => _onDigit('.'),
                    child: Text(
                      '.',
                      style: AppTheme.body(26, weight: FontWeight.w600, height: 1),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                PrimaryButton(
                  label: _action,
                  enabled: !_busy,
                  onPressed: _busy ? null : () => _commit(wallet),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
