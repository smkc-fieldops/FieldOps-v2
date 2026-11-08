import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import type { AlertSeverity, AlertType } from '../entities/alert.entity';

export const ALERT_TYPES: AlertType[] = [
  'LATE_CHECKIN',
  'OUT_OF_ZONE',
  'MISSED_SPOT_CHECK',
  'GHOST_PUNCH',
  'ABSENT',
  'TAMPER_DETECTED',
  'STATIONARY_TOO_LONG',
  'TASK_OVERDUE',
  'REPEATED_LATE',
  'NOT_CHECKED_IN',
];
export const ALERT_SEVERITIES: AlertSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class ListAlertsQueryDto {
  @ApiPropertyOptional({ description: 'false = the open queue' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isResolved?: boolean;

  @ApiPropertyOptional({ enum: ALERT_TYPES })
  @IsOptional()
  @IsIn(ALERT_TYPES)
  alertType?: AlertType;

  @ApiPropertyOptional({ enum: ALERT_SEVERITIES })
  @IsOptional()
  @IsIn(ALERT_SEVERITIES)
  severity?: AlertSeverity;

  @ApiPropertyOptional({ format: 'uuid', description: 'Alerts about one person in your scope' })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({ type: 'integer', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: 'integer', default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize = 50;
}

export class ResolveAlertDto {
  @ApiPropertyOptional({ example: 'Spoke to the worker; phone battery had died.' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}

export class AlertDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ALERT_TYPES }) alertType: AlertType;
  @ApiProperty({ enum: ALERT_SEVERITIES }) severity: AlertSeverity;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) staffId: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) wardId: string | null;
  @ApiProperty() message: string;
  @ApiProperty({ nullable: true, type: String }) messageMr: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  details: Record<string, unknown> | null;
  @ApiProperty() isResolved: boolean;
  @ApiProperty({ format: 'date-time' }) triggeredAt: string;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) resolvedAt: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) resolvedById: string | null;
  @ApiProperty({ nullable: true, type: String }) resolutionNote: string | null;
}

export class AlertPageDto {
  @ApiProperty({ type: [AlertDto] }) items: AlertDto[];
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty() total: number;
}
