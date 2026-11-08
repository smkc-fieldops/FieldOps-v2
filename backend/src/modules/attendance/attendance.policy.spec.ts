import type { AuthUser } from '../../shared/auth/auth-user';
import { Role, StaffRole } from '../../shared/auth/roles';
import { AppError } from '../../shared/errors/app-error';
import { ErrorCode } from '../../shared/errors/error-codes';
import { effectiveShift } from '../shifts/shifts.policy';
import {
  attendanceScope,
  checkAccuracy,
  checkChallenge,
  checkCheckinGeofence,
  geofenceResult,
  isOutOfZone,
  isRepeatedLate,
  logForPing,
  alertWardAt,
  lateMark,
  LIVENESS_ACTIONS,
  pickActions,
  pickCheckinShift,
  pickCheckoutLog,
  pingTimeAcceptable,
  PunchAssignment,
  punchMode,
  punchPlace,
  PunchSubject,
  routeAccess,
  RouteSubject,
  statusAtCheckout,
  tamperSeverity,
  workedMinutes,
} from './attendance.policy';

const user = (role: StaffRole, staffId = 'me', homeWardId: string | null = 'w1'): AuthUser => ({
  staffId,
  role,
  sessionId: 's',
  homeWardId,
  officeId: null,
});
const subject = (role: StaffRole, fields: Partial<PunchSubject> = {}): PunchSubject => ({
  id: 'sub',
  role,
  homeWardId: 'w1',
  officeId: null,
  isActive: true,
  ...fields,
});
const assignment = (fields: Partial<PunchAssignment> = {}): PunchAssignment => ({
  id: 'a1',
  wardId: 'w1',
  wardInspectorId: 'wi',
  inspectorId: 'in',
  isApproved: true,
  ...fields,
});

function codeOf(fn: () => unknown): ErrorCode | 'OK' {
  try {
    fn();
    return 'OK';
  } catch (error) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
}

// 06:00-14:00 IST on 2 Nov 2026 = 00:30Z-08:30Z.
const day = effectiveShift('2026-11-02', { shiftStart: '06:00', shiftEnd: '14:00' }, null);
const at = (iso: string): Date => new Date(iso);

describe('punchMode (hierarchy)', () => {
  it.each<[string, AuthUser, PunchSubject, PunchAssignment | null, PunchMode | ErrorCode]>([
    ['self', user(Role.WORKER, 'sub'), subject(Role.WORKER), assignment(), 'SELF'],
    ['self without assignment', user(Role.WORKER, 'sub'), subject(Role.WORKER), null, 'SELF'],
    [
      'inspector for own team',
      user(Role.INSPECTOR, 'in'),
      subject(Role.WORKER),
      assignment(),
      'INSPECTOR_PROXY',
    ],
    [
      'inspector for another team',
      user(Role.INSPECTOR, 'in2'),
      subject(Role.WORKER),
      assignment(),
      ErrorCode.FORBIDDEN,
    ],
    [
      'inspector without assignment',
      user(Role.INSPECTOR, 'in'),
      subject(Role.WORKER),
      null,
      ErrorCode.FORBIDDEN,
    ],
    [
      'inspector for an inspector',
      user(Role.INSPECTOR, 'in'),
      subject(Role.INSPECTOR),
      assignment(),
      ErrorCode.FORBIDDEN,
    ],
    [
      'ward inspector, own ward worker',
      user(Role.WARD_INSPECTOR, 'wi'),
      subject(Role.WORKER),
      assignment(),
      'INSPECTOR_PROXY',
    ],
    [
      'ward inspector, own ward inspector',
      user(Role.WARD_INSPECTOR, 'wi'),
      subject(Role.INSPECTOR),
      assignment(),
      'INSPECTOR_PROXY',
    ],
    [
      'ward inspector, other ward',
      user(Role.WARD_INSPECTOR, 'wi', 'w2'),
      subject(Role.WORKER),
      assignment(),
      ErrorCode.FORBIDDEN,
    ],
    [
      'ward inspector, office staff',
      user(Role.WARD_INSPECTOR, 'wi'),
      subject(Role.OFFICE_STAFF),
      null,
      ErrorCode.FORBIDDEN,
    ],
    [
      'admin for anyone below',
      user(Role.ADMIN, 'adm'),
      subject(Role.OFFICE_STAFF),
      null,
      'ADMIN_PROXY',
    ],
    [
      'admin for another admin',
      user(Role.ADMIN, 'adm'),
      subject(Role.ADMIN),
      null,
      ErrorCode.FORBIDDEN,
    ],
    [
      'worker for a worker',
      user(Role.WORKER, 'wk2'),
      subject(Role.WORKER),
      assignment(),
      ErrorCode.FORBIDDEN,
    ],
    [
      'office staff for a worker',
      user(Role.OFFICE_STAFF, 'of'),
      subject(Role.WORKER),
      assignment(),
      ErrorCode.FORBIDDEN,
    ],
    [
      'inactive subject',
      user(Role.ADMIN, 'adm'),
      subject(Role.WORKER, { isActive: false }),
      assignment(),
      ErrorCode.AUTH_ACCOUNT_INACTIVE,
    ],
  ])('%s', (_name, actor, sub, asg, expected) => {
    let result: PunchMode | ErrorCode;
    try {
      result = punchMode(actor, sub, asg);
    } catch (error) {
      result = (error as AppError).code;
    }
    expect(result).toBe(expected);
  });
});

type PunchMode = ReturnType<typeof punchMode>;

describe('punchPlace', () => {
  it.each<[string, PunchSubject, PunchAssignment | null, unknown]>([
    [
      'worker in assigned ward',
      subject(Role.WORKER),
      assignment({ wardId: 'w9' }),
      { kind: 'WARD', wardId: 'w9', assignmentId: 'a1' },
    ],
    [
      'inspector in assigned ward',
      subject(Role.INSPECTOR),
      assignment(),
      { kind: 'WARD', wardId: 'w1', assignmentId: 'a1' },
    ],
    ['worker without assignment', subject(Role.WORKER), null, ErrorCode.NO_ASSIGNMENT],
    [
      'unapproved self-join',
      subject(Role.WORKER),
      assignment({ isApproved: false }),
      ErrorCode.ASSIGNMENT_NOT_APPROVED,
    ],
    [
      'ward inspector in home ward',
      subject(Role.WARD_INSPECTOR, { homeWardId: 'w4' }),
      null,
      { kind: 'WARD', wardId: 'w4', assignmentId: null },
    ],
    [
      'office staff at office',
      subject(Role.OFFICE_STAFF, { officeId: 'o1' }),
      null,
      { kind: 'OFFICE', officeId: 'o1' },
    ],
    [
      'admin with no office',
      subject(Role.ADMIN, { officeId: null }),
      null,
      ErrorCode.RULE_VIOLATION,
    ],
  ])('%s', (_name, sub, asg, expected) => {
    let result: unknown;
    try {
      result = punchPlace(sub, asg);
    } catch (error) {
      result = (error as AppError).code;
    }
    expect(result).toEqual(expected);
  });
});

describe('lateMark with configured timing', () => {
  const shift = {
    date: '2026-11-02',
    shiftType: 'DAY',
    startsAt: new Date('2026-11-02T00:30:00Z'), // 06:00 IST
    endsAt: new Date('2026-11-02T08:30:00Z'), // 14:00 IST
  } as unknown as Parameters<typeof lateMark>[1];
  const timing = { lateGraceMinutes: 30, halfDayAfterPercent: 25 };
  it.each([
    ['inside the longer grace', '2026-11-02T01:00:00Z', 'PRESENT'],
    ['past the grace', '2026-11-02T01:01:00Z', 'LATE'],
    ['at a quarter of the shift', '2026-11-02T02:30:00Z', 'LATE'],
    ['past a quarter of the shift', '2026-11-02T02:31:00Z', 'HALF_DAY'],
  ])('%s', (_name, at, status) => {
    expect(lateMark(new Date(at), shift, timing).status).toBe(status);
  });
});

describe('geofence', () => {
  it.each<['WARD' | 'OFFICE', number, ErrorCode | 'OK']>([
    ['WARD', 0, 'OK'],
    ['WARD', 50, 'OK'],
    ['WARD', 50.01, ErrorCode.LOCATION_TOO_INACCURATE],
    ['OFFICE', 100, 'OK'],
    ['OFFICE', 101, ErrorCode.LOCATION_TOO_INACCURATE],
    ['WARD', -1, ErrorCode.LOCATION_TOO_INACCURATE],
    ['WARD', Number.NaN, ErrorCode.LOCATION_TOO_INACCURATE],
  ])('%s fix with %d m accuracy -> %s', (kind, accuracy, expected) => {
    expect(codeOf(() => checkAccuracy(kind, accuracy))).toBe(expected);
  });

  it.each([
    // inside, withinTolerance, distance -> inGeofence, distanceM, check-in allowed
    [true, true, 40, true, 0, 'OK'],
    [false, true, 24.9, true, 24.9, 'OK'],
    [false, false, 25.1, false, 25.1, ErrorCode.OUTSIDE_GEOFENCE],
  ] as const)(
    'inside=%s tolerance=%s edge=%d m',
    (inside, withinTolerance, distance, inGeofence, distanceM, expected) => {
      const result = geofenceResult({ inside, withinTolerance, distanceToEdgeMeters: distance });
      expect(result).toEqual({ inGeofence, distanceM });
      expect(codeOf(() => checkCheckinGeofence(result, 'WARD'))).toBe(expected);
    },
  );
});

describe('pickCheckinShift', () => {
  const night = effectiveShift(
    '2026-11-01',
    { shiftStart: '06:00', shiftEnd: '14:00' },
    { shiftType: 'NIGHT', startTime: '22:00', endTime: '06:00' },
  );
  const both = [night, day];
  it.each<[string, string, typeof both, ReadonlySet<string>, string | ErrorCode]>([
    [
      '61 minutes early',
      '2026-11-02T04:59:00+05:30',
      [day],
      new Set(),
      ErrorCode.OUTSIDE_SHIFT_WINDOW,
    ],
    ['exactly 60 minutes early', '2026-11-02T05:00:00+05:30', [day], new Set(), '2026-11-02'],
    ['during the shift', '2026-11-02T10:00:00+05:30', [day], new Set(), '2026-11-02'],
    [
      'at the shift end',
      '2026-11-02T14:00:00+05:30',
      both,
      new Set(),
      ErrorCode.OUTSIDE_SHIFT_WINDOW,
    ],
    [
      'already checked in',
      '2026-11-02T07:00:00+05:30',
      both,
      new Set(['2026-11-02']),
      ErrorCode.ALREADY_CHECKED_IN,
    ],
    // IST rollover: a night shift that began yesterday keeps yesterday's date after midnight.
    ['night shift after midnight', '2026-11-02T00:30:00+05:30', both, new Set(), '2026-11-01'],
    [
      'night shift done, day shift opens',
      '2026-11-02T05:30:00+05:30',
      both,
      new Set(['2026-11-01']),
      '2026-11-02',
    ],
  ])('%s', (_name, now, shifts, checkedIn, expected) => {
    let result: string;
    try {
      result = pickCheckinShift(at(now), shifts, checkedIn).date;
    } catch (error) {
      result = (error as AppError).code;
    }
    expect(result).toBe(expected);
  });

  it('says when check-in opens next', () => {
    try {
      pickCheckinShift(at('2026-11-02T03:00:00+05:30'), [day], new Set());
      fail('expected an error');
    } catch (error) {
      expect((error as AppError).details).toEqual({ opensAt: '2026-11-01T23:30:00.000Z' });
    }
  });
});

describe('lateMark (15-minute grace)', () => {
  it.each<[string, string, string, boolean, number]>([
    ['early', '05:40:00', 'PRESENT', false, 0],
    ['on the dot', '06:00:00', 'PRESENT', false, 0],
    ['14:59 after', '06:14:59', 'PRESENT', false, 0],
    ['exactly 15:00 after', '06:15:00', 'PRESENT', false, 0],
    ['one second past grace', '06:15:01', 'LATE', true, 16],
    ['22 minutes', '06:22:00', 'LATE', true, 22],
    ['exactly half the shift', '10:00:00', 'LATE', true, 240],
    ['past half the shift', '10:00:01', 'HALF_DAY', true, 241],
  ])('%s', (_name, time, status, isLate, lateMinutes) => {
    expect(lateMark(at(`2026-11-02T${time}+05:30`), day)).toEqual({ status, isLate, lateMinutes });
  });

  it.each([
    [2, false],
    [3, true],
    [4, true],
  ])('%d late marks this month -> repeated %s', (count, expected) => {
    expect(isRepeatedLate(count)).toBe(expected);
  });
});

describe('check-out', () => {
  const log = (date: string, checkin: string | null, checkout: string | null = null) => ({
    attendanceDate: date,
    checkinAt: checkin ? at(checkin) : null,
    checkoutAt: checkout ? at(checkout) : null,
  });

  it.each<[string, ReturnType<typeof log>[], string | ErrorCode]>([
    ['no logs', [], ErrorCode.NOT_CHECKED_IN],
    ['log without check-in', [log('2026-11-02', null)], ErrorCode.NOT_CHECKED_IN],
    ['open today', [log('2026-11-02', '2026-11-02T00:30:00Z')], '2026-11-02'],
    [
      'closed today',
      [log('2026-11-02', '2026-11-02T00:30:00Z', '2026-11-02T08:30:00Z')],
      ErrorCode.ALREADY_CHECKED_OUT,
    ],
    ['open night shift from yesterday', [log('2026-11-01', '2026-11-01T16:30:00Z')], '2026-11-01'],
    [
      'yesterday closed, today open',
      [
        log('2026-11-01', '2026-11-01T00:30:00Z', '2026-11-01T08:30:00Z'),
        log('2026-11-02', '2026-11-02T00:30:00Z'),
      ],
      '2026-11-02',
    ],
  ])('%s', (_name, logs, expected) => {
    let result: string;
    try {
      result = pickCheckoutLog(logs).attendanceDate;
    } catch (error) {
      result = (error as AppError).code;
    }
    expect(result).toBe(expected);
  });

  it.each<[string, string, number, string]>([
    ['full day', 'PRESENT', 480, 'PRESENT'],
    ['left at half', 'PRESENT', 240, 'PRESENT'],
    ['left before half', 'PRESENT', 239, 'HALF_DAY'],
    ['late and left early', 'LATE', 100, 'HALF_DAY'],
    ['already half day', 'HALF_DAY', 30, 'HALF_DAY'],
  ])('%s', (_name, current, worked, expected) => {
    expect(statusAtCheckout(current as 'PRESENT', worked, day)).toBe(expected);
  });

  it('counts whole minutes worked and never negative', () => {
    expect(workedMinutes(at('2026-11-02T00:30:00Z'), at('2026-11-02T08:29:59Z'))).toBe(479);
    expect(workedMinutes(at('2026-11-02T00:30:00Z'), at('2026-11-02T00:29:00Z'))).toBe(0);
  });
});

describe('liveness challenge', () => {
  it('always picks two different actions', () => {
    for (let a = 0; a < 12; a++) {
      for (let b = 0; b < 12; b++) {
        const [x, y] = pickActions(a, b);
        expect(x).not.toBe(y);
        expect(LIVENESS_ACTIONS).toContain(x);
        expect(LIVENESS_ACTIONS).toContain(y);
      }
    }
  });

  const good = {
    subjectId: 'sub',
    issuedToId: 'me',
    expiresAt: at('2026-11-02T00:32:00Z'),
    usedAt: null,
  };
  it.each<[string, typeof good | null, string, string, string, ErrorCode | 'OK']>([
    ['valid', good, 'me', 'sub', '2026-11-02T00:31:59Z', 'OK'],
    ['unknown', null, 'me', 'sub', '2026-11-02T00:31:00Z', ErrorCode.CHALLENGE_INVALID],
    [
      'for another subject',
      good,
      'me',
      'other',
      '2026-11-02T00:31:00Z',
      ErrorCode.CHALLENGE_INVALID,
    ],
    [
      'issued to someone else',
      good,
      'thief',
      'sub',
      '2026-11-02T00:31:00Z',
      ErrorCode.CHALLENGE_INVALID,
    ],
    [
      'used',
      { ...good, usedAt: at('2026-11-02T00:31:00Z') } as never,
      'me',
      'sub',
      '2026-11-02T00:31:10Z',
      ErrorCode.CHALLENGE_INVALID,
    ],
    ['expired', good, 'me', 'sub', '2026-11-02T00:32:00Z', ErrorCode.CHALLENGE_EXPIRED],
  ])('%s', (_name, challenge, actorId, subjectId, now, expected) => {
    expect(codeOf(() => checkChallenge(challenge, actorId, subjectId, at(now)))).toBe(expected);
  });
});

describe('pings', () => {
  const now = at('2026-11-02T06:00:00Z');
  it.each([
    ['now', '2026-11-02T06:00:00Z', true],
    ['two minutes ahead', '2026-11-02T06:02:00Z', true],
    ['three minutes ahead', '2026-11-02T06:03:00Z', false],
    ['47 hours old', '2026-10-31T07:00:00Z', true],
    ['49 hours old', '2026-10-31T05:00:00Z', false],
  ])('%s', (_name, recorded, expected) => {
    expect(pingTimeAcceptable(at(recorded), now)).toBe(expected);
  });

  it.each<[(boolean | null)[], boolean]>([
    [[], false],
    [[false], false],
    [[false, false], true],
    [[true, false, false], true],
    [[false, false, true], false],
    [[false, null, false], false],
  ])('%j -> out of zone %s', (flags, expected) => {
    expect(isOutOfZone(flags)).toBe(expected);
  });
});

describe('attendanceScope', () => {
  it.each<[StaffRole, string | null, unknown]>([
    [Role.ADMIN, null, { kind: 'ALL' }],
    [Role.WARD_INSPECTOR, 'w1', { kind: 'WARD', wardId: 'w1' }],
    [Role.WARD_INSPECTOR, null, { kind: 'SELF', staffId: 'me' }],
    [Role.INSPECTOR, 'w1', { kind: 'TEAM', managerId: 'me', selfId: 'me' }],
    [Role.WORKER, 'w1', { kind: 'SELF', staffId: 'me' }],
    [Role.OFFICE_STAFF, null, { kind: 'SELF', staffId: 'me' }],
  ])('%s', (role, ward, expected) => {
    expect(attendanceScope(user(role, 'me', ward))).toEqual(expected);
  });
});

describe('logForPing and tamperSeverity', () => {
  const logs = [
    {
      id: 'night',
      attendanceDate: '2026-11-01',
      checkinAt: at('2026-11-01T16:30:00Z'),
      checkoutAt: at('2026-11-02T00:30:00Z'),
    },
    {
      id: 'day',
      attendanceDate: '2026-11-02',
      checkinAt: at('2026-11-02T03:00:00Z'),
      checkoutAt: null,
    },
  ];
  it.each([
    ['during the night shift', '2026-11-01T20:00:00Z', 'night'],
    ['at the night check-out', '2026-11-02T00:30:00Z', 'night'],
    ['between shifts', '2026-11-02T01:00:00Z', null],
    ['during the open day shift', '2026-11-02T05:00:00Z', 'day'],
    ['before any check-in', '2026-11-01T10:00:00Z', null],
  ])('%s', (_name, recorded, expected) => {
    expect(logForPing(logs, at(recorded))?.id ?? null).toBe(expected);
  });

  it.each([
    ['during a shift in another ward: that ward', '2026-11-02T05:00:00Z', 'home', 'placed'],
    ['outside any shift: the home ward', '2026-11-02T01:00:00Z', 'home', 'home'],
    ['outside any shift, no home ward: none', '2026-11-02T01:00:00Z', null, undefined],
  ])('alertWardAt %s', (_name, when, home, expected) => {
    const placed = logs.map((l) => ({ ...l, wardId: l.id === 'day' ? 'placed' : 'home' }));
    expect(alertWardAt(placed, at(when), home)).toBe(expected);
  });

  it.each([
    ['MOCK_LOCATION', 'HIGH'],
    ['GPS_DISABLED', 'HIGH'],
    ['PERMISSION_REVOKED', 'HIGH'],
    ['AIRPLANE_MODE', 'MEDIUM'],
    ['DEVICE_OFFLINE', 'MEDIUM'],
    ['SILENT_GAP', 'MEDIUM'],
  ] as const)('%s -> %s', (type, expected) => {
    expect(tamperSeverity(type)).toBe(expected);
  });
});

describe('routeAccess', () => {
  const person = (fields: Partial<RouteSubject> = {}): RouteSubject => ({
    id: 'sub',
    reportsToId: 'me',
    homeWardId: 'w1',
    dayWardId: null,
    dayInspectorId: null,
    ...fields,
  });
  const today = '2026-11-02';

  it.each([
    ['admin: anyone, any day', Role.ADMIN, person({ homeWardId: 'w9' }), '2026-10-01', 'ALLOWED'],
    ['ward inspector: home ward', Role.WARD_INSPECTOR, person(), today, 'ALLOWED'],
    [
      'ward inspector: placed in the ward that day',
      Role.WARD_INSPECTOR,
      person({ homeWardId: 'w9', dayWardId: 'w1' }),
      today,
      'ALLOWED',
    ],
    [
      'ward inspector: placed elsewhere that day',
      Role.WARD_INSPECTOR,
      person({ dayWardId: 'w9' }),
      today,
      'HIDDEN',
    ],
    ['inspector: own report, any day', Role.INSPECTOR, person(), '2026-10-01', 'ALLOWED'],
    ['inspector: another team', Role.INSPECTOR, person({ reportsToId: 'other' }), today, 'HIDDEN'],
    [
      'inspector: another team, placed under me that day',
      Role.INSPECTOR,
      person({ reportsToId: 'other', dayInspectorId: 'me' }),
      today,
      'ALLOWED',
    ],
    ['worker: own route today', Role.WORKER, person({ id: 'me' }), today, 'ALLOWED'],
    [
      'worker: own night shift from yesterday',
      Role.WORKER,
      person({ id: 'me' }),
      '2026-11-01',
      'ALLOWED',
    ],
    [
      'worker: own route last week',
      Role.WORKER,
      person({ id: 'me' }),
      '2026-10-26',
      'DATE_NOT_ALLOWED',
    ],
    ['worker: a colleague', Role.WORKER, person(), today, 'HIDDEN'],
    ['office staff: own route today', Role.OFFICE_STAFF, person({ id: 'me' }), today, 'ALLOWED'],
  ] as const)('%s', (_case, role, subject, date, expected) => {
    expect(routeAccess(user(role), subject, date, today)).toBe(expected);
  });
});
