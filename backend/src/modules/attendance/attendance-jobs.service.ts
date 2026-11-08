import { Injectable, Logger } from '@nestjs/common';
import { AuditWriter } from '../../shared/audit/audit-writer';
import { Clock } from '../../shared/clock/clock';
import { addDays, istDate } from '../../shared/clock/ist';
import { AppConfig } from '../../shared/config/app-config';
import { Role } from '../../shared/auth/roles';
import { isUniqueViolation } from '../../shared/database/db-errors';
import { UnitOfWork } from '../../shared/database/unit-of-work';
import { IdGenerator } from '../../shared/ids/id-generator';
import { dedupeKey } from '../alerts/alerts.policy';
import { AlertsService, RaiseAlert } from '../alerts/alerts.service';
import { LeaveService } from '../leave/leave.service';
import { RostersService } from '../rosters/rosters.service';
import type { EffectiveShift } from '../shifts/shifts.policy';
import { ShiftsService } from '../shifts/shifts.service';
import type { Staff } from '../staff/entities/staff.entity';
import { StaffService } from '../staff/staff.service';
import { HolidaysService } from '../holidays/holidays.service';
import { newAttendanceLog } from './attendance-log.factory';
import { statusAtCheckout, workedMinutes } from './attendance.policy';
import { AttendanceRepository } from './attendance.repository';
import type { AttendanceLog } from './entities/attendance-log.entity';
import type { LocationPing } from './entities/location-ping.entity';
import type { TamperEvent } from './entities/tamper-event.entity';
import {
  autoCheckout,
  autoCheckoutDue,
  CHALLENGE_RETENTION_DAYS,
  dayCloseDates,
  dayCloseStatus,
  isSilent,
  isWeeklyOff,
  LEAVE_RECONCILE_DAYS,
  notCheckedInDue,
  pastHalfDayPoint,
  pingDate,
  pingWindow,
  reconciledStatus,
  REGULARIZATION_RECONCILE_DAYS,
  retentionCutoff,
  rollupDates,
  RoutePing,
  routeStats,
  wardDayCounts,
} from './jobs.policy';
import { SummariesRepository } from './summaries.repository';
import { TrackingRepository } from './tracking.repository';

const bool = (v: unknown): boolean => Boolean(Number(v));

/** People per query while rolling up a day of pings (keeps memory flat at 4,000 staff). */
const ROLLUP_CHUNK = 200;

export function toRoutePing(p: LocationPing): RoutePing {
  return {
    attendanceId: p.attendanceId,
    latitude: Number(p.lat),
    longitude: Number(p.lng),
    accuracyM: p.accuracyM === null ? null : Number(p.accuracyM),
    inWard: p.inWard === null ? null : bool(p.inWard),
    isMocked: bool(p.isMocked),
    isStationary: bool(p.isStationary),
    fromOffline: bool(p.fromOffline),
    recordedAt: p.recordedAt,
  };
}

/** IST midnight of a date, and of the next day: the day's [from, to) window. */
function istDay(date: string): { from: Date; to: Date } {
  return {
    from: new Date(`${date}T00:00:00+05:30`),
    to: new Date(`${addDays(date, 1)}T00:00:00+05:30`),
  };
}

/**
 * The scheduled attendance jobs (action plan Phase 2). Each method is one run, safe to
 * repeat: the scheduler calls them through JobRunner so one instance runs each slot, and
 * tests call them directly with a frozen clock. Rules: jobs.policy. Each returns a one-line
 * result for job_locks.
 */
@Injectable()
export class AttendanceJobsService {
  private readonly logger = new Logger(AttendanceJobsService.name);

  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly tracking: TrackingRepository,
    private readonly summaries: SummariesRepository,
    private readonly staff: StaffService,
    private readonly shifts: ShiftsService,
    private readonly rosters: RostersService,
    private readonly leave: LeaveService,
    private readonly holidays: HolidaysService,
    private readonly alerts: AlertsService,
    private readonly config: AppConfig,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly uow: UnitOfWork,
    private readonly audit: AuditWriter,
  ) {}

  // ------------------------------------------------------------ Auto-checkout (every 30 min)

  /** Closes shifts nobody checked out of, an hour after they were due to end. */
  async autoCheckout(): Promise<string> {
    const now = this.clock.now();
    const open = await this.attendance.findOpen(istDate(now));
    const people = await this.peopleOf(open);
    const shifts = await this.shiftsOf(open, people);
    let closed = 0;
    for (const log of open) {
      const person = people.get(log.staffId);
      const shift = shifts.get(log.id);
      if (!person || !shift) continue;
      if (!autoCheckoutDue(shift, now)) continue;

      const kind = log.officeId ? 'OFFICE' : 'WARD';
      const checkinAt = log.checkinAt!;
      const lastSeen =
        kind === 'WARD'
          ? ((await this.tracking.lastPingBetween(log.staffId, checkinAt, shift.endsAt))
              ?.recordedAt ?? null)
          : null;
      const out = autoCheckout(kind, checkinAt, shift, lastSeen);
      const worked = workedMinutes(checkinAt, out.checkoutAt);
      const status = statusAtCheckout(log.status, worked, shift);

      closed += await this.uow.run(async (tx) => {
        const n = await this.attendance.checkOut(
          log.id,
          Number(log.version),
          {
            checkoutAt: out.checkoutAt,
            checkoutType: out.checkoutType,
            workedMinutes: worked,
            status,
            isSuspicious: bool(log.isSuspicious) || out.suspicious,
            updatedAt: now,
          },
          tx,
        );
        if (n === 0) return 0; // checked out by hand meanwhile
        await this.audit.write(tx, {
          action: 'ATTENDANCE_AUTO_CHECKOUT',
          entityType: 'attendance',
          entityId: log.id,
          actorRole: 'SYSTEM',
          details: {
            staffId: log.staffId,
            date: log.attendanceDate,
            checkoutType: out.checkoutType,
            checkoutAt: out.checkoutAt.toISOString(),
            workedMinutes: worked,
            status,
            noLocationAfterCheckin: out.suspicious,
          },
        });
        return n;
      });
    }
    return `closed ${closed} of ${open.length} open shifts`;
  }

  // ------------------------------------------------------------ Day close (every 30 min)

  /**
   * Gives every expected person a row once past the half-day point of their shift: approved field
   * placements and active office staff without a check-in become REGULARIZED, ON_LEAVE,
   * HOLIDAY_OFF or ABSENT (with an ABSENT alert). A later check-in turns the row into a half day
   * and resolves the alert. Then applies supervisors' decisions to rows that exist: approved
   * corrections make the day REGULARIZED, approved leave turns ABSENT days into ON_LEAVE.
   */
  async closeDays(): Promise<string> {
    const now = this.clock.now();
    const today = istDate(now);
    const regularized = new Set(
      (
        await this.leave.approvedRegularizations(
          addDays(today, -REGULARIZATION_RECONCILE_DAYS),
          today,
        )
      ).map((r) => `${r.staffId}|${r.attendanceDate}`),
    );
    const leaveOn = new Map<string, Set<string>>();
    const onLeave = async (date: string) => {
      if (!leaveOn.has(date)) leaveOn.set(date, await this.leave.staffOnLeave(date));
      return leaveOn.get(date)!;
    };
    const timing = this.config.attendanceTiming;
    const unplaced = await this.unplacedStaff();

    let written = 0;
    let absent = 0;
    for (const date of dayCloseDates(now)) {
      const expected = await this.expectedOn(date, unplaced);
      const logged = new Set((await this.attendance.findForDate(date)).map((l) => l.staffId));
      const missing = [...expected.keys()].filter((id) => !logged.has(id));
      if (missing.length === 0) continue;

      const people = await this.staff.findByIds(missing);
      const shifts = await this.shifts.shiftsFor(people, date);
      const leave = await onLeave(date);
      const holiday = await this.holidays.isHoliday(date);
      for (const person of people) {
        // Nobody is absent before they joined.
        if (istDate(person.createdAt) > date) continue;
        const place = expected.get(person.id)!;
        const shift = shifts.get(person.id)!;
        const kind = place.wardId ? 'WARD' : 'OFFICE';
        const status = dayCloseStatus({
          kind,
          pastHalfDayPoint: pastHalfDayPoint(shift, now, timing),
          regularized: regularized.has(`${person.id}|${date}`),
          onLeave: leave.has(person.id),
          holiday,
          weeklyOff: isWeeklyOff(date),
        });
        if (!status) continue;
        const row = newAttendanceLog(this.ids.next(), person.id, date, now, {
          status,
          wardId: place.wardId,
          officeId: kind === 'OFFICE' ? (person.officeId ?? null) : null,
          assignmentId: place.assignmentId,
          shiftType: shift.shiftType,
        });
        if (!(await this.insertDayRow(row, status))) continue;
        written++;
        if (status === 'ABSENT') {
          absent++;
          await this.raise({
            alertType: 'ABSENT',
            severity: 'MEDIUM',
            message: `No check-in for the shift on ${date}`,
            messageMr: `${date} रोजीच्या शिफ्टसाठी हजेरी नाही`,
            staffId: person.id,
            wardId: place.wardId ?? undefined,
            details: { attendanceId: row.id, date },
            dedupeKey: dedupeKey('ABSENT', person.id, date),
          });
        }
      }
    }

    // Decisions taken after the day was written.
    let corrected = 0;
    const absentDays = await this.attendance.findAbsentBetween(
      addDays(today, -LEAVE_RECONCILE_DAYS),
      today,
    );
    for (const log of absentDays) {
      corrected += await this.reconcile(log, now, {
        regularized: regularized.has(`${log.staffId}|${log.attendanceDate}`),
        onLeave: (await onLeave(log.attendanceDate)).has(log.staffId),
      });
    }
    for (const key of regularized) {
      const [staffId, date] = key.split('|');
      const [log] = await this.attendance.findForDates(staffId, [date]);
      if (log && log.status !== 'ABSENT') {
        corrected += await this.reconcile(log, now, { regularized: true, onLeave: false });
      }
    }
    return `wrote ${written} day rows (${absent} absent), corrected ${corrected}`;
  }

  // ------------------------------------------------------------ Not checked in (every 15 min)

  /**
   * Tells supervisors who is past the grace with no check-in, while they can still act on it. Not
   * for anyone on leave, off that day or with an approved correction. Resolved by the check-in.
   */
  async flagNotCheckedIn(): Promise<string> {
    const now = this.clock.now();
    const timing = this.config.attendanceTiming;
    const unplaced = await this.unplacedStaff();
    const holidayOrOff = async (date: string) => (await this.holidays.isHoliday(date)) || isWeeklyOff(date);
    let raised = 0;
    // Yesterday too: a night shift that started then is still running.
    for (const date of dayCloseDates(now).slice(-2)) {
      const expected = await this.expectedOn(date, unplaced);
      const logged = new Set((await this.attendance.findForDate(date)).map((l) => l.staffId));
      const missing = [...expected.keys()].filter((id) => !logged.has(id));
      if (missing.length === 0) continue;

      const people = await this.staff.findByIds(missing);
      const shifts = await this.shifts.shiftsFor(people, date);
      const leave = await this.leave.staffOnLeave(date);
      const corrected = new Set(
        (await this.leave.approvedRegularizations(date, date)).map((r) => r.staffId),
      );
      const off = await holidayOrOff(date);
      for (const person of people) {
        if (istDate(person.createdAt) > date) continue;
        if (leave.has(person.id) || corrected.has(person.id)) continue;
        const place = expected.get(person.id)!;
        if (!place.wardId && off) continue;
        if (!notCheckedInDue(shifts.get(person.id)!, now, timing)) continue;
        await this.raise({
          alertType: 'NOT_CHECKED_IN',
          severity: 'LOW',
          message: `${person.fullName} has not checked in for the shift on ${date}`,
          messageMr: `${person.fullNameMr ?? person.fullName} यांनी ${date} रोजीच्या शिफ्टसाठी अजून हजेरी लावली नाही`,
          staffId: person.id,
          wardId: place.wardId ?? undefined,
          details: { date },
          dedupeKey: dedupeKey('NOT_CHECKED_IN', person.id, date),
        });
        raised++;
      }
    }
    return `flagged ${raised} people`;
  }

  /** Who is expected without a placement row: office staff, and ward inspectors in their ward. */
  private async unplacedStaff(): Promise<{ officeIds: string[]; wardInspectors: Staff[] }> {
    const officeIds = await this.staff.findIds({ role: Role.OFFICE_STAFF, isActive: true });
    const wardInspectors = (
      await this.staff.findByIds(
        await this.staff.findIds({ role: Role.WARD_INSPECTOR, isActive: true }),
      )
    ).filter((s) => s.homeWardId);
    return { officeIds, wardInspectors };
  }

  private async expectedOn(
    date: string,
    unplaced: { officeIds: string[]; wardInspectors: Staff[] },
  ): Promise<Map<string, { wardId: string | null; assignmentId: string | null }>> {
    const expected = new Map<string, { wardId: string | null; assignmentId: string | null }>();
    for (const p of await this.rosters.approvedPlacements(date)) {
      expected.set(p.staffId, { wardId: p.wardId, assignmentId: p.assignmentId });
    }
    for (const s of unplaced.wardInspectors) {
      if (!expected.has(s.id)) expected.set(s.id, { wardId: s.homeWardId!, assignmentId: null });
    }
    for (const id of unplaced.officeIds) {
      if (!expected.has(id)) expected.set(id, { wardId: null, assignmentId: null });
    }
    return expected;
  }

  /** Writes a closed day's row. False when it exists already (checked in meanwhile, or a rerun). */
  private async insertDayRow(row: AttendanceLog, status: string): Promise<boolean> {
    try {
      await this.uow.run(async (tx) => {
        await this.attendance.insert(row, tx);
        await this.audit.write(tx, {
          action: 'ATTENDANCE_DAY_CLOSED',
          entityType: 'attendance',
          entityId: row.id,
          actorRole: 'SYSTEM',
          details: { staffId: row.staffId, date: row.attendanceDate, status },
        });
      });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  /** Applies a supervisor's decision to an existing row (reconciledStatus). Returns rows changed. */
  private async reconcile(
    log: AttendanceLog,
    now: Date,
    decision: { regularized: boolean; onLeave: boolean },
  ): Promise<number> {
    const status = reconciledStatus({ status: log.status, hasCheckin: !!log.checkinAt }, decision);
    if (!status) return 0;
    return this.uow.run(async (tx) => {
      const n = await this.attendance.setStatus(
        log.id,
        Number(log.version),
        {
          status,
          updatedAt: now,
          // An approved correction counts the day as attended normally: no flag, no late mark.
          ...(status === 'REGULARIZED' ? { isSuspicious: false, isLate: false, lateMinutes: 0 } : {}),
        },
        tx,
      );
      if (n === 0) return 0;
      await this.audit.write(tx, {
        action: 'ATTENDANCE_STATUS_RECONCILED',
        entityType: 'attendance',
        entityId: log.id,
        actorRole: 'SYSTEM',
        details: { staffId: log.staffId, date: log.attendanceDate, from: log.status, to: status },
      });
      return n;
    });
  }

  // ------------------------------------------------------------ Silent gaps (every 15 min)

  /**
   * Records a SERVER tamper event when a checked-in field phone stops sending pings, and
   * closes it when pings resume (offline pings uploaded later count) or the shift ends.
   */
  async detectSilentGaps(): Promise<string> {
    const now = this.clock.now();
    const open = (await this.attendance.findOpen(istDate(now))).filter((l) => l.wardId);
    const gaps = new Map<string, TamperEvent>(
      (await this.tracking.findOpenSilentGaps()).map((g) => [g.staffId, g]),
    );
    const people = await this.peopleOf(open);
    const shifts = await this.shiftsOf(open, people);
    const since = new Date(Math.min(now.getTime(), ...open.map((l) => l.checkinAt!.getTime())));
    const lastPings = await this.tracking.lastPingTimes(
      open.map((l) => l.staffId),
      since,
    );

    let found = 0;
    let resolved = 0;
    const onShift = new Set<string>();
    for (const log of open) {
      onShift.add(log.staffId);
      const ping = lastPings.get(log.staffId);
      const lastSeen = ping && ping > log.checkinAt! ? ping : log.checkinAt!;
      const gap = gaps.get(log.staffId);
      if (gap) {
        if (lastSeen > gap.startedAt && (await this.resolveGap(gap, null))) resolved++;
        continue;
      }
      const person = people.get(log.staffId);
      const shift = shifts.get(log.id);
      if (!person || !shift) continue;
      if (!isSilent(lastSeen, shift, now)) continue;
      await this.openGap(log, person, lastSeen, now);
      found++;
    }

    // Gaps of people whose shift has closed since: they end at the check-out at the latest.
    for (const gap of gaps.values()) {
      if (onShift.has(gap.staffId)) continue;
      const date = istDate(gap.startedAt);
      const logs = await this.attendance.findForDates(gap.staffId, [addDays(date, -1), date]);
      const closedAt = logs
        .map((l) => l.checkoutAt)
        .filter((at): at is Date => at !== null && at >= gap.startedAt)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (await this.resolveGap(gap, closedAt ?? now)) resolved++;
    }
    return `opened ${found} silent gaps, closed ${resolved}`;
  }

  /** Ends a gap at the first ping after it began, or at `fallback` if that is earlier. */
  private async resolveGap(gap: TamperEvent, fallback: Date | null): Promise<boolean> {
    const first = (await this.tracking.firstPingAfter(gap.staffId, gap.startedAt))?.recordedAt;
    const ends = [first, fallback].filter((d): d is Date => Boolean(d));
    if (ends.length === 0) return false;
    const end = new Date(Math.min(...ends.map((d) => d.getTime())));
    await this.tracking.resolveTamper(gap.id, end < gap.startedAt ? gap.startedAt : end);
    return true;
  }

  private async openGap(
    log: AttendanceLog,
    person: Staff,
    lastSeen: Date,
    now: Date,
  ): Promise<void> {
    const lastPing = await this.tracking.lastPingBefore(
      log.staffId,
      new Date(lastSeen.getTime() + 1),
    );
    const row: TamperEvent = {
      id: this.ids.next(),
      clientUuid: null,
      staffId: log.staffId,
      eventType: 'SILENT_GAP',
      source: 'SERVER',
      startedAt: lastSeen,
      resolvedAt: null,
      lastLat: lastPing ? Number(lastPing.lat) : null,
      lastLng: lastPing ? Number(lastPing.lng) : null,
      createdAt: now,
    };
    await this.tracking.insertTamper(row);
    const minutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60_000);
    await this.raise({
      alertType: 'TAMPER_DETECTED',
      severity: 'MEDIUM',
      message: `${person.fullName}'s phone has sent no location for ${minutes} minutes`,
      messageMr: `${person.fullNameMr ?? person.fullName} यांच्या फोनवरून ${minutes} मिनिटे लोकेशन आले नाही`,
      staffId: log.staffId,
      wardId: log.wardId ?? undefined,
      details: {
        tamperEventId: row.id,
        eventType: 'SILENT_GAP',
        attendanceId: log.id,
        lastSeenAt: lastSeen.toISOString(),
      },
      dedupeKey: dedupeKey(
        'TAMPER_DETECTED',
        log.staffId,
        `${log.attendanceDate}:GAP:${lastSeen.toISOString().slice(11, 16)}`,
      ),
    });
  }

  // ------------------------------------------------------------ Nightly roll-up (01:30 IST)

  /** Rolls the last two IST days of pings into route summaries, then counts each ward's day. */
  async rollUp(): Promise<string> {
    const parts: string[] = [];
    for (const date of rollupDates(this.clock.now())) {
      const routes = await this.rollUpRoutes(date);
      const wards = await this.summarizeWards(date);
      parts.push(`${date}: ${routes} routes, ${wards} wards`);
    }
    return parts.join('; ');
  }

  /** Writes one route summary per person who sent pings counting towards `date`. */
  async rollUpRoutes(date: string): Promise<number> {
    const now = this.clock.now();
    const window = pingWindow(date);
    const day = istDay(date);
    const staffIds = await this.tracking.staffWithPings(window.from, window.to);
    const tamper = await this.tracking.tamperCounts(day.from, day.to);
    let written = 0;
    for (let i = 0; i < staffIds.length; i += ROLLUP_CHUNK) {
      const pings = await this.tracking.pingsOfStaff(
        staffIds.slice(i, i + ROLLUP_CHUNK),
        window.from,
        window.to,
      );
      const logIds = [...new Set(pings.map((p) => p.attendanceId).filter((id) => id !== null))];
      const logs = new Map((await this.attendance.findByIds(logIds)).map((l) => [l.id, l]));
      const dates = new Map([...logs.values()].map((l) => [l.id, l.attendanceDate]));

      const byStaff = new Map<string, RoutePing[]>();
      for (const p of pings) {
        const rp = toRoutePing(p);
        if (pingDate(rp, dates) !== date) continue;
        const list = byStaff.get(p.staffId) ?? [];
        list.push(rp);
        byStaff.set(p.staffId, list);
      }
      for (const [staffId, own] of byStaff) {
        const attendanceId = own.find((p) => p.attendanceId)?.attendanceId ?? null;
        await this.summaries.saveRoute(
          {
            staffId,
            summaryDate: date,
            attendanceId,
            wardId: (attendanceId && logs.get(attendanceId)?.wardId) || null,
            ...routeStats(own),
            tamperEvents: tamper.get(staffId) ?? 0,
            computedAt: now,
          },
          this.ids.next(),
        );
        written++;
      }
    }
    return written;
  }

  /** Writes one summary per ward that had placements or punches on `date`. */
  async summarizeWards(date: string): Promise<number> {
    const now = this.clock.now();
    const placements = await this.rosters.approvedPlacements(date);
    const logs = (await this.attendance.findForDate(date)).filter((l) => l.wardId);
    const onLeave = await this.leave.staffOnLeave(date);
    const distance = await this.summaries.distanceByWard(date);
    const wardIds = new Set([...placements.map((p) => p.wardId), ...logs.map((l) => l.wardId!)]);
    for (const wardId of wardIds) {
      const assigned = new Set(placements.filter((p) => p.wardId === wardId).map((p) => p.staffId));
      const counts = wardDayCounts(
        assigned,
        logs
          .filter((l) => l.wardId === wardId)
          .map((l) => ({
            staffId: l.staffId,
            status: l.status,
            checkinAt: l.checkinAt,
            isLate: bool(l.isLate),
            isSuspicious: bool(l.isSuspicious),
            checkinMode: l.checkinMode,
            checkoutType: l.checkoutType,
          })),
        onLeave,
      );
      await this.summaries.saveWard(
        {
          wardId,
          summaryDate: date,
          ...counts,
          distanceM: distance.get(wardId) ?? 0,
          computedAt: now,
        },
        this.ids.next(),
      );
    }
    return wardIds.size;
  }

  // ------------------------------------------------------------ Retention purge (02:30 IST)

  /** Deletes raw pings past the retention period and old liveness challenges. */
  async purge(): Promise<string> {
    const now = this.clock.now();
    const days = this.config.jobs.pingRetentionDays;
    const pings = await this.tracking.deletePingsBefore(retentionCutoff(now, days));
    const challenges = await this.attendance.deleteChallengesBefore(
      retentionCutoff(now, CHALLENGE_RETENTION_DAYS),
    );
    return `deleted ${pings} pings older than ${days} days and ${challenges} challenges`;
  }

  // ------------------------------------------------------------ Helpers

  /** The effective shift of each log (by log id): one query per date, not one per person. */
  private async shiftsOf(
    logs: AttendanceLog[],
    people: Map<string, Staff>,
  ): Promise<Map<string, EffectiveShift>> {
    const byLog = new Map<string, EffectiveShift>();
    for (const date of new Set(logs.map((l) => l.attendanceDate))) {
      const day = logs.filter((l) => l.attendanceDate === date);
      const staff = day.map((l) => people.get(l.staffId)).filter((x): x is Staff => !!x);
      const shifts = await this.shifts.shiftsFor(staff, date);
      for (const l of day) {
        const shift = shifts.get(l.staffId);
        if (shift) byLog.set(l.id, shift);
      }
    }
    return byLog;
  }

  private async peopleOf(logs: AttendanceLog[]): Promise<Map<string, Staff>> {
    const ids = [...new Set(logs.map((l) => l.staffId))];
    return new Map((await this.staff.findByIds(ids)).map((s) => [s.id, s]));
  }

  /** Alerts never fail a job run: a failure is logged and the job carries on. */
  private async raise(input: RaiseAlert): Promise<void> {
    try {
      await this.alerts.raise(input);
    } catch (error) {
      this.logger.error({ err: error, alertType: input.alertType }, 'Could not raise alert');
    }
  }
}
