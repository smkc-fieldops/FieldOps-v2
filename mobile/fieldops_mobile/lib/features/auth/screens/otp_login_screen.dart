import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import '../../../core/controllers/auth_controller.dart';
import '../../../core/controllers/locale_controller.dart';
import '../../../core/theme/app_theme.dart';

class OtpLoginScreen extends StatefulWidget {
  const OtpLoginScreen({super.key});

  @override
  State<OtpLoginScreen> createState() => _OtpLoginScreenState();
}

class _OtpLoginScreenState extends State<OtpLoginScreen> {
  final _authController = Get.find<AuthController>();
  final _localeController = Get.find<LocaleController>();
  final _phoneController = TextEditingController();
  final _otpController   = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _otpSent = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    final phone = _phoneController.text.trim().replaceAll(RegExp(r'\D'), '');
    if (phone.length != 10) {
      Get.snackbar(
        'error'.tr,
        'invalid_phone'.tr,
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.shade700,
        colorText: Colors.white,
      );
      return;
    }
    final success = await _authController.sendOtp(phone);
    if (success && mounted) {
      setState(() {
        _otpSent = true;
        _otpController.clear();
      });
    }
  }

  Future<void> _verifyOtp() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      Get.snackbar(
        'error'.tr,
        'invalid_otp'.tr,
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: Colors.red.shade700,
        colorText: Colors.white,
      );
      return;
    }
    await _authController.verifyOtp(
      _phoneController.text.trim(),
      otp,
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {},
      child: Scaffold(
        backgroundColor: const Color(0xFFF8F9FA),
        body: SafeArea(
          child: Obx(() {
            // Observe locale for immediate reactive text updates
            final _ = _localeController.currentLocale.value;
            return SingleChildScrollView(
              physics: const ClampingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Language Selection Bar at the top
                  _buildLanguageSelector(),

                  const SizedBox(height: 12),

                  // Municipality Logo
                  Container(
                    width: 92,
                    height: 92,
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.08),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: ClipOval(
                      child: Image.asset(
                        'assets/images/smkmc_logo.png',
                        width: 84,
                        height: 84,
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) => const Icon(
                          Icons.account_balance,
                          color: AppColors.primary,
                          size: 48,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Municipal Corporation Title
                  Text(
                    'smkmc_title'.tr,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontFamily: 'NotoSansDevanagari',
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1B5E20),
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    'Sangli Miraj Kupwad Municipal Corporation',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.subtle,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'smkmc_subtitle'.tr,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontFamily: 'NotoSansDevanagari',
                      fontSize: 12,
                      color: Color(0xFF555555),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Phone number & OTP card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 14,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.phone_android, size: 18, color: AppColors.primary),
                            const SizedBox(width: 6),
                            Text(
                              _otpSent ? 'enter_otp'.tr : 'enter_phone'.tr,
                              style: const TextStyle(
                                fontFamily: 'NotoSansDevanagari',
                                fontSize: 13,
                                color: Color(0xFF374151),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),

                        // Phone field
                        TextFormField(
                          controller: _phoneController,
                          enabled: !_otpSent,
                          keyboardType: TextInputType.phone,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(10),
                          ],
                          decoration: InputDecoration(
                            prefixText: '+91  ',
                            hintText: 'enter_phone_hint'.tr,
                            filled: true,
                            fillColor: const Color(0xFFF9FAFB),
                            prefixStyle: const TextStyle(
                              color: AppColors.onSurface,
                              fontWeight: FontWeight.w600,
                            ),
                            suffixIcon: _otpSent
                                ? IconButton(
                                    icon: const Icon(Icons.edit, size: 18, color: AppColors.primary),
                                    onPressed: () => setState(() => _otpSent = false),
                                  )
                                : null,
                          ),
                        ),

                        if (_otpSent) ...[
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _otpController,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(6),
                            ],
                            decoration: const InputDecoration(
                              hintText: '1 2 3 4 5 6',
                              filled: true,
                              fillColor: Color(0xFFF9FAFB),
                            ),
                            style: const TextStyle(
                              letterSpacing: 8,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              TextButton(
                                onPressed: _sendOtp,
                                child: Text(
                                  'resend_otp'.tr,
                                  style: const TextStyle(
                                    fontFamily: 'NotoSansDevanagari',
                                    fontSize: 12,
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],

                        const SizedBox(height: 16),

                        // Action button
                        Obx(() => SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: FilledButton(
                            onPressed: _authController.isLoading.value
                                ? null
                                : (_otpSent ? _verifyOtp : _sendOtp),
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: _authController.isLoading.value
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation(Colors.white),
                                    ),
                                  )
                                : Text(
                                    _otpSent ? 'verify_and_login'.tr : 'get_otp'.tr,
                                    style: const TextStyle(
                                      fontFamily: 'NotoSansDevanagari',
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                          ),
                        )),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  const SizedBox(height: 16),

                  Text(
                    'smkmc_footer'.tr,
                    style: const TextStyle(
                      fontFamily: 'NotoSansDevanagari',
                      color: AppColors.subtle,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    ),
  );
}

  Widget _buildLanguageSelector() {
    return Obx(() {
      final currentCode = _localeController.currentLocale.value.languageCode;
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: const Color(0xFFE5E7EB)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: LocaleController.supportedLocales.map((loc) {
            final isSelected = loc['code'] == currentCode;
            return GestureDetector(
              onTap: () {
                _localeController.changeLocale(loc['code'] as String);
                setState(() {});
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                margin: const EdgeInsets.symmetric(horizontal: 2),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  loc['name'] as String,
                  style: TextStyle(
                    fontFamily: 'NotoSansDevanagari',
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                    color: isSelected ? Colors.white : const Color(0xFF4B5563),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      );
    });
  }
}
