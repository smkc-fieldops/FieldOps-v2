//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'face_enrolment_dto.g.dart';

/// FaceEnrolmentDto
///
/// Properties:
/// * [id] 
/// * [staffId] 
/// * [createdAt] 
@BuiltValue()
abstract class FaceEnrolmentDto implements Built<FaceEnrolmentDto, FaceEnrolmentDtoBuilder> {
  @BuiltValueField(wireName: r'id')
  String get id;

  @BuiltValueField(wireName: r'staffId')
  String get staffId;

  @BuiltValueField(wireName: r'createdAt')
  DateTime get createdAt;

  FaceEnrolmentDto._();

  factory FaceEnrolmentDto([void updates(FaceEnrolmentDtoBuilder b)]) = _$FaceEnrolmentDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(FaceEnrolmentDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<FaceEnrolmentDto> get serializer => _$FaceEnrolmentDtoSerializer();
}

class _$FaceEnrolmentDtoSerializer implements PrimitiveSerializer<FaceEnrolmentDto> {
  @override
  final Iterable<Type> types = const [FaceEnrolmentDto, _$FaceEnrolmentDto];

  @override
  final String wireName = r'FaceEnrolmentDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    FaceEnrolmentDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'staffId';
    yield serializers.serialize(
      object.staffId,
      specifiedType: const FullType(String),
    );
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(DateTime),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    FaceEnrolmentDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required FaceEnrolmentDtoBuilder result,
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
        case r'staffId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.staffId = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.createdAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  FaceEnrolmentDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = FaceEnrolmentDtoBuilder();
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

