//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:fieldops_api/src/model/error_code.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'problem_details_dto.g.dart';

/// ProblemDetailsDto
///
/// Properties:
/// * [type] 
/// * [code] 
/// * [title] 
/// * [status] 
/// * [requestId] 
/// * [details] 
@BuiltValue()
abstract class ProblemDetailsDto implements Built<ProblemDetailsDto, ProblemDetailsDtoBuilder> {
  @BuiltValueField(wireName: r'type')
  String get type;

  @BuiltValueField(wireName: r'code')
  ErrorCode get code;
  // enum codeEnum {  VALIDATION_FAILED,  UNAUTHENTICATED,  FORBIDDEN,  NOT_FOUND,  CONFLICT,  VERSION_CONFLICT,  PAYLOAD_TOO_LARGE,  RULE_VIOLATION,  RATE_LIMITED,  HTTP_ERROR,  SERVICE_UNAVAILABLE,  INTERNAL_ERROR,  AUTH_INVALID_CREDENTIALS,  AUTH_OTP_INVALID,  AUTH_OTP_EXPIRED,  AUTH_OTP_TOO_MANY_ATTEMPTS,  AUTH_OTP_RATE_LIMITED,  AUTH_OTP_DELIVERY_UNAVAILABLE,  AUTH_SESSION_REVOKED,  AUTH_ACCOUNT_INACTIVE,  AUTH_WEAK_PASSWORD,  STAFF_IDENTITY_TAKEN,  STAFF_HAS_REPORTS,  OFFICE_CODE_TAKEN,  ROSTER_WORKER_TAKEN,  ASSIGNMENT_EXISTS,  HOLIDAY_DATE_TAKEN,  LEAVE_OVERLAP,  REGULARIZATION_EXISTS,  WARD_CODE_TAKEN,  INVALID_BOUNDARY,  OUTSIDE_WARD,  NO_ASSIGNMENT,  ASSIGNMENT_NOT_APPROVED,  OUTSIDE_GEOFENCE,  LOCATION_TOO_INACCURATE,  OUTSIDE_SHIFT_WINDOW,  ALREADY_CHECKED_IN,  ALREADY_CHECKED_OUT,  NOT_CHECKED_IN,  ON_LEAVE,  CHALLENGE_INVALID,  CHALLENGE_EXPIRED,  FACE_MISMATCH,  SPOT_CHECK_CLOSED,  COPRESENCE_FAILED,  FACE_PROVIDER_UNAVAILABLE,  FACE_NOT_ENROLLED,  FACE_ENROL_PHOTO_UNUSABLE,  FACE_ENROL_LIMIT_REACHED,  AADHAAR_CAPTURE_FAILED,  AADHAAR_IDENTITY_MISSING,  };

  @BuiltValueField(wireName: r'title')
  String get title;

  @BuiltValueField(wireName: r'status')
  num get status;

  @BuiltValueField(wireName: r'requestId')
  String get requestId;

  @BuiltValueField(wireName: r'details')
  BuiltMap<String, JsonObject?>? get details;

  ProblemDetailsDto._();

  factory ProblemDetailsDto([void updates(ProblemDetailsDtoBuilder b)]) = _$ProblemDetailsDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(ProblemDetailsDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<ProblemDetailsDto> get serializer => _$ProblemDetailsDtoSerializer();
}

class _$ProblemDetailsDtoSerializer implements PrimitiveSerializer<ProblemDetailsDto> {
  @override
  final Iterable<Type> types = const [ProblemDetailsDto, _$ProblemDetailsDto];

  @override
  final String wireName = r'ProblemDetailsDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    ProblemDetailsDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'type';
    yield serializers.serialize(
      object.type,
      specifiedType: const FullType(String),
    );
    yield r'code';
    yield serializers.serialize(
      object.code,
      specifiedType: const FullType(ErrorCode),
    );
    yield r'title';
    yield serializers.serialize(
      object.title,
      specifiedType: const FullType(String),
    );
    yield r'status';
    yield serializers.serialize(
      object.status,
      specifiedType: const FullType(num),
    );
    yield r'requestId';
    yield serializers.serialize(
      object.requestId,
      specifiedType: const FullType(String),
    );
    if (object.details != null) {
      yield r'details';
      yield serializers.serialize(
        object.details,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    ProblemDetailsDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required ProblemDetailsDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'type':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.type = valueDes;
          break;
        case r'code':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(ErrorCode),
          ) as ErrorCode;
          result.code = valueDes;
          break;
        case r'title':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.title = valueDes;
          break;
        case r'status':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.status = valueDes;
          break;
        case r'requestId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.requestId = valueDes;
          break;
        case r'details':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.details.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  ProblemDetailsDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = ProblemDetailsDtoBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}

