import { CreateWards1793145600000 } from './1793145600000-create-wards';
import { CreateOfficesAndStaff1793232000000 } from './1793232000000-create-offices-and-staff';
import { CreateAuthAndAudit1793232000100 } from './1793232000100-create-auth-and-audit';
import { CreateRostersAndShifts1793318400000 } from './1793318400000-create-rosters-and-shifts';
import { CreateAttendanceAndTracking1793318400100 } from './1793318400100-create-attendance-and-tracking';
import { CreateTasksAndRequests1793318400200 } from './1793318400200-create-tasks-and-requests';
import { CreateChat1793318400300 } from './1793318400300-create-chat';
import { CreateLivenessChallenges1793404800000 } from './1793404800000-create-liveness-challenges';
import { CreateJobsAndSummaries1793404800100 } from './1793404800100-create-jobs-and-summaries';
import { CreateUploads1793491200000 } from './1793491200000-create-uploads';
import { CreateNotifications1793577600000 } from './1793577600000-create-notifications';
import { UploadVoiceNotes1793577600100 } from './1793577600100-upload-voice-notes';
import { CreateFaceTemplates1793664000000 } from './1793664000000-create-face-templates';
import { AlertNotCheckedIn1793664000100 } from './1793664000100-alert-not-checked-in';

/** Every migration, oldest first. Add new migrations at the end. */
export const MIGRATIONS = [
  CreateWards1793145600000,
  CreateOfficesAndStaff1793232000000,
  CreateAuthAndAudit1793232000100,
  CreateRostersAndShifts1793318400000,
  CreateAttendanceAndTracking1793318400100,
  CreateTasksAndRequests1793318400200,
  CreateChat1793318400300,
  CreateLivenessChallenges1793404800000,
  CreateJobsAndSummaries1793404800100,
  CreateUploads1793491200000,
  CreateNotifications1793577600000,
  UploadVoiceNotes1793577600100,
  CreateFaceTemplates1793664000000,
  AlertNotCheckedIn1793664000100,
];
