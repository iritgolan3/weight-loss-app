import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Rounded white input with a hairline border that animates to ink on focus.
class AppTextField extends StatefulWidget {
  const AppTextField({
    super.key,
    required this.controller,
    required this.hint,
    this.errorText,
    this.obscure = false,
    this.keyboardType = TextInputType.text,
    this.textInputAction = TextInputAction.next,
    this.onSubmitted,
    this.autofillHints,
  });

  final TextEditingController controller;
  final String hint;
  final String? errorText;
  final bool obscure;
  final TextInputType keyboardType;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onSubmitted;
  final Iterable<String>? autofillHints;

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  final FocusNode _node = FocusNode();
  bool _focused = false;
  bool _hidden = true;

  @override
  void initState() {
    super.initState();
    _hidden = widget.obscure;
    _node.addListener(_onFocusChange);
  }

  void _onFocusChange() {
    if (_focused != _node.hasFocus) {
      setState(() => _focused = _node.hasFocus);
    }
  }

  @override
  void dispose() {
    _node.removeListener(_onFocusChange);
    _node.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bool hasError = widget.errorText != null;
    final Color borderColor = hasError
        ? AppColors.danger
        : _focused
            ? AppColors.ink
            : AppColors.hairline;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          height: 58,
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderColor),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 18),
          alignment: Alignment.center,
          child: Row(
            children: <Widget>[
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  focusNode: _node,
                  obscureText: widget.obscure && _hidden,
                  keyboardType: widget.keyboardType,
                  textInputAction: widget.textInputAction,
                  onSubmitted: widget.onSubmitted,
                  autofillHints: widget.autofillHints,
                  cursorColor: AppColors.ink,
                  cursorWidth: 1.6,
                  style: AppTheme.body(15, weight: FontWeight.w500),
                  decoration: InputDecoration(
                    isDense: true,
                    border: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    contentPadding: EdgeInsets.zero,
                    hintText: widget.hint,
                    hintStyle: AppTheme.body(15, color: AppColors.muted),
                  ),
                ),
              ),
              if (widget.obscure)
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _hidden = !_hidden),
                  child: Padding(
                    padding: const EdgeInsets.only(left: 12),
                    child: Icon(
                      _hidden ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                      size: 19,
                      color: AppColors.muted,
                    ),
                  ),
                ),
            ],
          ),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          alignment: Alignment.topLeft,
          child: hasError
              ? Padding(
                  padding: const EdgeInsets.only(top: 8, left: 4),
                  child: Text(
                    widget.errorText!,
                    style: AppTheme.body(12.5, color: AppColors.danger, weight: FontWeight.w500),
                  ),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}
