import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/app_scope.dart';
import '../services/auth_service.dart';
import '../theme/app_theme.dart';
import '../utils/transitions.dart';
import '../widgets/app_text_field.dart';
import '../widgets/primary_button.dart';
import 'home_screen.dart';
import 'passcode_screen.dart';

/// Sign in / sign up.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();

  bool _createMode = false;
  bool _initialised = false;
  bool _busy = false;
  String? _emailError;
  String? _passwordError;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_initialised) {
      _initialised = true;
      // A brand new install lands on "Create account".
      _createMode = !AppScope.authOf(context).hasAccount;
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  String get _title => _createMode ? 'Create account' : 'Welcome back';

  String get _subtitle => _createMode
      ? 'A couple of details and your wallet is ready.'
      : 'Sign in to pick up where you left off.';

  void _toggleMode() {
    FocusScope.of(context).unfocus();
    setState(() {
      _createMode = !_createMode;
      _emailError = null;
      _passwordError = null;
    });
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final AuthService auth = AppScope.authOf(context);

    final String? emailError = AuthService.validateEmail(_email.text);
    final String? passwordError = AuthService.validatePassword(_password.text);
    setState(() {
      _emailError = emailError;
      _passwordError = passwordError;
    });
    if (emailError != null || passwordError != null) return;

    setState(() => _busy = true);
    final String? failure = _createMode
        ? await auth.signUp(_email.text, _password.text)
        : await auth.signIn(_email.text, _password.text);
    if (!mounted) return;
    setState(() => _busy = false);

    if (failure != null) {
      setState(() {
        if (failure.toLowerCase().contains('password')) {
          _passwordError = failure;
        } else {
          _emailError = failure;
        }
      });
      return;
    }

    if (!auth.hasPasscode) {
      Navigator.of(context).push<void>(
        slideUpRoute<void>(
          const PasscodeScreen(mode: PasscodeMode.setup, replaceWithHome: true),
        ),
      );
    } else {
      Navigator.of(context).pushAndRemoveUntil<void>(
        fadeThroughRoute<void>(const HomeScreen()),
        (Route<dynamic> route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: AppColors.bg,
      ),
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              return SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight - 24),
                  child: IntrinsicHeight(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        const SizedBox(height: 56),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 260),
                          child: Text(
                            _title,
                            key: ValueKey<String>(_title),
                            style: AppTheme.headline(34, letterSpacing: -1.0),
                          ),
                        ),
                        const SizedBox(height: 10),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 260),
                          child: Text(
                            _subtitle,
                            key: ValueKey<String>(_subtitle),
                            style: AppTheme.body(14.5, color: AppColors.muted, height: 1.45),
                          ),
                        ),
                        const SizedBox(height: 36),
                        AppTextField(
                          controller: _email,
                          hint: 'Email address',
                          errorText: _emailError,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const <String>[AutofillHints.email],
                        ),
                        const SizedBox(height: 14),
                        AppTextField(
                          controller: _password,
                          hint: 'Password',
                          errorText: _passwordError,
                          obscure: true,
                          textInputAction: TextInputAction.done,
                          onSubmitted: (String _) => _submit(),
                          autofillHints: const <String>[AutofillHints.password],
                        ),
                        const SizedBox(height: 28),
                        PrimaryButton(
                          label: _createMode ? 'Create account' : 'Sign in',
                          enabled: !_busy,
                          onPressed: _busy ? null : _submit,
                        ),
                        const Spacer(),
                        const SizedBox(height: 24),
                        Center(
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: _toggleMode,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                              child: RichText(
                                text: TextSpan(
                                  style: AppTheme.body(14, color: AppColors.muted),
                                  children: <TextSpan>[
                                    TextSpan(
                                      text: _createMode
                                          ? 'Already have an account?  '
                                          : 'New to DailyWallet?  ',
                                    ),
                                    TextSpan(
                                      text: _createMode ? 'Sign in' : 'Create account',
                                      style: AppTheme.body(14, weight: FontWeight.w600),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
