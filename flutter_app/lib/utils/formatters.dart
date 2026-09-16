/// Money / clock formatting helpers. Deliberately dependency free so the app
/// does not need `intl`.

String _group(String digits) {
  final StringBuffer buffer = StringBuffer();
  for (int i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) {
      buffer.write(',');
    }
    buffer.write(digits[i]);
  }
  return buffer.toString();
}

/// `1050.0` -> `$1,050.00`. Always unsigned.
String formatMoney(double value) {
  final String fixed = value.abs().toStringAsFixed(2);
  final int dot = fixed.indexOf('.');
  return '\$${_group(fixed.substring(0, dot))}${fixed.substring(dot)}';
}

/// Debits render bare (`$1,050.00`), credits render with a plus
/// (`+$2,400.00`).
String formatTxnAmount(double value) {
  final String money = formatMoney(value);
  return value > 0 ? '+$money' : money;
}

/// `22000.0` -> `$22,000`, `21651.5` -> `$21,651.50`.
String formatBalance(double value) {
  if (value == value.roundToDouble()) {
    return '\$${_group(value.abs().toStringAsFixed(0))}';
  }
  return formatMoney(value);
}

/// `DateTime(.., 16, 7)` -> `4:07pm`.
String formatClock(DateTime time) {
  final int hour24 = time.hour;
  final int hour = hour24 % 12 == 0 ? 12 : hour24 % 12;
  final String minute = time.minute.toString().padLeft(2, '0');
  final String suffix = hour24 < 12 ? 'am' : 'pm';
  return '$hour:$minute$suffix';
}
