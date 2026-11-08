//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_face_enrolment_dto.g.dart';

/// CreateFaceEnrolmentDto
///
/// Properties:
/// * [staffId] 
/// * [imageBase64] - Base64 JPEG of the person's face (≤ 96000 chars); never stored
@BuiltValue()
abstract class CreateFaceEnrolmentDto implements Built<CreateFaceEnrolmentDto, CreateFaceEnrolmentDtoBuilder> {
  @BuiltValueField(wireName: r'staffId')
  String get staffId;

  /// Base64 JPEG of the person's face (≤ 96000 chars); never stored
  @BuiltValueField(wireName: r'imageBase64')
  String get imageBase64;

  CreateFaceEnrolmentDto._();

  factory CreateFaceEnrolmentDto([void updates(CreateFaceEnrolmentDtoBuilder b)]) = _$CreateFaceEnrolmentDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateFaceEnrolmentDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateFaceEnrolmentDto> get serializer => _$CreateFaceEnrolmentDtoSerializer();
}

class _$CreateFaceEnrolmentDtoSerializer implements PrimitiveSerializer<CreateFaceEnrolmentDto> {
  @override
  final Iterable<Type> types = const [CreateFaceEnrolmentDto, _$CreateFaceEnrolmentDto];

  @override
  final String wireName = r'CreateFaceEnrolmentDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateFaceEnrolmentDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'staffId';
    yield serializers.serialize(
      object.staffId,
      specifiedType: const FullType(String),
    );
    yield r'imageBase64';
    yield serializers.serialize(
      object.imageBase64,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateFaceEnrolmentDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateFaceEnrolmentDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'staffId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.staffId = valueDes;
          break;
        case r'imageBase64':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.imageBase64 = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateFaceEnrolmentDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateFaceEnrolmentDtoBuilder();
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

