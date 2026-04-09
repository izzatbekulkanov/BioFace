import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'employee_profile_screen.dart';

class AttendanceScreen extends StatelessWidget {
  const AttendanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: const Color(0xFFF0F4FD),
        body: Stack(
          children: [
            // Top gradient region
            Container(
              height: 220,
              width: double.infinity,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF558DFA), Color(0xFF154EE0)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),

            SafeArea(
              bottom: false,
              child: Column(
                children: [
                  // Header
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Davomat',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.calendar_today_rounded, color: Colors.white, size: 15),
                              const SizedBox(width: 6),
                              Text(
                                _todayStr(),
                                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Tab bar (on blue region)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Container(
                      height: 50,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const TabBar(
                        indicator: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.all(Radius.circular(16)),
                        ),
                        indicatorSize: TabBarIndicatorSize.tab,
                        dividerColor: Colors.transparent,
                        labelColor: Color(0xFF2B5DE4),
                        unselectedLabelColor: Colors.white,
                        labelStyle: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                        unselectedLabelStyle: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                        tabs: [
                          Tab(text: '  Kechikkanlar  '),
                          Tab(text: '  Kelmaganlar  '),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Content (white rounded area)
                  Expanded(
                    child: Container(
                      width: double.infinity,
                      decoration: const BoxDecoration(
                        color: Color(0xFFF0F4FD),
                        borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(36),
                          topRight: Radius.circular(36),
                        ),
                      ),
                      child: const TabBarView(
                        children: [
                          _EmployeeList(statusType: 'came_late'),
                          _EmployeeList(statusType: 'did_not_come'),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _todayStr() {
    final now = DateTime.now();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    return '${now.day} ${months[now.month - 1]} ${now.year}';
  }
}

class _EmployeeList extends StatefulWidget {
  final String statusType;
  const _EmployeeList({required this.statusType});

  @override
  State<_EmployeeList> createState() => _EmployeeListState();
}

class _EmployeeListState extends State<_EmployeeList> with AutomaticKeepAliveClientMixin {
  List<dynamic> _items = [];
  bool _isLoading = true;
  String? _error;
  Map<String, dynamic> _summary = {};

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final result = await ApiService.getAttendanceGroups(widget.statusType);

    if (!mounted) return;

    setState(() {
      _isLoading = false;
      if (result['ok'] == true) {
        _items = result['items'] ?? [];
        _summary = result['summary'] ?? {};
      } else {
        _error = result['error'] ?? 'Noma\'lum xato';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF2B5DE4)));
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(40.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF476F).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.wifi_off_rounded, size: 48, color: Color(0xFFEF476F)),
              ),
              const SizedBox(height: 24),
              const Text('Ulanishda muammo', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF131722))),
              const SizedBox(height: 8),
              Text(_error!, style: TextStyle(color: Colors.grey.shade500, fontSize: 14), textAlign: TextAlign.center),
              const SizedBox(height: 28),
              ElevatedButton.icon(
                onPressed: _fetchData,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Qayta urinish'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2B5DE4),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                ),
              )
            ],
          ),
        ),
      );
    }

    if (_items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                color: const Color(0xFF48CAE4).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                widget.statusType == 'came_late'
                    ? Icons.timer_off_outlined
                    : Icons.event_available_rounded,
                size: 52,
                color: const Color(0xFF48CAE4),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              widget.statusType == 'came_late' ? 'Kechikkanlar yo\'q 🎉' : 'Hamma ishda! 🎊',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: Color(0xFF131722),
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Bugun hammasi joyida!',
              style: TextStyle(color: Colors.grey.shade500, fontSize: 15),
            ),
          ],
        ),
      );
    }

    final empSummary = _summary['employee_summary'] as Map<String, dynamic>? ?? {};
    final int total = empSummary['total_employees'] ?? 0;
    final int came = empSummary['came'] ?? 0;
    final int late = empSummary['late'] ?? 0;
    final int absent = empSummary['did_not_come'] ?? 0;

    return RefreshIndicator(
      color: const Color(0xFF2B5DE4),
      backgroundColor: Colors.white,
      onRefresh: _fetchData,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // Summary chips row
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        '${_items.length} ta xodim',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF131722),
                          letterSpacing: -0.5,
                        ),
                      ),
                      const Spacer(),
                      if (total > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(color: const Color(0xFF4579FA).withOpacity(0.06), blurRadius: 10)
                            ],
                          ),
                          child: Text(
                            'Jami: $total ta',
                            style: const TextStyle(color: Color(0xFF2B5DE4), fontSize: 13, fontWeight: FontWeight.w700),
                          ),
                        )
                    ],
                  ),
                  const SizedBox(height: 12),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildChip('Keldi', came, const Color(0xFF48CAE4), Icons.check_circle_rounded),
                        const SizedBox(width: 8),
                        _buildChip('Kechikdi', late, const Color(0xFFFFB703), Icons.timer_outlined),
                        const SizedBox(width: 8),
                        _buildChip('Kelmadi', absent, const Color(0xFFEF476F), Icons.cancel_rounded),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Employee cards
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) => _EmployeeCard(
                  item: _items[index],
                  statusType: widget.statusType,
                ),
                childCount: _items.length,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChip(String label, int count, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 5),
          Text('$label ($count)', style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

// ─── Individual Employee Card ────────────────────────────────────────────────
class _EmployeeCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final String statusType;

  const _EmployeeCard({required this.item, required this.statusType});

  @override
  Widget build(BuildContext context) {
    final name = item['employee_name'] ?? 'Noma\'lum';
    final org = item['organization_name'];
    final department = item['department'];
    final position = item['position'];
    final employeeType = item['employee_type'];
    final imageUrl = item['employee_image_url'];
    final empId = item['employee_id'] as int?;
    final lateMinutes = item['late_minutes'] ?? 0;
    final firstSeen = item['first_timestamp'];
    final isLate = item['is_late'] == true;
    final visitCount = item['visit_count'] ?? 0;

    // Extract unique camera names from events
    final events = item['events'] as List<dynamic>? ?? [];
    final cameraNames = events
        .map((e) => e['camera_name'])
        .where((n) => n != null && n.toString().isNotEmpty)
        .map((n) => n.toString())
        .toSet()
        .toList();

    final avatarText = name.isNotEmpty ? name[0].toUpperCase() : '?';

    // Psychological status based on being late/absent
    String psychStatus = '';
    Color psychColor = Colors.grey;
    IconData psychIcon = Icons.sentiment_neutral;
    if (statusType == 'did_not_come') {
      psychStatus = 'Yo\'qlama tasdiqlandi';
      psychColor = const Color(0xFFEF476F);
      psychIcon = Icons.mood_bad_rounded;
    } else if (isLate && lateMinutes > 60) {
      psychStatus = 'Jiddiy kechikish';
      psychColor = const Color(0xFFEF476F);
      psychIcon = Icons.sentiment_very_dissatisfied_rounded;
    } else if (isLate && lateMinutes > 15) {
      psychStatus = 'Kechikdi';
      psychColor = const Color(0xFFFFB703);
      psychIcon = Icons.sentiment_dissatisfied_rounded;
    } else if (isLate) {
      psychStatus = 'Biroz kech';
      psychColor = const Color(0xFFFFB703).withOpacity(0.8);
      psychIcon = Icons.sentiment_neutral_rounded;
    }

    String? firstSeenFormatted;
    if (firstSeen != null) {
      try {
        final dt = DateTime.parse(firstSeen).toLocal();
        firstSeenFormatted = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      } catch (_) {}
    }

    return GestureDetector(
      onTap: () {
        if (empId != null) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => EmployeeProfileScreen(
                employeeId: empId,
                initialName: name,
              ),
            ),
          );
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF4579FA).withOpacity(0.07),
              blurRadius: 30,
              offset: const Offset(0, 12),
            )
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top row: avatar + name + status badge
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Avatar
                  Stack(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0F4FD),
                          borderRadius: BorderRadius.circular(18),
                          image: imageUrl != null
                              ? DecorationImage(image: NetworkImage(imageUrl), fit: BoxFit.cover)
                              : null,
                        ),
                        child: imageUrl == null
                            ? Center(
                                child: Text(
                                  avatarText,
                                  style: const TextStyle(
                                    color: Color(0xFF2B5DE4),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 22,
                                  ),
                                ),
                              )
                            : null,
                      ),
                      // Online dot
                      if (statusType != 'did_not_come')
                        Positioned(
                          bottom: 2,
                          right: 2,
                          child: Container(
                            width: 14,
                            height: 14,
                            decoration: BoxDecoration(
                              color: isLate ? const Color(0xFFFFB703) : const Color(0xFF48CAE4),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2),
                            ),
                          ),
                        ),
                    ],
                  ),

                  const SizedBox(width: 16),

                  // Name & Org
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: Color(0xFF131722),
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 4),
                        if (org != null)
                          Text(
                            org,
                            style: TextStyle(color: Colors.grey.shade500, fontSize: 13, fontWeight: FontWeight.w500),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),

                  // Status badge (late/absent)
                  _buildStatusBadge(statusType, lateMinutes, isLate),
                ],
              ),

              const SizedBox(height: 16),
              const Divider(height: 1, color: Color(0xFFF0F4FD), thickness: 2),
              const SizedBox(height: 16),

              // Details row: position, department, employee_type (with "Kiritilmagan" fallback)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _buildInfoBadge(
                    label: position ?? '',
                    icon: Icons.work_outline_rounded,
                    isUnfilled: position == null || position.toString().isEmpty,
                    unfillLabel: 'Lavozim kiritilmagan',
                    color: const Color(0xFF2B5DE4),
                  ),
                  _buildInfoBadge(
                    label: department ?? '',
                    icon: Icons.apartment_rounded,
                    isUnfilled: department == null || department.toString().isEmpty,
                    unfillLabel: 'Bo\'lim kiritilmagan',
                    color: const Color(0xFF48CAE4),
                  ),
                  _buildEmpTypeBadge(employeeType),
                ],
              ),

              // Psychological & arrival info
              if (psychStatus.isNotEmpty || firstSeenFormatted != null) ...[
                const SizedBox(height: 14),
                Row(
                  children: [
                    if (psychStatus.isNotEmpty) ...[
                      Icon(psychIcon, size: 16, color: psychColor),
                      const SizedBox(width: 5),
                      Text(
                        psychStatus,
                        style: TextStyle(color: psychColor, fontSize: 13, fontWeight: FontWeight.w700),
                      ),
                    ],
                    const Spacer(),
                    if (firstSeenFormatted != null) ...[
                      Icon(Icons.login_rounded, size: 15, color: Colors.grey.shade400),
                      const SizedBox(width: 4),
                      Text(
                        'Kirdi: $firstSeenFormatted',
                        style: TextStyle(color: Colors.grey.shade500, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ],
                    if (visitCount > 1) ...[
                      const SizedBox(width: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0F4FD),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '$visitCount marta',
                          style: const TextStyle(color: Color(0xFF2B5DE4), fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      )
                    ]
                  ],
                ),
              ],

              // Camera names row (reference: left-border list with icon)
              if (cameraNames.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0F4FD),
                    borderRadius: BorderRadius.circular(12),
                    border: Border(left: BorderSide(color: const Color(0xFF48CAE4), width: 3)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.videocam_outlined, size: 15, color: Colors.grey.shade500),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          cameraNames.take(2).join(' • '),
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String statusType, int lateMinutes, bool isLate) {
    if (statusType == 'did_not_come') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFFEF476F).withOpacity(0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Text(
          'Kelmagan',
          style: TextStyle(color: Color(0xFFEF476F), fontSize: 13, fontWeight: FontWeight.w700),
        ),
      );
    }
    if (isLate) {
      final hours = lateMinutes ~/ 60;
      final mins = lateMinutes % 60;
      final label = hours > 0 ? '${hours}s ${mins}d' : '${mins} daq.';
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFFFFB703).withOpacity(0.12),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            const Text('Kechikdi', style: TextStyle(color: Color(0xFFFFB703), fontSize: 11, fontWeight: FontWeight.w600)),
            Text(label, style: const TextStyle(color: Color(0xFFFFB703), fontSize: 15, fontWeight: FontWeight.w800)),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFF48CAE4).withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Text(
        'Keldi',
        style: TextStyle(color: Color(0xFF48CAE4), fontSize: 13, fontWeight: FontWeight.w700),
      ),
    );
  }

  Widget _buildInfoBadge({
    required String label,
    required IconData icon,
    bool isUnfilled = false,
    String unfillLabel = 'Kiritilmagan',
    Color color = const Color(0xFF2B5DE4),
  }) {
    final showLabel = isUnfilled ? unfillLabel : label;
    final effectiveColor = isUnfilled ? Colors.grey.shade400 : color;
    final bg = isUnfilled ? const Color(0xFFF5F5F5) : color.withOpacity(0.1);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: isUnfilled ? Border.all(color: Colors.grey.shade300, width: 1) : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: effectiveColor),
          const SizedBox(width: 5),
          Text(
            showLabel,
            style: TextStyle(
              color: effectiveColor,
              fontSize: 12,
              fontWeight: isUnfilled ? FontWeight.w500 : FontWeight.w700,
              fontStyle: isUnfilled ? FontStyle.italic : FontStyle.normal,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpTypeBadge(String? employeeType) {
    if (employeeType == null || employeeType.isEmpty) {
      return _buildInfoBadge(
        label: '',
        icon: Icons.badge_outlined,
        isUnfilled: true,
        unfillLabel: 'Tur kiritilmagan',
        color: Colors.grey,
      );
    }

    String label = employeeType;
    Color color = const Color(0xFF2B5DE4);
    IconData icon = Icons.badge_rounded;

    switch (employeeType.toLowerCase()) {
      case 'employee':
        label = 'Xodim';
        color = const Color(0xFF2B5DE4);
        icon = Icons.person_rounded;
        break;
      case 'student':
        label = 'Talaba';
        color = const Color(0xFF48CAE4);
        icon = Icons.school_rounded;
        break;
      case 'teacher':
        label = 'O\'qituvchi';
        color = const Color(0xFFFFB703);
        icon = Icons.cast_for_education_rounded;
        break;
      case 'admin':
        label = 'Admin';
        color = const Color(0xFFEF476F);
        icon = Icons.admin_panel_settings_rounded;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 5),
          Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
