import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/card_tier.dart';
import '../models/txn.dart';
import '../utils/formatters.dart';

/// Balance, ledger and owned card. Persisted with `shared_preferences`.
class WalletService extends ChangeNotifier {
  static const String _balanceKey = 'dw_balance';
  static const String _txnsKey = 'dw_txns';
  static const String _cardKey = 'dw_card';

  static const double startingBalance = 22000;

  double _balance = startingBalance;
  List<Txn> _transactions = List<Txn>.of(Txn.seed);
  String? _ownedCardId;
  bool _loaded = false;

  bool get isLoaded => _loaded;

  double get balance => _balance;

  List<Txn> get transactions => List<Txn>.unmodifiable(_transactions);

  CardTier? get ownedCard => CardTier.byId(_ownedCardId);

  /// The card shown on the home screen: the owned one, or Platinum by default.
  CardTier get activeCard => ownedCard ?? CardTier.platinum;

  Future<void> load() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    _balance = prefs.getDouble(_balanceKey) ?? startingBalance;
    _ownedCardId = prefs.getString(_cardKey);
    final String? raw = prefs.getString(_txnsKey);
    if (raw != null && raw.isNotEmpty) {
      final List<dynamic> decoded = jsonDecode(raw) as List<dynamic>;
      _transactions = decoded
          .map((dynamic item) => Txn.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(growable: true);
    } else {
      _transactions = List<Txn>.of(Txn.seed);
    }
    _loaded = true;
    notifyListeners();
  }

  Future<void> transfer(double amount) async {
    if (amount <= 0) return;
    _balance -= amount;
    _add(title: 'Transfer', amount: -amount, type: TxnType.transfer);
    await _persist();
  }

  Future<void> topUp(double amount) async {
    if (amount <= 0) return;
    _balance += amount;
    _add(title: 'Top up', amount: amount, type: TxnType.topup);
    await _persist();
  }

  /// Charges the annual fee and records the card as owned.
  Future<void> purchaseCard(CardTier tier) async {
    _ownedCardId = tier.id;
    _balance -= tier.price;
    _add(title: '${tier.name} card', amount: -tier.price, type: TxnType.transfer);
    await _persist();
  }

  /// Wipes the wallet back to its seeded state (used when signing out).
  Future<void> reset() async {
    _balance = startingBalance;
    _transactions = List<Txn>.of(Txn.seed);
    _ownedCardId = null;
    await _persist();
    notifyListeners();
  }

  void _add({required String title, required double amount, required TxnType type}) {
    _transactions.insert(
      0,
      Txn(
        id: 'tx-${DateTime.now().microsecondsSinceEpoch}',
        title: title,
        time: formatClock(DateTime.now()),
        amount: amount,
        type: type,
      ),
    );
    notifyListeners();
  }

  Future<void> _persist() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_balanceKey, _balance);
    await prefs.setString(
      _txnsKey,
      jsonEncode(_transactions.map((Txn txn) => txn.toJson()).toList()),
    );
    if (_ownedCardId == null) {
      await prefs.remove(_cardKey);
    } else {
      await prefs.setString(_cardKey, _ownedCardId!);
    }
  }
}
