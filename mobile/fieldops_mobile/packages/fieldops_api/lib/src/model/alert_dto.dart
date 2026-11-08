//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'alert_dto.g.dart';

/// AlertDto
///
/// Properties:
/// * [id] 
/// * [alertType] 
/// * [severity] 
/// * [staffId] 
/// * [wardId] 
/// * [message] 
/// * [messageMr] 
/// * [details] 
/// * [isResolved] 
/// * [triggeredAt] 
/// * [resolvedAt] 
/// * [resolvedById] 
/// * [resolutionNote] 
@BuiltValue()
abstract class AlertDto implements Built<AlertDto, AlertDtoBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'alertType')
  AlertDtoAlertTypeEnum get alertType;
  // enum alertTypeEnum {  LATE_CHECKIN,  OUT_OF_ZONE,  MISSED_SPOT_CHECK,  GHOST_PUNCH,  ABSENT,  TAMPER_DETECTED,  STATIONARY_TOO_LONG,  TASK_OVERDUE,  REPEATED_LATE,  NOT_CHECKED_IN,  };

  @BuiltValueField(wireName: r'severity')
  AlertDtoSeverityEnum get severity;
  // enum severityEnum {  LOW,  MEDIUM,  HIGH,  CRITICAL,  };

  @BuiltValueField(wireName: r'staffId')
  String? get staffId;

  @BuiltValueField(wireName: r'wardId')
  String? get wardId;

  @BuiltValueField(wireName: r'message')
  String get message;

  @BuiltValueField(wireName: r'messageMr')
  String? get messageMr;

  @BuiltValueField(wireName: r'details')
  BuiltMap<String, JsonObject?>? get details;

  @BuiltValueField(wireName: r'isResolved')
  bool get isResolved;

  @BuiltValueField(wireName: r'triggeredAt')
  DateTime get triggeredAt;

  @BuiltValueField(wireName: r'resolvedAt')
  DateTime? get resolvedAt;

  @BuiltValueField(wireName: r'resolvedById')
  String? get resolvedById;

  @BuiltValueField(wireName: r'resolutionNote')
  String? get resolutionNote;

  AlertDto._();

  factory AlertDto([void updates(AlertDtoBuilder b)]) = _$AlertDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AlertDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AlertDto> get serializer => _$AlertDtoSerializer();
}

class _$AlertDtoSerializer implements PrimitiveSerializer<AlertDto> {
  @override
  final Iterable<Type> types = const [AlertDto, _$AlertDto];

  @override
  final String wireName = r'AlertDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AlertDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'alertType';
    yield serializers.serialize(
      object.alertType,
      specifiedType: const FullType(AlertDtoAlertTypeEnum),
    );
    yield r'severity';
    yield serializers.serialize(
      object.severity,
      specifiedType: const FullType(AlertDtoSeverityEnum),
    );
    yield r'staffId';
    yield object.staffId == null ? null : serializers.serialize(
      object.staffId,
      specifiedType: const FullType.nullable(String),
    );
    yield r'wardId';
    yield object.wardId == null ? null : serializers.serialize(
      object.wardId,
      specifiedType: const FullType.nullable(String),
    );
    yield r'message';
    yield serializers.serialize(
      object.message,
      specifiedType: const FullType(String),
    );
    yield r'messageMr';
    yield object.messageMr == null ? null : serializers.serialize(
      object.messageMr,
      specifiedType: const FullType.nullable(String),
    );
    yield r'details';
    yield object.details == null ? null : serializers.serialize(
      object.details,
      specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
    );
    yield r'isResolved';
    yield serializers.serialize(
      object.isResolved,
      specifiedType: const FullType(bool),
    );
    yield r'triggeredAt';
    yield serializers.serialize(
      object.triggeredAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'resolvedAt';
    yield object.resolvedAt == null ? null : serializers.serialize(
      object.resolvedAt,
      specifiedType: const FullType.nullable(DateTime),
    );
    yield r'resolvedById';
    yield object.resolvedById == null ? null : serializers.serialize(
      object.resolvedById,
      specifiedType: const FullType.nullable(String),
    );
    yield r'resolutionNote';
    yield object.resolutionNote == null ? null : serializers.serialize(
      object.resolutionNote,
      specifiedType: const FullType.nullable(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AlertDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AlertDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'alertType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AlertDtoAlertTypeEnum),
          ) as AlertDtoAlertTypeEnum;
          result.alertType = valueDes;
          break;
        case r'severity':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AlertDtoSeverityEnum),
          ) as AlertDtoSeverityEnum;
          result.severity = valueDes;
          break;
        case r'staffId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.staffId = valueDes;
          break;
        case r'wardId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.wardId = valueDes;
          break;
        case r'message':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.message = valueDes;
          break;
        case r'messageMr':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.messageMr = valueDes;
          break;
        case r'details':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>?;
          if (valueDes == null) continue;
          result.details.replace(valueDes);
          break;
        case r'isResolved':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isResolved = valueDes;
          break;
        case r'triggeredAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.triggeredAt = valueDes;
          break;
        case r'resolvedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(DateTime),
          ) as DateTime?;
          if (valueDes == null) continue;
          result.resolvedAt = valueDes;
          break;
        case r'resolvedById':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.resolvedById = valueDes;
          break;
        case r'resolutionNote':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.resolutionNote = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AlertDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AlertDtoBuilder();
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

class AlertDtoAlertTypeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'LATE_CHECKIN')
  static const AlertDtoAlertTypeEnum LATE_CHECKIN = _$alertDtoAlertTypeEnum_LATE_CHECKIN;
  @BuiltValueEnumConst(wireName: r'OUT_OF_ZONE')
  static const AlertDtoAlertTypeEnum OUT_OF_ZONE = _$alertDtoAlertTypeEnum_OUT_OF_ZONE;
  @BuiltValueEnumConst(wireName: r'MISSED_SPOT_CHECK')
  static const AlertDtoAlertTypeEnum MISSED_SPOT_CHECK = _$alertDtoAlertTypeEnum_MISSED_SPOT_CHECK;
  @BuiltValueEnumConst(wireName: r'GHOST_PUNCH')
  static const AlertDtoAlertTypeEnum GHOST_PUNCH = _$alertDtoAlertTypeEnum_GHOST_PUNCH;
  @BuiltValueEnumConst(wireName: r'ABSENT')
  static const AlertDtoAlertTypeEnum ABSENT = _$alertDtoAlertTypeEnum_ABSENT;
  @BuiltValueEnumConst(wireName: r'TAMPER_DETECTED')
  static const AlertDtoAlertTypeEnum TAMPER_DETECTED = _$alertDtoAlertTypeEnum_TAMPER_DETECTED;
  @BuiltValueEnumConst(wireName: r'STATIONARY_TOO_LONG')
  static const AlertDtoAlertTypeEnum STATIONARY_TOO_LONG = _$alertDtoAlertTypeEnum_STATIONARY_TOO_LONG;
  @BuiltValueEnumConst(wireName: r'TASK_OVERDUE')
  static const AlertDtoAlertTypeEnum TASK_OVERDUE = _$alertDtoAlertTypeEnum_TASK_OVERDUE;
  @BuiltValueEnumConst(wireName: r'REPEATED_LATE')
  static const AlertDtoAlertTypeEnum REPEATED_LATE = _$alertDtoAlertTypeEnum_REPEATED_LATE;
  @BuiltValueEnumConst(wireName: r'NOT_CHECKED_IN')
  static const AlertDtoAlertTypeEnum NOT_CHECKED_IN = _$alertDtoAlertTypeEnum_NOT_CHECKED_IN;

  static Serializer<AlertDtoAlertTypeEnum> get serializer => _$alertDtoAlertTypeEnumSerializer;

  const AlertDtoAlertTypeEnum._(String name): super(name);

  static BuiltSet<AlertDtoAlertTypeEnum> get values => _$alertDtoAlertTypeEnumValues;
  static AlertDtoAlertTypeEnum valueOf(String name) => _$alertDtoAlertTypeEnumValueOf(name);
}

class AlertDtoSeverityEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'LOW')
  static const AlertDtoSeverityEnum LOW = _$alertDtoSeverityEnum_LOW;
  @BuiltValueEnumConst(wireName: r'MEDIUM')
  static const AlertDtoSeverityEnum MEDIUM = _$alertDtoSeverityEnum_MEDIUM;
  @BuiltValueEnumConst(wireName: r'HIGH')
  static const AlertDtoSeverityEnum HIGH = _$alertDtoSeverityEnum_HIGH;
  @BuiltValueEnumConst(wireName: r'CRITICAL')
  static const AlertDtoSeverityEnum CRITICAL = _$alertDtoSeverityEnum_CRITICAL;

  static Serializer<AlertDtoSeverityEnum> get serializer => _$alertDtoSeverityEnumSerializer;

  const AlertDtoSeverityEnum._(String name): super(name);

  static BuiltSet<AlertDtoSeverityEnum> get values => _$alertDtoSeverityEnumValues;
  static AlertDtoSeverityEnum valueOf(String name) => _$alertDtoSeverityEnumValueOf(name);
}

