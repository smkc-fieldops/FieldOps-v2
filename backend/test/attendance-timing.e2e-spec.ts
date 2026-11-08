/**
 * What happens to someone who does not check in on time, from their shift times alone: an alert
 * after the grace, ABSENT past the half-day point, and a late arrival turning the day into a
 * half day and closing both alerts.
 */
import { randomUUID } from 'node:crypto';
import { AttendanceJobsService } from '../src/modules/attendance/attendance-jobs.service';
import {
  FaceCaptureOptions,
  FaceVerificationResult,
  FaceVerifier,
} from '../src/modules/face/face-verifier';
import type { Staff } from '../src/modules/staff/entities/staff.entity';
import { Clock, FixedClock } from '../src/shared/clock/clock';
import { Role, type StaffRole } from '../src/shared/auth/roles';
import { bearerFor, createTestApp, insertWard, seedStaff, TestApp } from './helpers';

class AlwaysMatches extends FaceVerifier {
  readonly provider = 'local' as const;
  async captureOptions(): Promise<FaceCaptureOptions> {
    return { provider: 'local', instructions: 'ML_KIT_LIVENESS_THEN_UPLOAD_CROP' };
  }
  async verify(): Promise<FaceVerificationResult> {
    return { provider: 'local', matched: true, score: 0.8, threshold: 0.45 };
  }
}

describe('marks when a check-in is delayed or missing (e2e)', () => {
  const day = '2026-11-02'; // Default shift 06:00-14:00 IST, so the half-day point is 10:00.
  const clock = new FixedClock(`${day}T00:00:00Z`); // 05:30 IST
  let t: TestApp;
  let jobs: AttendanceJobsService;
  const s: Record<string, Staff> = {};
  const tok: Record<string, string> = {};

  beforeAll(async () => {
    t = await createTestApp((b) =>
      b.overrideProvider(Clock).useValue(clock).overrideProvider(FaceVerifier).useClass(AlwaysMatches),
    );
    jobs = t.app.get(AttendanceJobsService);
    const ward = await insertWard(t.dataSource, 'TM1');
    const people: [string, StaffRole, string | null][] = [
      ['ADM', Role.ADMIN, null],
      ['WI1', Role.WARD_INSPECTOR, 'ADM'],
      ['IN1', Role.INSPECTOR, 'WI1'],
      ['WK1', Role.WORKER, 'IN1'],
      ['WK2', Role.WORKER, 'IN1'],
    ];
    for (const [key, role, manager] of people) {
      s[key] = await seedStaff(t.dataSource, {
        role,
        employeeCode: `TM-${key}`,
        homeWardId: role === Role.ADMIN ? null : ward,
        reportsToId: manager ? s[manager].id : null,
        createdAt: new Date('2026-10-01T00:00:00Z'),
      });
      tok[key] = await bearerFor(t.http, `TM-${key}`);
    }
    for (const body of [
      { date: day, staffId: s.IN1.id, wardId: ward },
      { date: day, staffId: s.WK1.id, inspectorId: s.IN1.id },
      { date: day, staffId: s.WK2.id, inspectorId: s.IN1.id },
    ]) {
      await t.http.post('/api/v1/assignments').set('Authorization', tok.WI1).send(body).expect(201);
    }
  });

  afterAll(async () => {
    await t?.app.close();
  });

  const alertsOf = async (type: string, key: string) => {
    const res = await t.http
      .get(`/api/v1/alerts?alertType=${type}&staffId=${s[key].id}`)
      .set('Authorization', tok.ADM)
      .expect(200);
    return res.body.items as { isResolved: boolean }[];
  };

  const today = async (key: string) => {
    const res = await t.http
      .get(`/api/v1/attendance?staffId=${s[key].id}&from=${day}&to=${day}`)
      .set('Authorization', tok.ADM)
      .expect(200);
    return (res.body.items as { status: string }[])[0]?.status ?? null;
  };

  const checkIn = async (key: string) => {
    const challenge = await t.http
      .post('/api/v1/attendance/challenges')
      .set('Authorization', tok[key])
      .send({})
      .expect(201);
    return t.http
      .post('/api/v1/attendance/punches')
      .set('Authorization', tok[key])
      .send({
        clientUuid: randomUUID(),
        type: 'CHECK_IN',
        challengeId: challenge.body.challengeId,
        latitude: 16.855,
        longitude: 74.585,
        accuracyM: 45, // Within the 50 m field limit.
        faceImageBase64: Buffer.from('face').toString('base64'),
      });
  };

  it('raises nothing inside the grace', async () => {
    clock.set(`${day}T00:40:00Z`); // 06:10 IST
    await jobs.flagNotCheckedIn();
    expect(await alertsOf('NOT_CHECKED_IN', 'WK1')).toHaveLength(0);
  });

  it('alerts supervisors after the grace, once, and writes no mark yet', async () => {
    clock.set(`${day}T00:50:00Z`); // 06:20 IST
    await jobs.flagNotCheckedIn();
    await jobs.flagNotCheckedIn();
    expect(await alertsOf('NOT_CHECKED_IN', 'WK1')).toHaveLength(1);
    await jobs.closeDays();
    expect(await today('WK1')).toBeNull();
  });

  it('marks ABSENT only past the half-day point', async () => {
    clock.set(`${day}T04:30:00Z`); // 10:00 IST exactly
    await jobs.closeDays();
    expect(await today('WK1')).toBeNull();

    clock.set(`${day}T04:40:00Z`); // 10:10 IST
    await jobs.closeDays();
    expect(await today('WK1')).toBe('ABSENT');
    expect(await today('WK2')).toBe('ABSENT');
    expect(await alertsOf('ABSENT', 'WK1')).toHaveLength(1);
  });

  it('turns a late arrival into a half day and closes both alerts', async () => {
    clock.set(`${day}T05:30:00Z`); // 11:00 IST
    const res = await checkIn('WK1');
    expect(res.status).toBe(200);
    expect(res.body.attendance.status).toBe('HALF_DAY');
    expect(await today('WK1')).toBe('HALF_DAY');
    expect((await alertsOf('NOT_CHECKED_IN', 'WK1'))[0].isResolved).toBe(true);
    expect((await alertsOf('ABSENT', 'WK1'))[0].isResolved).toBe(true);
  });

  it('leaves someone who never arrives ABSENT at the end of the shift', async () => {
    clock.set(`${day}T08:40:00Z`); // 14:10 IST
    await jobs.closeDays();
    expect(await today('WK2')).toBe('ABSENT');
    expect((await alertsOf('ABSENT', 'WK2'))[0].isResolved).toBe(false);
  });
});
