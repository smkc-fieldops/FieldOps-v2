import { MigrationInterface, QueryRunner, TableCheck } from 'typeorm';

const TYPES =
  `'LATE_CHECKIN', 'OUT_OF_ZONE', 'MISSED_SPOT_CHECK', 'GHOST_PUNCH', 'ABSENT', ` +
  `'TAMPER_DETECTED', 'STATIONARY_TOO_LONG', 'TASK_OVERDUE', 'REPEATED_LATE'`;

/** Past the grace with no check-in, supervisors get a NOT_CHECKED_IN alert. */
export class AlertNotCheckedIn1793664000100 implements MigrationInterface {
  name = 'AlertNotCheckedIn1793664000100';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropCheckConstraint('alerts', 'ck_alerts_type');
    await queryRunner.createCheckConstraint(
      'alerts',
      new TableCheck({
        name: 'ck_alerts_type',
        expression: `"alert_type" IN (${TYPES}, 'NOT_CHECKED_IN')`,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropCheckConstraint('alerts', 'ck_alerts_type');
    await queryRunner.createCheckConstraint(
      'alerts',
      new TableCheck({ name: 'ck_alerts_type', expression: `"alert_type" IN (${TYPES})` }),
    );
  }
}
