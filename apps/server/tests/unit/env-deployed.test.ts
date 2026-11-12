import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../../src/config/env';

/** A valid environment that is not deployed; each test sets APP_ENV itself. */
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
  TENANT_SECRET_KEKS: `k1:${'1'.repeat(64)}`,
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

describe('loadEnv in a deployed environment', () => {
  it.each(['staging', 'production'])('requires CLIENT_IP_HEADER in %s (RL-4)', (appEnv) => {
    const deployed = { APP_ENV: appEnv, COOKIE_SECRET: 'k'.repeat(40), SUPERADMIN_PASSWORD: 'real-admin-pw' };

    expect(issuePaths(failureOf({ ...deployed, CLIENT_IP_HEADER: undefined }))).toEqual(['CLIENT_IP_HEADER']);
    expect(loadEnv({ ...valid, ...deployed, CLIENT_IP_HEADER: 'cf-connecting-ip' }).CLIENT_IP_HEADER).toBe(
      'cf-connecting-ip',
    );
  });

  it.each(['development', 'test'])('leaves CLIENT_IP_HEADER optional in %s', (appEnv) => {
    expect(loadEnv({ ...valid, APP_ENV: appEnv }).CLIENT_IP_HEADER).toBe('');
  });
});
