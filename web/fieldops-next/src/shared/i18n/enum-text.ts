import type { Schemas } from '@/api/client';
import type { Tone } from '@/shared/ui/badge';
import type { Bilingual } from './locale';

/** Marathi / English labels (and a badge colour) for the API's enum values. */
type Labels<K extends string> = Record<K, Bilingual & { tone?: Tone }>;

export const ROLE_TEXT: Labels<Schemas['StaffProfileDto']['role']> = {
  ADMIN: { en: 'Administrator', mr: 'प्रशासक', tone: 'blue' },
  WARD_INSPECTOR: { en: 'Ward inspector', mr: 'प्रभाग निरीक्षक', tone: 'blue' },
  INSPECTOR: { en: 'Inspector', mr: 'निरीक्षक', tone: 'slate' },
  WORKER: { en: 'Worker', mr: 'कामगार', tone: 'slate' },
  OFFICE_STAFF: { en: 'Office staff', mr: 'कार्यालयीन कर्मचारी', tone: 'slate' },
};

export const ZONE_TEXT: Labels<Schemas['WardDto']['zone']> = {
  SANGLI: { en: 'Sangli', mr: 'सांगली' },
  MIRAJ: { en: 'Miraj', mr: 'मिरज' },
  KUPWAD: { en: 'Kupwad', mr: 'कुपवाड' },
};

export const ATTENDANCE_STATUS_TEXT: Labels<Schemas['AttendanceLogDto']['status']> = {
  PRESENT: { en: 'Present', mr: 'उपस्थित', tone: 'green' },
  LATE: { en: 'Late', mr: 'उशिरा', tone: 'amber' },
  HALF_DAY: { en: 'Half day', mr: 'अर्धा दिवस', tone: 'amber' },
  ABSENT: { en: 'Absent', mr: 'अनुपस्थित', tone: 'red' },
  HOLIDAY_OFF: { en: 'Holiday', mr: 'सुट्टी', tone: 'slate' },
  ON_LEAVE: { en: 'On leave', mr: 'रजेवर', tone: 'blue' },
  REGULARIZED: { en: 'Regularized', mr: 'नियमित केले', tone: 'blue' },
};

export const CHECKOUT_TYPE_TEXT: Labels<NonNullable<Schemas['AttendanceLogDto']['checkoutType']>> = {
  MANUAL: { en: 'Self', mr: 'स्वतः' },
  AUTO_GPS_LAST_SEEN: { en: 'Auto (last seen)', mr: 'आपोआप (शेवटचे दिसले)', tone: 'amber' },
  AUTO_OFFICE_SCHEDULED: { en: 'Auto (shift end)', mr: 'आपोआप (शिफ्ट संपली)', tone: 'amber' },
  SUPERVISOR_OVERRIDE: { en: 'Corrected by supervisor', mr: 'पर्यवेक्षकाने दुरुस्त', tone: 'blue' },
};

export const PUNCH_MODE_TEXT: Labels<NonNullable<Schemas['PunchDetailsDto']['mode']>> = {
  SELF: { en: 'Self', mr: 'स्वतः' },
  INSPECTOR_PROXY: { en: 'By inspector', mr: 'निरीक्षकाकडून', tone: 'blue' },
  ADMIN_PROXY: { en: 'By administrator', mr: 'प्रशासकाकडून', tone: 'blue' },
};

export const ALERT_TYPE_TEXT: Labels<Schemas['AlertDto']['alertType']> = {
  LATE_CHECKIN: { en: 'Late check-in', mr: 'उशिरा हजेरी' },
  OUT_OF_ZONE: { en: 'Out of zone', mr: 'क्षेत्राबाहेर' },
  MISSED_SPOT_CHECK: { en: 'Missed spot check', mr: 'अचानक तपासणी चुकली' },
  GHOST_PUNCH: { en: 'Suspicious punch', mr: 'संशयास्पद हजेरी' },
  ABSENT: { en: 'Absent', mr: 'अनुपस्थित' },
  TAMPER_DETECTED: { en: 'Tampering', mr: 'छेडछाड' },
  STATIONARY_TOO_LONG: { en: 'Stationary too long', mr: 'खूप वेळ एकाच जागी' },
  TASK_OVERDUE: { en: 'Task overdue', mr: 'काम मुदतीबाहेर' },
  REPEATED_LATE: { en: 'Repeatedly late', mr: 'वारंवार उशिरा' },
  NOT_CHECKED_IN: { en: 'Not checked in', mr: 'अजून हजेरी नाही' },
};

export const SEVERITY_TEXT: Labels<Schemas['AlertDto']['severity']> = {
  LOW: { en: 'Low', mr: 'कमी', tone: 'slate' },
  MEDIUM: { en: 'Medium', mr: 'मध्यम', tone: 'amber' },
  HIGH: { en: 'High', mr: 'जास्त', tone: 'red' },
  CRITICAL: { en: 'Critical', mr: 'गंभीर', tone: 'red' },
};

export const REQUEST_STATUS_TEXT: Labels<Schemas['LeaveRequestDto']['status']> = {
  PENDING: { en: 'Pending', mr: 'प्रलंबित', tone: 'amber' },
  APPROVED: { en: 'Approved', mr: 'मंजूर', tone: 'green' },
  REJECTED: { en: 'Rejected', mr: 'नामंजूर', tone: 'red' },
  CANCELLED: { en: 'Cancelled', mr: 'रद्द', tone: 'slate' },
};

export const LEAVE_TYPE_TEXT: Labels<Schemas['LeaveRequestDto']['leaveType']> = {
  CASUAL: { en: 'Casual', mr: 'नैमित्तिक' },
  SICK: { en: 'Sick', mr: 'आजारपण' },
  EARNED: { en: 'Earned', mr: 'अर्जित' },
  WEEKLY_OFF: { en: 'Weekly off', mr: 'साप्ताहिक सुट्टी' },
};

export const REGULARIZATION_REASON_TEXT: Labels<Schemas['RegularizationRequestDto']['reasonType']> = {
  BATTERY_DEAD: { en: 'Battery dead', mr: 'बॅटरी संपली' },
  APP_CRASH: { en: 'App crashed', mr: 'अॅप बंद पडले' },
  FIELD_RESCUE_DUTY: { en: 'Rescue duty', mr: 'बचाव कार्य' },
  OUT_OF_NETWORK: { en: 'No network', mr: 'नेटवर्क नाही' },
  OTHER: { en: 'Other', mr: 'इतर' },
};

export const TASK_STATUS_TEXT: Labels<Schemas['TaskDto']['status']> = {
  OPEN: { en: 'Open', mr: 'खुले', tone: 'slate' },
  IN_PROGRESS: { en: 'In progress', mr: 'सुरू', tone: 'blue' },
  SUBMITTED: { en: 'Submitted', mr: 'सादर', tone: 'amber' },
  APPROVED: { en: 'Approved', mr: 'मंजूर', tone: 'green' },
  REJECTED: { en: 'Rejected', mr: 'नामंजूर', tone: 'red' },
  ESCALATED: { en: 'Escalated', mr: 'वरिष्ठांकडे', tone: 'red' },
  CLOSED: { en: 'Closed', mr: 'बंद', tone: 'slate' },
};

export const PRIORITY_TEXT: Labels<Schemas['TaskDto']['priority']> = {
  URGENT: { en: 'Urgent', mr: 'तातडीचे', tone: 'red' },
  NORMAL: { en: 'Normal', mr: 'सामान्य', tone: 'slate' },
  LOW: { en: 'Low', mr: 'कमी', tone: 'slate' },
};

/** Options for a <Select> from one of the tables above. */
export function enumOptions<K extends string>(
  labels: Labels<K>,
  pick: (text: Bilingual) => string,
): { value: K; label: string }[] {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: pick(labels[value]) }));
}
