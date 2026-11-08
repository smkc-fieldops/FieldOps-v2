/**
 * The day-close job end to end with a frozen clock: once a shift has ended, everyone expected
 * that day gets a row (ABSENT with an alert, ON_LEAVE, HOLIDAY_OFF for office staff on Sunday),
 * and supervisors' later decisions reach attendance (approved sick leave turns ABSENT into
 * ON_LEAVE, an approved correction makes the day REGULARIZED).
 */
import { randomUUID } from 'node:crypto';
import { AttendanceJobsService } from '../src/modules/attendance/attendance-jobs.service';
import { AttendanceLog } from '../src/modules/attendance/entities/attendance-log.entity';
import type { Staff } from '../src/modules/staff/entities/staff.entity';
import { Role, type StaffRole } from '../src/shared/auth/roles';
import { Clock, FixedClock } from '../src/shared/clock/clock';
import { bearerFor, createTestApp, insertOffice, insertWard, seedStaff, TestApp } from './helpers';

const DAY = '2026-11-02'; // a Monday; 1 Nov is a Sunday

describe('day close (e2e)', () => {
  const clock = new FixedClock('2026-11-01T00:00:00Z'); // 05:30 IST on Sunday 1 Nov
  let t: TestApp;
  let http: TestApp['http'];
  let jobs: AttendanceJobsService;
  const s: Record<string, Staff> = {};
  const tok: Record<string, string> = {};

  const statusOf = async (key: string, date = DAY) =>
    (
      await t.dataSource
        .getRepository(AttendanceLog)
        .findOneBy({ staffId: s[key].id, attendanceDate: date })
    )?.status ?? null;

  const review = async (kind: 'leave' | 'regularizations', id: string, version: number) =>
    http
      .post(`/api/v1/${kind}/${id}/review`)
      .set('Authorization', tok.IN1)
      .send({ expectedVersion: version, decision: 'APPROVED' })
      .expect(200);

  beforeAll(async () => {
    t = await createTestApp((b) => b.overrideProvider(Clock).useValue(clock));
    http = t.http;
    jobs = t.app.get(AttendanceJobsService);
    const w1 = await insertWard(t.dataSource, 'D1');
    const office = await insertOffice(t.dataSource, 'DHQ', {
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
      ['WK1', Role.WORKER, w1, 'IN1', null],
      ['WK2', Role.WORKER, w1, 'IN1', null],
      ['WK3', Role.WORKER, w1, 'IN1', null],
      ['WK4', Role.WORKER, w1, 'IN1', null],
      ['WK5', Role.WORKER, w1, 'IN1', null], // not placed on DAY: not expected
      ['OF1', Role.OFFICE_STAFF, null, 'ADM', office],
      ['OF2', Role.OFFICE_STAFF, null, 'ADM', office], // joins on DAY: not absent before
    ];
    for (const [key, role, homeWardId, managerKey, officeId] of people) {
      s[key] = await seedStaff(t.dataSource, {
        role,
        employeeCode: `D-${key}`,
        homeWardId,
        officeId,
        reportsToId: managerKey ? s[managerKey].id : null,
        createdAt: new Date(key === 'OF2' ? '2026-11-02T03:00:00Z' : '2026-10-01T00:00:00Z'),
      });
      tok[key] = await bearerFor(http, `D-${key}`);
    }
    for (const body of [
      { date: DAY, staffId: s.IN1.id, wardId: w1 },
      ...['WK1', 'WK2', 'WK3', 'WK4'].map((k) => ({
        date: DAY,
        staffId: s[k].id,
        inspectorId: s.IN1.id,
      })),
    ]) {
      await http.post('/api/v1/assignments').set('Authorization', tok.WI1).send(body).expect(201);
    }
    // WK2 asked for DAY off beforehand, and the inspector approved.
    const leave = await http
      .post('/api/v1/leave')
      .set('Authorization', tok.WK2)
      .send({ clientUuid: randomUUID(), leaveType: 'CASUAL', fromDate: DAY, toDate: DAY })
      .expect(201);
    await review('leave', leave.body.id, leave.body.version);
  });

  afterAll(async () => {
    await t?.app.close();
  });

  it('writes nothing before the half-day point of the shift', async () => {
    clock.set('2026-11-02T04:00:00Z'); // 09:30 IST on DAY, shift 06:00-14:00
    await jobs.closeDays();
    expect(await statusOf('WK1')).toBeNull();
    expect(await statusOf('WK2')).toBeNull();
  });

  it('closes the day once the shift has ended, with an ABSENT alert', async () => {
    clock.set('2026-11-02T08:40:00Z'); // 14:10 IST
    const result = await jobs.closeDays();
    expect(await statusOf('WK1')).toBe('ABSENT');
    expect(await statusOf('WK2')).toBe('ON_LEAVE');
    expect(await statusOf('OF1')).toBe('ABSENT'); // Monday, no check-in
    expect(await statusOf('OF1', '2026-11-01')).toBe('HOLIDAY_OFF'); // Sunday
    expect(await statusOf('WK5')).toBeNull(); // not placed that day
    expect(await statusOf('WI1')).toBe('ABSENT'); // ward inspectors have no assignment row
    expect(await statusOf('OF2')).toBe('ABSENT'); // joined that morning
    expect(await statusOf('OF2', '2026-11-01')).toBeNull(); // not yet on the rolls
    expect(result).toMatch(/absent/);

    const alerts = await http
      .get(`/api/v1/alerts?alertType=ABSENT&staffId=${s.WK1.id}`)
      .set('Authorization', tok.WI1)
      .expect(200);
    expect(alerts.body.total).toBe(1);
    expect(alerts.body.items[0]).toMatchObject({ severity: 'MEDIUM', isResolved: false });
  });

  it('is safe to repeat: no second row or alert', async () => {
    await jobs.closeDays();
    const rows = await t.dataSource
      .getRepository(AttendanceLog)
      .countBy({ staffId: s.WK1.id, attendanceDate: DAY });
    expect(rows).toBe(1);
    const alerts = await http
      .get(`/api/v1/alerts?alertType=ABSENT&staffId=${s.WK1.id}`)
      .set('Authorization', tok.WI1)
      .expect(200);
    expect(alerts.body.total).toBe(1);
  });

  it('applies decisions taken afterwards: sick leave and a correction', async () => {
    clock.set('2026-11-03T04:00:00Z'); // the next morning
    const sick = await http
      .post('/api/v1/leave')
      .set('Authorization', tok.WK3)
      .send({
        clientUuid: randomUUID(),
        leaveType: 'SICK',
        fromDate: DAY,
        toDate: DAY,
        reason: 'Fever',
      })
      .expect(201);
    await review('leave', sick.body.id, sick.body.version);
    const fix = await http
      .post('/api/v1/regularizations')
      .set('Authorization', tok.WK4)
      .send({
        clientUuid: randomUUID(),
        attendanceDate: DAY,
        reasonType: 'BATTERY_DEAD',
        explanation: 'Phone died at 6 am; the inspector saw me on the route.',
      })
      .expect(201);
    await review('regularizations', fix.body.id, fix.body.version);
    expect(await statusOf('WK3')).toBe('ABSENT');
    expect(await statusOf('WK4')).toBe('ABSENT');

    expect(await jobs.closeDays()).toMatch(/corrected 2/);
    expect(await statusOf('WK3')).toBe('ON_LEAVE');
    expect(await statusOf('WK4')).toBe('REGULARIZED');
    expect(await statusOf('WK1')).toBe('ABSENT');
    expect(await jobs.closeDays()).toMatch(/corrected 0/);
  });
});
