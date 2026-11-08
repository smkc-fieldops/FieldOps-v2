/**
 * The one list of error codes the API can return. Clients map `code` to a Marathi /
 * English message, so codes are stable: add new ones, never rename.
 */
export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VERSION_CONFLICT = 'VERSION_CONFLICT',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  RULE_VIOLATION = 'RULE_VIOLATION',
  RATE_LIMITED = 'RATE_LIMITED',
  HTTP_ERROR = 'HTTP_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  // Sign-in
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_OTP_INVALID = 'AUTH_OTP_INVALID',
  AUTH_OTP_EXPIRED = 'AUTH_OTP_EXPIRED',
  AUTH_OTP_TOO_MANY_ATTEMPTS = 'AUTH_OTP_TOO_MANY_ATTEMPTS',
  AUTH_OTP_RATE_LIMITED = 'AUTH_OTP_RATE_LIMITED',
  AUTH_OTP_DELIVERY_UNAVAILABLE = 'AUTH_OTP_DELIVERY_UNAVAILABLE',
  AUTH_SESSION_REVOKED = 'AUTH_SESSION_REVOKED',
  AUTH_ACCOUNT_INACTIVE = 'AUTH_ACCOUNT_INACTIVE',
  AUTH_WEAK_PASSWORD = 'AUTH_WEAK_PASSWORD',

  // Staff and offices
  STAFF_IDENTITY_TAKEN = 'STAFF_IDENTITY_TAKEN',
  STAFF_HAS_REPORTS = 'STAFF_HAS_REPORTS',
  OFFICE_CODE_TAKEN = 'OFFICE_CODE_TAKEN',

  // Rosters and assignments
  ROSTER_WORKER_TAKEN = 'ROSTER_WORKER_TAKEN',
  ASSIGNMENT_EXISTS = 'ASSIGNMENT_EXISTS',

  // Calendar
  HOLIDAY_DATE_TAKEN = 'HOLIDAY_DATE_TAKEN',
  LEAVE_OVERLAP = 'LEAVE_OVERLAP',
  REGULARIZATION_EXISTS = 'REGULARIZATION_EXISTS',

  // Wards
  WARD_CODE_TAKEN = 'WARD_CODE_TAKEN',
  INVALID_BOUNDARY = 'INVALID_BOUNDARY',
  OUTSIDE_WARD = 'OUTSIDE_WARD',

  // Attendance
  NO_ASSIGNMENT = 'NO_ASSIGNMENT',
  ASSIGNMENT_NOT_APPROVED = 'ASSIGNMENT_NOT_APPROVED',
  OUTSIDE_GEOFENCE = 'OUTSIDE_GEOFENCE',
  LOCATION_TOO_INACCURATE = 'LOCATION_TOO_INACCURATE',
  OUTSIDE_SHIFT_WINDOW = 'OUTSIDE_SHIFT_WINDOW',
  ALREADY_CHECKED_IN = 'ALREADY_CHECKED_IN',
  ALREADY_CHECKED_OUT = 'ALREADY_CHECKED_OUT',
  NOT_CHECKED_IN = 'NOT_CHECKED_IN',
  ON_LEAVE = 'ON_LEAVE',
  CHALLENGE_INVALID = 'CHALLENGE_INVALID',
  CHALLENGE_EXPIRED = 'CHALLENGE_EXPIRED',
  FACE_MISMATCH = 'FACE_MISMATCH',
  SPOT_CHECK_CLOSED = 'SPOT_CHECK_CLOSED',
  COPRESENCE_FAILED = 'COPRESENCE_FAILED',

  // Face verification
  FACE_PROVIDER_UNAVAILABLE = 'FACE_PROVIDER_UNAVAILABLE',
  FACE_NOT_ENROLLED = 'FACE_NOT_ENROLLED',
  FACE_ENROL_PHOTO_UNUSABLE = 'FACE_ENROL_PHOTO_UNUSABLE',
  FACE_ENROL_LIMIT_REACHED = 'FACE_ENROL_LIMIT_REACHED',
  AADHAAR_CAPTURE_FAILED = 'AADHAAR_CAPTURE_FAILED',
  AADHAAR_IDENTITY_MISSING = 'AADHAAR_IDENTITY_MISSING',
}

export interface ErrorDefinition {
  status: number;
  title: string;
}

export const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
  [ErrorCode.VALIDATION_FAILED]: { status: 400, title: 'The request is not valid' },
  [ErrorCode.UNAUTHENTICATED]: { status: 401, title: 'Please sign in again' },
  [ErrorCode.FORBIDDEN]: { status: 403, title: 'You are not allowed to do this' },
  [ErrorCode.NOT_FOUND]: { status: 404, title: 'Not found' },
  [ErrorCode.CONFLICT]: { status: 409, title: 'This conflicts with existing data' },
  [ErrorCode.VERSION_CONFLICT]: {
    status: 409,
    title: 'Someone else changed this record; reload and try again',
  },
  [ErrorCode.PAYLOAD_TOO_LARGE]: { status: 413, title: 'The upload is too large' },
  [ErrorCode.RULE_VIOLATION]: { status: 422, title: 'This breaks a business rule' },
  [ErrorCode.RATE_LIMITED]: { status: 429, title: 'Too many requests; try again shortly' },
  [ErrorCode.HTTP_ERROR]: { status: 400, title: 'The request could not be completed' },
  [ErrorCode.SERVICE_UNAVAILABLE]: { status: 503, title: 'The service is not ready' },
  [ErrorCode.INTERNAL_ERROR]: { status: 500, title: 'Something went wrong on the server' },

  [ErrorCode.AUTH_INVALID_CREDENTIALS]: {
    status: 401,
    title: 'Wrong employee code / phone or password',
  },
  [ErrorCode.AUTH_OTP_INVALID]: {
    status: 401,
    title: 'The code is not correct; check the SMS and try again',
  },
  [ErrorCode.AUTH_OTP_EXPIRED]: { status: 401, title: 'The code has expired; request a new one' },
  [ErrorCode.AUTH_OTP_TOO_MANY_ATTEMPTS]: {
    status: 429,
    title: 'Too many wrong codes; request a new one',
  },
  [ErrorCode.AUTH_OTP_RATE_LIMITED]: {
    status: 429,
    title: 'Too many codes requested; wait 15 minutes',
  },
  [ErrorCode.AUTH_OTP_DELIVERY_UNAVAILABLE]: {
    status: 503,
    title: 'SMS sign-in codes cannot be sent right now',
  },
  [ErrorCode.AUTH_SESSION_REVOKED]: {
    status: 401,
    title: 'You were signed out; please sign in again',
  },
  [ErrorCode.AUTH_ACCOUNT_INACTIVE]: { status: 403, title: 'This account is deactivated' },
  [ErrorCode.AUTH_WEAK_PASSWORD]: { status: 422, title: 'Choose a stronger password' },

  [ErrorCode.STAFF_IDENTITY_TAKEN]: {
    status: 409,
    title: 'Another staff member already has this phone or employee code',
  },
  [ErrorCode.STAFF_HAS_REPORTS]: {
    status: 409,
    title: 'People still report to this person; move them to another manager first',
  },
  [ErrorCode.OFFICE_CODE_TAKEN]: { status: 409, title: 'An office with this code already exists' },

  [ErrorCode.ROSTER_WORKER_TAKEN]: {
    status: 409,
    title: 'This worker is already in a standing squad',
  },
  [ErrorCode.ASSIGNMENT_EXISTS]: {
    status: 409,
    title: 'This person already has an assignment for that day',
  },

  [ErrorCode.HOLIDAY_DATE_TAKEN]: { status: 409, title: 'There is already a holiday on this date' },
  [ErrorCode.LEAVE_OVERLAP]: {
    status: 409,
    title: 'You already have pending or approved leave on these dates',
  },
  [ErrorCode.REGULARIZATION_EXISTS]: {
    status: 409,
    title: 'A regularization request for this day is already open or approved',
  },

  [ErrorCode.WARD_CODE_TAKEN]: { status: 409, title: 'A ward with this code already exists' },
  [ErrorCode.INVALID_BOUNDARY]: { status: 422, title: 'The ward boundary is not a valid polygon' },
  [ErrorCode.OUTSIDE_WARD]: { status: 422, title: 'Location is outside the assigned ward' },

  [ErrorCode.NO_ASSIGNMENT]: { status: 422, title: 'No ward assignment for this shift' },
  [ErrorCode.ASSIGNMENT_NOT_APPROVED]: {
    status: 422,
    title: 'Your assignment for today is waiting for approval',
  },
  [ErrorCode.OUTSIDE_GEOFENCE]: {
    status: 422,
    title: 'You are outside your ward or office; move inside and try again',
  },
  [ErrorCode.LOCATION_TOO_INACCURATE]: {
    status: 422,
    title: 'GPS is not accurate enough yet; wait a moment in the open and try again',
  },
  [ErrorCode.OUTSIDE_SHIFT_WINDOW]: {
    status: 422,
    title: 'Check-in is not open for your shift now',
  },
  [ErrorCode.ALREADY_CHECKED_IN]: { status: 409, title: 'Already checked in for this shift' },
  [ErrorCode.ALREADY_CHECKED_OUT]: { status: 409, title: 'Already checked out for this shift' },
  [ErrorCode.NOT_CHECKED_IN]: { status: 422, title: 'Check in before checking out' },
  [ErrorCode.ON_LEAVE]: { status: 422, title: 'You are on approved leave today' },
  [ErrorCode.CHALLENGE_INVALID]: {
    status: 422,
    title: 'The face check is not valid; start the face check again',
  },
  [ErrorCode.CHALLENGE_EXPIRED]: {
    status: 422,
    title: 'The face check took too long; start it again',
  },
  [ErrorCode.FACE_MISMATCH]: { status: 422, title: 'The face did not match; try again' },
  [ErrorCode.COPRESENCE_FAILED]: {
    status: 422,
    title: "Scan the worker's FieldOps code on their own phone to mark them",
  },
  [ErrorCode.SPOT_CHECK_CLOSED]: {
    status: 422,
    title: 'This spot check is no longer open',
  },

  [ErrorCode.FACE_PROVIDER_UNAVAILABLE]: {
    status: 503,
    title: 'Face verification is temporarily unavailable',
  },
  [ErrorCode.FACE_NOT_ENROLLED]: {
    status: 422,
    title: 'No enrolled face for this person; ask an administrator to enrol you',
  },
  [ErrorCode.FACE_ENROL_PHOTO_UNUSABLE]: {
    status: 422,
    title: 'The photo must show exactly one clear face',
  },
  [ErrorCode.FACE_ENROL_LIMIT_REACHED]: {
    status: 409,
    title: 'This person already has the most enrolment photos allowed; clear them first',
  },
  [ErrorCode.AADHAAR_CAPTURE_FAILED]: {
    status: 422,
    title: 'Aadhaar face capture failed; try again',
  },
  [ErrorCode.AADHAAR_IDENTITY_MISSING]: {
    status: 422,
    title: 'This person is not linked for Aadhaar face authentication',
  },
};
