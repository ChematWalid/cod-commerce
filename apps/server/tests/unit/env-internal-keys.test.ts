import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../../src/config/env';

const valid = {
  APP_ENV: 'test',
  ROLE: 'api',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://cod:pw@pgbouncer:5432/cod',
  DATABASE_URL_DIRECT: 'postgresql://cod:pw@postgres:5432/cod',
  REDIS_URL: 'redis://valkey:6379',
  COOKIE_SECRET: 'Qm7vXk2LpR9tWc4Zb8NdHf3JsGy6AeUo',
  AUTH_TOKEN_SECRET: 'Vb5nTr8KcXw2MzQj7LhPd4GfSy9EaUo3',
  INTERNAL_HMAC_KEYS: `k1:Hn4wBz9TqXc6MvKe2LrJd7GsPy3FaUo8`,
  TENANT_SECRET_KEKS: `k1:${'0123456789abcdef'.repeat(4)}`,
  TENANT_SECRET_ACTIVE_KID: 'k1',
  AUTH_DASHBOARD_URL: 'https://app.example.test/dashboard',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_FROM: 'no-reply@example.test',
  SUPERADMIN_USERNAME: 'superadmin',
  SUPERADMIN_PASSWORD: 'test-password',
  S3_ENDPOINT: 'http://garage:3900',
  S3_ACCESS_KEY: 'GK' + 'a'.repeat(24),
  S3_SECRET_KEY: 'fedcba9876543210'.repeat(4),
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
    const keys = `k1:Hn4wBz9TqXc6MvKe2LrJd7GsPy3FaUo8,k2:${'w'.repeat(40)}`;

    expect(loadEnv({ ...valid, INTERNAL_HMAC_KEYS: keys }).INTERNAL_HMAC_ACTIVE_KID).toBeUndefined();
    expect(
      loadEnv({ ...valid, INTERNAL_HMAC_KEYS: keys, INTERNAL_HMAC_ACTIVE_KID: 'k2' }).INTERNAL_HMAC_ACTIVE_KID,
    ).toBe('k2');
    expect(issuePaths(failureOf({ INTERNAL_HMAC_KEYS: keys, INTERNAL_HMAC_ACTIVE_KID: 'k9' }))).toEqual([
      'INTERNAL_HMAC_ACTIVE_KID',
    ]);
  });

  it.each(['staging', 'production'])('rejects a placeholder INTERNAL_HMAC_KEYS secret in %s', (appEnv) => {
    const deployed = {
      APP_ENV: appEnv,
      CLIENT_IP_HEADER: 'cf-connecting-ip',
      COOKIE_SECRET: 'Qm7vXk2LpR9tWc4Zb8NdHf3JsGy6AeUo',
    };
    const error = failureOf({
      ...deployed,
      SUPERADMIN_PASSWORD: 'real-admin-pw',
      INTERNAL_HMAC_KEYS: 'k1:change-me-internal-hmac-000000000000000000000',
    });

    expect(issuePaths(error)).toEqual(['INTERNAL_HMAC_KEYS']);
    expect(error.message).not.toContain('change-me-internal-hmac');
  });
});
