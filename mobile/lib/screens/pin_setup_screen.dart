import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'home_screen.dart';

/// PIN o'rnatish ekrani — login muvaffaqiyatli bo'lgandan keyin chiqadi
class PinSetupScreen extends StatefulWidget {
  const PinSetupScreen({super.key});

  @override
  State<PinSetupScreen> createState() => _PinSetupScreenState();
}

class _PinSetupScreenState extends State<PinSetupScreen> {
  final List<String> _digits = [];
  String _firstPin = '';
  bool _isConfirming = false;
  bool _isError = false;

  void _onDigit(String digit) {
    if (_digits.length >= 4) return;
    setState(() {
      _digits.add(digit);
      _isError = false;
    });
    if (_digits.length == 4) {
      final pin = _digits.join();
      if (!_isConfirming) {
        setState(() {
          _firstPin = pin;
          _digits.clear();
          _isConfirming = true;
        });
      } else {
        _confirm(pin);
      }
    }
  }

  void _onDelete() {
    if (_digits.isEmpty) return;
    setState(() {
      _digits.removeLast();
      _isError = false;
    });
  }

  Future<void> _confirm(String pin) async {
    if (pin == _firstPin) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('app_pin', pin);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(children: [
            Icon(Icons.check_circle_rounded, color: Colors.white),
            SizedBox(width: 10),
            Text('PIN kod muvaffaqiyatli o\'rnatildi!', style: TextStyle(fontWeight: FontWeight.w700)),
          ]),
          backgroundColor: const Color(0xFF48CAE4),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          margin: const EdgeInsets.only(bottom: 80, left: 20, right: 20),
        ),
      );
      await Future.delayed(const Duration(milliseconds: 600));
      if (!mounted) return;
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const HomeScreen()));
    } else {
      setState(() {
        _isError = true;
        _digits.clear();
        _isConfirming = false;
        _firstPin = '';
      });
    }
  }

  void _skip() {
    Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const HomeScreen()));
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
                      child: const Icon(Icons.shield_rounded, size: 36, color: Color(0xFF2B5DE4)),
                    ),
                    const SizedBox(height: 14),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      child: Text(
                        key: ValueKey(_isConfirming),
                        _isConfirming ? 'Tasdiqlang' : 'PIN O\'rnating',
                        style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _isConfirming ? 'PIN ni qayta kiriting' : 'Xavfsizlik uchun 4 xonali kod',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 13),
                    ),
                    const SizedBox(height: 36),

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
                            // Step dots
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                _StepDot(active: !_isConfirming, done: _isConfirming),
                                const SizedBox(width: 8),
                                _StepDot(active: _isConfirming, done: false),
                              ],
                            ),
                            const SizedBox(height: 20),

                            Text(
                              _isError
                                  ? 'Kodlar mos kelmadi. Qayta boshlang.'
                                  : (_isConfirming ? 'PIN kodini qayta kiriting' : 'Yangi PIN kod kiriting'),
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: _isError ? const Color(0xFFEF476F) : Colors.grey.shade600,
                              ),
                            ),
                            const SizedBox(height: 28),

                            // Pin dots
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
                            Expanded(child: _buildKeypad()),

                            TextButton(
                              onPressed: _skip,
                              child: Text(
                                'Hozircha o\'tkazib yuborish',
                                style: TextStyle(color: Colors.grey.shade400, fontWeight: FontWeight.w600, fontSize: 13),
                              ),
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
      ['', '0', 'del'],
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
            if (key.isEmpty) return const SizedBox(width: 70, height: 70);
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

class _StepDot extends StatelessWidget {
  final bool active, done;
  const _StepDot({required this.active, required this.done});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      width: active ? 28 : 10,
      height: 10,
      decoration: BoxDecoration(
        color: done ? const Color(0xFF48CAE4) : (active ? const Color(0xFF2B5DE4) : Colors.grey.shade300),
        borderRadius: BorderRadius.circular(5),
      ),
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
        width: 70, height: 70,
        decoration: const BoxDecoration(
          color: Color(0xFFF0F4FD), 
          shape: BoxShape.circle,
        ),
        child: Center(child: child),
      ),
    );
  }
}
