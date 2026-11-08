/**
 * The attendance engine's rules as pure functions (v4 §4, action plan Phase 2): who may punch
 * for whom, where the punch must be, how accurate the fix must be, which shift a punch belongs
 * to, late marks, and the one-time liveness challenge. No database, clock or network: "now"
 * and every fact are passed in, so each rule is tested with a table of cases.
 * Face matching itself lives in face.policy (cosine similarity over AuraFace embeddings).
 */
import type { AuthUser } from '../../shared/auth/auth-user';
import { outranks, Role, StaffRole } from '../../shared/auth/roles';
import { addDays } from '../../shared/clock/ist';
import { AppError } from '../../shared/errors/app-error';
import { ErrorCode } from '../../shared/errors/error-codes';
import type { EffectiveShift } from '../shifts/shifts.policy';
import type { LocationCheck } from '../wards/wards.policy';
import type { AttendanceStatus, PunchMode, TamperEventType } from './attendance-types';

// ------------------------------------------------------------------ Hierarchy

/** The facts about the person being punched. */
export interface PunchSubject {
  id: string;
  role: StaffRole;
  homeWardId: string | null;
  officeId: string | null;
  isActive: boolean;
}

/** The subject's daily assignment for the shift date (null when there is none). */
export interface PunchAssignment {
  id: string;
  wardId: string;
  wardInspectorId: string;
  inspectorId: string;
  isApproved: boolean;
}

/**
 * Who may press the button for whom (v4: higher rank marks lower rank, same ward, same team
 * for that day):
 *  - anyone for themselves (SELF);
 *  - an INSPECTOR for a WORKER in their team today;
 *  - a WARD_INSPECTOR for an INSPECTOR or WORKER placed in their ward today;
 *  - ADMIN for anyone they out-rank (ADMIN_PROXY).
 * The subject's face is still verified on every proxy punch.
 */
export function punchMode(
  actor: AuthUser,
  subject: PunchSubject,
  assignment: PunchAssignment | null,
): PunchMode {
  if (!subject.isActive) throw new AppError(ErrorCode.AUTH_ACCOUNT_INACTIVE);
  if (actor.staffId === subject.id) return 'SELF';
  if (!outranks(actor.role, subject.role)) throw notAllowed();
  if (actor.role === Role.ADMIN) return 'ADMIN_PROXY';
  if (!assignment) throw notAllowed();
  if (
    actor.role === Role.WARD_INSPECTOR &&
    actor.homeWardId !== null &&
    assignment.wardId === actor.homeWardId
  ) {
    return 'INSPECTOR_PROXY';
  }
  if (
    actor.role === Role.INSPECTOR &&
    subject.role === Role.WORKER &&
    assignment.inspectorId === actor.staffId
  ) {
    return 'INSPECTOR_PROXY';
  }
  throw notAllowed();
}

function notAllowed(): AppError {
  return new AppError(
    ErrorCode.FORBIDDEN,
    'You can mark attendance only for yourself or your own team today',
  );
}

// ------------------------------------------------------------------ Place

export type PunchPlace =
  | { kind: 'WARD'; wardId: string; assignmentId: string | null }
  | { kind: 'OFFICE'; officeId: string };

/**
 * Where the subject must be. Workers and inspectors punch in the ward of their approved daily
 * assignment (self-picks and self-joins start unapproved); a ward inspector in their own ward;
 * office staff and administrators at their office.
 */
export function punchPlace(subject: PunchSubject, assignment: PunchAssignment | null): PunchPlace {
  switch (subject.role) {
    case Role.WORKER:
    case Role.INSPECTOR:
      if (!assignment) throw new AppError(ErrorCode.NO_ASSIGNMENT);
      if (!assignment.isApproved) throw new AppError(ErrorCode.ASSIGNMENT_NOT_APPROVED);
      return { kind: 'WARD', wardId: assignment.wardId, assignmentId: assignment.id };
    case Role.WARD_INSPECTOR:
      if (!subject.homeWardId) throw new AppError(ErrorCode.NO_ASSIGNMENT);
      return { kind: 'WARD', wardId: subject.homeWardId, assignmentId: null };
    default:
      if (!subject.officeId) {
        throw new AppError(ErrorCode.RULE_VIOLATION, 'This person has no office to check in at', {
          field: 'staffId',
        });
      }
      return { kind: 'OFFICE', officeId: subject.officeId };
  }
}

// ------------------------------------------------------------------ Geofence

/** Field staff need a settled fix; office staff may be indoors (matches the 100 m office buffer). */
export const FIELD_MAX_ACCURACY_M = 50;
export const OFFICE_MAX_ACCURACY_M = 100;

export function maxAccuracyFor(kind: PunchPlace['kind']): number {
  return kind === 'OFFICE' ? OFFICE_MAX_ACCURACY_M : FIELD_MAX_ACCURACY_M;
}

/** Refuses a fix that is too coarse to geofence; the app waits for GPS to settle and retries. */
export function checkAccuracy(kind: PunchPlace['kind'], accuracyM: number): void {
  const limit = maxAccuracyFor(kind);
  if (!(accuracyM >= 0) || accuracyM > limit) {
    throw new AppError(ErrorCode.LOCATION_TOO_INACCURATE, undefined, {
      accuracyMeters: accuracyM,
      limitMeters: limit,
    });
  }
}

export interface GeofenceResult {
  inGeofence: boolean;
  /** Metres outside the boundary (0 when inside). */
  distanceM: number;
}

/** Reads a point-in-polygon check (25 m ward edge allowance, office buffer) as a punch result. */
export function geofenceResult(check: LocationCheck): GeofenceResult {
  return {
    inGeofence: check.withinTolerance,
    distanceM: check.inside ? 0 : check.distanceToEdgeMeters,
  };
}

/** A check-in must be inside the geofence. Check-out records the result but is not refused. */
export function checkCheckinGeofence(result: GeofenceResult, kind: PunchPlace['kind']): void {
  if (!result.inGeofence) {
    throw new AppError(ErrorCode.OUTSIDE_GEOFENCE, undefined, {
      place: kind,
      distanceMeters: result.distanceM,
    });
  }
}

// ------------------------------------------------------------------ Shift and late mark

/** Check-in opens this long before the shift starts. */
export const EARLY_CHECKIN_MINUTES = 60;
/** How a worker's shift times turn into marks. Set per server (ATTENDANCE_* settings). */
export interface AttendanceTiming {
  /** Up to this many minutes after the shift start is on time. */
  lateGraceMinutes: number;
  /** Past this share of the shift a check-in is a half day, and no check-in shows as absent. */
  halfDayAfterPercent: number;
}

/** v4: up to 15 minutes after the start is on time; past half the shift is a half day. */
export const DEFAULT_ATTENDANCE_TIMING: AttendanceTiming = {
  lateGraceMinutes: 15,
  halfDayAfterPercent: 50,
};
/** v4: the third late mark in a calendar month raises a REPEATED_LATE alert. */
export const REPEATED_LATE_THRESHOLD = 3;

const MINUTE = 60_000;

export function checkinOpensAt(shift: EffectiveShift): Date {
  return new Date(shift.startsAt.getTime() - EARLY_CHECKIN_MINUTES * MINUTE);
}

/**
 * The shift a check-in at `now` belongs to. `shifts` are the candidates in order of
 * preference (yesterday's first, so a night shift checked in after midnight stays on its own
 * IST date); dates already checked in are skipped.
 */
export function pickCheckinShift(
  now: Date,
  shifts: EffectiveShift[],
  checkedInDates: ReadonlySet<string>,
): EffectiveShift {
  const open = shifts.filter((s) => now >= checkinOpensAt(s) && now < s.endsAt);
  if (open.length === 0) {
    const next = shifts
      .map(checkinOpensAt)
      .filter((at) => at > now)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    throw new AppError(ErrorCode.OUTSIDE_SHIFT_WINDOW, undefined, {
      opensAt: next ? next.toISOString() : null,
    });
  }
  const free = open.find((s) => !checkedInDates.has(s.date));
  if (!free) throw new AppError(ErrorCode.ALREADY_CHECKED_IN, undefined, { date: open[0].date });
  return free;
}

export interface LateMark {
  status: Extract<AttendanceStatus, 'PRESENT' | 'LATE' | 'HALF_DAY'>;
  isLate: boolean;
  /** Minutes after the shift start (0 when on time). */
  lateMinutes: number;
}

/** When the grace ends: later check-ins are late. */
export function graceEndsAt(shift: EffectiveShift, timing: AttendanceTiming): Date {
  return new Date(shift.startsAt.getTime() + timing.lateGraceMinutes * MINUTE);
}

/** The half-day point: later check-ins are half days, and no check-in by then shows as absent. */
export function halfDayPointAt(shift: EffectiveShift, timing: AttendanceTiming): Date {
  const length = shift.endsAt.getTime() - shift.startsAt.getTime();
  return new Date(shift.startsAt.getTime() + (length * timing.halfDayAfterPercent) / 100);
}

/**
 * On time up to and including the grace; late after it, counting from the shift start; a half
 * day once past the half-day point.
 */
export function lateMark(
  checkinAt: Date,
  shift: EffectiveShift,
  timing: AttendanceTiming = DEFAULT_ATTENDANCE_TIMING,
): LateMark {
  if (checkinAt <= graceEndsAt(shift, timing)) {
    return { status: 'PRESENT', isLate: false, lateMinutes: 0 };
  }
  const lateMinutes = Math.ceil((checkinAt.getTime() - shift.startsAt.getTime()) / MINUTE);
  return {
    status: checkinAt > halfDayPointAt(shift, timing) ? 'HALF_DAY' : 'LATE',
    isLate: true,
    lateMinutes,
  };
}

/** True once this month's late marks (including the new one) reach the threshold. */
export function isRepeatedLate(lateMarksThisMonth: number): boolean {
  return lateMarksThisMonth >= REPEATED_LATE_THRESHOLD;
}

// ------------------------------------------------------------------ Check-out

export interface OpenLog {
  attendanceDate: string;
  checkinAt: Date | null;
  checkoutAt: Date | null;
}

/**
 * The log a check-out closes: the latest one checked in and not yet checked out.
 * `logs` are the subject's logs for yesterday and today.
 */
export function pickCheckoutLog<T extends OpenLog>(logs: T[]): T {
  const checkedIn = logs
    .filter((l) => l.checkinAt)
    .sort((a, b) => b.checkinAt!.getTime() - a.checkinAt!.getTime());
  const open = checkedIn.find((l) => !l.checkoutAt);
  if (open) return open;
  if (checkedIn.length > 0) {
    throw new AppError(ErrorCode.ALREADY_CHECKED_OUT, undefined, {
      date: checkedIn[0].attendanceDate,
    });
  }
  throw new AppError(ErrorCode.NOT_CHECKED_IN);
}

export function workedMinutes(checkinAt: Date, checkoutAt: Date): number {
  return Math.max(0, Math.floor((checkoutAt.getTime() - checkinAt.getTime()) / MINUTE));
}

/** Leaving before half the shift is worked turns the day into a half day. */
export function statusAtCheckout(
  current: AttendanceStatus,
  worked: number,
  shift: EffectiveShift,
): AttendanceStatus {
  const shiftMinutes = (shift.endsAt.getTime() - shift.startsAt.getTime()) / MINUTE;
  if ((current === 'PRESENT' || current === 'LATE') && worked < shiftMinutes / 2) return 'HALF_DAY';
  return current;
}

// ------------------------------------------------------------------ Liveness challenge

/** A challenge is valid this long: enough for the camera flow, too short to replay. */
export const CHALLENGE_TTL_SECONDS = 120;

/** Active-liveness prompts the app's ML Kit flow checks before uploading the crop. */
export const LIVENESS_ACTIONS = ['BLINK', 'SMILE', 'TURN_LEFT', 'TURN_RIGHT'] as const;
export type LivenessAction = (typeof LIVENESS_ACTIONS)[number];

/** Two different prompts, chosen by two random integers (injected so tests are exact). */
export function pickActions(a: number, b: number): LivenessAction[] {
  const n = LIVENESS_ACTIONS.length;
  const first = Math.abs(a) % n;
  const second = (first + 1 + (Math.abs(b) % (n - 1))) % n;
  return [LIVENESS_ACTIONS[first], LIVENESS_ACTIONS[second]];
}

export interface ChallengeFacts {
  subjectId: string;
  issuedToId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

/** A challenge is good once, for the person it was issued about, by the caller it was issued to. */
export function checkChallenge(
  challenge: ChallengeFacts | null,
  actorId: string,
  subjectId: string,
  now: Date,
): void {
  if (!challenge || challenge.subjectId !== subjectId || challenge.issuedToId !== actorId) {
    throw new AppError(ErrorCode.CHALLENGE_INVALID);
  }
  if (challenge.usedAt) {
    throw new AppError(ErrorCode.CHALLENGE_INVALID, 'This challenge was already used');
  }
  if (now >= challenge.expiresAt) throw new AppError(ErrorCode.CHALLENGE_EXPIRED);
}

// ------------------------------------------------------------------ Pings

export const MAX_PINGS_PER_BATCH = 200;
/** The phone's offline buffer is sent when the network returns; older fixes are dropped. */
export const MAX_PING_AGE_HOURS = 48;
/** Phone clocks drift; a fix further ahead of server time than this is rejected. */
export const MAX_PING_CLOCK_AHEAD_MS = 2 * MINUTE;
/** Two outside pings in a row (about 20 minutes) raise an OUT_OF_ZONE alert, not one GPS jump. */
export const OUT_OF_ZONE_CONSECUTIVE = 2;

export function pingTimeAcceptable(recordedAt: Date, now: Date): boolean {
  const age = now.getTime() - recordedAt.getTime();
  return age >= -MAX_PING_CLOCK_AHEAD_MS && age <= MAX_PING_AGE_HOURS * 60 * MINUTE;
}

/** `inWard` flags oldest first; true when the newest run of outside pings is long enough. */
export function isOutOfZone(inWard: (boolean | null)[]): boolean {
  let run = 0;
  for (let i = inWard.length - 1; i >= 0; i--) {
    if (inWard[i] !== false) break;
    run++;
  }
  return run >= OUT_OF_ZONE_CONSECUTIVE;
}

// ------------------------------------------------------------------ Read scope

export type AttendanceScope =
  | { kind: 'ALL' }
  | { kind: 'WARD'; wardId: string }
  | { kind: 'TEAM'; managerId: string; selfId: string }
  | { kind: 'SELF'; staffId: string };

/** ADMIN sees all; a ward inspector their ward; an inspector their reports and self; others self. */
export function attendanceScope(actor: AuthUser): AttendanceScope {
  if (actor.role === Role.ADMIN) return { kind: 'ALL' };
  if (actor.role === Role.WARD_INSPECTOR && actor.homeWardId) {
    return { kind: 'WARD', wardId: actor.homeWardId };
  }
  if (actor.role === Role.INSPECTOR) {
    return { kind: 'TEAM', managerId: actor.staffId, selfId: actor.staffId };
  }
  return { kind: 'SELF', staffId: actor.staffId };
}

/** The facts that decide who may see a person's route on a day. */
export interface RouteSubject {
  id: string;
  reportsToId: string | null;
  homeWardId: string | null;
  /** The ward of that day's attendance, if any (a worker may be placed outside their home ward). */
  dayWardId: string | null;
  /** The inspector that day's assignment placed them under (may differ from reportsToId). */
  dayInspectorId: string | null;
}

export type RouteAccess = 'ALLOWED' | 'HIDDEN' | 'DATE_NOT_ALLOWED';

/**
 * Route history follows the attendance read scope (action plan Phase 2): ADMIN anyone, a ward
 * inspector anyone who worked in their ward that day, an inspector their reports and anyone
 * placed under them that day. Everyone
 * else sees only their own route, and only for today's shift (yesterday's too, for a night
 * shift that began then). HIDDEN is answered as not found, so ids cannot be probed.
 */
export function routeAccess(
  actor: AuthUser,
  subject: RouteSubject,
  date: string,
  today: string,
): RouteAccess {
  const self = subject.id === actor.staffId;
  const scope = attendanceScope(actor);
  switch (scope.kind) {
    case 'ALL':
      return 'ALLOWED';
    case 'WARD':
      return self || (subject.dayWardId ?? subject.homeWardId) === scope.wardId
        ? 'ALLOWED'
        : 'HIDDEN';
    case 'TEAM':
      return self ||
        subject.reportsToId === scope.managerId ||
        subject.dayInspectorId === scope.managerId
        ? 'ALLOWED'
        : 'HIDDEN';
    case 'SELF':
      if (!self) return 'HIDDEN';
      return date === today || date === addDays(today, -1) ? 'ALLOWED' : 'DATE_NOT_ALLOWED';
  }
}

/** The shift a ping belongs to: the log whose check-in..check-out window contains it. */
export function logForPing<T extends OpenLog>(logs: T[], recordedAt: Date): T | null {
  return (
    logs.find(
      (l) =>
        l.checkinAt && recordedAt >= l.checkinAt && (!l.checkoutAt || recordedAt <= l.checkoutAt),
    ) ?? null
  );
}

/**
 * The ward an alert about a phone signal belongs to: the ward of the shift running at that
 * moment (a worker placed in another ward alerts that ward's inspector), else the home ward.
 */
export function alertWardAt<T extends OpenLog & { wardId: string | null }>(
  logs: T[],
  at: Date,
  homeWardId: string | null,
): string | undefined {
  return logForPing(logs, at)?.wardId ?? homeWardId ?? undefined;
}

// ------------------------------------------------------------------ Tamper events

/** Signals the phone watchdog may report; SILENT_GAP is found by the server only. */
export const DEVICE_TAMPER_TYPES = [
  'GPS_DISABLED',
  'PERMISSION_REVOKED',
  'AIRPLANE_MODE',
  'DATA_DISABLED',
  'DEVICE_OFFLINE',
  'MOCK_LOCATION',
] as const;
export type DeviceTamperType = (typeof DEVICE_TAMPER_TYPES)[number];

/** Turning location off or faking it is deliberate; losing network is often not. */
export function tamperSeverity(type: TamperEventType): 'MEDIUM' | 'HIGH' {
  return type === 'MOCK_LOCATION' || type === 'GPS_DISABLED' || type === 'PERMISSION_REVOKED'
    ? 'HIGH'
    : 'MEDIUM';
}
