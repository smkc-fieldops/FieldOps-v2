/**
 * Gate G2: a full check-in and check-out through the API, including a proxy punch by an
 * inspector, with every refusal the punch flow can give. Time is frozen (FixedClock) and the
 * face provider is a fake that matches "face:<staffId>" images, so the flow is exact.
 */
import { randomUUID } from 'node:crypto';
import {
  FaceCaptureOptions,
  FaceVerificationInput,
  FaceVerificationResult,
  FaceVerifier,
} from '../src/modules/face/face-verifier';
import type { Staff } from '../src/modules/staff/entities/staff.entity';
import { Clock, FixedClock } from '../src/shared/clock/clock';
import { Role, type StaffRole } from '../src/shared/auth/roles';
import { bearerFor, createTestApp, insertOffice, insertWard, seedStaff, TestApp } from './helpers';

class FakeFaceVerifier extends FaceVerifier {
  readonly provider = 'local' as const;
  async captureOptions(): Promise<FaceCaptureOptions> {
    return { provider: 'local', instructions: 'ML_KIT_LIVENESS_THEN_UPLOAD_CROP' };
  }
  async verify(input: FaceVerificationInput): Promise<FaceVerificationResult> {
    const ok = input.kind === 'image' && input.image.toString() === `face:${input.staffId}`;
    return ok
      ? { provider: 'local', matched: true, score: 0.82, threshold: 0.5 }
      : {
          provider: 'local',
          matched: false,
          score: 0.11,
          threshold: 0.5,
          reasonCode: 'FACE_MISMATCH',
        };
  }
}

const faceOf = (staff: Staff): string => Buffer.from(`face:${staff.id}`).toString('base64');
const INSIDE = { latitude: 16.855, longitude: 74.585 };
/** About 11 m north of the ward edge: inside the 25 m allowance. */
const NEAR_EDGE = { latitude: 16.8601, longitude: 74.585 };
/** About 1.1 km north of the ward. */
const OUTSIDE = { latitude: 16.87, longitude: 74.585 };

describe('attendance punches (e2e)', () => {
  // 06:10 IST on 2 Nov 2026; default shifts are 06:00-14:00 IST.
  const clock = new FixedClock('2026-11-02T00:40:00Z');
  let t: TestApp;
  let http: TestApp['http'];
  const s: Record<string, Staff> = {};
  const tok: Record<string, string> = {};
  const today = '2026-11-02';

  beforeAll(async () => {
    t = await createTestApp((b) =>
      b
        .overrideProvider(Clock)
        .useValue(clock)
        .overrideProvider(FaceVerifier)
        .useClass(FakeFaceVerifier),
    );
    http = t.http;
    const w1 = await insertWard(t.dataSource, 'P1');
    const office = await insertOffice(t.dataSource, 'HQ', {
      type: 'Polygon',
      coordinates: [
        [
          [74.6, 16.85],
          [74.601, 16.85],
          [74.601, 16.851],
          [74.6, 16.851],
          [74.6, 16.85],
        ],
      ],
    });
    const people: [string, StaffRole, string | null, string | null, string | null][] = [
      ['ADM', Role.ADMIN, null, null, null],
      ['WI1', Role.WARD_INSPECTOR, w1, 'ADM', null],
      ['IN1', Role.INSPECTOR, w1, 'WI1', null],
      ['IN2', Role.INSPECTOR, w1, 'WI1', null],
      ['WK1', Role.WORKER, w1, 'IN1', null],
      ['WK2', Role.WORKER, w1, 'IN1', null],
      ['WK3', Role.WORKER, w1, 'IN2', null],
      ['WK4', Role.WORKER, w1, 'IN2', null],
      ['OF1', Role.OFFICE_STAFF, null, 'ADM', office],
    ];
    for (const [key, role, homeWardId, managerKey, officeId] of people) {
      s[key] = await seedStaff(t.dataSource, {
        role,
        employeeCode: `P-${key}`,
        homeWardId,
        officeId,
        reportsToId: managerKey ? s[managerKey].id : null,
      });
      tok[key] = await bearerFor(http, `P-${key}`);
    }
    // Today's placements: both inspectors in the ward, WK1 + WK2 in IN1's team.
    for (const body of [
      { date: today, staffId: s.IN1.id, wardId: w1 },
      { date: today, staffId: s.IN2.id, wardId: w1 },
      { date: today, staffId: s.WK1.id, inspectorId: s.IN1.id },
      { date: today, staffId: s.WK2.id, inspectorId: s.IN1.id },
    ]) {
      await http.post('/api/v1/assignments').set('Authorization', tok.WI1).send(body).expect(201);
    }
    // WK4 self-joins IN2's team: unapproved until IN2 approves.
    await http
      .post('/api/v1/assignments/self')
      .set('Authorization', tok.WK4)
      .send({ clientUuid: randomUUID(), date: today, inspectorId: s.IN2.id })
      .expect(201);
  });

  afterAll(async () => {
    await t?.app.close();
  });

  async function challenge(who: string, staffId?: string): Promise<string> {
    const res = await http
      .post('/api/v1/attendance/challenges')
      .set('Authorization', tok[who])
      .send(staffId ? { staffId } : {})
      .expect(201);
    return res.body.challengeId as string;
  }

  function punch(who: string, body: Record<string, unknown>) {
    return http.post('/api/v1/attendance/punches').set('Authorization', tok[who]).send(body);
  }

  async function body(
    who: string,
    type: 'CHECK_IN' | 'CHECK_OUT',
    fields: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const subject = (fields.staffId as string | undefined) ?? s[who].id;
    const subjectStaff = Object.values(s).find((x) => x.id === subject)!;
    return {
      clientUuid: randomUUID(),
      type,
      challengeId: await challenge(who, fields.staffId as string | undefined),
      ...INSIDE,
      accuracyM: 10,
      faceImageBase64: faceOf(subjectStaff),
      ...fields,
    };
  }

  describe('liveness challenge', () => {
    it('gives two different prompts and a 2-minute expiry', async () => {
      const res = await http
        .post('/api/v1/attendance/challenges')
        .set('Authorization', tok.WK1)
        .send({})
        .expect(201);
      expect(res.body.actions).toHaveLength(2);
      expect(res.body.actions[0]).not.toBe(res.body.actions[1]);
      expect(res.body.expiresAt).toBe('2026-11-02T00:42:00.000Z');
    });

    it.each([
      ['an inspector, for another team', 'IN2', 'WK1'],
      ['a worker, for a colleague', 'WK2', 'WK1'],
      ['office staff, for a worker', 'OF1', 'WK1'],
    ])('is refused to %s', async (_name, who, subjectKey) => {
      await http
        .post('/api/v1/attendance/challenges')
        .set('Authorization', tok[who])
        .send({ staffId: s[subjectKey].id })
        .expect(403);
    });

    it('needs a signed-in caller', async () => {
      await http.post('/api/v1/attendance/challenges').send({}).expect(401);
      await http.post('/api/v1/attendance/punches').send({}).expect(401);
    });
  });

  describe('check-in', () => {
    let wk1Punch: Record<string, unknown>;

    it('accepts a worker on time, inside the ward, with a matching face', async () => {
      wk1Punch = await body('WK1', 'CHECK_IN');
      const res = await punch('WK1', wk1Punch).expect(200);
      expect(res.body.replayed).toBe(false);
      expect(res.body.attendance).toMatchObject({
        staffId: s.WK1.id,
        date: today,
        status: 'PRESENT',
        isLate: false,
        lateMinutes: 0,
        checkinFaceScore: 0.82,
        isSuspicious: false,
        checkin: {
          at: '2026-11-02T00:40:00.000Z',
          inGeofence: true,
          mode: 'SELF',
          markedById: s.WK1.id,
        },
        checkout: null,
      });
    });

    it('treats a retry with the same clientUuid as the same punch', async () => {
      const res = await punch('WK1', wk1Punch).expect(200);
      expect(res.body.replayed).toBe(true);
      expect(res.body.attendance.checkin.at).toBe('2026-11-02T00:40:00.000Z');
    });

    it('refuses a second check-in for the same shift', async () => {
      const res = await punch('WK1', await body('WK1', 'CHECK_IN')).expect(409);
      expect(res.body.code).toBe('ALREADY_CHECKED_IN');
    });

    it('lets an inspector check in their own team member, late (proxy punch)', async () => {
      clock.set('2026-11-02T00:55:00Z'); // 06:25 IST: 25 minutes after the start
      const res = await punch('IN1', await body('IN1', 'CHECK_IN', { staffId: s.WK2.id })).expect(
        200,
      );
      expect(res.body.attendance).toMatchObject({
        staffId: s.WK2.id,
        status: 'LATE',
        isLate: true,
        lateMinutes: 25,
        checkin: { mode: 'INSPECTOR_PROXY', markedById: s.IN1.id },
      });
      const alerts = await http
        .get(`/api/v1/alerts?alertType=LATE_CHECKIN&staffId=${s.WK2.id}`)
        .set('Authorization', tok.IN1)
        .expect(200);
      expect(alerts.body.total).toBe(1);
    });

    it('records a GPS point just outside the edge as inside (25 m allowance)', async () => {
      const res = await punch('IN1', await body('IN1', 'CHECK_IN', NEAR_EDGE)).expect(200);
      expect(res.body.attendance.checkin.inGeofence).toBe(true);
      expect(res.body.attendance.checkinDistanceM).toBeGreaterThan(0);
    });

    it.each<[string, string, Record<string, unknown>, number, string]>([
      ['outside the ward', 'IN2', OUTSIDE, 422, 'OUTSIDE_GEOFENCE'],
      ['a coarse GPS fix', 'IN2', { accuracyM: 60 }, 422, 'LOCATION_TOO_INACCURATE'],
      ['without an assignment', 'WK3', {}, 422, 'NO_ASSIGNMENT'],
      ['with an unapproved self-join', 'WK4', {}, 422, 'ASSIGNMENT_NOT_APPROVED'],
      ['without a face image', 'IN2', { faceImageBase64: undefined }, 400, 'VALIDATION_FAILED'],
    ])('refuses a punch %s', async (_name, who, fields, status, code) => {
      const res = await punch(who, await body(who, 'CHECK_IN', fields)).expect(status);
      expect(res.body.code).toBe(code);
    });

    it('refuses a face that does not match, and spends the challenge', async () => {
      const attempt = await body('IN2', 'CHECK_IN', { faceImageBase64: faceOf(s.WK1) });
      const res = await punch('IN2', attempt).expect(422);
      expect(res.body.code).toBe('FACE_MISMATCH');
      const retry = await punch('IN2', { ...attempt, faceImageBase64: faceOf(s.IN2) }).expect(422);
      expect(retry.body.code).toBe('CHALLENGE_INVALID');
    });

    it("refuses someone else's challenge and an expired one", async () => {
      const stolen = await challenge('IN2');
      const res = await punch('WK1', {
        ...(await body('WK1', 'CHECK_OUT')),
        challengeId: stolen,
      }).expect(422);
      expect(res.body.code).toBe('CHALLENGE_INVALID');

      const late = await body('IN2', 'CHECK_IN');
      clock.advanceMinutes(3);
      const expired = await punch('IN2', late).expect(422);
      expect(expired.body.code).toBe('CHALLENGE_EXPIRED');
    });

    it('accepts a mock location but flags it and alerts the supervisors', async () => {
      const res = await punch('IN2', await body('IN2', 'CHECK_IN', { isMocked: true })).expect(200);
      expect(res.body.attendance.isSuspicious).toBe(true);
      const alerts = await http
        .get(`/api/v1/alerts?alertType=TAMPER_DETECTED&staffId=${s.IN2.id}`)
        .set('Authorization', tok.WI1)
        .expect(200);
      expect(alerts.body.total).toBe(1);
    });

    it('checks office staff in at their office with a 100 m accuracy limit', async () => {
      const atOffice = { latitude: 16.8505, longitude: 74.6005, accuracyM: 80 };
      const res = await punch('OF1', await body('OF1', 'CHECK_IN', atOffice)).expect(200);
      expect(res.body.attendance).toMatchObject({ wardId: null, status: 'LATE' });
      expect(res.body.attendance.officeId).toBeTruthy();
    });
  });

  describe('check-out', () => {
    it('refuses a check-out before a check-in', async () => {
      const res = await punch('WK3', await body('WK3', 'CHECK_OUT')).expect(422);
      expect(res.body.code).toBe('NOT_CHECKED_IN');
    });

    let out: Record<string, unknown>;
    it('closes the shift with the worked minutes', async () => {
      clock.set('2026-11-02T08:35:00Z'); // 14:05 IST
      out = await body('WK1', 'CHECK_OUT');
      const res = await punch('WK1', out).expect(200);
      expect(res.body.attendance).toMatchObject({
        status: 'PRESENT',
        workedMinutes: 475,
        checkoutType: 'MANUAL',
        checkout: { at: '2026-11-02T08:35:00.000Z', inGeofence: true, mode: 'SELF' },
      });
    });

    it('is idempotent and refuses a second check-out', async () => {
      expect((await punch('WK1', out).expect(200)).body.replayed).toBe(true);
      const res = await punch('WK1', await body('WK1', 'CHECK_OUT')).expect(409);
      expect(res.body.code).toBe('ALREADY_CHECKED_OUT');
    });

    it('lets the inspector check their team member out (proxy), outside the ward', async () => {
      const res = await punch(
        'IN1',
        await body('IN1', 'CHECK_OUT', { staffId: s.WK2.id, ...OUTSIDE }),
      );
      expect(res.status).toBe(200);
      expect(res.body.attendance.checkout).toMatchObject({
        inGeofence: false,
        mode: 'INSPECTOR_PROXY',
        markedById: s.IN1.id,
      });
    });

    it('turns an early leaver into a half day', async () => {
      clock.set('2026-11-02T03:00:00Z'); // 08:30 IST, 2 h after checking in at 06:28
      const res = await punch(
        'OF1',
        await body('OF1', 'CHECK_OUT', { latitude: 16.8505, longitude: 74.6005 }),
      );
      expect(res.status).toBe(200);
      expect(res.body.attendance.status).toBe('HALF_DAY');
    });
  });

  describe('reading attendance', () => {
    const count = async (who: string, query = '') =>
      (await http.get(`/api/v1/attendance${query}`).set('Authorization', tok[who]).expect(200)).body
        .total as number;

    it('shows each person their own scope', async () => {
      expect(await count('WK1')).toBe(1);
      expect(await count('IN1')).toBe(3); // self + WK1 + WK2
      expect(await count('WI1')).toBe(4); // every ward log, not the office one
      expect(await count('ADM')).toBe(5);
      expect(await count('ADM', '?status=HALF_DAY')).toBe(1);
    });

    it('hides records outside your scope', async () => {
      const page = await http.get('/api/v1/attendance').set('Authorization', tok.WK1).expect(200);
      const id = page.body.items[0].id as string;
      await http.get(`/api/v1/attendance/${id}`).set('Authorization', tok.IN1).expect(200);
      await http.get(`/api/v1/attendance/${id}`).set('Authorization', tok.IN2).expect(404);
      await http
        .get(`/api/v1/attendance?staffId=${s.WK1.id}`)
        .set('Authorization', tok.IN2)
        .expect(403);
      await http.get('/api/v1/attendance').expect(401);
    });

    it("lets an inspector read a worker placed under them for the day (not their report)", async () => {
      // WK3 reports to IN2, but today the ward inspector places them in IN1's team.
      await http
        .post('/api/v1/assignments')
        .set('Authorization', tok.WI1)
        .send({ date: today, staffId: s.WK3.id, inspectorId: s.IN1.id })
        .expect(201);
      clock.set('2026-11-02T03:00:00Z'); // 08:30 IST, inside the shift
      const marked = await punch('IN1', await body('IN1', 'CHECK_IN', { staffId: s.WK3.id })).expect(200);
      const id = marked.body.attendance.id as string;

      await http.get(`/api/v1/attendance/${id}`).set('Authorization', tok.IN1).expect(200);
      const mine = await http
        .get(`/api/v1/attendance?staffId=${s.WK3.id}`)
        .set('Authorization', tok.IN1)
        .expect(200);
      expect(mine.body.items.map((l: { id: string }) => l.id)).toEqual([id]);
      await http
        .get(`/api/v1/staff/${s.WK3.id}/route?date=${today}`)
        .set('Authorization', tok.IN1)
        .expect(200);
      // Their own inspector still sees them (reporting line).
      await http.get(`/api/v1/attendance/${id}`).set('Authorization', tok.IN2).expect(200);
    });
  });
});
