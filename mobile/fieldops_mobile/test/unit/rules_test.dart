import 'package:dio/dio.dart';
import 'package:fieldops_mobile/core/api/api_failure.dart';
import 'package:fieldops_mobile/core/controllers/auth_controller.dart';
import 'package:fieldops_mobile/core/services/app_config_service.dart';
import 'package:fieldops_mobile/features/attendance/attendance_rules.dart';
import 'package:fieldops_mobile/features/map/geojson.dart';
import 'package:flutter_test/flutter_test.dart';

typedef Log = ({String date, bool open});

void main() {
  group('AttendanceRules', () {
    test('IST date turns over at 18:30 UTC', () {
      expect(AttendanceRules.istDate(DateTime.utc(2026, 11, 3, 18, 29)), '2026-11-03');
      expect(AttendanceRules.istDate(DateTime.utc(2026, 11, 3, 18, 30)), '2026-11-04');
      expect(AttendanceRules.istYesterday(DateTime.utc(2026, 11, 1, 0)), '2026-10-31');
    });

    test('accuracy: 25 m in the field, 100 m in the office', () {
      expect(AttendanceRules.accuracyLimitM('WORKER'), 50);
      expect(AttendanceRules.accuracyLimitM('INSPECTOR'), 50);
      expect(AttendanceRules.accuracyLimitM('OFFICE_STAFF'), 100);
    });

    Log? pick(List<Log> logs) => AttendanceRules.current<Log>(
          logs,
          today: '2026-11-03',
          yesterday: '2026-11-02',
          dateOf: (l) => l.date,
          isOpen: (l) => l.open,
        );

    test('an open night shift from yesterday wins over today', () {
      expect(pick([(date: '2026-11-02', open: true), (date: '2026-11-03', open: false)])!.date, '2026-11-02');
    });

    test('a closed yesterday is not shown', () {
      expect(pick([(date: '2026-11-02', open: false)]), isNull);
      expect(pick([(date: '2026-11-02', open: false), (date: '2026-11-03', open: false)])!.date, '2026-11-03');
    });

    test('hours label', () {
      expect(AttendanceRules.hoursLabel(425), '7h 05m');
      expect(AttendanceRules.hoursLabel(-3), '0h 00m');
    });
  });

  group('ApiFailure', () {
    final req = RequestOptions(path: '/x');

    test('reads problem+json', () {
      final f = ApiFailure.from(DioException(
        requestOptions: req,
        type: DioExceptionType.badResponse,
        response: Response(requestOptions: req, statusCode: 409, data: {
          'code': 'ALREADY_CHECKED_IN',
          'requestId': 'req-9',
          'details': {'field': 'type'},
        }),
      ));
      expect(f.code, 'ALREADY_CHECKED_IN');
      expect(f.status, 409);
      expect(f.requestId, 'req-9');
      expect(f.details, {'field': 'type'});
      expect(f.isRetryable, isFalse);
    });

    test('a body left as text is parsed too', () {
      final f = ApiFailure.from(DioException(
        requestOptions: req,
        response: Response(requestOptions: req, statusCode: 503, data: '{"code":"SERVICE_UNAVAILABLE"}'),
      ));
      expect(f.code, 'SERVICE_UNAVAILABLE');
      expect(f.isRetryable, isTrue);
    });

    test('no response is a network failure', () {
      final f = ApiFailure.from(DioException(requestOptions: req, type: DioExceptionType.connectionTimeout));
      expect(f.isNetwork, isTrue);
      expect(f.isRetryable, isTrue);
    });

    test('messages come from the shared table, with the request ID', () {
      ErrorMessages.loadFromJson('{"messages":{"FACE_MISMATCH":{"en":"Face did not match","mr":"चेहरा जुळला नाही"}}}');
      const f = ApiFailure(code: 'FACE_MISMATCH', requestId: 'req-1');
      expect(f.message('en'), 'Face did not match (req-1)');
      expect(f.message('mr'), 'चेहरा जुळला नाही (req-1)');
      expect(const ApiFailure(code: 'SOMETHING_NEW').message('en'), contains('Something went wrong'));
      expect(const ApiFailure(code: ApiCodes.gpsDisabled).message('en'), contains('GPS'));
    });
  });

  group('app config', () {
    test('update is forced only below the minimum version', () {
      expect(AppConfigService.mustUpdate(3, 4), isTrue);
      expect(AppConfigService.mustUpdate(4, 4), isFalse);
    });

    test('a phone clock more than 5 minutes off is reported', () {
      final server = DateTime.utc(2026, 11, 3, 6);
      expect(AppConfigService.clockIsOff(server.add(const Duration(minutes: 4)), server), isFalse);
      expect(AppConfigService.clockIsOff(server.subtract(const Duration(minutes: 6)), server), isTrue);
    });
  });

  test('phone numbers: last ten digits', () {
    expect(AuthController.tenDigits('+91 98220-11111'), '9822011111');
    expect(AuthController.tenDigits('12345'), isNull);
  });

  group('GeoJSON', () {
    test('polygon outer ring as lat/lng', () {
      final rings = outerRings({
        'type': 'Polygon',
        'coordinates': [
          [
            [74.60, 16.84],
            [74.61, 16.84],
            [74.61, 16.85],
            [74.60, 16.84],
          ],
          [
            [74.605, 16.845],
          ],
        ],
      });
      expect(rings.length, 1);
      expect(rings.first.first.latitude, 16.84);
      expect(rings.first.first.longitude, 74.60);
    });

    test('multipolygon and junk', () {
      expect(
        outerRings({
          'type': 'MultiPolygon',
          'coordinates': [
            [
              [
                [1, 2],
                [3, 4],
              ],
            ],
            [
              [
                [5, 6],
              ],
            ],
          ],
        }).length,
        2,
      );
      expect(outerRings({'type': 'Point', 'coordinates': [1, 2]}), isEmpty);
      expect(outerRings(null), isEmpty);
    });
  });
}
