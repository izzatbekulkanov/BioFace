import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'https://bioface.uz';
  static const String cookieKey = 'session_cookie';

  // Make an authenticated POST request
  static Future<http.Response> post(String endpoint, Map<String, dynamic> body) async {
    final prefs = await SharedPreferences.getInstance();
    final cookie = prefs.getString(cookieKey);
    // ignore: prefer_collection_literals
    final headers = Map<String, String>();
    headers['Content-Type'] = 'application/json';
    
    if (cookie != null) {
      headers['Cookie'] = cookie;
    }

    final url = Uri.parse('$baseUrl$endpoint');
    return await http.post(
      url,
      headers: headers,
      body: jsonEncode(body),
    );
  }

  // Make an authenticated GET request
  static Future<http.Response> get(String endpoint) async {
    final prefs = await SharedPreferences.getInstance();
    final cookie = prefs.getString(cookieKey);
    // ignore: prefer_collection_literals
    final headers = Map<String, String>();
    
    if (cookie != null) {
      headers['Cookie'] = cookie;
    }

    final url = Uri.parse('$baseUrl$endpoint');
    return await http.get(url, headers: headers);
  }

  // Login specific flow
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await post('/api/auth/login', {
      'email': email,
      'password': password,
    });

    if (response.statusCode == 200 || response.statusCode == 201) {
      final rawCookie = response.headers['set-cookie'];
      if (rawCookie != null) {
        int index = rawCookie.indexOf(';');
        final formattedCookie = (index == -1) ? rawCookie : rawCookie.substring(0, index);
        
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(cookieKey, formattedCookie);
        await prefs.setString('user_email', email);
      }
      final data = jsonDecode(response.body);
      return {'success': true, 'data': data};
    } else {
      String errorMessage = 'Tizimga ulanishda xatolik yuz berdi';
      try {
        final bodyData = jsonDecode(response.body);
        if (bodyData['detail'] != null) {
          errorMessage = bodyData['detail'];
        }
      } catch (e) {
        // ignore JSON errors if backend sends plain text
      }
      return {'success': false, 'message': errorMessage};
    }
  }

  // Fetch users list to get current logged-in user's full info
  static Future<Map<String, dynamic>> getCurrentUserInfo() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedEmail = prefs.getString('user_email') ?? '';
      final cached = prefs.getString('user_info_cache');
      if (cached != null) {
        return jsonDecode(cached);
      }
      final response = await get('/api/users');
      if (response.statusCode == 200) {
        final List<dynamic> users = jsonDecode(response.body);
        final match = users.firstWhere(
          (u) => (u['email'] ?? '').toString().toLowerCase() == savedEmail.toLowerCase(),
          orElse: () => null,
        );
        if (match != null) {
          await prefs.setString('user_info_cache', jsonEncode(match));
          return Map<String, dynamic>.from(match);
        }
      }
      return {'email': savedEmail};
    } catch (e) {
      return {};
    }
  }

  static Future<void> clearUserCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('user_info_cache');
  }

  static Future<Map<String, dynamic>> getAttendanceGroups(String todayStatus) async {
    try {
      final response = await get('/api/attendance/groups?today_status=$todayStatus&page=1&page_size=100');
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        return {'ok': false, 'error': 'Xatolik yuz berdi: ${response.statusCode}'};
      }
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> getDashboardMetrics() async {
    try {
      final response = await get('/api/dashboard/metrics');
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        return {'ok': false, 'error': 'Dashboard xatosi: ${response.statusCode}'};
      }
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }

  static Future<Map<String, dynamic>> getEmployeeCalendar(int empId, {int? year, int? month}) async {
    try {
      final now = DateTime.now();
      final y = year ?? now.year;
      final m = month ?? now.month;
      
      final response = await get('/api/employees/$empId/attendance-calendar?year=$y&month=$m');
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        return {'ok': false, 'error': 'Xatolik yuz berdi: ${response.statusCode}'};
      }
    } catch (e) {
      return {'ok': false, 'error': e.toString()};
    }
  }

  static Future<void> logout() async {
    await post('/api/auth/logout', {});
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(cookieKey);
  }

  static Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey(cookieKey);
  }
}
