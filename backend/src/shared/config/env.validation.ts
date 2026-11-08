import * as Joi from 'joi';

export type NodeEnv = 'development' | 'test' | 'production';
export type DbType = 'postgres' | 'oracle';
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/** Validated, typed environment. Anything not listed here is ignored. */
export interface Env {
  NODE_ENV: NodeEnv;
  PORT: number;
  LOG_LEVEL: LogLevel;
  CORS_ORIGINS: string;
  SWAGGER_ENABLED: boolean;
  DB_TYPE: DbType;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_NAME?: string;
  DB_SERVICE_NAME?: string;
  DB_POOL_MAX: number;
  DB_SLOW_QUERY_MS: number;
  DB_SSL: boolean;
  AUTH_TEST_LOGIN_ENABLED: boolean;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  AUTH_REFRESH_TTL_DAYS: number;
  AUTH_MAX_SESSIONS_PER_STAFF: number;
  OTP_SENDER: OtpSenderKind;
  OTP_TTL_SECONDS: number;
  OTP_MAX_ATTEMPTS: number;
  OTP_MAX_PER_15_MIN: number;
  SMS_GATEWAY_URL?: string;
  SMS_GATEWAY_METHOD: 'GET' | 'POST';
  SMS_OTP_MESSAGE: string;
  SMS_SENDER_ID: string;
  SMS_DLT_TEMPLATE_ID: string;
  SMS_TIMEOUT_MS: number;
  RATE_LIMIT_PER_MINUTE: number;
  SIGN_IN_RATE_LIMIT_PER_MINUTE: number;
  TRUST_PROXY: string;
  JOBS_ENABLED: boolean;
  PING_RETENTION_DAYS: number;
  SEED_WEB_PASSWORD?: string;
  MOBILE_MIN_VERSION_CODE: number;
  MOBILE_LATEST_VERSION_CODE: number;
  MOBILE_UPDATE_URL?: string;
  UPLOAD_DIR: string;
  UPLOAD_MAX_BYTES: number;
  FCM_PROJECT_ID?: string;
  FCM_CLIENT_EMAIL?: string;
  FCM_PRIVATE_KEY?: string;
  NOTIFY_SMS_URL?: string;
  NOTIFY_WHATSAPP_URL?: string;
  NOTIFY_GATEWAY_TOKEN?: string;
  SPOT_CHECK_DAILY_RATE: number;
  COPRESENCE_REQUIRED: boolean;
  ATTENDANCE_LATE_GRACE_MINUTES: number;
  ATTENDANCE_HALF_DAY_AFTER_PERCENT: number;
  TILE_DIR?: string;

  FACE_PROVIDER: FaceProvider;
  FACE_MATCH_THRESHOLD: number;
  FACE_LIVENESS_THRESHOLD: number;
  FACE_MODEL_DIR: string;
  FACE_MAX_PARALLEL: number;
  FACE_THREADS: number;
  AADHAAR_ENV: string;
  AADHAAR_API_VERSION: string;
  AADHAAR_PID_VERSION: string;
  AADHAAR_LANGUAGE: string;
  AADHAAR_AUA_CODE?: string;
  AADHAAR_SUB_AUA_CODE?: string;
  AADHAAR_LICENSE_KEY?: string;
  AADHAAR_ASA_LICENSE_KEY?: string;
  AADHAAR_ASA_URL_TEMPLATE?: string;
  AADHAAR_SIGNING_KEY_PATH?: string;
  AADHAAR_SIGNING_CERT_PATH?: string;
  AADHAAR_DEVICE_UDC?: string;
  AADHAAR_TIMEOUT_MS: number;
}

export type FaceProvider = 'local' | 'aadhaar';
export type OtpSenderKind = 'log' | 'sms_http' | 'disabled';

/** Required only when FACE_PROVIDER=aadhaar. */
const aadhaarRequired = () =>
  Joi.string().when('FACE_PROVIDER', {
    is: 'aadhaar',
    then: Joi.required(),
    otherwise: Joi.optional(),
  });

const isProduction = { is: 'production' } as const;

const secret = (devDefault: string) =>
  Joi.string().when('NODE_ENV', {
    ...isProduction,
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().min(16).default(devDefault),
  });

const schema = Joi.object<Env>({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
  PORT: Joi.number().port().default(3000),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
  CORS_ORIGINS: Joi.string().when('NODE_ENV', {
    ...isProduction,
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  SWAGGER_ENABLED: Joi.boolean().when('NODE_ENV', {
    ...isProduction,
    then: Joi.boolean().default(false),
    otherwise: Joi.boolean().default(true),
  }),

  DB_TYPE: Joi.string().valid('postgres', 'oracle').default('postgres'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number()
    .port()
    .when('DB_TYPE', {
      is: 'oracle',
      then: Joi.number().default(1521),
      otherwise: Joi.number().default(5432),
    }),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().when('DB_TYPE', {
    is: 'postgres',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  DB_SERVICE_NAME: Joi.string().when('DB_TYPE', {
    is: 'oracle',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  DB_POOL_MAX: Joi.number().integer().min(1).max(200).default(20),
  DB_SLOW_QUERY_MS: Joi.number().integer().min(1).default(500),
  DB_SSL: Joi.boolean().default(false),

  AUTH_TEST_LOGIN_ENABLED: Joi.boolean().when('NODE_ENV', {
    ...isProduction,
    then: Joi.boolean().valid(false).default(false).messages({
      'any.only': 'AUTH_TEST_LOGIN_ENABLED must be false in production',
    }),
    otherwise: Joi.boolean().default(false),
  }),
  JWT_ACCESS_SECRET: secret('dev-only-access-secret-change-me'),
  JWT_REFRESH_SECRET: secret('dev-only-refresh-secret-change-me'),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
  AUTH_REFRESH_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),
  AUTH_MAX_SESSIONS_PER_STAFF: Joi.number().integer().min(1).max(20).default(5),

  // OTP delivery: 'log' prints codes to the server log (never in production),
  // 'sms_http' calls SMKC's SMS gateway, 'disabled' turns OTP sign-in off.
  OTP_SENDER: Joi.string().when('NODE_ENV', {
    ...isProduction,
    then: Joi.string().valid('sms_http', 'disabled').default('disabled').messages({
      'any.only': 'OTP_SENDER=log is not allowed in production (it writes codes to the log)',
    }),
    otherwise: Joi.string().valid('log', 'sms_http', 'disabled').default('log'),
  }),
  OTP_TTL_SECONDS: Joi.number().integer().min(60).max(900).default(300),
  OTP_MAX_ATTEMPTS: Joi.number().integer().min(1).max(10).default(5),
  OTP_MAX_PER_15_MIN: Joi.number().integer().min(1).max(20).default(3),
  // Not validated as a URI: the {placeholders} are not legal URI characters until filled.
  SMS_GATEWAY_URL: Joi.string()
    .pattern(/^https?:\/\/[^\s]+$/)
    .pattern(/\{phone\}.*\{message\}|\{message\}.*\{phone\}/)
    .when('OTP_SENDER', { is: 'sms_http', then: Joi.required(), otherwise: Joi.optional() })
    .messages({
      'string.pattern.base':
        'SMS_GATEWAY_URL must be an http(s) URL containing {phone} and {message}',
    }),
  SMS_GATEWAY_METHOD: Joi.string().valid('GET', 'POST').default('GET'),
  SMS_OTP_MESSAGE: Joi.string()
    .pattern(/\{otp\}/)
    .default(
      '{otp} is your FieldOps SMKMC login code. Valid for {minutes} minutes. Do not share it.',
    ),
  SMS_SENDER_ID: Joi.string().allow('').default(''),
  SMS_DLT_TEMPLATE_ID: Joi.string().allow('').default(''),
  SMS_TIMEOUT_MS: Joi.number().integer().min(1000).max(30000).default(8000),

  // Requests per minute. Tests get high limits so suites never trip them.
  RATE_LIMIT_PER_MINUTE: Joi.number()
    .integer()
    .min(1)
    .when('NODE_ENV', {
      is: 'test',
      then: Joi.number().default(100000),
      otherwise: Joi.number().default(300),
    }),
  SIGN_IN_RATE_LIMIT_PER_MINUTE: Joi.number()
    .integer()
    .min(1)
    .when('NODE_ENV', {
      is: 'test',
      then: Joi.number().default(100000),
      otherwise: Joi.number().default(30),
    }),
  // Behind IIS / a reverse proxy set to the number of proxy hops (e.g. 1), so client IPs are real.
  // false | true | a hop count | Express address names (e.g. loopback: trust only proxies on
  // this machine, so IIS -> API and IIS -> Next.js -> API both resolve the real client).
  TRUST_PROXY: Joi.string()
    .pattern(
      /^(false|true|\d{1,2}|(loopback|linklocal|uniquelocal)(,(loopback|linklocal|uniquelocal))*)$/,
    )
    .default('false'),

  // Scheduled jobs. Tests run them directly with a frozen clock, so they are off there.
  JOBS_ENABLED: Joi.boolean().when('NODE_ENV', {
    is: 'test',
    then: Joi.boolean().default(false),
    otherwise: Joi.boolean().default(true),
  }),
  // Raw location pings are purged after this many days (SMKC policy); route summaries stay.
  PING_RETENTION_DAYS: Joi.number().integer().min(7).max(365).default(90),
  // Mobile app: builds below the minimum must update before use (Android versionCode).
  MOBILE_MIN_VERSION_CODE: Joi.number().integer().min(1).default(1),
  MOBILE_LATEST_VERSION_CODE: Joi.number()
    .integer()
    .min(Joi.ref('MOBILE_MIN_VERSION_CODE'))
    .default(Joi.ref('MOBILE_MIN_VERSION_CODE')),
  MOBILE_UPDATE_URL: Joi.string()
    .uri({ scheme: ['https', 'http'] })
    .optional(),
  // Photos staff attach (task evidence): kept on this server's disk, never a public cloud.
  UPLOAD_DIR: Joi.string().default('storage/uploads'),
  UPLOAD_MAX_BYTES: Joi.number().integer().min(50_000).max(10_000_000).default(2_000_000),
  // Push through Firebase Cloud Messaging: all three or none (off = in-app inbox + polling).
  FCM_PROJECT_ID: Joi.string().optional(),
  FCM_CLIENT_EMAIL: Joi.string()
    .email()
    .when('FCM_PROJECT_ID', { is: Joi.exist(), then: Joi.required() }),
  FCM_PRIVATE_KEY: Joi.string().when('FCM_PROJECT_ID', { is: Joi.exist(), then: Joi.required() }),
  // SMS / WhatsApp through SMKC's gateway (a JSON POST); off unless a URL is set.
  NOTIFY_SMS_URL: Joi.string()
    .uri({ scheme: ['https', 'http'] })
    .optional(),
  NOTIFY_WHATSAPP_URL: Joi.string()
    .uri({ scheme: ['https', 'http'] })
    .optional(),
  NOTIFY_GATEWAY_TOKEN: Joi.string().optional(),
  // Share of checked-in field staff who get one random spot check per shift (0 = off).
  SPOT_CHECK_DAILY_RATE: Joi.number().min(0).max(1).default(0.3),
  // Proxy punches must carry the worker's rolling QR code (off for the pilot; a code sent is always checked).
  COPRESENCE_REQUIRED: Joi.boolean().default(false),
  // How shift times turn into marks: on time up to the grace, a half day past the percent.
  ATTENDANCE_LATE_GRACE_MINUTES: Joi.number().integer().min(0).max(240).default(15),
  ATTENDANCE_HALF_DAY_AFTER_PERCENT: Joi.number().integer().min(10).max(90).default(50),
  // Offline OSM tile pack (z/x/y.png + manifest.json) served at /tiles; unset = no local tiles.
  TILE_DIR: Joi.string().optional(),
  // Development / test only: the sample seed gives the web roles this password.
  SEED_WEB_PASSWORD: Joi.string().when('NODE_ENV', {
    ...isProduction,
    then: Joi.string().valid('').optional().messages({
      'any.only': 'SEED_WEB_PASSWORD is not allowed in production',
    }),
    otherwise: Joi.string().allow('').min(10).max(72).optional(),
  }),

  // Face verification: 'local' (AuraFace on our server) or 'aadhaar' (UIDAI via SMKC's ASA).
  FACE_PROVIDER: Joi.string().valid('local', 'aadhaar').default('local'),
  // Calibrated in the Phase 2 benchmark; these are starting values only.
  FACE_MATCH_THRESHOLD: Joi.number().min(0).max(1).default(0.45),
  FACE_LIVENESS_THRESHOLD: Joi.number().min(0).max(1).default(0.5),
  // Local face models (see modules/face/README.md); relative paths are from backend/.
  FACE_MODEL_DIR: Joi.string().default('storage/models'),
  FACE_MAX_PARALLEL: Joi.number().integer().min(1).max(32).default(2),
  FACE_THREADS: Joi.number().integer().min(1).max(32).default(2),
  AADHAAR_ENV: Joi.string().valid('P', 'PP').default('PP'),
  AADHAAR_API_VERSION: Joi.string().default('2.5'),
  AADHAAR_PID_VERSION: Joi.string().default('2.0'),
  AADHAAR_LANGUAGE: Joi.string().default('mr'),
  AADHAAR_AUA_CODE: aadhaarRequired(),
  AADHAAR_SUB_AUA_CODE: aadhaarRequired(),
  AADHAAR_LICENSE_KEY: aadhaarRequired(),
  AADHAAR_ASA_LICENSE_KEY: aadhaarRequired(),
  AADHAAR_ASA_URL_TEMPLATE: Joi.string()
    .pattern(/\{ver\}.*\{ac\}.*\{uid0\}.*\{uid1\}.*\{asalk\}/)
    .when('FACE_PROVIDER', { is: 'aadhaar', then: Joi.required(), otherwise: Joi.optional() })
    .messages({
      'string.pattern.base':
        'AADHAAR_ASA_URL_TEMPLATE must contain {ver}, {ac}, {uid0}, {uid1} and {asalk}',
    }),
  AADHAAR_SIGNING_KEY_PATH: aadhaarRequired(),
  AADHAAR_SIGNING_CERT_PATH: aadhaarRequired(),
  AADHAAR_DEVICE_UDC: Joi.string().optional(),
  AADHAAR_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
});

/**
 * Validates raw environment variables and returns typed config.
 * Throws one error listing every problem, so a bad deployment stops at boot.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const { error, value } = schema.validate(raw, {
    abortEarly: false,
    convert: true,
    stripUnknown: true,
  });
  const problems = error ? error.details.map((d) => `- ${d.message}`) : [];
  const env = value as Env;
  // One leaked secret must not forge both kinds of token (the OTP HMAC also uses the refresh one).
  if (env.NODE_ENV === 'production' && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('- JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production');
  }
  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  return env;
}
