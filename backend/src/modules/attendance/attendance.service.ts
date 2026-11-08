import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { AuditWriter } from '../../shared/audit/audit-writer';
import type { AuthUser } from '../../shared/auth/auth-user';
import { Clock } from '../../shared/clock/clock';
import { AppConfig } from '../../shared/config/app-config';
import { addDays, istDate } from '../../shared/clock/ist';
import { isUniqueViolation } from '../../shared/database/db-errors';
import { UnitOfWork } from '../../shared/database/unit-of-work';
import { AppError } from '../../shared/errors/app-error';
import { ErrorCode } from '../../shared/errors/error-codes';
import { IdGenerator } from '../../shared/ids/id-generator';
import { dedupeKey } from '../alerts/alerts.policy';
import { AlertsService, RaiseAlert } from '../alerts/alerts.service';
import { FaceVerificationInput, FaceVerificationResult, FaceVerifier } from '../face/face-verifier';
import { LeaveService } from '../leave/leave.service';
import { OfficesService } from '../offices/offices.service';
import { RostersService } from '../rosters/rosters.service';
import { ShiftsService } from '../shifts/shifts.service';
import type { Staff } from '../staff/entities/staff.entity';
import { StaffService } from '../staff/staff.service';
import { WardsService } from '../wards/wards.service';
import type { LocationCheck } from '../wards/wards.policy';
import {
  attendanceScope,
  CHALLENGE_TTL_SECONDS,
  checkAccuracy,
  checkChallenge,
  checkCheckinGeofence,
  geofenceResult,
  GeofenceResult,
  isRepeatedLate,
  lateMark,
  pickActions,
  pickCheckinShift,
  pickCheckoutLog,
  PunchAssignment,
  punchMode,
  PunchPlace,
  punchPlace,
  statusAtCheckout,
  workedMinutes,
} from './attendance.policy';
import { newAttendanceLog } from './attendance-log.factory';
import { AttendanceFilter, AttendanceRepository } from './attendance.repository';
import type {
  AttendanceLogDto,
  AttendancePageDto,
  ChallengeDto,
  CreatePunchDto,
  ListAttendanceQueryDto,
  PresenceKeyDto,
  PunchResultDto,
} from './dto/attendance.dto';
import { AttendanceLog } from './entities/attendance-log.entity';
import type { LivenessChallenge } from './entities/liveness-challenge.entity';
import {
  copresenceOutcome,
  PRESENCE_DIGITS,
  PRESENCE_PERIOD_SECONDS,
  presenceKey,
  verifyPresenceCode,
} from './copresence.policy';

/** The face part of a proof: a punch or a spot-check answer carries the same fields. */
type FaceProof = Pick<
  CreatePunchDto,
  'challengeId' | 'faceImageBase64' | 'aadhaarPidXml' | 'aadhaarTxn'
>;

/** What a spot-check answer sends to prove presence. */
export type PresenceProof = FaceProof & { latitude: number; longitude: number; accuracyM: number };

export interface PresenceResult {
  attendanceId: string;
  wardId: string | null;
  inGeofence: boolean;
  distanceM: number | null;
  faceScore: number | null;
}

export interface OnDuty {
  attendanceId: string;
  staffId: string;
  wardId: string;
  date: string;
  checkinAt: Date;
  shiftEndsAt: Date;
}

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));
const bool = (v: unknown): boolean => Boolean(Number(v));

export function toAttendanceDto(l: AttendanceLog): AttendanceLogDto {
  return {
    id: l.id,
    staffId: l.staffId,
    date: l.attendanceDate,
    status: l.status,
    wardId: l.wardId ?? null,
    officeId: l.officeId ?? null,
    assignmentId: l.assignmentId ?? null,
    isLate: bool(l.isLate),
    lateMinutes: Number(l.lateMinutes),
    workedMinutes: num(l.workedMinutes),
    checkin: l.checkinAt
      ? {
          at: l.checkinAt.toISOString(),
          latitude: Number(l.checkinLat),
          longitude: Number(l.checkinLng),
          accuracyM: num(l.checkinAccuracyM),
          inGeofence: bool(l.checkinInGeofence),
          mode: l.checkinMode ?? null,
          markedById: l.checkinMarkedById ?? null,
        }
      : null,
    checkinDistanceM: num(l.checkinDistanceM),
    checkinFaceScore: num(l.checkinFaceScore),
    checkout: l.checkoutAt
      ? {
          at: l.checkoutAt.toISOString(),
          latitude: Number(l.checkoutLat),
          longitude: Number(l.checkoutLng),
          accuracyM: num(l.checkoutAccuracyM),
          inGeofence: l.checkoutInGeofence === null ? null : bool(l.checkoutInGeofence),
          mode: l.checkoutMode ?? null,
          markedById: l.checkoutMarkedById ?? null,
        }
      : null,
    checkoutType: l.checkoutType ?? null,
    isSuspicious: bool(l.isSuspicious),
    version: Number(l.version),
  };
}

function previousDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * The punch flow (action plan Phase 2). The backend is the only authority: server time,
 * hierarchy, approved assignment, geofence, one-time liveness challenge and server-side face
 * match are all decided here, before anything is written. Rules: attendance.policy.
 */
/** Without a date range, an inspector's placed-worker days are looked up this far back. */
const TEAM_LOOKBACK_DAYS = 92;

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly repo: AttendanceRepository,
    private readonly staff: StaffService,
    private readonly rosters: RostersService,
    private readonly shifts: ShiftsService,
    private readonly leave: LeaveService,
    private readonly wards: WardsService,
    private readonly offices: OfficesService,
    private readonly face: FaceVerifier,
    private readonly alerts: AlertsService,
    private readonly clock: Clock,
    private readonly config: AppConfig,
    private readonly ids: IdGenerator,
    private readonly uow: UnitOfWork,
    private readonly audit: AuditWriter,
  ) {}

  // ------------------------------------------------------------ Liveness challenge

  /** Issued just before the camera opens; one punch, this subject, this caller, 2 minutes. */
  async issueChallenge(actor: AuthUser, staffId?: string): Promise<ChallengeDto> {
    const subject = await this.subject(staffId ?? actor.staffId);
    if (subject.id !== actor.staffId) {
      const today = istDate(this.clock.now());
      const assignment =
        (await this.rosters.assignmentFor(today, subject.id)) ??
        (await this.rosters.assignmentFor(previousDay(today), subject.id));
      punchMode(actor, subject, assignment);
    }
    const now = this.clock.now();
    const row: LivenessChallenge = {
      id: this.ids.next(),
      subjectId: subject.id,
      issuedToId: actor.staffId,
      actions: pickActions(randomInt(1_000_000), randomInt(1_000_000)).join(','),
      issuedAt: now,
      expiresAt: new Date(now.getTime() + CHALLENGE_TTL_SECONDS * 1000),
      usedAt: null,
    };
    await this.repo.insertChallenge(row);
    return {
      challengeId: row.id,
      staffId: subject.id,
      actions: row.actions.split(',') as ChallengeDto['actions'],
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  // ------------------------------------------------------------ Punch

  async punch(actor: AuthUser, dto: CreatePunchDto): Promise<PunchResultDto> {
    const subjectId = dto.staffId ?? actor.staffId;
    const replay = await this.replayOf(dto, subjectId);
    if (replay) return { replayed: true, attendance: toAttendanceDto(replay) };

    const subject = await this.subject(subjectId);
    try {
      const log =
        dto.type === 'CHECK_IN'
          ? await this.checkIn(actor, subject, dto)
          : await this.checkOut(actor, subject, dto);
      return { replayed: false, attendance: toAttendanceDto(log) };
    } catch (error) {
      // Two phones sent the same punch at once: the loser returns the winner's row.
      if (isUniqueViolation(error)) {
        const winner = await this.replayOf(dto, subjectId);
        if (winner) return { replayed: true, attendance: toAttendanceDto(winner) };
        throw new AppError(ErrorCode.ALREADY_CHECKED_IN);
      }
      throw error;
    }
  }

  private async checkIn(
    actor: AuthUser,
    subject: Staff,
    dto: CreatePunchDto,
  ): Promise<AttendanceLog> {
    const now = this.clock.now();
    const today = istDate(now);
    const yesterday = previousDay(today);
    const logs = await this.repo.findForDates(subject.id, [yesterday, today]);
    const candidates = [
      await this.shifts.shiftFor(subject, yesterday),
      await this.shifts.shiftFor(subject, today),
    ];
    const checkedIn = new Set(logs.filter((l) => l.checkinAt).map((l) => l.attendanceDate));
    const shift = pickCheckinShift(now, candidates, checkedIn);

    const assignment = await this.assignmentFacts(shift.date, subject.id);
    const mode = punchMode(actor, subject, assignment);
    const copresence = this.checkCopresence(mode, subject.id, dto.presenceCode, now);
    if (await this.leave.isOnApprovedLeave(subject.id, shift.date)) {
      throw new AppError(ErrorCode.ON_LEAVE, undefined, { date: shift.date });
    }
    const place = punchPlace(subject, assignment);
    checkAccuracy(place.kind, dto.accuracyM);
    const geo = geofenceResult(await this.locationCheck(place, dto));
    checkCheckinGeofence(geo, place.kind);

    const face = await this.proveFace(actor, subject, dto, now);
    const mark = lateMark(now, shift, this.config.attendanceTiming);
    const fields: Partial<AttendanceLog> = {
      wardId: place.kind === 'WARD' ? place.wardId : null,
      officeId: place.kind === 'OFFICE' ? place.officeId : null,
      assignmentId: place.kind === 'WARD' ? place.assignmentId : null,
      shiftType: shift.shiftType,
      status: mark.status,
      isLate: mark.isLate,
      lateMinutes: mark.lateMinutes,
      checkinClientUuid: dto.clientUuid,
      checkinAt: now,
      checkinLat: dto.latitude,
      checkinLng: dto.longitude,
      checkinAccuracyM: dto.accuracyM,
      checkinInGeofence: geo.inGeofence,
      checkinDistanceM: geo.distanceM,
      checkinIsMocked: Boolean(dto.isMocked),
      checkinChallengeId: dto.challengeId,
      checkinFaceScore: face.score ?? null,
      checkinFacePassed: true,
      checkinMode: mode,
      checkinMarkedById: actor.staffId,
      isSuspicious: Boolean(dto.isMocked),
      updatedAt: now,
    };

    const existing = logs.find((l) => l.attendanceDate === shift.date);
    const id = await this.uow.run(async (tx) => {
      let logId: string;
      if (existing) {
        const n = await this.repo.checkIn(existing.id, Number(existing.version), fields, tx);
        if (n === 0)
          throw new AppError(ErrorCode.ALREADY_CHECKED_IN, undefined, { date: shift.date });
        logId = existing.id;
      } else {
        logId = this.ids.next();
        await this.repo.insert(newAttendanceLog(logId, subject.id, shift.date, now, fields), tx);
      }
      await this.audit.write(tx, {
        action: mode === 'SELF' ? 'ATTENDANCE_CHECKIN' : 'ATTENDANCE_PROXY_CHECKIN',
        entityType: 'attendance',
        entityId: logId,
        details: {
          staffId: subject.id,
          date: shift.date,
          mode,
          copresence,
          status: mark.status,
          lateMinutes: mark.lateMinutes,
          inGeofence: geo.inGeofence,
          accuracyM: dto.accuracyM,
          isMocked: Boolean(dto.isMocked),
          faceProvider: face.provider,
          faceScore: face.score ?? null,
          faceReference: face.reference ?? null,
        },
      });
      return logId;
    });

    const log = (await this.repo.findById(id))!;
    await this.afterCheckIn(log, subject, Boolean(dto.isMocked));
    return log;
  }

  private async checkOut(
    actor: AuthUser,
    subject: Staff,
    dto: CreatePunchDto,
  ): Promise<AttendanceLog> {
    const now = this.clock.now();
    const today = istDate(now);
    const open = pickCheckoutLog(
      await this.repo.findForDates(subject.id, [previousDay(today), today]),
    );
    const assignment = await this.assignmentFacts(open.attendanceDate, subject.id);
    const mode = punchMode(actor, subject, assignment);
    const copresence = this.checkCopresence(mode, subject.id, dto.presenceCode, now);

    const place: PunchPlace = open.officeId
      ? { kind: 'OFFICE', officeId: open.officeId }
      : { kind: 'WARD', wardId: open.wardId!, assignmentId: open.assignmentId ?? null };
    checkAccuracy(place.kind, dto.accuracyM);
    // Check-out is not refused outside the geofence (the shift is over); the result is kept.
    const geo: GeofenceResult = geofenceResult(await this.locationCheck(place, dto));

    const face = await this.proveFace(actor, subject, dto, now);
    const shift = await this.shifts.shiftFor(subject, open.attendanceDate);
    const worked = workedMinutes(open.checkinAt!, now);
    const status = statusAtCheckout(open.status, worked, shift);

    await this.uow.run(async (tx) => {
      const n = await this.repo.checkOut(
        open.id,
        Number(open.version),
        {
          checkoutClientUuid: dto.clientUuid,
          checkoutAt: now,
          checkoutLat: dto.latitude,
          checkoutLng: dto.longitude,
          checkoutAccuracyM: dto.accuracyM,
          checkoutInGeofence: geo.inGeofence,
          checkoutType: 'MANUAL',
          checkoutMode: mode,
          checkoutMarkedById: actor.staffId,
          workedMinutes: worked,
          status,
          isSuspicious: bool(open.isSuspicious) || Boolean(dto.isMocked),
          updatedAt: now,
        },
        tx,
      );
      if (n === 0) {
        throw new AppError(ErrorCode.ALREADY_CHECKED_OUT, undefined, { date: open.attendanceDate });
      }
      await this.audit.write(tx, {
        action: mode === 'SELF' ? 'ATTENDANCE_CHECKOUT' : 'ATTENDANCE_PROXY_CHECKOUT',
        entityType: 'attendance',
        entityId: open.id,
        details: {
          staffId: subject.id,
          date: open.attendanceDate,
          mode,
          copresence,
          status,
          workedMinutes: worked,
          inGeofence: geo.inGeofence,
          isMocked: Boolean(dto.isMocked),
          faceProvider: face.provider,
          faceScore: face.score ?? null,
          faceReference: face.reference ?? null,
        },
      });
    });
    const log = (await this.repo.findById(open.id))!;
    if (dto.isMocked) await this.raiseMockLocation(log, subject);
    return log;
  }

  // ------------------------------------------------------------ Co-presence (rolling QR)

  /** The caller's key for the rolling code their phone shows when an inspector marks them. */
  presenceKeyFor(actor: AuthUser): PresenceKeyDto {
    return {
      key: presenceKey(this.config.auth.refreshSecret, actor.staffId).toString('base64'),
      periodSeconds: PRESENCE_PERIOD_SECONDS,
      digits: PRESENCE_DIGITS,
    };
  }

  /** A proxy punch shows the worker's phone was there: its rolling code (required by config). */
  private checkCopresence(
    mode: string,
    subjectId: string,
    code: string | undefined,
    now: Date,
  ): 'NOT_NEEDED' | 'CONFIRMED' {
    const key = presenceKey(this.config.auth.refreshSecret, subjectId);
    const outcome = copresenceOutcome(
      mode !== 'SELF',
      this.config.copresenceRequired,
      code,
      !!code && verifyPresenceCode(key, code, now),
    );
    if (outcome === 'MISSING' || outcome === 'WRONG') {
      throw new AppError(ErrorCode.COPRESENCE_FAILED, undefined, { reason: outcome });
    }
    return outcome;
  }

  // ------------------------------------------------------------ Presence (spot checks)

  /**
   * Proves the caller is at work right now (a spot-check answer): the same one-time challenge
   * and server face match as a punch (no fail-open), a usable GPS fix, and where they are
   * against the geofence of their open shift. Throws NOT_CHECKED_IN without an open shift.
   */
  async provePresence(actor: AuthUser, proof: PresenceProof): Promise<PresenceResult> {
    const now = this.clock.now();
    const today = istDate(now);
    const open = (await this.repo.findForDates(actor.staffId, [previousDay(today), today])).find(
      (l) => l.checkinAt && !l.checkoutAt,
    );
    if (!open) throw new AppError(ErrorCode.NOT_CHECKED_IN);
    const subject = await this.subject(actor.staffId);
    const place: PunchPlace = open.officeId
      ? { kind: 'OFFICE', officeId: open.officeId }
      : { kind: 'WARD', wardId: open.wardId!, assignmentId: open.assignmentId ?? null };
    checkAccuracy(place.kind, proof.accuracyM);
    const geo = geofenceResult(await this.locationCheck(place, proof));
    const face = await this.proveFace(actor, subject, { ...proof, type: 'SPOT_CHECK' }, now);
    return {
      attendanceId: open.id,
      wardId: open.wardId,
      inGeofence: geo.inGeofence,
      distanceM: geo.distanceM,
      faceScore: face.score ?? null,
    };
  }

  /**
   * Field staff checked in right now (today's shift, or last night's still running), with the
   * end of their shift: the people a random spot check may pick.
   */
  async onDuty(): Promise<OnDuty[]> {
    const now = this.clock.now();
    const today = istDate(now);
    const yesterday = previousDay(today);
    const open = (await this.repo.findOpen(today)).filter(
      (l) => l.wardId && l.attendanceDate >= yesterday,
    );
    if (open.length === 0) return [];
    const people = await this.staff.findByIds([...new Set(open.map((l) => l.staffId))]);
    const out: OnDuty[] = [];
    for (const date of new Set(open.map((l) => l.attendanceDate))) {
      const shifts = await this.shifts.shiftsFor(people, date);
      for (const log of open.filter((l) => l.attendanceDate === date)) {
        const shift = shifts.get(log.staffId);
        if (!shift || shift.endsAt <= now) continue;
        out.push({
          attendanceId: log.id,
          staffId: log.staffId,
          wardId: log.wardId!,
          date,
          checkinAt: log.checkinAt!,
          shiftEndsAt: shift.endsAt,
        });
      }
    }
    return out;
  }

  // ------------------------------------------------------------ Reads

  async list(actor: AuthUser, q: ListAttendanceQueryDto): Promise<AttendancePageDto> {
    const filter: AttendanceFilter = { from: q.from, to: q.to, status: q.status };
    const scope = attendanceScope(actor);
    if (scope.kind === 'WARD') filter.wardId = scope.wardId;
    if (scope.kind === 'SELF') filter.staffIds = [scope.staffId];
    if (scope.kind === 'TEAM') {
      filter.staffIds = [
        scope.selfId,
        ...(await this.staff.findIds({ reportsToId: scope.managerId })),
      ];
      // Workers placed under this inspector for a day (who may report to someone else): the
      // inspector can mark them, so must see those days too. Bounded to the asked range.
      const today = istDate(this.clock.now());
      const placed = await this.rosters.placementsUnder(
        scope.managerId,
        q.from ?? addDays(q.to ?? today, -TEAM_LOOKBACK_DAYS),
        q.to ?? today,
      );
      filter.orAssignmentIds = placed.map((p) => p.assignmentId);
      if (q.staffId) {
        const known =
          filter.staffIds.includes(q.staffId) || placed.some((p) => p.staffId === q.staffId);
        if (!known) throw new AppError(ErrorCode.FORBIDDEN);
        filter.staffId = q.staffId;
      }
    } else if (q.staffId) {
      if (filter.staffIds && !filter.staffIds.includes(q.staffId)) {
        throw new AppError(ErrorCode.FORBIDDEN);
      }
      filter.staffIds = [q.staffId];
    }
    const [items, total] = await this.repo.findPage(filter, (q.page - 1) * q.pageSize, q.pageSize);
    return { items: items.map(toAttendanceDto), page: q.page, pageSize: q.pageSize, total };
  }

  async get(actor: AuthUser, id: string): Promise<AttendanceLogDto> {
    const log = await this.repo.findById(id);
    if (!log || !(await this.canSee(actor, log))) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Attendance record not found', { id });
    }
    return toAttendanceDto(log);
  }

  // ------------------------------------------------------------ Helpers

  private async canSee(actor: AuthUser, log: AttendanceLog): Promise<boolean> {
    const scope = attendanceScope(actor);
    switch (scope.kind) {
      case 'ALL':
        return true;
      case 'WARD':
        return log.wardId === scope.wardId || log.staffId === actor.staffId;
      case 'SELF':
        return log.staffId === scope.staffId;
      case 'TEAM': {
        if (log.staffId === scope.selfId) return true;
        const person = await this.staff.findById(log.staffId);
        if (person?.reportsToId === scope.managerId) return true;
        const placed = await this.rosters.assignmentFor(log.attendanceDate, log.staffId);
        return placed?.inspectorId === scope.managerId;
      }
    }
  }

  /** The log an earlier punch with this clientUuid produced, if it was the same punch. */
  private async replayOf(dto: CreatePunchDto, subjectId: string): Promise<AttendanceLog | null> {
    const log = await this.repo.findByPunchUuid(dto.clientUuid);
    if (!log) return null;
    const sameType =
      dto.type === 'CHECK_IN'
        ? log.checkinClientUuid === dto.clientUuid
        : log.checkoutClientUuid === dto.clientUuid;
    if (log.staffId !== subjectId || !sameType) {
      throw new AppError(ErrorCode.CONFLICT, 'This clientUuid was already used for another punch');
    }
    return log;
  }

  private async subject(id: string): Promise<Staff> {
    const person = await this.staff.findById(id);
    if (!person) throw new AppError(ErrorCode.NOT_FOUND, 'Staff member not found', { id });
    return person;
  }

  private async assignmentFacts(date: string, staffId: string): Promise<PunchAssignment | null> {
    const a = await this.rosters.assignmentFor(date, staffId);
    return a
      ? {
          id: a.id,
          wardId: a.wardId,
          wardInspectorId: a.wardInspectorId,
          inspectorId: a.inspectorId,
          isApproved: bool(a.isApproved),
        }
      : null;
  }

  private locationCheck(
    place: PunchPlace,
    dto: { latitude: number; longitude: number },
  ): Promise<LocationCheck> {
    const point = { latitude: dto.latitude, longitude: dto.longitude };
    return place.kind === 'WARD'
      ? this.wards.checkLocation(place.wardId, point)
      : this.offices.checkLocation(place.officeId, point);
  }

  /**
   * Uses the one-time challenge, then verifies the face on the server. No fail-open: a
   * provider error or a mismatch stops the punch. A used challenge is spent even when the
   * face fails, so a stolen request cannot be retried.
   */
  private async proveFace(
    actor: AuthUser,
    subject: Staff,
    dto: FaceProof & { type: string },
    now: Date,
  ): Promise<FaceVerificationResult> {
    checkChallenge(await this.repo.findChallenge(dto.challengeId), actor.staffId, subject.id, now);
    if ((await this.repo.consumeChallenge(dto.challengeId, now)) === 0) {
      throw new AppError(ErrorCode.CHALLENGE_INVALID, 'This challenge was already used');
    }
    const result = await this.face.verify(this.faceInput(subject.id, dto));
    if (!result.matched) {
      await this.uow.run((tx) =>
        this.audit.write(tx, {
          action: 'ATTENDANCE_FACE_REJECTED',
          entityType: 'staff',
          entityId: subject.id,
          details: {
            punch: dto.type,
            provider: result.provider,
            reasonCode: result.reasonCode ?? null,
            score: result.score ?? null,
          },
        }),
      );
      throw new AppError(ErrorCode.FACE_MISMATCH, undefined, {
        reasonCode: result.reasonCode ?? 'FACE_MISMATCH',
      });
    }
    return result;
  }

  private faceInput(staffId: string, dto: FaceProof): FaceVerificationInput {
    if (this.face.provider === 'aadhaar') {
      if (!dto.aadhaarPidXml || !dto.aadhaarTxn) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          'aadhaarPidXml and aadhaarTxn are required',
          {
            field: 'aadhaarPidXml',
          },
        );
      }
      return { kind: 'aadhaar-pid', staffId, pidDataXml: dto.aadhaarPidXml, txn: dto.aadhaarTxn };
    }
    if (!dto.faceImageBase64) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'faceImageBase64 is required', {
        field: 'faceImageBase64',
      });
    }
    const image = Buffer.from(dto.faceImageBase64, 'base64');
    if (image.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'faceImageBase64 is not valid base64', {
        field: 'faceImageBase64',
      });
    }
    return { kind: 'image', staffId, image, challengeId: dto.challengeId };
  }

  // ------------------------------------------------------------ Alerts (after commit)

  private async afterCheckIn(log: AttendanceLog, subject: Staff, mocked: boolean): Promise<void> {
    if (mocked) await this.raiseMockLocation(log, subject);
    // They arrived: the "not here" alerts from the day's jobs no longer apply.
    await this.alerts.resolveBySystem(
      [
        dedupeKey('NOT_CHECKED_IN', subject.id, log.attendanceDate),
        dedupeKey('ABSENT', subject.id, log.attendanceDate),
      ],
      'Checked in later',
    );
    if (!bool(log.isLate)) return;
    const minutes = Number(log.lateMinutes);
    await this.raise({
      alertType: 'LATE_CHECKIN',
      severity: 'LOW',
      message: `${subject.fullName} checked in ${minutes} minutes late`,
      messageMr: `${subject.fullNameMr ?? subject.fullName} ${minutes} मिनिटे उशिरा हजर`,
      staffId: subject.id,
      wardId: log.wardId ?? undefined,
      details: { attendanceId: log.id, date: log.attendanceDate, lateMinutes: minutes },
      dedupeKey: dedupeKey('LATE_CHECKIN', subject.id, log.attendanceDate),
    });
    const month = log.attendanceDate.slice(0, 7);
    const count = await this.repo.countLate(subject.id, `${month}-01`, log.attendanceDate);
    if (isRepeatedLate(count)) {
      await this.raise({
        alertType: 'REPEATED_LATE',
        severity: 'MEDIUM',
        message: `${subject.fullName} has ${count} late marks this month`,
        messageMr: `${subject.fullNameMr ?? subject.fullName} यांचे या महिन्यात ${count} उशीर`,
        staffId: subject.id,
        wardId: log.wardId ?? undefined,
        details: { month, lateMarks: count },
        dedupeKey: dedupeKey('REPEATED_LATE', subject.id, month),
      });
    }
  }

  private raiseMockLocation(log: AttendanceLog, subject: Staff): Promise<void> {
    return this.raise({
      alertType: 'TAMPER_DETECTED',
      severity: 'HIGH',
      message: `${subject.fullName} punched with a mock location`,
      messageMr: `${subject.fullNameMr ?? subject.fullName} यांनी बनावट लोकेशनने हजेरी लावली`,
      staffId: subject.id,
      wardId: log.wardId ?? undefined,
      details: { attendanceId: log.id, date: log.attendanceDate, signal: 'MOCK_LOCATION' },
      dedupeKey: dedupeKey('TAMPER_DETECTED', subject.id, `${log.attendanceDate}:MOCK`),
    });
  }

  /** Alerts never undo an accepted punch: a failure is logged, and the punch stands. */
  private async raise(input: RaiseAlert): Promise<void> {
    try {
      await this.alerts.raise(input);
    } catch (error) {
      this.logger.error({ err: error, alertType: input.alertType }, 'Could not raise alert');
    }
  }
}
