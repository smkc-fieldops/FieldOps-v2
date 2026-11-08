import { Alert } from '../modules/alerts/entities/alert.entity';
import { AttendanceLog } from '../modules/attendance/entities/attendance-log.entity';
import { LivenessChallenge } from '../modules/attendance/entities/liveness-challenge.entity';
import { LocationPing } from '../modules/attendance/entities/location-ping.entity';
import { TamperEvent } from '../modules/attendance/entities/tamper-event.entity';
import { AuthOtp } from '../modules/auth/entities/auth-otp.entity';
import { AuthSession } from '../modules/auth/entities/auth-session.entity';
import { ConversationParticipant } from '../modules/chat/entities/conversation-participant.entity';
import { Conversation } from '../modules/chat/entities/conversation.entity';
import { Message } from '../modules/chat/entities/message.entity';
import { CitizenComplaint } from '../modules/complaints/entities/citizen-complaint.entity';
import { Holiday } from '../modules/holidays/entities/holiday.entity';
import { LeaveRequest } from '../modules/leave/entities/leave-request.entity';
import { RegularizationRequest } from '../modules/leave/entities/regularization-request.entity';
import { CorporationOffice } from '../modules/offices/entities/corporation-office.entity';
import { DailyAssignment } from '../modules/rosters/entities/daily-assignment.entity';
import { StandingRoster } from '../modules/rosters/entities/standing-roster.entity';
import { Shift } from '../modules/shifts/entities/shift.entity';
import { SpotCheck } from '../modules/spot-checks/entities/spot-check.entity';
import { Staff } from '../modules/staff/entities/staff.entity';
import { TaskUpdate } from '../modules/tasks/entities/task-update.entity';
import { Task } from '../modules/tasks/entities/task.entity';
import { Ward } from '../modules/wards/entities/ward.entity';
import { AuditLog } from '../shared/audit/audit-log.entity';
import { RouteSummary } from '../modules/attendance/entities/route-summary.entity';
import { WardDailySummary } from '../modules/attendance/entities/ward-daily-summary.entity';
import { Upload } from '../modules/uploads/entities/upload.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { FaceTemplate } from '../modules/face/entities/face-template.entity';
import { PushToken } from '../modules/notifications/entities/push-token.entity';
import { JobLock } from '../shared/jobs/job-lock.entity';

/** Every TypeORM entity. Add new entities here when a module adds one. */
export const ENTITIES = [
  Ward,
  CorporationOffice,
  Staff,
  AuthOtp,
  AuthSession,
  AuditLog,
  StandingRoster,
  DailyAssignment,
  Shift,
  AttendanceLog,
  LivenessChallenge,
  LocationPing,
  TamperEvent,
  RouteSummary,
  WardDailySummary,
  SpotCheck,
  CitizenComplaint,
  Task,
  TaskUpdate,
  LeaveRequest,
  RegularizationRequest,
  Holiday,
  Alert,
  Conversation,
  ConversationParticipant,
  Message,
  JobLock,
  Upload,
  Notification,
  FaceTemplate,
  PushToken,
];
