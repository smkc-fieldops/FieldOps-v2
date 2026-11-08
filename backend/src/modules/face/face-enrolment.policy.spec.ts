import { Role, type StaffRole } from '../../shared/auth/roles';
import {
  canManageEnrolment,
  decodeEmbedding,
  encodeEmbedding,
  enrolmentPhotoProblem,
} from './face-enrolment.policy';

describe('canManageEnrolment', () => {
  const cases: [string, StaffRole, string | null, StaffRole, string | null, boolean][] = [
    ['admin, any office staff', Role.ADMIN, null, Role.OFFICE_STAFF, null, true],
    ['ward inspector, own worker', Role.WARD_INSPECTOR, 'w1', Role.WORKER, 'w1', true],
    ['ward inspector, own inspector', Role.WARD_INSPECTOR, 'w1', Role.INSPECTOR, 'w1', true],
    ['ward inspector, other ward', Role.WARD_INSPECTOR, 'w1', Role.WORKER, 'w2', false],
    ['ward inspector, a peer in the ward', Role.WARD_INSPECTOR, 'w1', Role.WARD_INSPECTOR, 'w1', false],
    ['ward inspector without a ward', Role.WARD_INSPECTOR, null, Role.WORKER, null, false],
    ['inspector', Role.INSPECTOR, 'w1', Role.WORKER, 'w1', false],
    ['worker, self', Role.WORKER, 'w1', Role.WORKER, 'w1', false],
  ];
  it.each(cases)('%s', (_name, role, homeWardId, subjectRole, subjectWard, expected) => {
    expect(canManageEnrolment({ role, homeWardId }, { role: subjectRole, homeWardId: subjectWard })).toBe(expected);
  });
});

describe('enrolmentPhotoProblem', () => {
  it.each([
    [0, 'NO_FACE'],
    [1, null],
    [2, 'MULTIPLE_FACES'],
  ])('%i faces', (count, expected) => {
    expect(enrolmentPhotoProblem(count)).toBe(expected);
  });
});

describe('embedding text', () => {
  it('round-trips and fits the column', () => {
    const embedding = Array.from({ length: 512 }, (_, i) => Math.sin(i));
    const text = encodeEmbedding(embedding);
    expect(text.length).toBeLessThanOrEqual(4000);
    const back = decodeEmbedding(text);
    expect(back).toHaveLength(512);
    expect(back[7]).toBeCloseTo(embedding[7], 5);
  });
});
