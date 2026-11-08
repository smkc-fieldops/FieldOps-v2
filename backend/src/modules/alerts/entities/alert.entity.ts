import { Column, Entity, PrimaryColumn } from 'typeorm';
import {
  booleanColumn,
  longTextType,
  timestampType,
  unicodeVarcharType,
  varcharType,
} from '../../../shared/database/column-types';

export type AlertType =
  | 'LATE_CHECKIN'
  | 'OUT_OF_ZONE'
  | 'MISSED_SPOT_CHECK'
  | 'GHOST_PUNCH'
  | 'ABSENT'
  | 'TAMPER_DETECTED'
  | 'STATIONARY_TOO_LONG'
  | 'TASK_OVERDUE'
  | 'REPEATED_LATE'
  | 'NOT_CHECKED_IN';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Something a supervisor should look at, raised by the punch flow or a scheduled job. */
@Entity({ name: 'alerts' })
export class Alert {
  @PrimaryColumn({ type: varcharType(), length: 36 })
  id: string;

  /** E.g. "LATE_CHECKIN:<staffId>:2026-11-02", so a re-run job cannot raise it twice. */
  @Column({ name: 'dedupe_key', type: varcharType(), length: 120, nullable: true, unique: true })
  dedupeKey: string | null;

  @Column({ name: 'staff_id', type: varcharType(), length: 36, nullable: true })
  staffId: string | null;

  @Column({ name: 'ward_id', type: varcharType(), length: 36, nullable: true })
  wardId: string | null;

  @Column({ name: 'alert_type', type: varcharType(), length: 30 })
  alertType: AlertType;

  @Column({ type: varcharType(), length: 10 })
  severity: AlertSeverity;

  @Column({ type: unicodeVarcharType(), length: 500 })
  message: string;

  @Column({ name: 'message_mr', type: unicodeVarcharType(), length: 500, nullable: true })
  messageMr: string | null;

  /** Extra facts as JSON text (portable; no JSONB). */
  @Column({ name: 'details_json', type: longTextType(), nullable: true })
  detailsJson: string | null;

  @Column({ name: 'is_resolved', ...booleanColumn(), default: 0 })
  isResolved: boolean;

  @Column({ name: 'triggered_at', type: timestampType() })
  triggeredAt: Date;

  @Column({ name: 'resolved_at', type: timestampType(), nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by_id', type: varcharType(), length: 36, nullable: true })
  resolvedById: string | null;

  @Column({ name: 'resolution_note', type: unicodeVarcharType(), length: 500, nullable: true })
  resolutionNote: string | null;
}
