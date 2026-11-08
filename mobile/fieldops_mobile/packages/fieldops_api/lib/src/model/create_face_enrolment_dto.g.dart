// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_face_enrolment_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CreateFaceEnrolmentDto extends CreateFaceEnrolmentDto {
  @override
  final String staffId;
  @override
  final String imageBase64;

  factory _$CreateFaceEnrolmentDto(
          [void Function(CreateFaceEnrolmentDtoBuilder)? updates]) =>
      (CreateFaceEnrolmentDtoBuilder()..update(updates))._build();

  _$CreateFaceEnrolmentDto._({required this.staffId, required this.imageBase64})
      : super._();
  @override
  CreateFaceEnrolmentDto rebuild(
          void Function(CreateFaceEnrolmentDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  CreateFaceEnrolmentDtoBuilder toBuilder() =>
      CreateFaceEnrolmentDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateFaceEnrolmentDto &&
        staffId == other.staffId &&
        imageBase64 == other.imageBase64;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, staffId.hashCode);
    _$hash = $jc(_$hash, imageBase64.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateFaceEnrolmentDto')
          ..add('staffId', staffId)
          ..add('imageBase64', imageBase64))
        .toString();
  }
}

class CreateFaceEnrolmentDtoBuilder
    implements Builder<CreateFaceEnrolmentDto, CreateFaceEnrolmentDtoBuilder> {
  _$CreateFaceEnrolmentDto? _$v;

  String? _staffId;
  String? get staffId => _$this._staffId;
  set staffId(String? staffId) => _$this._staffId = staffId;

  String? _imageBase64;
  String? get imageBase64 => _$this._imageBase64;
  set imageBase64(String? imageBase64) => _$this._imageBase64 = imageBase64;

  CreateFaceEnrolmentDtoBuilder() {
    CreateFaceEnrolmentDto._defaults(this);
  }

  CreateFaceEnrolmentDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _staffId = $v.staffId;
      _imageBase64 = $v.imageBase64;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateFaceEnrolmentDto other) {
    _$v = other as _$CreateFaceEnrolmentDto;
  }

  @override
  void update(void Function(CreateFaceEnrolmentDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateFaceEnrolmentDto build() => _build();

  _$CreateFaceEnrolmentDto _build() {
    final _$result = _$v ??
        _$CreateFaceEnrolmentDto._(
          staffId: BuiltValueNullFieldError.checkNotNull(
              staffId, r'CreateFaceEnrolmentDto', 'staffId'),
          imageBase64: BuiltValueNullFieldError.checkNotNull(
              imageBase64, r'CreateFaceEnrolmentDto', 'imageBase64'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
