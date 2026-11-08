// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'face_enrolment_list_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$FaceEnrolmentListDto extends FaceEnrolmentListDto {
  @override
  final BuiltList<FaceEnrolmentDto> items;
  @override
  final num remaining;

  factory _$FaceEnrolmentListDto(
          [void Function(FaceEnrolmentListDtoBuilder)? updates]) =>
      (FaceEnrolmentListDtoBuilder()..update(updates))._build();

  _$FaceEnrolmentListDto._({required this.items, required this.remaining})
      : super._();
  @override
  FaceEnrolmentListDto rebuild(
          void Function(FaceEnrolmentListDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  FaceEnrolmentListDtoBuilder toBuilder() =>
      FaceEnrolmentListDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is FaceEnrolmentListDto &&
        items == other.items &&
        remaining == other.remaining;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, items.hashCode);
    _$hash = $jc(_$hash, remaining.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'FaceEnrolmentListDto')
          ..add('items', items)
          ..add('remaining', remaining))
        .toString();
  }
}

class FaceEnrolmentListDtoBuilder
    implements Builder<FaceEnrolmentListDto, FaceEnrolmentListDtoBuilder> {
  _$FaceEnrolmentListDto? _$v;

  ListBuilder<FaceEnrolmentDto>? _items;
  ListBuilder<FaceEnrolmentDto> get items =>
      _$this._items ??= ListBuilder<FaceEnrolmentDto>();
  set items(ListBuilder<FaceEnrolmentDto>? items) => _$this._items = items;

  num? _remaining;
  num? get remaining => _$this._remaining;
  set remaining(num? remaining) => _$this._remaining = remaining;

  FaceEnrolmentListDtoBuilder() {
    FaceEnrolmentListDto._defaults(this);
  }

  FaceEnrolmentListDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _items = $v.items.toBuilder();
      _remaining = $v.remaining;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(FaceEnrolmentListDto other) {
    _$v = other as _$FaceEnrolmentListDto;
  }

  @override
  void update(void Function(FaceEnrolmentListDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  FaceEnrolmentListDto build() => _build();

  _$FaceEnrolmentListDto _build() {
    _$FaceEnrolmentListDto _$result;
    try {
      _$result = _$v ??
          _$FaceEnrolmentListDto._(
            items: items.build(),
            remaining: BuiltValueNullFieldError.checkNotNull(
                remaining, r'FaceEnrolmentListDto', 'remaining'),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'items';
        items.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'FaceEnrolmentListDto', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
