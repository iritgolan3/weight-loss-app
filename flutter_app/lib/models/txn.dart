import 'package:flutter/foundation.dart';

/// The three kinds of movement that can appear in the ledger.
enum TxnType { transfer, topup, conversion }

TxnType txnTypeFromName(String name) {
  for (final TxnType type in TxnType.values) {
    if (type.name == name) return type;
  }
  return TxnType.transfer;
}

@immutable
class Txn {
  const Txn({
    required this.id,
    required this.title,
    required this.time,
    required this.amount,
    required this.type,
  });

  final String id;

  /// `Transfer`, `Top up`, `Conversion`, ...
  final String title;

  /// Pre-formatted clock time, e.g. `4:07pm`.
  final String time;

  /// Signed: negative is a debit, positive is a credit.
  final double amount;

  final TxnType type;

  bool get isCredit => amount > 0;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'title': title,
        'time': time,
        'amount': amount,
        'type': type.name,
      };

  factory Txn.fromJson(Map<String, dynamic> json) => Txn(
        id: json['id'] as String,
        title: json['title'] as String,
        time: json['time'] as String,
        amount: (json['amount'] as num).toDouble(),
        type: txnTypeFromName(json['type'] as String),
      );

  /// The ledger the app ships with.
  static const List<Txn> seed = <Txn>[
    Txn(id: 't1', title: 'Transfer', time: '4:07pm', amount: -1050.00, type: TxnType.transfer),
    Txn(id: 't2', title: 'Top up', time: '12:07pm', amount: 2400.00, type: TxnType.topup),
    Txn(id: 't3', title: 'Conversion', time: '4:07pm', amount: -950.00, type: TxnType.conversion),
    Txn(id: 't4', title: 'Transfer', time: '4:07pm', amount: -1050.00, type: TxnType.transfer),
    Txn(id: 't5', title: 'Top up', time: '9:15am', amount: 1200.00, type: TxnType.topup),
    Txn(id: 't6', title: 'Conversion', time: '2:41pm', amount: -470.00, type: TxnType.conversion),
  ];
}
