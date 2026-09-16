import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/txn.dart';
import '../services/app_scope.dart';
import '../services/wallet_service.dart';
import '../theme/app_theme.dart';
import '../utils/formatters.dart';
import '../utils/transitions.dart';
import '../widgets/amount_sheet.dart';
import '../widgets/bottom_nav_pill.dart';
import '../widgets/credit_card_widget.dart';
import '../widgets/transactions_sheet.dart';
import '../widgets/txn_row.dart';
import 'card_picker_screen.dart';
import 'profile_screen.dart';

/// The signature screen: black top section with the balance and the card, a
/// white sheet pulled up over it, and the floating navigation pill.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _search = TextEditingController();
  final FocusNode _searchFocus = FocusNode();

  int _navIndex = 0;
  bool _searching = false;
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _toggleSearch() {
    setState(() {
      _searching = !_searching;
      if (!_searching) {
        _search.clear();
        _query = '';
      }
    });
    if (_searching) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _searchFocus.requestFocus());
    }
  }

  Future<void> _openPicker() async {
    await Navigator.of(context).push<void>(
      fadeThroughRoute<void>(const CardPickerScreen()),
    );
  }

  Future<void> _onNavTap(int index) async {
    setState(() => _navIndex = index);
    switch (index) {
      case 1:
        await showAmountSheet(context, mode: AmountSheetMode.transfer);
        break;
      case 2:
        await _openPicker();
        break;
      case 3:
        await Navigator.of(context).push<void>(slideUpRoute<void>(const ProfileScreen()));
        break;
      default:
        break;
    }
    if (!mounted) return;
    setState(() => _navIndex = 0);
  }

  @override
  Widget build(BuildContext context) {
    final WalletService wallet = AppScope.walletOf(context);
    final EdgeInsets viewPadding = MediaQuery.of(context).padding;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: AppColors.surface,
      ),
      child: Scaffold(
        backgroundColor: AppColors.bgDark,
        body: ListenableBuilder(
          listenable: wallet,
          builder: (BuildContext context, Widget? child) {
            return Stack(
              children: <Widget>[
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Padding(
                      padding: EdgeInsets.fromLTRB(24, viewPadding.top + 10, 24, 46),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          _header(),
                          const SizedBox(height: 28),
                          Text(
                            'Available balance',
                            style: AppTheme.body(13, color: AppColors.muted),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            formatBalance(wallet.balance),
                            maxLines: 1,
                            style: AppTheme.headline(
                              44,
                              color: Colors.white,
                              letterSpacing: -1.5,
                            ),
                          ),
                          const SizedBox(height: 20),
                          GestureDetector(
                            onTap: _openPicker,
                            child: AspectRatio(
                              aspectRatio: kCardAspect,
                              child: CardHero(tier: wallet.activeCard),
                            ),
                          ),
                        ],
                      ),
                    ),
                    // The white sheet, pulled up over the black area.
                    Expanded(
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: <Widget>[
                          Positioned(
                            top: -28,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            child: _sheet(wallet, viewPadding.bottom),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                Positioned(
                  left: 24,
                  right: 24,
                  bottom: viewPadding.bottom + 20,
                  child: BottomNavPill(index: _navIndex, onSelected: _onNavTap),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _header() {
    return Row(
      children: <Widget>[
        Expanded(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              'Hello DailyWallet',
              maxLines: 1,
              style: AppTheme.headline(30, color: Colors.white, letterSpacing: -0.8),
            ),
          ),
        ),
        const SizedBox(width: 12),
        _CircleButton(
          icon: Icons.search_rounded,
          onTap: _toggleSearch,
          semanticLabel: 'Search transactions',
        ),
        const SizedBox(width: 10),
        _CircleButton(
          icon: Icons.add_rounded,
          onTap: () => showAmountSheet(context, mode: AmountSheetMode.topUp),
          semanticLabel: 'Top up',
        ),
      ],
    );
  }

  Widget _sheet(WalletService wallet, double bottomInset) {
    final String query = _query.trim().toLowerCase();
    final List<Txn> items = query.isEmpty
        ? wallet.transactions
        : wallet.transactions
            .where((Txn txn) => txn.title.toLowerCase().contains(query))
            .toList(growable: false);

    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 240),
              child: _searching ? _searchBar() : _sheetHeader(),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: items.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 60),
                      child: Text(
                        'Nothing matches that search.',
                        style: AppTheme.body(14, color: AppColors.muted),
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: EdgeInsets.fromLTRB(24, 0, 24, 104 + bottomInset),
                    itemCount: items.length,
                    separatorBuilder: (BuildContext context, int index) => const TxnDivider(),
                    itemBuilder: (BuildContext context, int index) => TxnRow(txn: items[index]),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _sheetHeader() {
    return SizedBox(
      key: const ValueKey<String>('sheet-header'),
      height: 44,
      child: Row(
        children: <Widget>[
          Text(
            'Recent transactions',
            style: AppTheme.body(17, weight: FontWeight.w600, letterSpacing: -0.3),
          ),
          const Spacer(),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => showTransactionsSheet(context),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
              child: Text(
                'See all',
                style: AppTheme.body(14, color: AppColors.muted),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _searchBar() {
    return Container(
      key: const ValueKey<String>('sheet-search'),
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: AppColors.bg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: <Widget>[
          const Icon(Icons.search_rounded, size: 18, color: AppColors.muted),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: _search,
              focusNode: _searchFocus,
              cursorColor: AppColors.ink,
              cursorWidth: 1.6,
              style: AppTheme.body(14, weight: FontWeight.w500),
              onChanged: (String value) => setState(() => _query = value),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                contentPadding: EdgeInsets.zero,
                hintText: 'Search transactions',
                hintStyle: AppTheme.body(14, color: AppColors.muted),
              ),
            ),
          ),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: _toggleSearch,
            child: const Padding(
              padding: EdgeInsets.only(left: 8),
              child: Icon(Icons.close_rounded, size: 18, color: AppColors.muted),
            ),
          ),
        ],
      ),
    );
  }
}

/// 44px circular button on the dark section.
class _CircleButton extends StatelessWidget {
  const _CircleButton({
    super.key,
    required this.icon,
    required this.onTap,
    required this.semanticLabel,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: AppColors.darkChip,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          splashColor: const Color(0x1FFFFFFF),
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(icon, size: 20, color: Colors.white),
          ),
        ),
      ),
    );
  }
}
