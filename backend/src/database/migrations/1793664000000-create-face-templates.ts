import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { migrationColumnTypes } from '../../shared/database/column-types';

/** Enrolled face embeddings (the photos are never stored). Local face provider only. */
export class CreateFaceTemplates1793664000000 implements MigrationInterface {
  name = 'CreateFaceTemplates1793664000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const t = migrationColumnTypes(queryRunner.connection.options.type);
    await queryRunner.createTable(
      new Table({
        name: 'face_templates',
        columns: [
          { name: 'id', type: t.varchar, length: '36', isPrimary: true },
          { name: 'staff_id', type: t.varchar, length: '36' },
          { name: 'model_name', type: t.varchar, length: '40' },
          { name: 'embedding', type: t.varchar, length: '4000' },
          { name: 'created_by_id', type: t.varchar, length: '36' },
          { name: 'created_at', type: t.timestamp },
        ],
        foreignKeys: [
          {
            name: 'fk_face_templates_staff',
            columnNames: ['staff_id'],
            referencedTableName: 'staff',
            referencedColumnNames: ['id'],
          },
          {
            name: 'fk_face_templates_creator',
            columnNames: ['created_by_id'],
            referencedTableName: 'staff',
            referencedColumnNames: ['id'],
          },
        ],
      }),
    );
    await queryRunner.createIndex(
      'face_templates',
      new TableIndex({ name: 'ix_face_templates_staff', columnNames: ['staff_id', 'model_name'] }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('face_templates');
  }
}
