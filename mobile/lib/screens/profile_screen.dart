import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../main.dart';
import '../services/api_service.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String _userEmail = 'Yuklanmoqda...';
  bool _notificationsEnabled = true;
  String _currentLanguage = 'O\'zbekcha';

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _userEmail = prefs.getString('user_email') ?? 'Tizim Administratori';
      _notificationsEnabled = prefs.getBool('notifications_enabled') ?? true;
      _currentLanguage = prefs.getString('app_language') ?? 'O\'zbekcha';
    });
  }

  Future<void> _toggleNotifications(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notifications_enabled', value);
    setState(() {
      _notificationsEnabled = value;
    });

    if (value) {
      // Send a real test notification to confirm it works
      const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
        'bioface_channel',
        'BioFace Bildirishnomalari',
        channelDescription: 'BioFace tizimidan keladigan bildirishnomalar',
        importance: Importance.high,
        priority: Priority.high,
        icon: '@mipmap/ic_launcher',
      );
      const NotificationDetails details = NotificationDetails(android: androidDetails);
      await flutterLocalNotificationsPlugin.show(
        id: 0,
        title: 'BioFace',
        body: 'Bildirishnomalar yoqildi! Siz endi xabardor bo\'lasiz.',
        notificationDetails: details,
      );
    }

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(value ? 'Bildirishnomalar yoqildi' : 'Bildirishnomalar o\'chirildi'),
        backgroundColor: const Color(0xFF2B5DE4),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.only(bottom: 80, left: 20, right: 20),
      ),
    );
  }

  Future<void> _changeLanguage() async {
    final languages = ['O\'zbekcha', 'Русский', 'English'];
    
    final selected = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(topLeft: Radius.circular(32), topRight: Radius.circular(32)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Tilni tanlang', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, letterSpacing: -0.5)),
            const SizedBox(height: 16),
            ...languages.map((lang) => ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(lang, style: TextStyle(fontWeight: lang == _currentLanguage ? FontWeight.bold : FontWeight.w500)),
              trailing: lang == _currentLanguage 
                  ? const Icon(Icons.check_circle, color: Color(0xFF2B5DE4))
                  : null,
              onTap: () => Navigator.pop(ctx, lang),
            )),
            const SizedBox(height: 20),
          ],
        ),
      )
    );

    if (selected != null && selected != _currentLanguage) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('app_language', selected);
      setState(() {
        _currentLanguage = selected;
      });
    }
  }

  Future<void> _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text('Tizimdan chiqish', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: -0.5)),
        content: const Text('Rostdan ham tizimdan chiqmoqchimisiz? Shu qurilmadagi saqlangan parollaringiz o\'chiriladi.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Bekor qilish', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF476F),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
            child: const Text('Chiqish', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await ApiService.logout();
      await ApiService.clearUserCache();
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F4FD),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        title: const Text('Profilim', style: TextStyle(color: Color(0xFF131722), fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        child: Column(
          children: [
            // Profile Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(32),
                boxShadow: [
                  BoxShadow(color: const Color(0xFF4579FA).withOpacity(0.06), blurRadius: 30, offset: const Offset(0, 15))
                ],
              ),
              child: Column(
                children: [
                  Container(
                    width: 90,
                    height: 90,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        colors: [Color(0xFF558DFA), Color(0xFF154EE0)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      boxShadow: [
                        BoxShadow(color: const Color(0xFF154EE0).withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 10))
                      ],
                    ),
                    child: const Icon(Icons.security, size: 40, color: Colors.white),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Administrator Akkaunt',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF131722), letterSpacing: -0.5),
                  ),
                  const SizedBox(height: 6),
                  Container(
                     padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                     decoration: BoxDecoration(color: const Color(0xFFF0F4FD), borderRadius: BorderRadius.circular(12)),
                     child: Text(
                       _userEmail,
                       style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
                     ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 32),

            // Settings Block
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(color: const Color(0xFF4579FA).withOpacity(0.06), blurRadius: 30, offset: const Offset(0, 15))
                ],
              ),
              child: Column(
                children: [
                   _buildSettingsRow(
                     icon: Icons.language, 
                     color: const Color(0xFF48CAE4),
                     title: 'Tizim Tili',
                     trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_currentLanguage, style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                          const SizedBox(width: 4),
                          Icon(Icons.chevron_right, color: Colors.grey.shade400),
                        ],
                      ),
                      onTap: _changeLanguage,
                   ),
                   const Divider(height: 1, color: Color(0xFFF0F4FD), thickness: 1.5, indent: 60, endIndent: 20),
                   _buildSettingsRow(
                     icon: Icons.notifications_active_rounded, 
                     color: const Color(0xFFFFB703),
                     title: 'Bildirishnomalar (Push)',
                     trailing: Switch(
                       value: _notificationsEnabled,
                       onChanged: _toggleNotifications,
                       activeThumbColor: Colors.white,
                       activeTrackColor: const Color(0xFF48CAE4),
                       inactiveThumbColor: Colors.white,
                       inactiveTrackColor: Colors.grey.shade300,
                     ),
                   ),
                ],
              ),
            ),

            const SizedBox(height: 48),

            // Logout Button Solid
            SizedBox(
              width: double.infinity,
              height: 60,
              child: ElevatedButton(
                onPressed: _logout,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEF476F),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shadowColor: const Color(0xFFEF476F).withOpacity(0.3),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.power_settings_new_rounded, size: 24),
                    SizedBox(width: 12),
                    Text('Tizimdan chiqish', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: -0.5)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingsRow({required IconData icon, required Color color, required String title, required Widget trailing, VoidCallback? onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: color.withOpacity(0.15), shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: Color(0xFF131722))),
            ),
            trailing,
          ],
        ),
      ),
    );
  }
}
