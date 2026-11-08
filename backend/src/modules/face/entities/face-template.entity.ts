import { Column, Entity, PrimaryColumn } from 'typeorm';
import { timestampType, varcharType } from '../../../shared/database/column-types';

/**
 * One enrolment photo's embedding (3-5 per person). The photo itself is never kept. The model
 * name is stored because embeddings from different models cannot be compared.
 */
@Entity({ name: 'face_templates' })
export class FaceTemplate {
  @PrimaryColumn({ type: varcharType(), length: 36 })
  id: string;

  @Column({ name: 'staff_id', type: varcharType(), length: 36 })
  staffId: string;

  @Column({ name: 'model_name', type: varcharType(), length: 40 })
  modelName: string;

  /** Base64 of the little-endian float32 values (512 values = 2,732 characters). */
  @Column({ type: varcharType(), length: 4000 })
  embedding: string;

  @Column({ name: 'created_by_id', type: varcharType(), length: 36 })
  createdById: string;

  @Column({ name: 'created_at', type: timestampType() })
  createdAt: Date;
}
