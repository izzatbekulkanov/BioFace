import 'dart:ui';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../services/api_service.dart';
import 'attendance_screen.dart';
import 'profile_screen.dart';
import '../widgets/responsive_layout.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  int _currentIndex = 0;

  final List<_NavItem> _navItems = const [
    _NavItem(icon: CupertinoIcons.house, activeIcon: CupertinoIcons.house_fill, label: 'Asosiy'),
    _NavItem(icon: CupertinoIcons.person_2, activeIcon: CupertinoIcons.person_2_fill, label: 'Davomat'),
    _NavItem(icon: CupertinoIcons.settings, activeIcon: CupertinoIcons.settings_solid, label: 'Profil'),
  ];

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      const _DashboardTab(),
      const AttendanceScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF0F4FD),
      extendBody: true,
      body: ResponsiveLayout(
        maxWidth: 700,
        child: IndexedStack(
          index: _currentIndex,
          children: pages,
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 700),
            child: _FloatingNavBar(
              currentIndex: _currentIndex,
              items: _navItems,
              onTap: (i) => setState(() => _currentIndex = i),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Floating pill navbar (like the reference image) ─────────────────────────
class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _NavItem({required this.icon, required this.activeIcon, required this.label});
}

class _FloatingNavBar extends StatelessWidget {
  final int currentIndex;
  final List<_NavItem> items;
  final ValueChanged<int> onTap;

  const _FloatingNavBar({required this.currentIndex, required this.items, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 30),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(36),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: Container(
            height: 72,
            decoration: BoxDecoration(
              color: const Color(0xFF1A1F36).withValues(alpha: 0.82),
              borderRadius: BorderRadius.circular(36),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.12),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF1A1F36).withValues(alpha: 0.35),
                  blurRadius: 32,
                  offset: const Offset(0, 12),
                )
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: List.generate(items.length, (i) {
                final isActive = i == currentIndex;
                return GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onTap(i),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeOutCubic,
                    padding: EdgeInsets.symmetric(
                      horizontal: isActive ? 24 : 16,
                      vertical: 12,
                    ),
                    decoration: isActive
                        ? BoxDecoration(
                            color: const Color(0xFF2563EB),
                            borderRadius: BorderRadius.circular(24),
                          )
                        : null,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          isActive ? items[i].activeIcon : items[i].icon,
                          color: isActive ? Colors.white : Colors.white.withValues(alpha: 0.5),
                          size: 24,
                        ),
                        if (isActive) ...[
                          const SizedBox(width: 8),
                          Text(
                            items[i].label,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ]
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
class _DashboardTab extends StatefulWidget {
  const _DashboardTab();

  @override
  State<_DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<_DashboardTab> {
  Map<String, dynamic>? _dashboard;
  Map<String, dynamic>? _userInfo;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() { _isLoading = true; _error = null; });
    final results = await Future.wait([
      ApiService.getDashboardMetrics(),
      ApiService.getCurrentUserInfo(),
    ]);
    if (!mounted) return;
    final dash = results[0];
    final user = results[1];

    setState(() {
      _isLoading = false;
      if (dash['ok'] == true && dash['dashboard'] != null) {
        _dashboard = dash['dashboard'];
      } else {
        _error = dash['error'] ?? 'Xatolik yuz berdi';
      }
      _userInfo = Map<String, dynamic>.from(user);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFFF0F4FD),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF2563EB))),
      );
    }
    if (_error != null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF0F4FD),
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.cloud_off_rounded, size: 64, color: Color(0xFFEF476F)),
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: Color(0xFFEF476F))),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _loadAll,
              icon: const Icon(Icons.refresh),
              label: const Text('Qayta urinish'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            )
          ]),
        ),
      );
    }

    final summary = _dashboard?['summary'] ?? {};
    final orgCards = (_dashboard?['org_cards'] as List<dynamic>?) ?? [];

    final int totalEmps = summary['employees'] ?? 0;
    final int presentToday = summary['present_today'] ?? 0;
    final int absentToday = summary['absent_today'] ?? 0;
    final int lateToday = summary['late_today'] ?? 0;
    final int activeCameras = summary['active_cameras'] ?? 0;
    final int totalCameras = summary['cameras'] ?? 0;

    // Psychological status
    final double presentPct = totalEmps > 0 ? presentToday / totalEmps : 0;
    final String psychLabel;
    final Color psychColor;
    final IconData psychIcon;
    if (presentPct >= 0.90) {
      psychLabel = 'Jamoaviy ruh: A\'lo!';
      psychColor = const Color(0xFF48CAE4);
      psychIcon = Icons.sentiment_very_satisfied_rounded;
    } else if (presentPct >= 0.75) {
      psychLabel = 'Jamoaviy ruh: Yaxshi';
      psychColor = const Color(0xFF2563EB);
      psychIcon = Icons.sentiment_satisfied_rounded;
    } else if (presentPct >= 0.50) {
      psychLabel = 'Jamoaviy ruh: O\'rtacha';
      psychColor = const Color(0xFFFFB703);
      psychIcon = Icons.sentiment_neutral_rounded;
    } else {
      psychLabel = 'Jamoaviy ruh: Past!';
      psychColor = const Color(0xFFEF476F);
      psychIcon = Icons.sentiment_very_dissatisfied_rounded;
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF0F4FD),
      body: RefreshIndicator(
        color: const Color(0xFF2563EB),
        backgroundColor: Colors.white,
        onRefresh: _loadAll,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // ── AppBar with User Info ──────────────────────────────────────
            SliverToBoxAdapter(
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF558DFA), Color(0xFF154EE0)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(40),
                    bottomRight: Radius.circular(40),
                  ),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Top row: greeting + user avatar
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _greeting(),
                                    style: TextStyle(
                                      color: Colors.white.withOpacity(0.8),
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  const Text(
                                    'BioFace Dashboard',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 24,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // User info bubble (top right)
                            _UserBubble(userInfo: _userInfo),
                          ],
                        ),

                        const SizedBox(height: 24),

                        // Psychological mood bar
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            children: [
                              Icon(psychIcon, color: Colors.white, size: 22),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  psychLabel,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  '${(presentPct * 100).round()}% keldi',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // ── Stat Cards Row ─────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                child: Row(
                  children: [
                    _StatMiniCard(
                      label: 'Jami xodim',
                      value: '$totalEmps',
                      icon: Icons.groups_rounded,
                      color: const Color(0xFF2563EB),
                    ),
                    const SizedBox(width: 12),
                    _StatMiniCard(
                      label: 'Kameralar',
                      value: '$activeCameras/$totalCameras',
                      icon: Icons.videocam_rounded,
                      color: const Color(0xFF48CAE4),
                    ),
                    const SizedBox(width: 12),
                    _StatMiniCard(
                      label: 'Kechikdi',
                      value: '$lateToday',
                      icon: Icons.timer_outlined,
                      color: const Color(0xFFFFB703),
                    ),
                    const SizedBox(width: 12),
                    _StatMiniCard(
                      label: 'Kelmagan',
                      value: '$absentToday',
                      icon: Icons.person_off_rounded,
                      color: const Color(0xFFEF476F),
                    ),
                  ],
                ),
              ),
            ),

            // ── Pie Chart ─────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Bugungi holat', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF131722), letterSpacing: -0.5)),
                        Text(_todayStr(), style: TextStyle(color: Colors.grey.shade500, fontSize: 13, fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(36),
                        boxShadow: [
                          BoxShadow(color: const Color(0xFF4579FA).withOpacity(0.07), blurRadius: 30, offset: const Offset(0, 16))
                        ],
                      ),
                      child: Column(
                        children: [
                          SizedBox(
                            height: 200,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                PieChart(
                                  PieChartData(
                                    sectionsSpace: 6,
                                    centerSpaceRadius: 70,
                                    startDegreeOffset: -90,
                                    sections: _buildSections(presentToday, lateToday, absentToday),
                                  ),
                                ),
                                Column(mainAxisSize: MainAxisSize.min, children: [
                                  Text('${presentToday + lateToday + absentToday}',
                                      style: const TextStyle(fontSize: 38, fontWeight: FontWeight.w900, color: Color(0xFF131722), letterSpacing: -1, height: 1)),
                                  Text('Tasdiqlangan', style: TextStyle(fontSize: 13, color: Colors.grey.shade400, fontWeight: FontWeight.w500)),
                                ]),
                              ],
                            ),
                          ),
                          const SizedBox(height: 24),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              _LegendItem(label: 'Keldi', value: '$presentToday', color: const Color(0xFF48CAE4)),
                              _LegendItem(label: 'Kechikdi', value: '$lateToday', color: const Color(0xFFFFB703)),
                              _LegendItem(label: 'Kelmadi', value: '$absentToday', color: const Color(0xFFEF476F)),
                            ],
                          )
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // ── Org Cards with subscription + cameras ─────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Tashkilotlar', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF131722), letterSpacing: -0.5)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFF2563EB).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text('${orgCards.length} ta', style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w700, fontSize: 13)),
                    )
                  ],
                ),
              ),
            ),

            SliverPadding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 130),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) => _OrgCard(card: orgCards[i]),
                  childCount: orgCards.length,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Xayrli tong!';
    if (h < 17) return 'Xayrli kun!';
    return 'Xayrli kech!';
  }

  String _todayStr() {
    final now = DateTime.now();
    const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    return '${now.day} ${months[now.month - 1]} ${now.year}';
  }

  List<PieChartSectionData> _buildSections(int p, int l, int a) {
    final total = p + l + a;
    if (total == 0) {
      return [PieChartSectionData(color: const Color(0xFFF0F4FD), value: 1, title: '', radius: 16)];
    }
    return [
      if (p > 0) PieChartSectionData(color: const Color(0xFF48CAE4), value: p.toDouble(), title: '', radius: 18),
      if (l > 0) PieChartSectionData(color: const Color(0xFFFFB703), value: l.toDouble(), title: '', radius: 18),
      if (a > 0) PieChartSectionData(color: const Color(0xFFEF476F), value: a.toDouble(), title: '', radius: 18),
    ];
  }
}

// ─── User bubble (top right corner) ──────────────────────────────────────────
class _UserBubble extends StatelessWidget {
  final Map<String, dynamic>? userInfo;
  const _UserBubble({this.userInfo});

  @override
  Widget build(BuildContext context) {
    if (userInfo == null || userInfo!.isEmpty) return const SizedBox.shrink();

    final name = [userInfo!['first_name'] ?? '', userInfo!['last_name'] ?? ''].where((s) => s.isNotEmpty).join(' ');
    final displayName = name.isNotEmpty ? name : (userInfo!['name'] ?? userInfo!['email'] ?? 'Admin');
    final email = userInfo!['email'] ?? '';
    final role = userInfo!['role'] ?? '';
    final initials = displayName.isNotEmpty ? displayName.trim().split(' ').take(2).map((w) => w[0].toUpperCase()).join() : '?';

    return GestureDetector(
      onTap: () {
        showDialog(
          context: context,
          barrierColor: Colors.black.withOpacity(0.4),
          builder: (_) => _UserInfoDialog(
            name: displayName,
            email: email,
            role: role,
            initials: initials,
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.2),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withOpacity(0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(initials, style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold, fontSize: 12)),
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  displayName.split(' ').first,
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                ),
                if (role.isNotEmpty)
                  Text(
                    _roleLabel(role),
                    style: TextStyle(color: Colors.white.withOpacity(0.75), fontSize: 10, fontWeight: FontWeight.w500),
                  ),
              ],
            ),
            const SizedBox(width: 4),
            Icon(Icons.keyboard_arrow_down_rounded, color: Colors.white.withOpacity(0.8), size: 18),
          ],
        ),
      ),
    );
  }

  String _roleLabel(String role) {
    switch (role.toLowerCase()) {
      case 'admin': return 'Administrator';
      case 'superadmin': return 'Super Admin';
      case 'manager': return 'Menejer';
      case 'viewer': return 'Kuzatuvchi';
      default: return role;
    }
  }
}

// ─── User Info Dialog ─────────────────────────────────────────────────────────
class _UserInfoDialog extends StatelessWidget {
  final String name, email, role, initials;
  const _UserInfoDialog({required this.name, required this.email, required this.role, required this.initials});

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF558DFA), Color(0xFF154EE0)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                shape: BoxShape.circle,
              ),
              child: Center(child: Text(initials, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold))),
            ),
            const SizedBox(height: 16),
            Text(name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF131722))),
            const SizedBox(height: 4),
            Text(email, style: TextStyle(fontSize: 14, color: Colors.grey.shade500)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(color: const Color(0xFF2563EB).withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.shield_rounded, color: Color(0xFF2563EB), size: 16),
                  const SizedBox(width: 6),
                  Text(_roleLabel(role), style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w700, fontSize: 14)),
                ],
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: () => Navigator.pop(context),
                style: TextButton.styleFrom(
                  backgroundColor: const Color(0xFFF0F4FD),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Yopish', style: TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _roleLabel(String role) {
    switch (role.toLowerCase()) {
      case 'admin': return 'Administrator';
      case 'superadmin': return 'Super Admin';
      case 'manager': return 'Menejer';
      case 'viewer': return 'Kuzatuvchi';
      default: return role.isEmpty ? 'Foydalanuvchi' : role;
    }
  }
}

// ─── Org Card with subscription + cameras ────────────────────────────────────
class _OrgCard extends StatelessWidget {
  final Map<String, dynamic> card;
  const _OrgCard({required this.card});

  @override
  Widget build(BuildContext context) {
    final name = card['name'] ?? '-';
    final status = card['subscription_status'] ?? 'pending';
    final int present = card['present_today'] ?? 0;
    final int absent = card['absent_today'] ?? 0;
    final int late = card['late_today'] ?? 0;
    final int empCount = card['employee_count'] ?? 0;
    final List<dynamic> cameraNames = card['camera_names'] ?? [];
    final int activeCams = card['active_camera_count'] ?? 0;
    final int totalCams = card['camera_count'] ?? 0;

    final Color subColor;
    final String subLabel;
    final IconData subIcon;
    switch (status) {
      case 'active':
        subColor = const Color(0xFF48CAE4);
        subLabel = 'Faol';
        subIcon = Icons.verified_rounded;
        break;
      case 'expired':
        subColor = const Color(0xFFEF476F);
        subLabel = 'Muddati tugagan';
        subIcon = Icons.cancel_rounded;
        break;
      default:
        subColor = const Color(0xFFFFB703);
        subLabel = 'Kutilayapti';
        subIcon = Icons.pending_rounded;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(color: const Color(0xFF4579FA).withOpacity(0.07), blurRadius: 28, offset: const Offset(0, 12))
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: org name + subscription badge
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0F4FD),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.business_rounded, color: Color(0xFF2563EB), size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF131722), letterSpacing: -0.3)),
                      const SizedBox(height: 2),
                      Text('$empCount ta xodim', style: TextStyle(fontSize: 13, color: Colors.grey.shade500, fontWeight: FontWeight.w500)),
                    ],
                  ),
                ),
                // Subscription badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: subColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(subIcon, color: subColor, size: 14),
                      const SizedBox(width: 4),
                      Text(subLabel, style: TextStyle(color: subColor, fontSize: 12, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),
            const Divider(height: 1, color: Color(0xFFF5F7FF), thickness: 2),
            const SizedBox(height: 14),

            // Attendance row: left border colored cards like the reference
            Row(
              children: [
                _AttendancePill(label: 'Keldi', value: present, color: const Color(0xFF48CAE4)),
                const SizedBox(width: 8),
                _AttendancePill(label: 'Kechikdi', value: late, color: const Color(0xFFFFB703)),
                const SizedBox(width: 8),
                _AttendancePill(label: 'Kelmadi', value: absent, color: const Color(0xFFEF476F)),
              ],
            ),

            // Camera names
            if (cameraNames.isNotEmpty) ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  Icon(Icons.videocam_outlined, size: 15, color: Colors.grey.shade400),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      cameraNames.take(3).join(' • '),
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade500, fontWeight: FontWeight.w500),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: const Color(0xFFF0F4FD), borderRadius: BorderRadius.circular(8)),
                    child: Text('$activeCams/$totalCams online', style: const TextStyle(fontSize: 11, color: Color(0xFF2563EB), fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AttendancePill extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  const _AttendancePill({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border(left: BorderSide(color: color, width: 3)),
        ),
        child: Column(children: [
          Text('$value', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: color)),
          Text(label, style: TextStyle(fontSize: 11, color: color.withOpacity(0.8), fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}

// ─── Small helpers ────────────────────────────────────────────────────────────
class _StatMiniCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _StatMiniCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [BoxShadow(color: color.withOpacity(0.1), blurRadius: 16, offset: const Offset(0, 8))],
        ),
        child: Column(children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: color)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 10, color: Colors.grey.shade500, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
        ]),
      ),
    );
  }
}

class _LegendItem extends StatelessWidget {
  final String label, value;
  final Color color;
  const _LegendItem({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: color)),
        const SizedBox(width: 5),
        Text(label, style: TextStyle(color: Colors.grey.shade500, fontSize: 12, fontWeight: FontWeight.w600)),
      ]),
      const SizedBox(height: 6),
      Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: color, letterSpacing: -0.5)),
    ]);
  }
}
