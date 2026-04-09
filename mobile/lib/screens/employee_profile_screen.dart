import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class EmployeeProfileScreen extends StatefulWidget {
  final int employeeId;
  final String initialName;

  const EmployeeProfileScreen({
    super.key,
    required this.employeeId,
    required this.initialName,
  });

  @override
  State<EmployeeProfileScreen> createState() => _EmployeeProfileScreenState();
}

class _EmployeeProfileScreenState extends State<EmployeeProfileScreen> {
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;
  
  Map<String, dynamic>? _calendarData;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selectedDay = _focusedDay;
    _fetchCalendarData(_focusedDay.year, _focusedDay.month);
  }

  Future<void> _fetchCalendarData(int year, int month) async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final result = await ApiService.getEmployeeCalendar(widget.employeeId, year: year, month: month);
    if (!mounted) return;

    setState(() {
      _isLoading = false;
      if (result['ok'] == true) {
        _calendarData = result;
      } else {
        _error = result['error'] ?? 'Kalendar malumotlarini olishda xatolik yuz berdi';
      }
    });
  }

  Map<String, dynamic>? _getDayData(DateTime day) {
    if (_calendarData == null || _calendarData!['days'] == null) return null;
    final dateStr = DateFormat('yyyy-MM-dd').format(day);
    final daysList = _calendarData!['days'] as List<dynamic>;
    
    try {
      return daysList.firstWhere((element) => element['date'] == dateStr);
    } catch (e) {
      return null;
    }
  }

  Future<void> _onPageChanged(DateTime focusedDay) async {
    _focusedDay = focusedDay;
    if (_calendarData != null && 
        _calendarData!['month']['month'] == focusedDay.month && 
        _calendarData!['month']['year'] == focusedDay.year) {
      return; 
    }
    await _fetchCalendarData(focusedDay.year, focusedDay.month);
  }

  @override
  Widget build(BuildContext context) {
    final employee = _calendarData?['employee'];
    final name = employee?['first_name'] != null 
        ? '${employee['first_name']} ${employee['last_name'] ?? ''}'.trim()
        : widget.initialName;
    final position = employee?['position'] ?? 'Mas\'ul ishchi';
    final orgName = employee?['organization_name'] ?? '';
    final imageUrl = employee?['image_url'];

    // Stats
    final summary = _calendarData?['summary'] ?? {};
    final totalEvents = summary['total_events'] ?? 0;
    final totalLateHuman = summary['total_late_human_full'] ?? '0 daqiqa';

    return Scaffold(
      backgroundColor: const Color(0xFFF0F4FD),
      body: _isLoading && _calendarData == null
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2B5DE4)))
          : Stack(
              children: [
                // Top Blue Background Region matches "Sleep" screen header
                Container(
                  height: 320,
                  width: double.infinity,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF558DFA), Color(0xFF154EE0)],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    ),
                  ),
                ),
                
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 700),
                    child: SafeArea(
                      bottom: false,
                      child: Column(
                    children: [
                      // Header Row
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              decoration: BoxDecoration(color: Colors.white.withValues(alpha:0.2), borderRadius: BorderRadius.circular(12)),
                              child: IconButton(
                                icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
                                onPressed: () => Navigator.pop(context),
                              ),
                            ),
                            Text(name, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                            const SizedBox(width: 48), // Balance for Title centering
                          ],
                        ),
                      ),
                      
                      const SizedBox(height: 10),

                      // Avatar & Short Info (Still on Blue area)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha:0.3)),
                            child: CircleAvatar(
                              radius: 36,
                              backgroundColor: Colors.white,
                              backgroundImage: (imageUrl != null && imageUrl.toString().isNotEmpty) 
                                  ? NetworkImage(imageUrl) 
                                  : null,
                              child: (imageUrl == null || imageUrl.toString().isEmpty)
                                  ? Text(
                                      name.isNotEmpty ? name[0].toUpperCase() : '?',
                                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF2B5DE4)),
                                    )
                                  : null,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '$position${orgName.isNotEmpty ? ' • $orgName' : ''}',
                        style: TextStyle(color: Colors.white.withValues(alpha:0.9), fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 20),

                      // Main White Content Container
                      Expanded(
                        child: Container(
                          width: double.infinity,
                          decoration: const BoxDecoration(
                            color: Color(0xFFF0F4FD),
                            borderRadius: BorderRadius.only(topLeft: Radius.circular(40), topRight: Radius.circular(40)),
                          ),
                          child: RefreshIndicator(
                            onRefresh: () => _fetchCalendarData(_focusedDay.year, _focusedDay.month),
                            color: const Color(0xFF2B5DE4),
                            backgroundColor: Colors.white,
                            child: SingleChildScrollView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(20, 30, 20, 60),
                              child: Column(
                                children: [
                                  if (_error != null)
                                    Container(
                                      padding: const EdgeInsets.all(12),
                                      margin: const EdgeInsets.only(bottom: 20),
                                      decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(16)),
                                      child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                                    ),

                                  // Calendar Card
                                  Container(
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(32),
                                      boxShadow: [
                                        BoxShadow(color: const Color(0xFF4579FA).withValues(alpha:0.05), blurRadius: 30, offset: const Offset(0, 15))
                                      ],
                                    ),
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                                    child: TableCalendar(
                                      firstDay: DateTime.utc(2020, 1, 1),
                                      lastDay: DateTime.utc(2030, 12, 31),
                                      focusedDay: _focusedDay,
                                      selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
                                      onDaySelected: (selectedDay, focusedDay) {
                                        setState(() {
                                          _selectedDay = selectedDay;
                                          _focusedDay = focusedDay;
                                        });
                                      },
                                      onPageChanged: _onPageChanged,
                                      calendarFormat: CalendarFormat.month,
                                      availableCalendarFormats: const {CalendarFormat.month: 'Oy'},
                                      headerStyle: const HeaderStyle(
                                        titleCentered: true,
                                        formatButtonVisible: false,
                                        titleTextStyle: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF131722)),
                                        leftChevronIcon: Icon(Icons.chevron_left, color: Color(0xFF2B5DE4)),
                                        rightChevronIcon: Icon(Icons.chevron_right, color: Color(0xFF2B5DE4)),
                                      ),
                                      daysOfWeekStyle: DaysOfWeekStyle(
                                        weekdayStyle: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600),
                                        weekendStyle: TextStyle(color: Colors.grey.shade400, fontWeight: FontWeight.w600),
                                      ),
                                      calendarStyle: CalendarStyle(
                                        selectedDecoration: const BoxDecoration(
                                          color: Color(0xFF2B5DE4),
                                          shape: BoxShape.circle,
                                          boxShadow: [BoxShadow(color: Color(0x662B5DE4), blurRadius: 8, offset: Offset(0, 4))],
                                        ),
                                        todayDecoration: BoxDecoration(
                                          color: const Color(0xFF2B5DE4).withValues(alpha:0.15),
                                          shape: BoxShape.circle,
                                        ),
                                        todayTextStyle: const TextStyle(color: Color(0xFF2B5DE4), fontWeight: FontWeight.bold),
                                      ),
                                      calendarBuilders: CalendarBuilders(
                                        markerBuilder: (context, day, events) {
                                          final dayData = _getDayData(day);
                                          if (dayData == null) return null;
                                          
                                          final status = dayData['status'];
                                          Color markerColor = Colors.transparent;
                                          if (status == 'present') markerColor = const Color(0xFF48CAE4);
                                          if (status == 'late') markerColor = const Color(0xFFFFB703);
                                          if (status == 'absent') markerColor = const Color(0xFFEF476F);

                                          return Positioned(
                                            bottom: 6,
                                            child: Container(
                                              width: 6,
                                              height: 6,
                                              decoration: BoxDecoration(color: markerColor, shape: BoxShape.circle),
                                            ),
                                          );
                                        },
                                      ),
                                    ),
                                  ),

                                  const SizedBox(height: 24),

                                  // Stats Summary Row
                                  Row(
                                    children: [
                                      _buildStatCard('Aktiv kunlar', '$totalEvents ta', Icons.calendar_month_rounded, const Color(0xFF48CAE4)),
                                      const SizedBox(width: 16),
                                      _buildStatCard('Jami kechqolish', totalLateHuman, Icons.timer_outlined, const Color(0xFFFFB703)),
                                    ],
                                  ),
                                  
                                  const SizedBox(height: 24),
                                  if (_selectedDay != null) _buildSelectedDayDetails(),
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
            ),
          ],
        ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color iconColor) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [BoxShadow(color: const Color(0xFF4579FA).withValues(alpha:0.04), blurRadius: 20, offset: const Offset(0, 10))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: iconColor.withValues(alpha:0.1), shape: BoxShape.circle),
              child: Icon(icon, color: iconColor, size: 22),
            ),
            const SizedBox(height: 16),
            Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF131722))),
            const SizedBox(height: 4),
            Text(title, style: TextStyle(color: Colors.grey.shade500, fontSize: 13, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }

  Widget _buildSelectedDayDetails() {
    final dayData = _getDayData(_selectedDay!);
    final dateStr = DateFormat('dd MMMM yyyy').format(_selectedDay!);

    if (dayData == null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white, 
          borderRadius: BorderRadius.circular(24),
          boxShadow: [BoxShadow(color: const Color(0xFF4579FA).withValues(alpha:0.04), blurRadius: 20, offset: const Offset(0, 10))],
        ),
        child: Column(
          children: [
            Text(dateStr, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131722))),
            const SizedBox(height: 12),
            Text('Ushbu kun bo\'yicha ma\'lumot topilmadi', style: TextStyle(color: Colors.grey.shade500)),
          ],
        ),
      );
    }

    final isPresent = dayData['present'] == true;
    final status = dayData['status'];
    final lateHuman = dayData['late_human_full'] ?? '';
    final workedHuman = dayData['worked_human'] ?? '';
    final cameras = dayData['camera_names'] as List<dynamic>? ?? [];

    Color statusColor = Colors.grey;
    String statusText = 'Kelmagan';
    IconData statusIcon = Icons.cancel;

    if (status == 'present') {
      statusColor = const Color(0xFF48CAE4);
      statusText = 'O\'z vaqtida kelgan';
      statusIcon = Icons.check_circle;
    } else if (status == 'late') {
      statusColor = const Color(0xFFFFB703);
      statusText = 'Kechikkan';
      statusIcon = Icons.warning;
    } else if (status == 'absent') {
      statusColor = const Color(0xFFEF476F);
      statusText = 'Kelmagan';
      statusIcon = Icons.cancel;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [BoxShadow(color: const Color(0xFF4579FA).withValues(alpha:0.05), blurRadius: 30, offset: const Offset(0, 15))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(dateStr, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131722), letterSpacing: -0.5)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: statusColor.withValues(alpha:0.15), borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    Icon(statusIcon, color: statusColor, size: 14),
                    const SizedBox(width: 4),
                    Text(statusText, style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.bold)),
                  ],
                ),
              )
            ],
          ),
          const SizedBox(height: 20),
          const Divider(height: 1, color: Color(0xFFF0F4FD), thickness: 2),
          const SizedBox(height: 20),
          
          if (isPresent) ...[
            _buildTimelineRow('Kutilgan vaqt', DateFormat('HH:mm').format(DateTime.parse(dayData['expected_time'])), Icons.access_time, isPast: true),
            const SizedBox(height: 20),
            _buildTimelineRow('Kelgan vaqti', DateFormat('HH:mm').format(DateTime.parse(dayData['first_seen'])), Icons.login_rounded, isHighlight: status == 'late', highlightColor: const Color(0xFFFFB703)),
            if (status == 'late') ...[
              const SizedBox(height: 20),
              _buildTimelineRow('Kechikdi', lateHuman, Icons.warning_amber_rounded, isHighlight: true, highlightColor: const Color(0xFFEF476F)),
            ],
            const SizedBox(height: 20),
            _buildTimelineRow('Ohirgi ko\'rinish', DateFormat('HH:mm').format(DateTime.parse(dayData['last_seen'])), Icons.logout_rounded),
            const SizedBox(height: 20),
            _buildTimelineRow('Ish vaqti', workedHuman, Icons.work_history_rounded),
            
            if (cameras.isNotEmpty) ...[
              const SizedBox(height: 24),
              Text('Asosiy joylashuv (Kameralar):', style: TextStyle(color: Colors.grey.shade500, fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: cameras.map((c) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: const Color(0xFFF0F4FD), borderRadius: BorderRadius.circular(12)),
                  child: Text(c.toString(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF2B5DE4))),
                )).toList(),
              )
            ]
          ] else ...[
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Column(
                  children: [
                    Icon(Icons.bedtime_outlined, size: 48, color: Colors.grey.withValues(alpha:0.3)),
                    const SizedBox(height: 12),
                    Text('Ushbu kun xodim tizimda ro\'yxatdan o\'tmagan.', style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            )
          ]
        ],
      ),
    );
  }

  Widget _buildTimelineRow(String label, String value, IconData icon, {bool isPast = false, bool isHighlight = false, Color highlightColor = Colors.black87}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
           children: [
             Icon(icon, size: 18, color: Colors.grey.shade400),
             const SizedBox(width: 8),
             Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 14, fontWeight: FontWeight.w500)),
           ],
        ),
        Text(
          value,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 15,
            decoration: isPast ? TextDecoration.lineThrough : null,
            decorationColor: Colors.grey.shade400,
            decorationThickness: 2,
            color: isHighlight ? highlightColor : const Color(0xFF131722),
          ),
        ),
      ],
    );
  }
}
