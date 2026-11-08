/// Pure display rules for attendance on the phone. The server decides every
/// mark (time, geofence, late, half day); these only choose what to show.
class AttendanceRules {
  AttendanceRules._();

  static const ist = Duration(hours: 5, minutes: 30);

  /// Required GPS accuracy before a punch is sent (the server checks again).
  static const fieldAccuracyM = 50.0;
  static const officeAccuracyM = 100.0;

  static double accuracyLimitM(String role) =>
      role == 'OFFICE_STAFF' ? officeAccuracyM : fieldAccuracyM;

  /// The IST calendar date (`YYYY-MM-DD`) of a UTC instant.
  static String istDate(DateTime utc) {
    final t = utc.toUtc().add(ist);
    String two(int v) => v.toString().padLeft(2, '0');
    return '${t.year}-${two(t.month)}-${two(t.day)}';
  }

  static String istYesterday(DateTime utc) => istDate(utc.toUtc().subtract(const Duration(days: 1)));

  /// The record the home screen shows: an open shift from today or yesterday
  /// (night shift past midnight) wins, else today's record.
  static T? current<T>(
    Iterable<T> logs, {
    required String today,
    required String yesterday,
    required String Function(T) dateOf,
    required bool Function(T) isOpen,
  }) {
    T? todays;
    T? openYesterday;
    for (final l in logs) {
      final d = dateOf(l);
      if (d == today) {
        if (isOpen(l)) return l;
        todays ??= l;
      } else if (d == yesterday && isOpen(l)) {
        openYesterday = l;
      }
    }
    return openYesterday ?? todays;
  }

  /// `7h 05m` for worked minutes.
  static String hoursLabel(int minutes) {
    if (minutes < 0) minutes = 0;
    return '${minutes ~/ 60}h ${(minutes % 60).toString().padLeft(2, '0')}m';
  }
}
