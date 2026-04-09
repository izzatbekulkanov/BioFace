import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'home_screen.dart';

/// Shown after login to verify PIN or biometric
class PinLockScreen extends StatefulWidget {
  const PinLockScreen({super.key});

  @override
  State<PinLockScreen> createState() => _PinLockScreenState();
}

class _PinLockScreenState extends State<PinLockScreen> {
  final LocalAuthentication _localAuth = LocalAuthentication();
  final List<String> _digits = [];
  bool _biometricAvailable = false;
  bool _isError = false;
  String _userEmail = '';

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _userEmail = prefs.getString('user_email') ?? '';
    });
    await _checkBiometric();
    await Future.delayed(const Duration(milliseconds: 400));
    await _tryBiometric();
  }

  Future<void> _checkBiometric() async {
    try {
      final canCheck = await _localAuth.canCheckBiometrics;
      final isSupported = await _localAuth.isDeviceSupported();
      setState(() => _biometricAvailable = canCheck && isSupported);
    } catch (_) {}
  }

  Future<void> _tryBiometric() async {
    if (!_biometricAvailable) return;
    try {
      final ok = await _localAuth.authenticate(
        localizedReason: 'BioFace tizimiga kirish uchun biometrik tasdiqlash',
        biometricOnly: false,
      );
      if (ok && mounted) _goHome();
    } catch (_) {}
  }

  void _onDigit(String digit) {
    if (_digits.length >= 4) return;
    setState(() {
      _digits.add(digit);
      _isError = false;
    });
    if (_digits.length == 4) {
      _verify(_digits.join());
    }
  }

  void _onDelete() {
    if (_digits.isEmpty) return;
    setState(() {
      _digits.removeLast();
      _isError = false;
    });
  }

  Future<void> _verify(String pin) async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('app_pin') ?? '';
    if (pin == saved) {
      _goHome();
    } else {
      setState(() {
        _isError = true;
        _digits.clear();
      });
    }
  }

  void _goHome() {
    if (!mounted) return;
    Navigator.pushReplacement(
        context, MaterialPageRoute(builder: (_) => const HomeScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F4FD),
      body: Stack(
        children: [
          Container(
            height: 300,
            width: double.infinity,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF558DFA), Color(0xFF154EE0)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(48),
                bottomRight: Radius.circular(48),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 450),
                child: Column(
                  children: [
                    const SizedBox(height: 32),
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 20, offset: const Offset(0, 10))],
                      ),
                      child: const Icon(Icons.lock_rounded, size: 36, color: Color(0xFF2B5DE4)),
                    ),
                    const SizedBox(height: 14),
                    const Text('Kirish', style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
                    const SizedBox(height: 4),
                    Text(_userEmail, style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 13)),
                    const SizedBox(height: 36),

                    // White card
                    Expanded(
                      child: Container(
                        width: double.infinity,
                        margin: const EdgeInsets.symmetric(horizontal: 28),
                        padding: const EdgeInsets.fromLTRB(28, 32, 28, 16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(40),
                          boxShadow: [BoxShadow(color: const Color(0xFF4579FA).withValues(alpha: 0.12), blurRadius: 40, offset: const Offset(0, 20))],
                        ),
                        child: Column(
                          children: [
                            const Text('PIN kod kiriting', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF131722))),
                            const SizedBox(height: 4),
                            Text(_isError ? 'Noto\'g\'ri PIN! Qayta urinib ko\'ring.' : '4 xonali PIN kodingizni kiriting',
                                style: TextStyle(fontSize: 13, color: _isError ? const Color(0xFFEF476F) : Colors.grey.shade500)),
                            const SizedBox(height: 32),

                            // PIN dots
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: List.generate(4, (i) {
                                final filled = i < _digits.length;
                                return AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  margin: const EdgeInsets.symmetric(horizontal: 10),
                                  width: filled ? 22 : 18,
                                  height: filled ? 22 : 18,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: _isError
                                        ? const Color(0xFFEF476F)
                                        : (filled ? const Color(0xFF2B5DE4) : const Color(0xFFE8EEFF)),
                                    boxShadow: filled && !_isError
                                        ? [BoxShadow(color: const Color(0xFF2B5DE4).withValues(alpha: 0.3), blurRadius: 8, offset: const Offset(0, 4))]
                                        : null,
                                  ),
                                );
                              }),
                            ),

                            const SizedBox(height: 36),

                            // Keypad
                            Expanded(
                              child: _buildKeypad(),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKeypad() {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['bio', '0', 'del'],
    ];

    return Column(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: keys.map((row) {
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: row.map((key) {
            if (key == 'del') {
              return _KeyButton(
                onTap: _onDelete,
                child: const Icon(Icons.backspace_outlined, size: 22, color: Color(0xFF2B5DE4)),
              );
            }
            if (key == 'bio') {
              return _biometricAvailable
                  ? _KeyButton(
                      onTap: _tryBiometric,
                      child: const Icon(Icons.fingerprint_rounded, size: 26, color: Color(0xFF2B5DE4)),
                    )
                  : const SizedBox(width: 70, height: 70);
            }
            return _KeyButton(
              onTap: () => _onDigit(key),
              child: Text(key, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF131722))),
            );
          }).toList(),
        );
      }).toList(),
    );
  }
}

class _KeyButton extends StatelessWidget {
  final Widget child;
  final VoidCallback onTap;
  const _KeyButton({required this.child, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 70,
        height: 70,
        decoration: const BoxDecoration(
          color: Color(0xFFF0F4FD),
          shape: BoxShape.circle,
        ),
        child: Center(child: child),
      ),
    );
  }
}
