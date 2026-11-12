import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../../src/config/env';

const KEK_ONE = '11'.repeat(32);
const KEK_TWO = 'ab'.repeat(32);
const ZEROS = '0'.repeat(64);

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
  TENANT_SECRET_KEKS: `k1:${KEK_ONE}`,
  TENANT_SECRET_ACTIVE_KID: 'k1',
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

describe('loadEnv tenant secret keys', () => {
  it('requires TENANT_SECRET_KEKS for every role', () => {
    for (const role of ['api', 'worker', 'migrate']) {
      expect(issuePaths(failureOf({ ROLE: role, TENANT_SECRET_KEKS: undefined }))).toContain('TENANT_SECRET_KEKS');
    }
  });

  it('requires TENANT_SECRET_ACTIVE_KID', () => {
    // Act and Assert
    expect(issuePaths(failureOf({ TENANT_SECRET_ACTIVE_KID: undefined }))).toEqual(['TENANT_SECRET_ACTIVE_KID']);
  });

  it('reads the ring and the active kid', () => {
    // Act
    const env = loadEnv({
      ...valid,
      TENANT_SECRET_KEKS: `k1:${KEK_ONE},k2:${KEK_TWO}`,
      TENANT_SECRET_ACTIVE_KID: 'k2',
    });

    // Assert
    expect(env.TENANT_SECRET_ACTIVE_KID).toBe('k2');
  });

  it('rejects an active kid that is not in the ring', () => {
    // Act and Assert
    expect(issuePaths(failureOf({ TENANT_SECRET_ACTIVE_KID: 'k9' }))).toEqual(['TENANT_SECRET_ACTIVE_KID']);
  });

  it.each([
    ['a 63-hex key', `k1:${KEK_ONE.slice(1)}`],
    ['a key that is not hex', `k1:${'zz'.repeat(32)}`],
    ['no kid', KEK_ONE],
  ])('rejects %s without printing it', (_name, keks) => {
    // Act
    const error = failureOf({ TENANT_SECRET_KEKS: keks });

    // Assert
    expect(issuePaths(error)).toContain('TENANT_SECRET_KEKS');
    expect(error.message).not.toContain(KEK_ONE.slice(1));
    expect(error.message).not.toContain('zzzz');
  });

  it('refuses a kid that reads as a job continuation, naming it, and accepts k2', () => {
    // Act
    const error = failureOf({ TENANT_SECRET_KEKS: `r2:${KEK_ONE}`, TENANT_SECRET_ACTIVE_KID: 'r2' });
    const env = loadEnv({ ...valid, TENANT_SECRET_KEKS: `k2:${KEK_ONE}`, TENANT_SECRET_ACTIVE_KID: 'k2' });

    // Assert
    expect(issuePaths(error)).toContain('TENANT_SECRET_KEKS');
    expect(error.message).toContain('r2');
    expect(env.TENANT_SECRET_ACTIVE_KID).toBe('k2');
  });

  it.each(['staging', 'production'])('rejects an all-zero placeholder KEK in %s', (appEnv) => {
    // Arrange
    const deployed = {
      APP_ENV: appEnv,
      CLIENT_IP_HEADER: 'cf-connecting-ip',
      COOKIE_SECRET: 'k'.repeat(40),
      SUPERADMIN_PASSWORD: 'real-admin-pw',
    };

    // Act
    const error = failureOf({ ...deployed, TENANT_SECRET_KEKS: `k1:${ZEROS}` });

    // Assert
    expect(issuePaths(error)).toEqual(['TENANT_SECRET_KEKS']);
    expect(error.message).not.toContain(ZEROS);
  });

  it('flags a placeholder among several keys in production, and accepts real keys', () => {
    // Arrange
    const deployed = {
      APP_ENV: 'production',
      CLIENT_IP_HEADER: 'cf-connecting-ip',
      COOKIE_SECRET: 'k'.repeat(40),
      SUPERADMIN_PASSWORD: 'real-admin-pw',
    };

    // Act and Assert
    expect(issuePaths(failureOf({ ...deployed, TENANT_SECRET_KEKS: `k1:${KEK_ONE},k2:${ZEROS}` }))).toEqual([
      'TENANT_SECRET_KEKS',
    ]);
    expect(() =>
      loadEnv({
        ...valid,
        ...deployed,
        TENANT_SECRET_KEKS: `k1:${KEK_ONE},k2:${KEK_TWO}`,
        TENANT_SECRET_ACTIVE_KID: 'k2',
      }),
    ).not.toThrow();
  });

  it('accepts the placeholder outside staging and production', () => {
    // Act and Assert
    expect(() => loadEnv({ ...valid, APP_ENV: 'development', TENANT_SECRET_KEKS: `k1:${ZEROS}` })).not.toThrow();
  });
});
