import 'package:flutter/material.dart';

/// A wrapper to ensure layouts do not continuously stretch horizontally on tablets and landscape screens.
class ResponsiveLayout extends StatelessWidget {
  final Widget child;
  final double maxWidth;
  final Color backgroundColor;
  final AlignmentGeometry alignment;

  const ResponsiveLayout({
    super.key,
    required this.child,
    this.maxWidth = 700,
    this.backgroundColor = const Color(0xFFF0F4FD),
    this.alignment = Alignment.topCenter,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: backgroundColor, // Fills the out-of-bounds area with the standard background color
      alignment: alignment,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}
