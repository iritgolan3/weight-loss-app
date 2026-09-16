import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// The floating navigation pill: 64px tall, 32px radius, ink fill. The active
/// item is a 48px white circle that slides between the four slots.
class BottomNavPill extends StatelessWidget {
  const BottomNavPill({
    super.key,
    required this.index,
    required this.onSelected,
  });

  static const double height = 64;
  static const double indicatorSize = 48;

  static const List<IconData> icons = <IconData>[
    Icons.home_outlined,
    Icons.swap_horiz_rounded,
    Icons.credit_card_outlined,
    Icons.person_outline,
  ];

  static const List<String> labels = <String>['Home', 'Convert', 'Card', 'Profile'];

  final int index;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: AppColors.ink,
        borderRadius: BorderRadius.circular(height / 2),
        boxShadow: const <BoxShadow>[
          BoxShadow(color: Color(0x40000000), blurRadius: 26, offset: Offset(0, 12)),
        ],
      ),
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) {
          final double slot = constraints.maxWidth / icons.length;
          return Stack(
            children: <Widget>[
              AnimatedPositioned(
                duration: const Duration(milliseconds: 400),
                curve: Curves.easeOutCubic,
                left: slot * index + (slot - indicatorSize) / 2,
                top: (height - indicatorSize) / 2,
                width: indicatorSize,
                height: indicatorSize,
                child: const DecoratedBox(
                  decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                ),
              ),
              Row(
                children: <Widget>[
                  for (int i = 0; i < icons.length; i++)
                    Expanded(
                      child: Semantics(
                        button: true,
                        selected: i == index,
                        label: labels[i],
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => onSelected(i),
                          child: SizedBox(
                            height: height,
                            child: Center(
                              child: AnimatedSwitcher(
                                duration: const Duration(milliseconds: 260),
                                child: Icon(
                                  icons[i],
                                  key: ValueKey<bool>(i == index),
                                  size: 23,
                                  color: i == index ? AppColors.ink : AppColors.navInactive,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}
