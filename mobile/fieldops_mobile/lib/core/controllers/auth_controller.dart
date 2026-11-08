import 'package:fieldops_api/fieldops_api.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../api/api_failure.dart';
import '../api/api_service.dart';
import '../api/env.dart';
import '../routes/app_routes.dart';
import '../services/location_ping_service.dart';
import '../../features/attendance/controllers/attendance_controller.dart';

/// Sign-in by OTP through `/auth/otp/*`, the signed-in profile and sign-out.
/// Tokens live in the keystore (SessionManager); only the profile, which holds
/// no secret, is cached in SharedPreferences so the app opens offline.
class AuthController extends GetxController {
  static const _profileKey = 'cached_staff_profile_v2';
  static const _wardKey = 'cached_ward_v2';
  static const _deviceKey = 'device_id';

  final _localAuth = LocalAuthentication();

  ApiService get _api => Get.find<ApiService>();

  final isLoading = false.obs;
  final isAuthenticated = false.obs;
  final isBiometricAvailable = false.obs;
  final Rx<StaffProfileDto?> profile = Rx(null);
  final Rx<WardDto?> homeWard = Rx(null);

  /// Seconds until the OTP expires, from the last request.
  final otpExpiresIn = 0.obs;

  @override
  void onInit() {
    super.onInit();
    _api.session.onExpired = _onSessionExpired;
    _checkBiometricAvailability();
  }

  Future<void> _checkBiometricAvailability() async {
    try {
      final available = await _localAuth.canCheckBiometrics;
      final supported = await _localAuth.isDeviceSupported();
      isBiometricAvailable.value = available || supported;
    } catch (e) {
      debugPrint('Biometric availability check: $e');
      isBiometricAvailable.value = false;
    }
  }

  /// Splash: signed in (tokens in the keystore) → app lock, else sign-in.
  Future<void> checkExistingSession() async {
    if (!await _api.session.hasSession) {
      Get.offAllNamed(AppRoutes.otpLogin);
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    profile.value = _api.decode(StaffProfileDto.serializer, prefs.getString(_profileKey));
    homeWard.value = _api.decode(WardDto.serializer, prefs.getString(_wardKey));
    isAuthenticated.value = true;
    await _checkBiometricAvailability();
    Get.offAllNamed(AppRoutes.biometricLock);
    // Fresh profile in the background (role, ward or shift may have changed).
    refreshProfile();
  }

  // ── OTP ────────────────────────────────────────────────────

  static String? tenDigits(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 10) return null;
    return digits.substring(digits.length - 10);
  }

  Future<bool> sendOtp(String phone) async {
    final last10 = tenDigits(phone);
    if (last10 == null) {
      _showError('invalid_phone'.tr);
      return false;
    }
    isLoading.value = true;
    try {
      final res = await _api.auth.authControllerRequestOtp(
        otpRequestDto: OtpRequestDto((b) => b..phone = last10),
      );
      otpExpiresIn.value = res.data?.expiresInSeconds.toInt() ?? 300;
      _showSuccess('otp_sent'.tr, 'otp_sent_to'.trParams({'phone': last10}));
      return true;
    } catch (e) {
      _showFailure(e);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> verifyOtp(String phone, String otp) async {
    final last10 = tenDigits(phone);
    if (last10 == null) return _showError('invalid_phone'.tr);
    isLoading.value = true;
    try {
      final deviceId = await _deviceId();
      final res = await _api.auth.authControllerVerifyOtp(
        headers: {'User-Agent': 'FieldOps-Android/${Env.versionCode}'},
        otpVerifyDto: OtpVerifyDto((b) => b
          ..phone = last10
          ..code = otp.trim()
          ..deviceId = deviceId),
      );
      await _startSession(res.data!);
    } catch (e) {
      _showFailure(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<String> _deviceId() async {
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_deviceKey);
    if (id == null) {
      id = const Uuid().v4();
      await prefs.setString(_deviceKey, id);
    }
    return id;
  }

  Future<void> _startSession(SessionTokensDto tokens) async {
    await _api.session.save(ApiService.sessionFromTokens(tokens));
    await _setProfile(tokens.staff);
    isAuthenticated.value = true;

    if (Get.isRegistered<AttendanceController>()) {
      Get.find<AttendanceController>().loadToday();
    }
    Get.offAllNamed(AppRoutes.mainShell);
  }

  Future<void> refreshProfile() async {
    try {
      final res = await _api.auth.authControllerMe();
      await _setProfile(res.data!);
    } catch (e) {
      debugPrint('Profile refresh: $e');
    }
  }

  Future<void> _setProfile(StaffProfileDto staff) async {
    profile.value = staff;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_profileKey, _api.encode(StaffProfileDto.serializer, staff));
    final wardId = staff.homeWardId;
    if (wardId == null) {
      homeWard.value = null;
      await prefs.remove(_wardKey);
      return;
    }
    if (homeWard.value?.id == wardId) return;
    try {
      final ward = (await _api.wards.wardsControllerGet(id: wardId)).data!;
      homeWard.value = ward;
      await prefs.setString(_wardKey, _api.encode(WardDto.serializer, ward));
    } catch (e) {
      debugPrint('Ward load: $e');
    }
  }

  // ── App lock (device biometric / PIN; not attendance proof) ─

  Future<bool> authenticateWithBiometric() async {
    try {
      final supported = await _localAuth.isDeviceSupported();
      final canCheck = await _localAuth.canCheckBiometrics;
      // No screen lock on this phone: nothing to unlock with.
      if (!supported && !canCheck) return true;
      return await _localAuth.authenticate(
        localizedReason: 'biometric_reason'.tr,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false,
          useErrorDialogs: true,
        ),
      );
    } catch (e) {
      debugPrint('Biometric auth error: $e');
      return false;
    }
  }

  // ── Sign-out ───────────────────────────────────────────────

  Future<void> signOut() async {
    try {
      await _api.auth.authControllerLogout(logoutDto: LogoutDto());
    } catch (e) {
      debugPrint('Logout call: $e');
    }
    await _clearLocal();
    Get.offAllNamed(AppRoutes.otpLogin);
  }

  /// The server refused the refresh token (signed out elsewhere, revoked or
  /// expired): remote logout lands here.
  void _onSessionExpired() {
    _clearLocal();
    if (Get.currentRoute != AppRoutes.otpLogin) {
      Get.offAllNamed(AppRoutes.otpLogin);
      _showError(ErrorMessages.text(ApiCodes.unauthenticated, lang));
    }
  }

  Future<void> _clearLocal() async {
    LocationPingService().stopLiveTracking();
    await _api.session.clear();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_profileKey);
    await prefs.remove(_wardKey);
    profile.value = null;
    homeWard.value = null;
    isAuthenticated.value = false;
  }

  // ── Helpers ────────────────────────────────────────────────

  static String get lang => Get.locale?.languageCode == 'mr' ? 'mr' : 'en';

  void _showFailure(Object e) => _showError(ApiFailure.from(e).message(lang));

  void _showError(String msg) {
    Get.snackbar(
      'error'.tr,
      msg,
      snackPosition: SnackPosition.BOTTOM,
      backgroundColor: Colors.red.shade700,
      colorText: Colors.white,
      duration: const Duration(seconds: 4),
    );
  }

  void _showSuccess(String title, String msg) {
    Get.snackbar(
      title,
      msg,
      snackPosition: SnackPosition.BOTTOM,
      backgroundColor: Colors.green.shade700,
      colorText: Colors.white,
      duration: const Duration(seconds: 4),
    );
  }

  // Convenience getters
  String? get staffId => profile.value?.id;
  String get staffName => profile.value?.fullName ?? '';
  String get staffNameMr => profile.value?.fullNameMr ?? staffName;
  String get displayName => lang == 'mr' ? staffNameMr : staffName;
  String get staffRole => profile.value?.role.name ?? 'WORKER';
  String get wardName =>
      (lang == 'mr' ? homeWard.value?.nameMr : homeWard.value?.name) ?? '';
  String get department => profile.value?.department ?? '';
  String get employeeCode => profile.value?.employeeCode ?? '';
  String get phone => profile.value?.phone ?? '';
  bool get isOfficeStaff => staffRole == 'OFFICE_STAFF';
  bool get isAdmin => staffRole == 'ADMIN';
  bool get isSupervisor =>
      staffRole == 'ADMIN' || staffRole == 'WARD_INSPECTOR' || staffRole == 'INSPECTOR';
}
