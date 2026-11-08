import { effectiveShift } from '../shifts/shifts.policy';
import {
  autoCheckout,
  autoCheckoutDue,
  dayCloseDates,
  dayCloseStatus,
  isSilent,
  isWeeklyOff,
  notCheckedInDue,
  pastHalfDayPoint,
  pingDate,
  pingWindow,
  reconciledStatus,
  retentionCutoff,
  rollupDates,
  RoutePing,
  routeStats,
  slotKey,
  wardDayCounts,
  WardDayLog,
} from './jobs.policy';

// Day shift 06:00-14:00 IST = 00:30Z-08:30Z; night shift 22:00-06:00 IST = 16:30Z-00:30Z next day.
const day = effectiveShift('2026-11-02', { shiftStart: '06:00', shiftEnd: '14:00' }, null);
const night = effectiveShift('2026-11-02', { shiftStart: '22:00', shiftEnd: '06:00' }, null);
const at = (iso: string) => new Date(iso);

describe('slotKey', () => {
  it.each([
    ['2026-11-02T06:00:00Z', 30, '2026-11-02T06:00'],
    ['2026-11-02T06:29:59Z', 30, '2026-11-02T06:00'],
    ['2026-11-02T06:30:00Z', 30, '2026-11-02T06:30'],
    ['2026-11-02T06:44:00Z', 15, '2026-11-02T06:30'],
    ['2026-11-02T06:45:00Z', 15, '2026-11-02T06:45'],
  ])('%s in %i-minute slots is %s', (now, minutes, key) => {
    expect(slotKey(at(now), minutes)).toBe(key);
  });
});

describe('autoCheckoutDue', () => {
  it.each([
    ['an hour minus a second after the end', '2026-11-02T09:29:59Z', day, false],
    ['exactly an hour after the end', '2026-11-02T09:30:00Z', day, true],
    ['a night shift during the night', '2026-11-03T00:00:00Z', night, false],
    ['a night shift the next morning', '2026-11-03T01:30:00Z', night, true],
  ])('%s', (_case, now, shift, due) => {
    expect(autoCheckoutDue(shift, at(now))).toBe(due);
  });
});

describe('autoCheckout', () => {
  const checkin = at('2026-11-02T00:35:00Z');
  it.each([
    [
      'office: at the scheduled end',
      'OFFICE',
      null,
      '2026-11-02T08:30:00.000Z',
      'AUTO_OFFICE_SCHEDULED',
      false,
    ],
    [
      'field: when last seen',
      'WARD',
      '2026-11-02T07:10:00Z',
      '2026-11-02T07:10:00.000Z',
      'AUTO_GPS_LAST_SEEN',
      false,
    ],
    [
      'field: never after the shift end',
      'WARD',
      '2026-11-02T10:00:00Z',
      '2026-11-02T08:30:00.000Z',
      'AUTO_GPS_LAST_SEEN',
      false,
    ],
    [
      'field: no ping at all = at check-in, flagged',
      'WARD',
      null,
      '2026-11-02T00:35:00.000Z',
      'AUTO_GPS_LAST_SEEN',
      true,
    ],
    [
      'field: a ping before check-in does not count',
      'WARD',
      '2026-11-02T00:20:00Z',
      '2026-11-02T00:35:00.000Z',
      'AUTO_GPS_LAST_SEEN',
      true,
    ],
  ] as const)('%s', (_case, kind, lastSeen, expectedAt, type, suspicious) => {
    const out = autoCheckout(kind, checkin, day, lastSeen ? at(lastSeen) : null);
    expect(out.checkoutAt.toISOString()).toBe(expectedAt);
    expect(out.checkoutType).toBe(type);
    expect(out.suspicious).toBe(suspicious);
  });
});

describe('isSilent', () => {
  it.each([
    ['29 minutes without a ping', '2026-11-02T03:00:00Z', '2026-11-02T03:29:00Z', false],
    ['30 minutes without a ping', '2026-11-02T03:00:00Z', '2026-11-02T03:30:00Z', true],
    ['after the shift has ended', '2026-11-02T07:00:00Z', '2026-11-02T08:30:00Z', false],
  ])('%s', (_case, lastSeen, now, silent) => {
    expect(isSilent(at(lastSeen), day, at(now))).toBe(silent);
  });
});

describe('pingDate and pingWindow', () => {
  const dates = new Map([['night-log', '2026-11-02']]);
  it.each([
    ['a night-shift ping after midnight', 'night-log', '2026-11-02T20:00:00Z', '2026-11-02'],
    ['an unlinked ping, by its IST date', null, '2026-11-02T20:00:00Z', '2026-11-03'],
    ['an unlinked ping just before IST midnight', null, '2026-11-02T18:29:59Z', '2026-11-02'],
    ['a ping of an unknown log, by its IST date', 'other', '2026-11-02T10:00:00Z', '2026-11-02'],
  ])('%s', (_case, attendanceId, recordedAt, expected) => {
    expect(pingDate({ attendanceId, recordedAt: at(recordedAt) }, dates)).toBe(expected);
  });

  it('spans from IST midnight to two days later', () => {
    const w = pingWindow('2026-11-02');
    expect(w.from.toISOString()).toBe('2026-11-01T18:30:00.000Z');
    expect(w.to.toISOString()).toBe('2026-11-03T18:30:00.000Z');
  });
});

describe('routeStats', () => {
  const p = (minute: number, lat: number, fields: Partial<RoutePing> = {}): RoutePing => ({
    attendanceId: 'a',
    latitude: lat,
    longitude: 74.585,
    accuracyM: 8,
    inWard: true,
    isMocked: false,
    isStationary: false,
    fromOffline: false,
    recordedAt: new Date(Date.UTC(2026, 10, 2, 1, minute)),
    ...fields,
  });

  it('is empty without pings', () => {
    expect(routeStats([])).toMatchObject({
      pingCount: 0,
      distanceM: 0,
      firstPingAt: null,
      maxGapMinutes: null,
    });
  });

  it('counts flags, the longest gap and only trusted distance', () => {
    const s = routeStats([
      p(40, 16.856, { inWard: false }), // out of order on purpose
      p(0, 16.855),
      p(10, 16.856, { isStationary: true, fromOffline: true }),
      p(20, 16.9, { isMocked: true }), // a 5 km jump that must not count
      p(25, 16.86, { accuracyM: 80 }), // too inaccurate for distance
    ]);
    expect(s.pingCount).toBe(5);
    expect(s.firstPingAt?.toISOString()).toBe('2026-11-02T01:00:00.000Z');
    expect(s.lastPingAt?.toISOString()).toBe('2026-11-02T01:40:00.000Z');
    expect(s).toMatchObject({
      inWardPings: 4,
      outWardPings: 1,
      stationaryPings: 1,
      mockedPings: 1,
      offlinePings: 1,
      maxGapMinutes: 15,
    });
    // 16.855 -> 16.856 (~111 m), then standing at 16.856: ~111 m in all.
    expect(s.distanceM).toBeGreaterThan(105);
    expect(s.distanceM).toBeLessThan(117);
  });
});

describe('wardDayCounts', () => {
  const log = (staffId: string, fields: Partial<WardDayLog> = {}): WardDayLog => ({
    staffId,
    status: 'PRESENT',
    checkinAt: at('2026-11-02T00:40:00Z'),
    isLate: false,
    isSuspicious: false,
    checkinMode: 'SELF',
    checkoutType: 'MANUAL',
    ...fields,
  });

  it('counts present, late, half days, proxies, auto-checkouts, absent and leave', () => {
    const counts = wardDayCounts(
      new Set(['a', 'b', 'c', 'd', 'e']),
      [
        log('a'),
        log('b', { status: 'LATE', isLate: true, checkinMode: 'INSPECTOR_PROXY' }),
        log('c', { status: 'HALF_DAY', checkoutType: 'AUTO_GPS_LAST_SEEN', isSuspicious: true }),
        log('wi'), // the ward inspector: present without an assignment row
        log('e', { checkinAt: null, status: 'ABSENT', checkinMode: null, checkoutType: null }),
      ],
      new Set(['d', 'x']),
    );
    expect(counts).toEqual({
      assignedCount: 5,
      presentCount: 4,
      lateCount: 1,
      halfDayCount: 1,
      absentCount: 1,
      onLeaveCount: 1,
      proxyCount: 1,
      autoCheckoutCount: 1,
      suspiciousCount: 1,
    });
  });

  it('is all zeros for an empty ward', () => {
    expect(wardDayCounts(new Set(), [], new Set()).presentCount).toBe(0);
  });
});

describe('retention and roll-up dates', () => {
  it('cuts off whole days before now', () => {
    expect(retentionCutoff(at('2026-11-02T00:00:00Z'), 90).toISOString()).toBe(
      '2026-08-04T00:00:00.000Z',
    );
  });

  it.each([
    ['01:30 IST', '2026-11-01T20:00:00Z', ['2026-10-31', '2026-11-01']],
    ['just after IST midnight', '2026-11-01T18:30:00Z', ['2026-10-31', '2026-11-01']],
  ])('rolls up the two previous IST days at %s', (_case, now, dates) => {
    expect(rollupDates(at(now))).toEqual(dates);
  });
});

describe('day close', () => {
  it('looks at the day before yesterday through today (IST)', () => {
    expect(dayCloseDates(at('2026-11-02T20:00:00Z'))).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
  });

  it.each([
    ['2026-11-01', true], // a Sunday
    ['2026-11-02', false],
  ])('%s weekly off: %s', (date, off) => {
    expect(isWeeklyOff(date)).toBe(off);
  });

  const base = {
    kind: 'WARD' as const,
    pastHalfDayPoint: true,
    regularized: false,
    onLeave: false,
    holiday: false,
    weeklyOff: false,
  };
  describe('during the shift', () => {
    const shift = {
      date: '2026-11-02',
      shiftType: 'DAY',
      startsAt: new Date('2026-11-02T00:30:00Z'), // 06:00 IST
      endsAt: new Date('2026-11-02T08:30:00Z'), // 14:00 IST
    } as unknown as Parameters<typeof notCheckedInDue>[0];
    const timing = { lateGraceMinutes: 15, halfDayAfterPercent: 50 };
    it.each([
      ['before the shift', '2026-11-02T00:00:00Z', false, false],
      ['at the end of the grace', '2026-11-02T00:45:00Z', false, false],
      ['just past the grace', '2026-11-02T00:46:00Z', true, false],
      ['at the half-day point', '2026-11-02T04:30:00Z', true, false],
      ['just past the half-day point', '2026-11-02T04:31:00Z', false, true],
      ['after the shift', '2026-11-02T09:00:00Z', false, true],
    ])('%s', (_name, at, alert, absent) => {
      expect(notCheckedInDue(shift, new Date(at), timing)).toBe(alert);
      expect(pastHalfDayPoint(shift, new Date(at), timing)).toBe(absent);
    });

    it('follows the configured values', () => {
      const custom = { lateGraceMinutes: 30, halfDayAfterPercent: 25 };
      expect(notCheckedInDue(shift, new Date('2026-11-02T00:46:00Z'), custom)).toBe(false);
      expect(pastHalfDayPoint(shift, new Date('2026-11-02T02:31:00Z'), custom)).toBe(true);
    });
  });

  it.each([
    ['before the half-day point: wait', { pastHalfDayPoint: false }, null],
    ['no check-in past the half-day point: absent', {}, 'ABSENT'],
    ['approved leave', { onLeave: true }, 'ON_LEAVE'],
    ['approved correction wins over leave', { regularized: true, onLeave: true }, 'REGULARIZED'],
    ['office staff on a holiday', { kind: 'OFFICE', holiday: true }, 'HOLIDAY_OFF'],
    ['office staff on Sunday', { kind: 'OFFICE', weeklyOff: true }, 'HOLIDAY_OFF'],
    ['field staff placed on a holiday are expected', { holiday: true }, 'ABSENT'],
    [
      'leave on a holiday stays leave',
      { kind: 'OFFICE', holiday: true, onLeave: true },
      'ON_LEAVE',
    ],
  ] as const)('%s', (_case, fields, expected) => {
    expect(dayCloseStatus({ ...base, ...fields })).toBe(expected);
  });

  it.each([
    [
      'correction of an absent day',
      'ABSENT',
      false,
      { regularized: true, onLeave: false },
      'REGULARIZED',
    ],
    [
      'correction of a worked day',
      'PRESENT',
      true,
      { regularized: true, onLeave: false },
      'REGULARIZED',
    ],
    ['already corrected', 'REGULARIZED', true, { regularized: true, onLeave: false }, null],
    [
      'leave over an absent day',
      'ABSENT',
      false,
      { regularized: false, onLeave: true },
      'ON_LEAVE',
    ],
    [
      'leave never replaces a worked day',
      'PRESENT',
      true,
      { regularized: false, onLeave: true },
      null,
    ],
    ['no decision', 'ABSENT', false, { regularized: false, onLeave: false }, null],
  ] as const)('reconcile: %s', (_case, status, hasCheckin, decision, expected) => {
    expect(reconciledStatus({ status, hasCheckin }, decision)).toBe(expected);
  });
});
