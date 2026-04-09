import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'home_screen.dart';
import 'login_screen.dart';
import 'pin_lock_screen.dart';

class IntroScreen extends StatefulWidget {
  final bool isLoggedIn;
  const IntroScreen({super.key, required this.isLoggedIn});

  @override
  State<IntroScreen> createState() => _IntroScreenState();
}

class _IntroScreenState extends State<IntroScreen> {
  late VideoPlayerController _controller;
  bool _isVideoInitialized = false;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.asset('assets/videos/intro.mp4')
      ..initialize().then((_) {
        setState(() {
          _isVideoInitialized = true;
        });
        _controller.setVolume(1.0);
        _controller.play();
      });

    // Listen to video completion to navigate automatically
    _controller.addListener(() {
      if (_controller.value.isInitialized &&
          !_controller.value.isPlaying &&
          _controller.value.position >= _controller.value.duration) {
        _navigateToNext();
      }
    });
  }

  Future<void> _navigateToNext() async {
    if (!mounted) return;
    if (widget.isLoggedIn) {
      final prefs = await SharedPreferences.getInstance();
      final savedPin = prefs.getString('app_pin') ?? '';
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => savedPin.isNotEmpty ? const PinLockScreen() : const HomeScreen(),
        ),
      );
    } else {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black, // Makes top and bottom borders black natively
      body: Center(
        child: _isVideoInitialized
            ? AspectRatio(
                aspectRatio: _controller.value.aspectRatio,
                child: VideoPlayer(_controller),
              )
            : const CircularProgressIndicator(color: Colors.white),
      ),
      // Optionally add a skip button just in case the user doesn't want to wait
      floatingActionButton: FloatingActionButton.small(
        onPressed: _navigateToNext,
        backgroundColor: Colors.white24,
        elevation: 0,
        child: const Icon(Icons.skip_next, color: Colors.white),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endTop,
    );
  }
}
