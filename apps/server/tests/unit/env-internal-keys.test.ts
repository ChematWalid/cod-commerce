import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../../src/config/env';

const valid = {
  APP_ENV: 'test',
  ROLE: 'api',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://cod:pw@pgbouncer:5432/cod',
  DATABASE_URL_DIRECT: 'postgresql://cod:pw@postgres:5432/cod',
  REDIS_URL: 'redis://valkey:6379',
  COOKIE_SECRET: 'x'.repeat(32),
  AUTH_TOKEN_SECRET: 'y'.repeat(32),
  INTERNAL_HMAC_KEYS: `k1:${'z'.repeat(40)}`,
  AUTH_DASHBOARD_URL: 'https://app.example.test/dashboard',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_FROM: 'no-reply@example.test',
  SUPERADMIN_USERNAME: 'superadmin',
  SUPERADMIN_PASSWORD: 'test-password',
  S3_ENDPOINT: 'http://garage:3900',
  S3_ACCESS_KEY: 'GK' + 'a'.repeat(24),
  S3_SECRET_KEY: 'b'.repeat(64),
  S3_BUCKET_PRIVATE: 'cod-private',
  PLATFORM_DOMAIN: 'example.test',
};

function failureOf(overrides: Record<string, string | undefined>): EnvValidationError {
  try {
    loadEnv({ ...valid, ...overrides });
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return error;
    }
    throw error;
  }
  throw new Error('loadEnv accepted an invalid environment');
}

const issuePaths = (error: EnvValidationError): string[] => error.issues.map((issue) => issue.path);

describe('loadEnv internal HMAC keys', () => {
  it('requires INTERNAL_HMAC_KEYS for every role', () => {
    for (const role of ['api', 'worker', 'migrate']) {
      expect(issuePaths(failureOf({ ROLE: role, INTERNAL_HMAC_KEYS: undefined }))).toEqual(['INTERNAL_HMAC_KEYS']);
    }
  });

  it('rejects malformed INTERNAL_HMAC_KEYS without printing the secret', () => {
    const error = failureOf({ INTERNAL_HMAC_KEYS: 'k1:tooshort-secret' });

    expect(issuePaths(error)).toEqual(['INTERNAL_HMAC_KEYS']);
    expect(error.message).not.toContain('tooshort-secret');
  });

  it('parses INTERNAL_HMAC_ACTIVE_KID as optional and as one of the kids', () => {
    const keys = `k1:${'z'.repeat(40)},k2:${'w'.repeat(40)}`;

    expect(loadEnv({ ...valid, INTERNAL_HMAC_KEYS: keys }).INTERNAL_HMAC_ACTIVE_KID).toBeUndefined();
    expect(
      loadEnv({ ...valid, INTERNAL_HMAC_KEYS: keys, INTERNAL_HMAC_ACTIVE_KID: 'k2' }).INTERNAL_HMAC_ACTIVE_KID,
    ).toBe('k2');
    expect(issuePaths(failureOf({ INTERNAL_HMAC_KEYS: keys, INTERNAL_HMAC_ACTIVE_KID: 'k9' }))).toEqual([
      'INTERNAL_HMAC_ACTIVE_KID',
    ]);
  });

  it.each(['staging', 'production'])('rejects a placeholder INTERNAL_HMAC_KEYS secret in %s', (appEnv) => {
    const deployed = { APP_ENV: appEnv, CLIENT_IP_HEADER: 'cf-connecting-ip', COOKIE_SECRET: 'k'.repeat(40) };
    const error = failureOf({
      ...deployed,
      SUPERADMIN_PASSWORD: 'real-admin-pw',
      INTERNAL_HMAC_KEYS: 'k1:change-me-internal-hmac-000000000000000000000',
    });

    expect(issuePaths(error)).toEqual(['INTERNAL_HMAC_KEYS']);
    expect(error.message).not.toContain('change-me-internal-hmac');
  });
});
