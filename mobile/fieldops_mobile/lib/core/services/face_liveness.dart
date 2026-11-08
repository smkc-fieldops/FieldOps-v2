import 'dart:math';
import 'dart:typed_data';

import 'package:image/image.dart' as img;

/// One camera frame as ML Kit saw it (only what liveness needs).
class FaceSample {
  final int faceCount;
  final double? leftEyeOpen;
  final double? rightEyeOpen;
  final double? smiling;

  /// ML Kit `headEulerAngleY` in degrees.
  final double? yaw;

  const FaceSample({
    required this.faceCount,
    this.leftEyeOpen,
    this.rightEyeOpen,
    this.smiling,
    this.yaw,
  });
}

/// Actions of the server's one-time challenge (`ChallengeDto.actions`).
enum LivenessAction { blink, smile, turnLeft, turnRight }

LivenessAction? livenessActionFromWire(String name) => switch (name) {
      'BLINK' => LivenessAction.blink,
      'SMILE' => LivenessAction.smile,
      'TURN_LEFT' => LivenessAction.turnLeft,
      'TURN_RIGHT' => LivenessAction.turnRight,
      _ => null,
    };

/// Active liveness on the phone: the person performs the server's actions in
/// order, one face in view the whole time. It only gates the capture; the
/// server still matches the face and checks for spoofing (no fail-open).
class LivenessTracker {
  static const eyesOpen = 0.7;
  static const eyesClosed = 0.25;
  static const smile = 0.8;
  static const turnDegrees = 20.0;
  static const frontalDegrees = 12.0;

  final List<LivenessAction> actions;
  int _index = 0;
  bool _sawOpenEyes = false;

  LivenessTracker(this.actions);

  int get completed => _index;
  bool get isDone => _index >= actions.length;
  LivenessAction? get current => isDone ? null : actions[_index];

  /// Feeds one frame. A frame with no face or several faces starts over.
  void add(FaceSample s) {
    if (isDone) return;
    if (s.faceCount != 1) {
      _index = 0;
      _sawOpenEyes = false;
      return;
    }
    if (_satisfied(current!, s)) {
      _index++;
      _sawOpenEyes = false;
    }
  }

  /// Ready for the still photo: all actions done and the face frontal again.
  bool readyForCapture(FaceSample s) =>
      isDone && s.faceCount == 1 && (s.yaw ?? 0).abs() <= frontalDegrees;

  bool _satisfied(LivenessAction a, FaceSample s) {
    final l = s.leftEyeOpen, r = s.rightEyeOpen;
    switch (a) {
      case LivenessAction.blink:
        if (l == null || r == null) return false;
        if (l >= eyesOpen && r >= eyesOpen) {
          _sawOpenEyes = true;
          return false;
        }
        return _sawOpenEyes && l <= eyesClosed && r <= eyesClosed;
      case LivenessAction.smile:
        return (s.smiling ?? 0) >= smile;
      // ML Kit: positive yaw = head turned to the person's left on the front
      // camera. Check on the pilot phones; swap here if a model differs.
      case LivenessAction.turnLeft:
        return (s.yaw ?? 0) >= turnDegrees;
      case LivenessAction.turnRight:
        return (s.yaw ?? 0) <= -turnDegrees;
    }
  }
}

/// Face box in the photo's pixel coordinates (after EXIF rotation).
class FaceBox {
  final double left, top, width, height;
  const FaceBox(this.left, this.top, this.width, this.height);
}

class FaceCrop {
  /// The API body limit is 100 kB; base64 adds a third.
  static const maxBytes = 70 * 1024;
  static const side = 320;

  /// Cuts the face with a wide margin (the server's anti-spoofing model looks
  /// at 1.5x the face; tighter crops read as spoofs), scales the longer side to [side] px and
  /// encodes a JPEG under [maxBytes]. Returns null if nothing fits.
  static Uint8List? fromJpeg(Uint8List photo, FaceBox box, {double margin = 0.5}) {
    final decoded = img.decodeImage(photo);
    if (decoded == null) return null;
    final image = img.bakeOrientation(decoded);

    final mx = box.width * margin, my = box.height * margin;
    final x = max(0, (box.left - mx).floor());
    final y = max(0, (box.top - my).floor());
    final w = min(image.width - x, (box.width + 2 * mx).ceil());
    final h = min(image.height - y, (box.height + 2 * my).ceil());
    if (w <= 0 || h <= 0) return null;

    var face = img.copyCrop(image, x: x, y: y, width: w, height: h);
    if (max(face.width, face.height) > side) {
      face = face.width >= face.height
          ? img.copyResize(face, width: side)
          : img.copyResize(face, height: side);
    }
    for (var quality = 90; quality >= 40; quality -= 10) {
      final jpeg = img.encodeJpg(face, quality: quality);
      if (jpeg.length <= maxBytes) return jpeg;
    }
    return null;
  }
}
