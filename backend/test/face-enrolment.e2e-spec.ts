/**
 * Face enrolment endpoints with a fake engine. ONNX Runtime cannot run inside Jest's sandbox
 * (typed arrays cross realms), so the real models are exercised by scripts/face-smoke.mjs.
 */
import { randomUUID } from 'node:crypto';
import { FaceEngine, type FaceAnalysis } from '../src/modules/face/local/local-face.verifier';
import type { Staff } from '../src/modules/staff/entities/staff.entity';
import { Role, type StaffRole } from '../src/shared/auth/roles';
import { bearerFor, createTestApp, insertWard, seedStaff, TestApp } from './helpers';

const IMAGE = Buffer.alloc(200, 1).toString('base64');
const noFace = Buffer.from('no-face'.padEnd(200, '.')).toString('base64');

class FakeFaceEngine extends FaceEngine {
  async analyse(image: Buffer): Promise<FaceAnalysis> {
    return image.toString().startsWith('no-face')
      ? { faceCount: 0, livenessScore: 0, embedding: [] }
      : { faceCount: 1, livenessScore: 0.9, embedding: [1, 0, 0, 0] };
  }
}

describe('face enrolment (e2e)', () => {
  let t: TestApp;
  let http: TestApp['http'];
  const s: Record<string, Staff> = {};
  const tok: Record<string, string> = {};

  beforeAll(async () => {
    t = await createTestApp((b) => b.overrideProvider(FaceEngine).useClass(FakeFaceEngine));
    http = t.http;
    const w1 = await insertWard(t.dataSource, 'FE1');
    const w2 = await insertWard(t.dataSource, 'FE2');
    const people: [string, StaffRole, string | null, string | null][] = [
      ['ADM', Role.ADMIN, null, null],
      ['WI1', Role.WARD_INSPECTOR, w1, 'ADM'],
      ['WI2', Role.WARD_INSPECTOR, w2, 'ADM'],
      ['IN1', Role.INSPECTOR, w1, 'WI1'],
      ['WK1', Role.WORKER, w1, 'IN1'],
    ];
    for (const [key, role, homeWardId, manager] of people) {
      s[key] = await seedStaff(t.dataSource, {
        role,
        employeeCode: `FE-${key}`,
        homeWardId,
        reportsToId: manager ? s[manager].id : null,
      });
      tok[key] = await bearerFor(http, `FE-${key}`);
    }
  });

  afterAll(async () => {
    await t?.app.close();
  });

  const post = (who: string, body: Record<string, unknown>) =>
    http.post('/api/v1/face/enrolments').set('Authorization', tok[who]).send(body);

  it('needs a signed-in caller', async () => {
    await http.post('/api/v1/face/enrolments').send({}).expect(401);
    await http.get(`/api/v1/face/enrolments/${s.WK1.id}`).expect(401);
    await http.delete(`/api/v1/face/enrolments/${s.WK1.id}`).expect(401);
  });

  it.each([
    ['the worker themself', 'WK1'],
    ['their inspector', 'IN1'],
    ['a ward inspector of another ward', 'WI2'],
  ])('is refused to %s', async (_name, who) => {
    await post(who, { staffId: s.WK1.id, imageBase64: IMAGE }).expect(403);
  });

  it('refuses a photo without exactly one face, and an unknown person', async () => {
    const res = await post('WI1', { staffId: s.WK1.id, imageBase64: noFace }).expect(422);
    expect(res.body.code).toBe('FACE_ENROL_PHOTO_UNUSABLE');
    await post('ADM', { staffId: randomUUID(), imageBase64: IMAGE }).expect(404);
  });

  it('adds photos up to the limit, never returns the embedding, and clears them', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await post('WI1', { staffId: s.WK1.id, imageBase64: IMAGE }).expect(201);
      expect(res.body.staffId).toBe(s.WK1.id);
      expect(res.body.embedding).toBeUndefined();
    }
    const over = await post('WI1', { staffId: s.WK1.id, imageBase64: IMAGE }).expect(409);
    expect(over.body.code).toBe('FACE_ENROL_LIMIT_REACHED');

    const list = await http.get(`/api/v1/face/enrolments/${s.WK1.id}`).set('Authorization', tok.ADM).expect(200);
    expect(list.body.items).toHaveLength(5);
    expect(list.body.remaining).toBe(0);

    await http.delete(`/api/v1/face/enrolments/${s.WK1.id}`).set('Authorization', tok.WI1).expect(204);
    const after = await http.get(`/api/v1/face/enrolments/${s.WK1.id}`).set('Authorization', tok.ADM).expect(200);
    expect(after.body.items).toHaveLength(0);
  });
});
