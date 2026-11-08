// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'alert_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AlertDtoAlertTypeEnum _$alertDtoAlertTypeEnum_LATE_CHECKIN =
    const AlertDtoAlertTypeEnum._('LATE_CHECKIN');
const AlertDtoAlertTypeEnum _$alertDtoAlertTypeEnum_OUT_OF_ZONE =
    const AlertDtoAlertTypeEnum._('OUT_OF_ZONE');
const AlertDtoAlertTypeEnum _$alertDtoAlertTypeEnum_MISSED_SPOT_CHECK =
    const AlertDtoAlertTypeEnum._('MISSED_SPOT_CHECK');
const AlertDtoAlertTypeEnum _$alertDtoAlertTypeEnum_GHOST_PUNCH =
    const AlertDtoAlertTypeEnum._('GHOST_PUNCH');
const AlertDtoAlertTypeEnum _$alertDtoAlertTypeEnum_ABSENT =
    const AlertDtoAlertTypeEnum._('ABSENT');
const AlertDtoAlertTypeEnum _$alertDtoAlertTypeEnum_TAMPER_DETECTED =
    const AlertDtoAlertTypeEnum._('TAMPER_DETECTED');
const AlertDtoAlertTypeEnum _$alertDtoAlertTypeEnum_STATIONARY_TOO_LONG =
    const AlertDtoAlertTypeEnum._('STATIONARY_TOO_LONG');
const AlertDtoAlertTypeEnum _$alertDtoAlertTypeEnum_TASK_OVERDUE =
    const AlertDtoAlertTypeEnum._('TASK_OVERDUE');
const AlertDtoAlertTypeEnum _$alertDtoAlertTypeEnum_REPEATED_LATE =
    const AlertDtoAlertTypeEnum._('REPEATED_LATE');
const AlertDtoAlertTypeEnum _$alertDtoAlertTypeEnum_NOT_CHECKED_IN =
    const AlertDtoAlertTypeEnum._('NOT_CHECKED_IN');

AlertDtoAlertTypeEnum _$alertDtoAlertTypeEnumValueOf(String name) {
  switch (name) {
    case 'LATE_CHECKIN':
      return _$alertDtoAlertTypeEnum_LATE_CHECKIN;
    case 'OUT_OF_ZONE':
      return _$alertDtoAlertTypeEnum_OUT_OF_ZONE;
    case 'MISSED_SPOT_CHECK':
      return _$alertDtoAlertTypeEnum_MISSED_SPOT_CHECK;
    case 'GHOST_PUNCH':
      return _$alertDtoAlertTypeEnum_GHOST_PUNCH;
    case 'ABSENT':
      return _$alertDtoAlertTypeEnum_ABSENT;
    case 'TAMPER_DETECTED':
      return _$alertDtoAlertTypeEnum_TAMPER_DETECTED;
    case 'STATIONARY_TOO_LONG':
      return _$alertDtoAlertTypeEnum_STATIONARY_TOO_LONG;
    case 'TASK_OVERDUE':
      return _$alertDtoAlertTypeEnum_TASK_OVERDUE;
    case 'REPEATED_LATE':
      return _$alertDtoAlertTypeEnum_REPEATED_LATE;
    case 'NOT_CHECKED_IN':
      return _$alertDtoAlertTypeEnum_NOT_CHECKED_IN;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AlertDtoAlertTypeEnum> _$alertDtoAlertTypeEnumValues =
    BuiltSet<AlertDtoAlertTypeEnum>(const <AlertDtoAlertTypeEnum>[
  _$alertDtoAlertTypeEnum_LATE_CHECKIN,
  _$alertDtoAlertTypeEnum_OUT_OF_ZONE,
  _$alertDtoAlertTypeEnum_MISSED_SPOT_CHECK,
  _$alertDtoAlertTypeEnum_GHOST_PUNCH,
  _$alertDtoAlertTypeEnum_ABSENT,
  _$alertDtoAlertTypeEnum_TAMPER_DETECTED,
  _$alertDtoAlertTypeEnum_STATIONARY_TOO_LONG,
  _$alertDtoAlertTypeEnum_TASK_OVERDUE,
  _$alertDtoAlertTypeEnum_REPEATED_LATE,
  _$alertDtoAlertTypeEnum_NOT_CHECKED_IN,
]);

const AlertDtoSeverityEnum _$alertDtoSeverityEnum_LOW =
    const AlertDtoSeverityEnum._('LOW');
const AlertDtoSeverityEnum _$alertDtoSeverityEnum_MEDIUM =
    const AlertDtoSeverityEnum._('MEDIUM');
const AlertDtoSeverityEnum _$alertDtoSeverityEnum_HIGH =
    const AlertDtoSeverityEnum._('HIGH');
const AlertDtoSeverityEnum _$alertDtoSeverityEnum_CRITICAL =
    const AlertDtoSeverityEnum._('CRITICAL');

AlertDtoSeverityEnum _$alertDtoSeverityEnumValueOf(String name) {
  switch (name) {
    case 'LOW':
      return _$alertDtoSeverityEnum_LOW;
    case 'MEDIUM':
      return _$alertDtoSeverityEnum_MEDIUM;
    case 'HIGH':
      return _$alertDtoSeverityEnum_HIGH;
    case 'CRITICAL':
      return _$alertDtoSeverityEnum_CRITICAL;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AlertDtoSeverityEnum> _$alertDtoSeverityEnumValues =
    BuiltSet<AlertDtoSeverityEnum>(const <AlertDtoSeverityEnum>[
  _$alertDtoSeverityEnum_LOW,
  _$alertDtoSeverityEnum_MEDIUM,
  _$alertDtoSeverityEnum_HIGH,
  _$alertDtoSeverityEnum_CRITICAL,
]);

Serializer<AlertDtoAlertTypeEnum> _$alertDtoAlertTypeEnumSerializer =
    _$AlertDtoAlertTypeEnumSerializer();
Serializer<AlertDtoSeverityEnum> _$alertDtoSeverityEnumSerializer =
    _$AlertDtoSeverityEnumSerializer();

class _$AlertDtoAlertTypeEnumSerializer
    implements PrimitiveSerializer<AlertDtoAlertTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'LATE_CHECKIN': 'LATE_CHECKIN',
    'OUT_OF_ZONE': 'OUT_OF_ZONE',
    'MISSED_SPOT_CHECK': 'MISSED_SPOT_CHECK',
    'GHOST_PUNCH': 'GHOST_PUNCH',
    'ABSENT': 'ABSENT',
    'TAMPER_DETECTED': 'TAMPER_DETECTED',
    'STATIONARY_TOO_LONG': 'STATIONARY_TOO_LONG',
    'TASK_OVERDUE': 'TASK_OVERDUE',
    'REPEATED_LATE': 'REPEATED_LATE',
    'NOT_CHECKED_IN': 'NOT_CHECKED_IN',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'LATE_CHECKIN': 'LATE_CHECKIN',
    'OUT_OF_ZONE': 'OUT_OF_ZONE',
    'MISSED_SPOT_CHECK': 'MISSED_SPOT_CHECK',
    'GHOST_PUNCH': 'GHOST_PUNCH',
    'ABSENT': 'ABSENT',
    'TAMPER_DETECTED': 'TAMPER_DETECTED',
    'STATIONARY_TOO_LONG': 'STATIONARY_TOO_LONG',
    'TASK_OVERDUE': 'TASK_OVERDUE',
    'REPEATED_LATE': 'REPEATED_LATE',
    'NOT_CHECKED_IN': 'NOT_CHECKED_IN',
  };

  @override
  final Iterable<Type> types = const <Type>[AlertDtoAlertTypeEnum];
  @override
  final String wireName = 'AlertDtoAlertTypeEnum';

  @override
  Object serialize(Serializers serializers, AlertDtoAlertTypeEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  AlertDtoAlertTypeEnum deserialize(Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      AlertDtoAlertTypeEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$AlertDtoSeverityEnumSerializer
    implements PrimitiveSerializer<AlertDtoSeverityEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'LOW': 'LOW',
    'MEDIUM': 'MEDIUM',
    'HIGH': 'HIGH',
    'CRITICAL': 'CRITICAL',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'LOW': 'LOW',
    'MEDIUM': 'MEDIUM',
    'HIGH': 'HIGH',
    'CRITICAL': 'CRITICAL',
  };

  @override
  final Iterable<Type> types = const <Type>[AlertDtoSeverityEnum];
  @override
  final String wireName = 'AlertDtoSeverityEnum';

  @override
  Object serialize(Serializers serializers, AlertDtoSeverityEnum object,
          {FullType specifiedType = FullType.unspecified}) =>
      _toWire[object.name] ?? object.name;

  @override
  AlertDtoSeverityEnum deserialize(Serializers serializers, Object serialized,
          {FullType specifiedType = FullType.unspecified}) =>
      AlertDtoSeverityEnum.valueOf(
          _fromWire[serialized] ?? (serialized is String ? serialized : ''));
}

class _$AlertDto extends AlertDto {
  @override
  final String id;
  @override
  final AlertDtoAlertTypeEnum alertType;
  @override
  final AlertDtoSeverityEnum severity;
  @override
  final String? staffId;
  @override
  final String? wardId;
  @override
  final String message;
  @override
  final String? messageMr;
  @override
  final BuiltMap<String, JsonObject?>? details;
  @override
  final bool isResolved;
  @override
  final DateTime triggeredAt;
  @override
  final DateTime? resolvedAt;
  @override
  final String? resolvedById;
  @override
  final String? resolutionNote;

  factory _$AlertDto([void Function(AlertDtoBuilder)? updates]) =>
      (AlertDtoBuilder()..update(updates))._build();

  _$AlertDto._(
      {required this.id,
      required this.alertType,
      required this.severity,
      this.staffId,
      this.wardId,
      required this.message,
      this.messageMr,
      this.details,
      required this.isResolved,
      required this.triggeredAt,
      this.resolvedAt,
      this.resolvedById,
      this.resolutionNote})
      : super._();
  @override
  AlertDto rebuild(void Function(AlertDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  AlertDtoBuilder toBuilder() => AlertDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AlertDto &&
        id == other.id &&
        alertType == other.alertType &&
        severity == other.severity &&
        staffId == other.staffId &&
        wardId == other.wardId &&
        message == other.message &&
        messageMr == other.messageMr &&
        details == other.details &&
        isResolved == other.isResolved &&
        triggeredAt == other.triggeredAt &&
        resolvedAt == other.resolvedAt &&
        resolvedById == other.resolvedById &&
        resolutionNote == other.resolutionNote;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, alertType.hashCode);
    _$hash = $jc(_$hash, severity.hashCode);
    _$hash = $jc(_$hash, staffId.hashCode);
    _$hash = $jc(_$hash, wardId.hashCode);
    _$hash = $jc(_$hash, message.hashCode);
    _$hash = $jc(_$hash, messageMr.hashCode);
    _$hash = $jc(_$hash, details.hashCode);
    _$hash = $jc(_$hash, isResolved.hashCode);
    _$hash = $jc(_$hash, triggeredAt.hashCode);
    _$hash = $jc(_$hash, resolvedAt.hashCode);
    _$hash = $jc(_$hash, resolvedById.hashCode);
    _$hash = $jc(_$hash, resolutionNote.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AlertDto')
          ..add('id', id)
          ..add('alertType', alertType)
          ..add('severity', severity)
          ..add('staffId', staffId)
          ..add('wardId', wardId)
          ..add('message', message)
          ..add('messageMr', messageMr)
          ..add('details', details)
          ..add('isResolved', isResolved)
          ..add('triggeredAt', triggeredAt)
          ..add('resolvedAt', resolvedAt)
          ..add('resolvedById', resolvedById)
          ..add('resolutionNote', resolutionNote))
        .toString();
  }
}

class AlertDtoBuilder implements Builder<AlertDto, AlertDtoBuilder> {
  _$AlertDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  AlertDtoAlertTypeEnum? _alertType;
  AlertDtoAlertTypeEnum? get alertType => _$this._alertType;
  set alertType(AlertDtoAlertTypeEnum? alertType) =>
      _$this._alertType = alertType;

  AlertDtoSeverityEnum? _severity;
  AlertDtoSeverityEnum? get severity => _$this._severity;
  set severity(AlertDtoSeverityEnum? severity) => _$this._severity = severity;

  String? _staffId;
  String? get staffId => _$this._staffId;
  set staffId(String? staffId) => _$this._staffId = staffId;

  String? _wardId;
  String? get wardId => _$this._wardId;
  set wardId(String? wardId) => _$this._wardId = wardId;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  String? _messageMr;
  String? get messageMr => _$this._messageMr;
  set messageMr(String? messageMr) => _$this._messageMr = messageMr;

  MapBuilder<String, JsonObject?>? _details;
  MapBuilder<String, JsonObject?> get details =>
      _$this._details ??= MapBuilder<String, JsonObject?>();
  set details(MapBuilder<String, JsonObject?>? details) =>
      _$this._details = details;

  bool? _isResolved;
  bool? get isResolved => _$this._isResolved;
  set isResolved(bool? isResolved) => _$this._isResolved = isResolved;

  DateTime? _triggeredAt;
  DateTime? get triggeredAt => _$this._triggeredAt;
  set triggeredAt(DateTime? triggeredAt) => _$this._triggeredAt = triggeredAt;

  DateTime? _resolvedAt;
  DateTime? get resolvedAt => _$this._resolvedAt;
  set resolvedAt(DateTime? resolvedAt) => _$this._resolvedAt = resolvedAt;

  String? _resolvedById;
  String? get resolvedById => _$this._resolvedById;
  set resolvedById(String? resolvedById) => _$this._resolvedById = resolvedById;

  String? _resolutionNote;
  String? get resolutionNote => _$this._resolutionNote;
  set resolutionNote(String? resolutionNote) =>
      _$this._resolutionNote = resolutionNote;

  AlertDtoBuilder() {
    AlertDto._defaults(this);
  }

  AlertDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _alertType = $v.alertType;
      _severity = $v.severity;
      _staffId = $v.staffId;
      _wardId = $v.wardId;
      _message = $v.message;
      _messageMr = $v.messageMr;
      _details = $v.details?.toBuilder();
      _isResolved = $v.isResolved;
      _triggeredAt = $v.triggeredAt;
      _resolvedAt = $v.resolvedAt;
      _resolvedById = $v.resolvedById;
      _resolutionNote = $v.resolutionNote;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AlertDto other) {
    _$v = other as _$AlertDto;
  }

  @override
  void update(void Function(AlertDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AlertDto build() => _build();

  _$AlertDto _build() {
    _$AlertDto _$result;
    try {
      _$result = _$v ??
          _$AlertDto._(
            id: BuiltValueNullFieldError.checkNotNull(id, r'AlertDto', 'id'),
            alertType: BuiltValueNullFieldError.checkNotNull(
                alertType, r'AlertDto', 'alertType'),
            severity: BuiltValueNullFieldError.checkNotNull(
                severity, r'AlertDto', 'severity'),
            staffId: staffId,
            wardId: wardId,
            message: BuiltValueNullFieldError.checkNotNull(
                message, r'AlertDto', 'message'),
            messageMr: messageMr,
            details: _details?.build(),
            isResolved: BuiltValueNullFieldError.checkNotNull(
                isResolved, r'AlertDto', 'isResolved'),
            triggeredAt: BuiltValueNullFieldError.checkNotNull(
                triggeredAt, r'AlertDto', 'triggeredAt'),
            resolvedAt: resolvedAt,
            resolvedById: resolvedById,
            resolutionNote: resolutionNote,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'details';
        _details?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
            r'AlertDto', _$failedField, e.toString());
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
