import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { FaceTemplate } from './entities/face-template.entity';

/** The only place that queries the face_templates table. */
@Injectable()
export class FaceTemplatesRepository {
  constructor(@InjectRepository(FaceTemplate) private readonly repo: Repository<FaceTemplate>) {}

  private r(tx?: EntityManager): Repository<FaceTemplate> {
    return tx ? tx.getRepository(FaceTemplate) : this.repo;
  }

  findForStaff(staffId: string, modelName: string, tx?: EntityManager): Promise<FaceTemplate[]> {
    return this.r(tx).find({ where: { staffId, modelName }, order: { createdAt: 'ASC' } });
  }

  async insert(row: FaceTemplate, tx: EntityManager): Promise<void> {
    await this.r(tx).insert(row);
  }

  async deleteForStaff(staffId: string, tx: EntityManager): Promise<number> {
    const result = await this.r(tx).delete({ staffId });
    return result.affected ?? 0;
  }
}
