/**
 * Rules for the scheduled attendance jobs (action plan Phase 2) as pure functions: when an
 * open shift is closed automatically and at what time, when a silent phone counts as a gap,
 * how a day of pings rolls up into a route summary, how a ward's day is counted, and what
 * the retention purge deletes. No database, clock or network: callers pass `now`.
 */
import { addDays, istDate } from '../../shared/clock/ist';
import type { EffectiveShift } from '../shifts/shifts.policy';
import type { AttendanceStatus, CheckoutType } from './attendance-types';
import { type AttendanceTiming, graceEndsAt, halfDayPointAt } from './attendance.policy';
import { routeLengthMeters } from './geo.policy';

const MINUTE = 60_000;

// ------------------------------------------------------------------ Slots

/** The run key of the slot `now` falls in, e.g. "2026-11-02T06:30" for 30-minute slots (UTC). */
export function slotKey(now: Date, slotMinutes: number): string {
  const slot = Math.floor(now.getTime() / (slotMinutes * MINUTE)) * slotMinutes * MINUTE;
  return new Date(slot).toISOString().slice(0, 16);
}

// ------------------------------------------------------------------ Auto-checkout

/** An open shift is closed automatically this long after it was due to end. */
export const AUTO_CHECKOUT_AFTER_MINUTES = 60;

export function autoCheckoutDue(shift: EffectiveShift, now: Date): boolean {
  return now.getTime() >= shift.endsAt.getTime() + AUTO_CHECKOUT_AFTER_MINUTES * MINUTE;
}

export interface AutoCheckout {
  checkoutAt: Date;
  checkoutType: CheckoutType;
  /** A field shift with no location after check-in is flagged for review. */
  suspicious: boolean;
}

/**
 * When an unclosed shift ends. Office staff are checked out at the scheduled end. Field staff
 * are checked out when the phone was last seen during the shift (never later than its end),
 * so a forgotten check-out does not credit hours nobody saw; with no ping at all, at check-in.
 */
export function autoCheckout(
  kind: 'WARD' | 'OFFICE',
  checkinAt: Date,
  shift: EffectiveShift,
  lastSeenAt: Date | null,
): AutoCheckout {
  const end = Math.max(checkinAt.getTime(), shift.endsAt.getTime());
  if (kind === 'OFFICE') {
    return { checkoutAt: new Date(end), checkoutType: 'AUTO_OFFICE_SCHEDULED', suspicious: false };
  }
  const seen = lastSeenAt && lastSeenAt >= checkinAt ? lastSeenAt.getTime() : null;
  return {
    checkoutAt: new Date(seen === null ? checkinAt.getTime() : Math.min(seen, end)),
    checkoutType: 'AUTO_GPS_LAST_SEEN',
    suspicious: seen === null,
  };
}

// ------------------------------------------------------------------ Silent gaps

/** No ping for this long during a field shift is a silent gap (the phone pings every ~10 min). */
export const SILENT_GAP_MINUTES = 30;

/**
 * Whether a checked-in field shift has gone silent: the last sign of life (last ping, or the
 * check-in itself) is at least SILENT_GAP_MINUTES old while the shift is still running.
 */
export function isSilent(lastSeenAt: Date, shift: EffectiveShift, now: Date): boolean {
  return now < shift.endsAt && now.getTime() - lastSeenAt.getTime() >= SILENT_GAP_MINUTES * MINUTE;
}

// ------------------------------------------------------------------ Route roll-up

/** Fixes worse than this are kept for display but left out of the distance. */
export const ROUTE_MAX_ACCURACY_M = 50;

export interface RoutePing {
  attendanceId: string | null;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  inWard: boolean | null;
  isMocked: boolean;
  isStationary: boolean;
  fromOffline: boolean;
  recordedAt: Date;
}

/**
 * The IST date a ping counts towards: its shift's attendance date (so a night shift's pings
 * after midnight stay on the day it began), else the IST date it was recorded.
 */
export function pingDate(
  ping: Pick<RoutePing, 'attendanceId' | 'recordedAt'>,
  attendanceDates: ReadonlyMap<string, string>,
): string {
  return (ping.attendanceId && attendanceDates.get(ping.attendanceId)) || istDate(ping.recordedAt);
}

/**
 * The window of recorded_at times that can hold the pings of IST date `date`: from its IST
 * midnight to two days later, which covers a night shift ending the next morning.
 */
export function pingWindow(date: string): { from: Date; to: Date } {
  return {
    from: new Date(`${date}T00:00:00+05:30`),
    to: new Date(`${addDays(date, 2)}T00:00:00+05:30`),
  };
}

export interface RouteStats {
  pingCount: number;
  distanceM: number;
  firstPingAt: Date | null;
  lastPingAt: Date | null;
  inWardPings: number;
  outWardPings: number;
  stationaryPings: number;
  mockedPings: number;
  offlinePings: number;
  /** Longest wait between two pings, in whole minutes; null with fewer than two pings. */
  maxGapMinutes: number | null;
}

/** Aggregates one person's pings for one day. Mocked and inaccurate fixes add no distance. */
export function routeStats(pings: readonly RoutePing[]): RouteStats {
  const sorted = [...pings].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  let maxGap: number | null = null;
  for (let i = 1; i < sorted.length; i++) {
    const gap = Math.floor(
      (sorted[i].recordedAt.getTime() - sorted[i - 1].recordedAt.getTime()) / MINUTE,
    );
    maxGap = maxGap === null ? gap : Math.max(maxGap, gap);
  }
  const trusted = sorted.filter(
    (p) => !p.isMocked && (p.accuracyM === null || p.accuracyM <= ROUTE_MAX_ACCURACY_M),
  );
  return {
    pingCount: sorted.length,
    distanceM: routeLengthMeters(trusted),
    firstPingAt: sorted[0]?.recordedAt ?? null,
    lastPingAt: sorted[sorted.length - 1]?.recordedAt ?? null,
    inWardPings: sorted.filter((p) => p.inWard === true).length,
    outWardPings: sorted.filter((p) => p.inWard === false).length,
    stationaryPings: sorted.filter((p) => p.isStationary).length,
    mockedPings: sorted.filter((p) => p.isMocked).length,
    offlinePings: sorted.filter((p) => p.fromOffline).length,
    maxGapMinutes: maxGap,
  };
}

// ------------------------------------------------------------------ Ward day summary

export interface WardDayLog {
  staffId: string;
  status: AttendanceStatus;
  checkinAt: Date | null;
  isLate: boolean;
  isSuspicious: boolean;
  checkinMode: string | null;
  checkoutType: CheckoutType | null;
}

export interface WardDayCounts {
  assignedCount: number;
  presentCount: number;
  lateCount: number;
  halfDayCount: number;
  absentCount: number;
  onLeaveCount: number;
  proxyCount: number;
  autoCheckoutCount: number;
  suspiciousCount: number;
}

/**
 * Counts one ward's day. `assigned` = staff with an approved assignment there; `logs` =
 * attendance punched in the ward; `onLeave` = staff on approved leave that day. Absent =
 * assigned, not checked in and not on leave. Anyone who checked in counts as present,
 * assigned or not (a ward inspector has no assignment row).
 */
export function wardDayCounts(
  assigned: ReadonlySet<string>,
  logs: readonly WardDayLog[],
  onLeave: ReadonlySet<string>,
): WardDayCounts {
  const present = logs.filter((l) => l.checkinAt);
  const checkedIn = new Set(present.map((l) => l.staffId));
  let absent = 0;
  let leave = 0;
  for (const id of assigned) {
    if (checkedIn.has(id)) continue;
    if (onLeave.has(id)) leave++;
    else absent++;
  }
  return {
    assignedCount: assigned.size,
    presentCount: present.length,
    lateCount: present.filter((l) => l.isLate).length,
    halfDayCount: present.filter((l) => l.status === 'HALF_DAY').length,
    absentCount: absent,
    onLeaveCount: leave,
    proxyCount: present.filter((l) => l.checkinMode && l.checkinMode !== 'SELF').length,
    autoCheckoutCount: present.filter(
      (l) => l.checkoutType === 'AUTO_GPS_LAST_SEEN' || l.checkoutType === 'AUTO_OFFICE_SCHEDULED',
    ).length,
    suspiciousCount: present.filter((l) => l.isSuspicious).length,
  };
}

// ------------------------------------------------------------------ Day close

/** Approved leave turns an ABSENT day back into ON_LEAVE this far back (leave can be late). */
export const LEAVE_RECONCILE_DAYS = 31;
/** Regularization covers the last 7 days; look one more back for a request made at midnight. */
export const REGULARIZATION_RECONCILE_DAYS = 8;

/** The IST dates the day-close job looks at: the day before yesterday (night shifts) to today. */
export function dayCloseDates(now: Date): string[] {
  const today = istDate(now);
  return [addDays(today, -2), addDays(today, -1), today];
}

/** Office staff are off on Sundays (SMKMC office calendar, a working assumption). */
export function isWeeklyOff(date: string): boolean {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
}

export type DayCloseStatus = 'REGULARIZED' | 'ON_LEAVE' | 'HOLIDAY_OFF' | 'ABSENT';

/**
 * What to record for someone expected on a day (an approved ward placement, or office staff)
 * who has no attendance row. Nothing until the half-day point; then an approved correction,
 * approved leave, an office holiday / Sunday, or else ABSENT. A later check-in still lands on
 * this row and makes it a half day. Field staff placed on a holiday are expected: sanitation
 * works every day.
 */
export function dayCloseStatus(input: {
  kind: 'WARD' | 'OFFICE';
  pastHalfDayPoint: boolean;
  regularized: boolean;
  onLeave: boolean;
  holiday: boolean;
  weeklyOff: boolean;
}): DayCloseStatus | null {
  if (!input.pastHalfDayPoint) return null;
  if (input.regularized) return 'REGULARIZED';
  if (input.onLeave) return 'ON_LEAVE';
  if (input.kind === 'OFFICE' && (input.holiday || input.weeklyOff)) return 'HOLIDAY_OFF';
  return 'ABSENT';
}

export function pastHalfDayPoint(shift: EffectiveShift, now: Date, timing: AttendanceTiming): boolean {
  return now > halfDayPointAt(shift, timing);
}

/** Between the end of the grace and the half-day point, no check-in means "not checked in yet". */
export function notCheckedInDue(shift: EffectiveShift, now: Date, timing: AttendanceTiming): boolean {
  return now > graceEndsAt(shift, timing) && !pastHalfDayPoint(shift, now, timing);
}

/**
 * The status an existing log takes after a supervisor's decision, or null to leave it: an
 * approved correction makes the day REGULARIZED (counted as attended); approved leave turns a
 * day marked ABSENT without any check-in into ON_LEAVE. Worked days are never turned into leave.
 */
export function reconciledStatus(
  log: { status: AttendanceStatus; hasCheckin: boolean },
  decision: { regularized: boolean; onLeave: boolean },
): AttendanceStatus | null {
  if (decision.regularized) return log.status === 'REGULARIZED' ? null : 'REGULARIZED';
  if (decision.onLeave && !log.hasCheckin && log.status === 'ABSENT') return 'ON_LEAVE';
  return null;
}

// ------------------------------------------------------------------ Retention

/** Used or expired liveness challenges are kept this long (enough to audit a disputed punch). */
export const CHALLENGE_RETENTION_DAYS = 7;

/** Rows older than this instant are purged. */
export function retentionCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * MINUTE);
}

/**
 * The nightly roll-up recomputes the two previous IST days: yesterday (still open if a night
 * shift ends this morning) and the day before, which is then final before pings are purged.
 */
export function rollupDates(now: Date): string[] {
  const today = istDate(now);
  return [addDays(today, -2), addDays(today, -1)];
}
