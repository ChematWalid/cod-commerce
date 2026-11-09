import { InvalidDatabaseUrlError, RESERVED_WORKER_ID_MAX, RESERVED_WORKER_ID_MIN, toPostgresFields } from '@cod/shared';
import { z } from 'zod';
import { DEFAULT_API_PORT, DEFAULT_WORKER_HEALTH_PORT } from './ports';
import { InvalidRedisUrlError, redisOptionsFromUrl } from './redis-url';

/** The process roles of the one server image. */
export const SERVER_ROLES = ['api', 'worker', 'migrate'] as const;

/** One of the {@link SERVER_ROLES}. */
export type ServerRole = (typeof SERVER_ROLES)[number];

const APP_ENVS = ['development', 'test', 'staging', 'production'] as const;

/** The log levels `LOG_LEVEL` accepts, mapped one to one onto Vendure's. */
export const LOG_LEVELS = ['error', 'warn', 'info', 'verbose', 'debug'] as const;

/** One of the {@link LOG_LEVELS}. */
export type LogLevelName = (typeof LOG_LEVELS)[number];

/** Environments in which a placeholder secret is a misconfiguration. */
const PLACEHOLDER_FORBIDDEN_ENVS: readonly string[] = ['staging', 'production'];

/** Placeholder secrets in `.env.example` carry this marker, or are all zeros where the value is hex. */
export const PLACEHOLDER_SECRET_MARKER = 'change-me';

const ZERO_HEX_PLACEHOLDER = /^(GK)?0+$/;

/** True for a value taken from `.env.example`: it has the marker, or its hex part is all zeros. */
export function isPlaceholderSecret(value: string): boolean {
  return value.includes(PLACEHOLDER_SECRET_MARKER) || ZERO_HEX_PLACEHOLDER.test(value);
}

/** Connections each role keeps open per process unless `DB_POOL_MAX` says otherwise. */
const DEFAULT_POOL_MAX_BY_ROLE = { api: 10, worker: 5, migrate: 2 } as const satisfies Record<ServerRole, number>;

const MAX_PORT = 65535;
const MIN_COOKIE_SECRET_LENGTH = 32;
const MIN_SUPERADMIN_PASSWORD_LENGTH = 8;
const DEFAULT_LOG_LEVEL: LogLevelName = 'info';
const DEFAULT_S3_REGION = 'garage';
const DEFAULT_PLATFORM_DOMAIN = 'localhost';

const POSTGRES_URL_SCHEME = /^postgres(ql)?:\/\//;
const GARAGE_ACCESS_KEY = /^GK[0-9a-f]{24}$/;
const GARAGE_SECRET_KEY = /^[0-9a-f]{64}$/;
/** Lowercase DNS labels of 1-63 characters, dot-separated: no port, no trailing dot. */
const DNS_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const DNS_NAME_MAX_LENGTH = 253;
/** An HTTP header field name (RFC 9110 token, restricted to the characters real headers use). */
const HEADER_NAME = /^[A-Za-z0-9-]+$/;

const port = (fallback: number): z.ZodDefault<z.ZodCoercedNumber> =>
  z.coerce.number().int().min(1).max(MAX_PORT).default(fallback);

const splitCsv = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');

const csvList = z.string().default('').transform(splitCsv);

/** A refinement that reports `parse`'s typed error as an issue; any other error is a bug and propagates. */
function parsedBy(
  parse: (url: string) => unknown,
  errorType: new (reason: string) => Error,
): (url: string, context: z.RefinementCtx) => void {
  return (url, context) => {
    try {
      parse(url);
    } catch (error) {
      if (!(error instanceof errorType)) {
        throw error;
      }
      context.addIssue({ code: 'custom', message: error.message });
    }
  };
}

/** The messages never repeat the URL: it can hold the password. */
const databaseUrl = z
  .string()
  .regex(POSTGRES_URL_SCHEME, 'must be a postgres:// or postgresql:// URL')
  .superRefine(parsedBy(toPostgresFields, InvalidDatabaseUrlError));

const redisUrl = z.string().superRefine(parsedBy(redisOptionsFromUrl, InvalidRedisUrlError));

const baseSchema = z.object({
  APP_ENV: z.enum(APP_ENVS).default('development'),
  ROLE: z.enum(SERVER_ROLES),
  TZ: z.literal('UTC', { error: 'must be UTC' }),
  DATABASE_URL: databaseUrl,
  DATABASE_URL_DIRECT: databaseUrl,
  DB_POOL_MAX: z.coerce.number().int().min(1).optional(),
  REDIS_URL: redisUrl,
  WORKER_ACTIVE_QUEUES: csvList,
  API_PORT: port(DEFAULT_API_PORT),
  WORKER_HEALTH_PORT: port(DEFAULT_WORKER_HEALTH_PORT),
  COOKIE_SECRET: z.string().min(MIN_COOKIE_SECRET_LENGTH),
  SUPERADMIN_USERNAME: z.string().min(1),
  SUPERADMIN_PASSWORD: z.string().min(MIN_SUPERADMIN_PASSWORD_LENGTH),
  S3_ENDPOINT: z.string().min(1),
  S3_BUCKET_PRIVATE: z.string().min(1),
  S3_ACCESS_KEY: z.string().regex(GARAGE_ACCESS_KEY, 'must be a Garage key id: GK followed by 24 hex characters'),
  S3_SECRET_KEY: z.string().regex(GARAGE_SECRET_KEY, 'must be 64 hex characters'),
  S3_REGION: z.string().min(1).default(DEFAULT_S3_REGION),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  CORS_ORIGINS: csvList,
  LOG_LEVEL: z.enum(LOG_LEVELS).default(DEFAULT_LOG_LEVEL),
  PLATFORM_DOMAIN: z.string().max(DNS_NAME_MAX_LENGTH).regex(DNS_NAME, 'must be a lowercase DNS name').optional(),
  // The request header that carries the client address behind the edge (`cf-connecting-ip`); blank uses `req.ip`,
  // which behind the edge is the edge's own address (production must set it).
  CLIENT_IP_HEADER: z.string().max(DNS_NAME_MAX_LENGTH).regex(HEADER_NAME, 'must be an HTTP header name').default(''),
  DEMO_OWNER_PASSWORD: z.string().min(MIN_SUPERADMIN_PASSWORD_LENGTH).optional(),
  SNOWFLAKE_WORKER_ID: z.coerce.number().int().min(RESERVED_WORKER_ID_MIN).max(RESERVED_WORKER_ID_MAX).optional(),
});

type BaseEnv = z.infer<typeof baseSchema>;

const PLACEHOLDER_MESSAGE = 'is a placeholder from .env.example; set a real secret';

/** The password of a database URL, or undefined when the URL is malformed (its own issue reports that). */
function passwordOf(url: string): string | undefined {
  try {
    return toPostgresFields(url).password;
  } catch (error) {
    if (error instanceof InvalidDatabaseUrlError) {
      return undefined;
    }
    throw error;
  }
}

function secretsOf(env: BaseEnv): [name: string, value: string | undefined][] {
  return [
    ['COOKIE_SECRET', env.COOKIE_SECRET],
    ['SUPERADMIN_PASSWORD', env.SUPERADMIN_PASSWORD],
    ['DEMO_OWNER_PASSWORD', env.DEMO_OWNER_PASSWORD],
    ['S3_SECRET_KEY', env.S3_SECRET_KEY],
    ['S3_ACCESS_KEY', env.S3_ACCESS_KEY],
    ['DATABASE_URL', passwordOf(env.DATABASE_URL)],
    ['DATABASE_URL_DIRECT', passwordOf(env.DATABASE_URL_DIRECT)],
  ];
}

function rejectPlaceholders(env: BaseEnv, context: z.RefinementCtx): void {
  if (!PLACEHOLDER_FORBIDDEN_ENVS.includes(env.APP_ENV)) {
    return;
  }
  for (const [name, value] of secretsOf(env)) {
    if (value !== undefined && isPlaceholderSecret(value)) {
      context.addIssue({ code: 'custom', path: [name], message: PLACEHOLDER_MESSAGE });
    }
  }
}

/** Behind the edge `req.ip` is the edge's address, so a production limiter without the header has one bucket for everyone. */
function requireClientIpHeader(env: BaseEnv, context: z.RefinementCtx): void {
  if (env.APP_ENV === 'production' && env.CLIENT_IP_HEADER === '') {
    context.addIssue({ code: 'custom', path: ['CLIENT_IP_HEADER'], message: 'is required in production' });
  }
}

/** A deployed server must know its real domain, and only tests may skip the worker id lease (ADR 0003). */
function rejectUnsafeTenancySettings(env: BaseEnv, context: z.RefinementCtx): void {
  if (PLACEHOLDER_FORBIDDEN_ENVS.includes(env.APP_ENV) && env.PLATFORM_DOMAIN === undefined) {
    context.addIssue({ code: 'custom', path: ['PLATFORM_DOMAIN'], message: 'is required in this environment' });
  }
  if (env.APP_ENV !== 'test' && env.SNOWFLAKE_WORKER_ID !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['SNOWFLAKE_WORKER_ID'],
      message: 'is only allowed when APP_ENV is test',
    });
  }
}

const envSchema = baseSchema
  .superRefine(rejectPlaceholders)
  .superRefine(rejectUnsafeTenancySettings)
  .superRefine(requireClientIpHeader)
  .transform((env) => ({
    ...env,
    PLATFORM_DOMAIN: env.PLATFORM_DOMAIN ?? DEFAULT_PLATFORM_DOMAIN,
    DB_POOL_MAX: env.DB_POOL_MAX ?? DEFAULT_POOL_MAX_BY_ROLE[env.ROLE],
  }));

/** The validated, typed environment of the server. */
export type AppEnv = z.infer<typeof envSchema>;

/** The environment is invalid. The issues carry variable names and rules, never values. */
export class EnvValidationError extends Error {
  readonly issues: { path: string; message: string }[];

  constructor(issues: { path: string; message: string }[]) {
    super(`Invalid environment:\n${issues.map((issue) => `  ${issue.path}: ${issue.message}`).join('\n')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

/** A blank variable counts as unset, so `KEY=` in a `.env` file falls back to the default. */
const withoutBlanks = (source: NodeJS.ProcessEnv): NodeJS.ProcessEnv =>
  Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));

/**
 * Validates `source` and returns the typed environment. This is the only module that reads `process.env`.
 *
 * @throws {EnvValidationError} listing every invalid variable.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = envSchema.safeParse(withoutBlanks(source));
  if (result.success) {
    return result.data;
  }
  throw new EnvValidationError(
    result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  );
}
