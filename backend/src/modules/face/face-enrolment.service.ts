import { Injectable } from '@nestjs/common';
import { AuditWriter } from '../../shared/audit/audit-writer';
import type { AuthUser } from '../../shared/auth/auth-user';
import { Clock } from '../../shared/clock/clock';
import { UnitOfWork } from '../../shared/database/unit-of-work';
import { AppError } from '../../shared/errors/app-error';
import { ErrorCode } from '../../shared/errors/error-codes';
import { IdGenerator } from '../../shared/ids/id-generator';
import type { Staff } from '../staff/entities/staff.entity';
import { StaffService } from '../staff/staff.service';
import type { Embedding } from './face.policy';
import type { FaceEnrolmentDto, FaceEnrolmentListDto } from './dto/face-enrolment.dto';
import { FaceTemplate } from './entities/face-template.entity';
import {
  canManageEnrolment,
  decodeEmbedding,
  encodeEmbedding,
  enrolmentPhotoProblem,
  MAX_ENROLMENT_PHOTOS,
} from './face-enrolment.policy';
import { FaceTemplatesRepository } from './face-templates.repository';
import { FaceEngine, FaceTemplateStore } from './local/local-face.verifier';
import { FACE_MODEL_NAME } from './local/onnx-face.engine';

function toDto(row: FaceTemplate): FaceEnrolmentDto {
  return { id: row.id, staffId: row.staffId, createdAt: row.createdAt.toISOString() };
}

/** What the local verifier matches against: this person's templates from the current model. */
@Injectable()
export class DbFaceTemplateStore extends FaceTemplateStore {
  constructor(private readonly templates: FaceTemplatesRepository) {
    super();
  }

  async embeddingsFor(staffId: string): Promise<Embedding[]> {
    const rows = await this.templates.findForStaff(staffId, FACE_MODEL_NAME);
    return rows.map((row) => decodeEmbedding(row.embedding));
  }
}

/** Adds, lists and clears a person's enrolment photos. Photos are dropped once embedded. */
@Injectable()
export class FaceEnrolmentService {
  constructor(
    private readonly engine: FaceEngine,
    private readonly templates: FaceTemplatesRepository,
    private readonly staff: StaffService,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly audit: AuditWriter,
  ) {}

  async list(actor: AuthUser, staffId: string): Promise<FaceEnrolmentListDto> {
    await this.subject(actor, staffId);
    const rows = await this.templates.findForStaff(staffId, FACE_MODEL_NAME);
    return { items: rows.map(toDto), remaining: Math.max(0, MAX_ENROLMENT_PHOTOS - rows.length) };
  }

  async enrol(actor: AuthUser, staffId: string, image: Buffer): Promise<FaceEnrolmentDto> {
    await this.subject(actor, staffId);
    // Models run before the transaction, so a slow analysis never holds a connection.
    const analysis = await this.engine.analyse(image);
    const problem = enrolmentPhotoProblem(analysis.faceCount);
    if (problem) throw new AppError(ErrorCode.FACE_ENROL_PHOTO_UNUSABLE, undefined, { reason: problem });

    const row = new FaceTemplate();
    row.id = this.ids.next();
    row.staffId = staffId;
    row.modelName = FACE_MODEL_NAME;
    row.embedding = encodeEmbedding(analysis.embedding);
    row.createdById = actor.staffId;
    row.createdAt = this.clock.now();

    await this.uow.run(async (tx) => {
      const existing = await this.templates.findForStaff(staffId, FACE_MODEL_NAME, tx);
      if (existing.length >= MAX_ENROLMENT_PHOTOS) {
        throw new AppError(ErrorCode.FACE_ENROL_LIMIT_REACHED, undefined, { limit: MAX_ENROLMENT_PHOTOS });
      }
      await this.templates.insert(row, tx);
      await this.audit.write(tx, {
        action: 'FACE_ENROLLED',
        entityType: 'staff',
        entityId: staffId,
        details: { templateId: row.id, modelName: row.modelName },
      });
    });
    return toDto(row);
  }

  async clear(actor: AuthUser, staffId: string): Promise<void> {
    await this.subject(actor, staffId);
    await this.uow.run(async (tx) => {
      const removed = await this.templates.deleteForStaff(staffId, tx);
      await this.audit.write(tx, {
        action: 'FACE_ENROLMENT_CLEARED',
        entityType: 'staff',
        entityId: staffId,
        details: { removed },
      });
    });
  }

  private async subject(actor: AuthUser, staffId: string): Promise<Staff> {
    const person = await this.staff.findById(staffId);
    if (!person) throw new AppError(ErrorCode.NOT_FOUND, undefined, { staffId });
    if (!canManageEnrolment(actor, person)) throw new AppError(ErrorCode.FORBIDDEN);
    return person;
  }
}
