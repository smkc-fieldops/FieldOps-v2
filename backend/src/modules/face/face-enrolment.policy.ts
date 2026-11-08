/** Enrolment rules as pure functions: who may enrol whom, and how embeddings are stored. */
import type { AuthUser } from '../../shared/auth/auth-user';
import { Role, type StaffRole } from '../../shared/auth/roles';
import type { Embedding } from './face.policy';

export const MAX_ENROLMENT_PHOTOS = 5;

/** ADMIN enrols anyone; a ward inspector enrols the field staff of their own ward. */
export function canManageEnrolment(
  actor: Pick<AuthUser, 'role' | 'homeWardId'>,
  subject: { role: StaffRole; homeWardId: string | null },
): boolean {
  if (actor.role === Role.ADMIN) return true;
  if (actor.role !== Role.WARD_INSPECTOR || !actor.homeWardId) return false;
  const isFieldStaff = subject.role === Role.INSPECTOR || subject.role === Role.WORKER;
  return isFieldStaff && subject.homeWardId === actor.homeWardId;
}

/** A template must come from a photo of exactly one face. */
export function enrolmentPhotoProblem(faceCount: number): 'NO_FACE' | 'MULTIPLE_FACES' | null {
  if (faceCount === 0) return 'NO_FACE';
  return faceCount > 1 ? 'MULTIPLE_FACES' : null;
}

/** Little-endian float32 as base64: portable text that fits one VARCHAR2(4000) column. */
export function encodeEmbedding(embedding: Embedding): string {
  const bytes = Buffer.alloc(embedding.length * 4);
  for (let i = 0; i < embedding.length; i++) bytes.writeFloatLE(embedding[i], i * 4);
  return bytes.toString('base64');
}

export function decodeEmbedding(text: string): Float32Array {
  const bytes = Buffer.from(text, 'base64');
  const values = new Float32Array(Math.floor(bytes.length / 4));
  for (let i = 0; i < values.length; i++) values[i] = bytes.readFloatLE(i * 4);
  return values;
}
