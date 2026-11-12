import { createHash } from 'node:crypto';

/**
 * Synthetic environments for the server's config tests. The secrets are built at runtime from a fixed seed rather
 * than written out: a secret-shaped literal trips secret scanners, and hand-typed copies drifted across files. Every
 * value is the same on every run, and every secret has as many different characters as its length allows, so it
 * passes the deployed strength rule (SRV-8) unless a test weakens it on purpose.
 */
const FIXTURE_SEED = 'cod-server-env-fixture';
const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const HEX_DIGITS = '0123456789abcdef';
const HEX_KEY_LENGTH = 64;
const SECRET_LENGTH = 32;
/** Long enough for the deployed SUPERADMIN_PASSWORD minimum (12), with room to spare. */
const DEPLOYED_PASSWORD_LENGTH = 14;

const rankOf = (label: string, symbol: string): string =>
  createHash('sha256').update(`${FIXTURE_SEED}:${label}:${symbol}`).digest('hex');

/** The symbols of `alphabet`, each once, in an order fixed by `label`. */
function shuffled(alphabet: string, label: string): string {
  return Array.from(alphabet)
    .map((symbol) => ({ symbol, rank: rankOf(label, symbol) }))
    .sort((left, right) => (left.rank < right.rank ? -1 : 1))
    .map(({ symbol }) => symbol)
    .join('');
}

/**
 * A mixed-case alphanumeric secret of `length` characters, none repeated.
 * @throws RangeError when `length` exceeds the 62 symbols, past which characters would repeat.
 */
export function syntheticSecret(label: string, length = SECRET_LENGTH): string {
  if (length > ALPHANUMERIC.length) {
    throw new RangeError(`a synthetic secret has at most ${String(ALPHANUMERIC.length)} characters`);
  }
  return shuffled(ALPHANUMERIC, label).slice(0, length);
}

/** A lowercase hex key; each 16-character block holds all sixteen digits. */
export function syntheticHex(label: string, length = HEX_KEY_LENGTH): string {
  let hex = '';
  for (let block = 0; hex.length < length; block += 1) {
    hex += shuffled(HEX_DIGITS, `${label}#${String(block)}`);
  }
  return hex.slice(0, length);
}

/** A password a person might type, of exactly `length` distinct characters. */
export const syntheticPassword = (length: number): string => syntheticSecret(`password-${String(length)}`, length);

/** The tenant key-encryption keys the rotation tests move between. */
export const KEK_ONE = syntheticHex('tenant-kek-1');
export const KEK_TWO = syntheticHex('tenant-kek-2');

/** A SUPERADMIN_PASSWORD that staging and production accept. */
export const DEPLOYED_PASSWORD = syntheticPassword(DEPLOYED_PASSWORD_LENGTH);

/** The secrets every valid environment carries, each strong enough for staging and production. */
export const STRONG_SECRETS = {
  COOKIE_SECRET: syntheticSecret('cookie-secret'),
  AUTH_TOKEN_SECRET: syntheticSecret('auth-token-secret'),
  INTERNAL_HMAC_KEYS: `k1:${syntheticSecret('internal-hmac-k1')}`,
  TENANT_SECRET_KEKS: `k1:${KEK_ONE}`,
  S3_SECRET_KEY: syntheticHex('s3-secret-key'),
} as const;

/** What every role needs, without the settings a deployment adds: the base the deployment tests build on. */
export const CORE_ENV = {
  APP_ENV: 'test',
  ROLE: 'api',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://cod:pw@pgbouncer:5432/cod',
  DATABASE_URL_DIRECT: 'postgresql://cod:pw@postgres:5432/cod',
  REDIS_URL: 'redis://valkey:6379',
  ...STRONG_SECRETS,
  TENANT_SECRET_ACTIVE_KID: 'k1',
  SUPERADMIN_USERNAME: 'superadmin',
  SUPERADMIN_PASSWORD: 'test-password',
  S3_ENDPOINT: 'http://garage:3900',
  S3_ACCESS_KEY: `GK${'a'.repeat(24)}`,
  S3_BUCKET_PRIVATE: 'cod-private',
} as const;

/** A valid environment outside staging and production. */
export const TEST_ENV = {
  ...CORE_ENV,
  AUTH_DASHBOARD_URL: 'https://app.example.test/dashboard',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_FROM: 'no-reply@example.test',
  PLATFORM_DOMAIN: 'souk.example.dz',
} as const;

/** What staging and production need on top of {@link TEST_ENV}: the client IP header and a long enough password. */
export const DEPLOYED_OVERRIDES = {
  CLIENT_IP_HEADER: 'cf-connecting-ip',
  SUPERADMIN_PASSWORD: DEPLOYED_PASSWORD,
} as const;
