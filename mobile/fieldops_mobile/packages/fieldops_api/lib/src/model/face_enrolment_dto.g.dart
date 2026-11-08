// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'face_enrolment_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$FaceEnrolmentDto extends FaceEnrolmentDto {
  @override
  final String id;
  @override
  final String staffId;
  @override
  final DateTime createdAt;

  factory _$FaceEnrolmentDto(
          [void Function(FaceEnrolmentDtoBuilder)? updates]) =>
      (FaceEnrolmentDtoBuilder()..update(updates))._build();

  _$FaceEnrolmentDto._(
      {required this.id, required this.staffId, required this.createdAt})
      : super._();
  @override
  FaceEnrolmentDto rebuild(void Function(FaceEnrolmentDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  FaceEnrolmentDtoBuilder toBuilder() =>
      FaceEnrolmentDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is FaceEnrolmentDto &&
        id == other.id &&
        staffId == other.staffId &&
        createdAt == other.createdAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, staffId.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'FaceEnrolmentDto')
          ..add('id', id)
          ..add('staffId', staffId)
          ..add('createdAt', createdAt))
        .toString();
  }
}

class FaceEnrolmentDtoBuilder
    implements Builder<FaceEnrolmentDto, FaceEnrolmentDtoBuilder> {
  _$FaceEnrolmentDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _staffId;
  String? get staffId => _$this._staffId;
  set staffId(String? staffId) => _$this._staffId = staffId;

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  FaceEnrolmentDtoBuilder() {
    FaceEnrolmentDto._defaults(this);
  }

  FaceEnrolmentDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _staffId = $v.staffId;
      _createdAt = $v.createdAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(FaceEnrolmentDto other) {
    _$v = other as _$FaceEnrolmentDto;
  }

  @override
  void update(void Function(FaceEnrolmentDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  FaceEnrolmentDto build() => _build();

  _$FaceEnrolmentDto _build() {
    final _$result = _$v ??
        _$FaceEnrolmentDto._(
          id: BuiltValueNullFieldError.checkNotNull(
              id, r'FaceEnrolmentDto', 'id'),
          staffId: BuiltValueNullFieldError.checkNotNull(
              staffId, r'FaceEnrolmentDto', 'staffId'),
          createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt, r'FaceEnrolmentDto', 'createdAt'),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
