import 'dart:async';
import 'dart:convert';

import 'package:built_collection/built_collection.dart';
import 'package:fieldops_api/fieldops_api.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:uuid/uuid.dart';

import '../../../core/api/api_failure.dart';
import '../../../core/api/api_service.dart';
import '../../../core/controllers/auth_controller.dart';
import '../../../core/services/face_liveness.dart';
import '../../../core/services/location_ping_service.dart';
import '../attendance_rules.dart';

enum PunchStep { idle, locating, face, sending, done, failed }

/// Today's record and the punch flow: settle GPS, take the server's one-time
/// challenge, ML Kit liveness, send the face crop. The server stamps the time,
/// checks the geofence and matches the face; nothing is decided here.
class AttendanceController extends GetxController {
  static const _uuid = Uuid();
  static const gpsTimeout = Duration(seconds: 45);

  ApiService get _api => Get.find<ApiService>();
  AuthController get _auth => Get.find<AuthController>();

  final isLoading = false.obs;
  final Rx<AttendanceLogDto?> todayLog = Rx(null);
  final Rx<EffectiveShiftDto?> shift = Rx(null);
  final Rx<ApiFailure?> loadFailure = Rx(null);

  // Punch flow
  final step = PunchStep.idle.obs;
  final Rx<Position?> position = Rx(null);
  final accuracyOk = false.obs;
  final Rx<ChallengeDto?> challenge = Rx(null);
  final Rx<ApiFailure?> failure = Rx(null);
  final Rx<PunchResultDto?> result = Rx(null);
  final aadhaarRequired = false.obs;

  /// One per punch attempt, reused on retries so a timeout never punches twice.
  String? _clientUuid;
  StreamSubscription<Position>? _gpsSub;

  @override
  void onInit() {
    super.onInit();
    loadToday();
  }

  @override
  void onClose() {
    _gpsSub?.cancel();
    super.onClose();
  }

  bool get isCheckedIn => todayLog.value?.checkin != null && todayLog.value?.checkout == null;
  bool get isCheckedOut => todayLog.value?.checkout != null;
  double get accuracyLimit => AttendanceRules.accuracyLimitM(_auth.staffRole);

  String get hoursWorked {
    final log = todayLog.value;
    if (log == null) return '—';
    if (log.workedMinutes != null) return AttendanceRules.hoursLabel(log.workedMinutes!.toInt());
    final inAt = log.checkin?.at;
    if (inAt == null) return '—';
    return AttendanceRules.hoursLabel(DateTime.now().toUtc().difference(inAt).inMinutes);
  }

  // ── Today ──────────────────────────────────────────────────

  Future<void> loadToday() async {
    final staffId = _auth.staffId;
    if (staffId == null) return;
    isLoading.value = true;
    final now = DateTime.now().toUtc();
    final today = AttendanceRules.istDate(now);
    final yesterday = AttendanceRules.istYesterday(now);
    try {
      final page = (await _api.attendance.attendanceControllerList(
        from: yesterday,
        to: today,
        staffId: staffId,
        pageSize: 10,
      ))
          .data!;
      todayLog.value = AttendanceRules.current<AttendanceLogDto>(
        page.items,
        today: today,
        yesterday: yesterday,
        dateOf: (l) => l.date,
        isOpen: (l) => l.checkin != null && l.checkout == null,
      );
      loadFailure.value = null;
    } catch (e) {
      loadFailure.value = ApiFailure.from(e);
    } finally {
      isLoading.value = false;
    }
    try {
      shift.value = (await _api.shifts.shiftsControllerEffective(staffId: staffId, date: today)).data;
    } catch (e) {
      debugPrint('Effective shift: $e');
    }
    // App restarted mid-shift: keep the breadcrumbs going.
    if (isCheckedIn && !_auth.isOfficeStaff) {
      LocationPingService().resumeIfActive();
    }
  }

  // ── Punch flow ─────────────────────────────────────────────

  void resetFlow() {
    _gpsSub?.cancel();
    step.value = PunchStep.idle;
    position.value = null;
    accuracyOk.value = false;
    challenge.value = null;
    failure.value = null;
    result.value = null;
    aadhaarRequired.value = false;
    _clientUuid = null;
  }

  /// Step 1: watch GPS until the fix is accurate enough (50 m field, 100 m
  /// office) or [gpsTimeout] passes. The best fix is kept either way; the
  /// punch is only offered once [accuracyOk] is true.
  Future<bool> settleGps() async {
    step.value = PunchStep.locating;
    failure.value = null;
    accuracyOk.value = false;
    if (!await _locationReady()) {
      step.value = PunchStep.failed;
      return false;
    }
    final done = Completer<bool>();
    await _gpsSub?.cancel();
    _gpsSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.best, distanceFilter: 0),
    ).listen((p) {
      final best = position.value;
      if (best == null || p.accuracy <= best.accuracy) position.value = p;
      if (p.accuracy <= accuracyLimit && !done.isCompleted) {
        accuracyOk.value = true;
        done.complete(true);
      }
    }, onError: (Object e) {
      if (!done.isCompleted) done.complete(false);
    });
    final ok = await done.future.timeout(gpsTimeout, onTimeout: () => false);
    await _gpsSub?.cancel();
    _gpsSub = null;
    if (!ok) {
      failure.value = const ApiFailure(code: 'LOCATION_TOO_INACCURATE');
      step.value = PunchStep.failed;
    }
    return ok;
  }

  Future<bool> _locationReady() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      failure.value = const ApiFailure(code: ApiCodes.gpsDisabled);
      return false;
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      failure.value = const ApiFailure(code: ApiCodes.locationPermission);
      return false;
    }
    return true;
  }

  /// Step 2: the server's capture mode and a one-time challenge (2 minutes).
  Future<List<LivenessAction>?> startChallenge() async {
    failure.value = null;
    try {
      final options = (await _api.face.faceControllerCaptureOptions()).data!;
      if (options.provider == FaceCaptureOptionsDtoProviderEnum.aadhaar) {
        // UIDAI FaceRD capture is not in this build (decision D4: ready to
        // plug in when SMKC asks).
        aadhaarRequired.value = true;
        step.value = PunchStep.failed;
        return null;
      }
      final c = (await _api.attendance.attendanceControllerChallenge(
        createChallengeDto: CreateChallengeDto(),
      ))
          .data!;
      challenge.value = c;
      _clientUuid = _uuid.v4();
      step.value = PunchStep.face;
      return c.actions.map((a) => livenessActionFromWire(a.name)).whereType<LivenessAction>().toList();
    } catch (e) {
      failure.value = ApiFailure.from(e);
      step.value = PunchStep.failed;
      return null;
    }
  }

  /// Step 3: send the punch with the face crop. Network failures are retried
  /// twice with the same client UUID; the server replays a punch it already
  /// stored instead of creating a second one.
  Future<bool> submitPunch({required bool checkOut, required Uint8List faceJpeg}) async {
    final c = challenge.value;
    final pos = position.value;
    if (c == null || pos == null) return false;
    step.value = PunchStep.sending;
    failure.value = null;
    final dto = CreatePunchDto((b) => b
      ..clientUuid = _clientUuid ??= _uuid.v4()
      ..type = checkOut ? CreatePunchDtoTypeEnum.OUT : CreatePunchDtoTypeEnum.IN
      ..challengeId = c.challengeId
      ..latitude = pos.latitude
      ..longitude = pos.longitude
      ..accuracyM = pos.accuracy
      ..isMocked = pos.isMocked
      ..faceImageBase64 = base64Encode(faceJpeg));

    for (var attempt = 0;; attempt++) {
      try {
        final res = (await _api.attendance.attendanceControllerPunch(createPunchDto: dto)).data!;
        result.value = res;
        todayLog.value = res.attendance;
        step.value = PunchStep.done;
        await _afterPunch(checkOut);
        return true;
      } catch (e) {
        final f = ApiFailure.from(e);
        if (f.isNetwork && attempt < 2) {
          await Future<void>.delayed(Duration(seconds: 2 * (attempt + 1)));
          continue;
        }
        failure.value = f;
        step.value = PunchStep.failed;
        // The challenge is spent once the server has seen it.
        if (!f.isNetwork) challenge.value = null;
        return false;
      }
    }
  }

  Future<void> _afterPunch(bool checkOut) async {
    if (_auth.isOfficeStaff) return;
    if (checkOut) {
      await LocationPingService().stopLiveTracking();
    } else {
      await LocationPingService().startLiveTracking();
    }
  }

  /// Statuses shown as chips (wire names from the API).
  static BuiltSet<AttendanceLogDtoStatusEnum> get presentLike => BuiltSet([
        AttendanceLogDtoStatusEnum.PRESENT,
        AttendanceLogDtoStatusEnum.LATE,
        AttendanceLogDtoStatusEnum.HALF_DAY,
      ]);
}
