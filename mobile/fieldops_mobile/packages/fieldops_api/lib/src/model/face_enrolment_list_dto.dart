//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:fieldops_api/src/model/face_enrolment_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'face_enrolment_list_dto.g.dart';

/// FaceEnrolmentListDto
///
/// Properties:
/// * [items] 
/// * [remaining] - How many more photos can be added
@BuiltValue()
abstract class FaceEnrolmentListDto implements Built<FaceEnrolmentListDto, FaceEnrolmentListDtoBuilder> {
  @BuiltValueField(wireName: r'items')
  BuiltList<FaceEnrolmentDto> get items;

  /// How many more photos can be added
  @BuiltValueField(wireName: r'remaining')
  num get remaining;

  FaceEnrolmentListDto._();

  factory FaceEnrolmentListDto([void updates(FaceEnrolmentListDtoBuilder b)]) = _$FaceEnrolmentListDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(FaceEnrolmentListDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<FaceEnrolmentListDto> get serializer => _$FaceEnrolmentListDtoSerializer();
}

class _$FaceEnrolmentListDtoSerializer implements PrimitiveSerializer<FaceEnrolmentListDto> {
  @override
  final Iterable<Type> types = const [FaceEnrolmentListDto, _$FaceEnrolmentListDto];

  @override
  final String wireName = r'FaceEnrolmentListDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    FaceEnrolmentListDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'items';
    yield serializers.serialize(
      object.items,
      specifiedType: const FullType(BuiltList, [FullType(FaceEnrolmentDto)]),
    );
    yield r'remaining';
    yield serializers.serialize(
      object.remaining,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    FaceEnrolmentListDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required FaceEnrolmentListDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'items':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(FaceEnrolmentDto)]),
          ) as BuiltList<FaceEnrolmentDto>;
          result.items.replace(valueDes);
          break;
        case r'remaining':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.remaining = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  FaceEnrolmentListDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = FaceEnrolmentListDtoBuilder();
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

