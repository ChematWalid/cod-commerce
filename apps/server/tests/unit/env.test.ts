import { describe, expect, it } from 'vitest';
import { EnvValidationError, isPlaceholderSecret, loadEnv, PLACEHOLDER_SECRET_MARKER } from '../../src/config/env';

const valid = {
  APP_ENV: 'test',
  ROLE: 'api',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://cod:pw@pgbouncer:5432/cod',
  DATABASE_URL_DIRECT: 'postgresql://cod:pw@postgres:5432/cod',
  REDIS_URL: 'redis://valkey:6379',
  COOKIE_SECRET: 'x'.repeat(32),
  SUPERADMIN_USERNAME: 'superadmin',
  SUPERADMIN_PASSWORD: 'test-password',
  S3_ENDPOINT: 'http://garage:3900',
  S3_ACCESS_KEY: 'GK' + 'a'.repeat(24),
  S3_SECRET_KEY: 'b'.repeat(64),
  S3_BUCKET_PRIVATE: 'cod-private',
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

describe('loadEnv', () => {
  it('applies port and pool defaults for the api role', () => {
    expect(loadEnv(valid)).toMatchObject({
      API_PORT: 3000,
      WORKER_HEALTH_PORT: 3020,
      DB_POOL_MAX: 10,
      WORKER_ACTIVE_QUEUES: [],
      CORS_ORIGINS: [],
    });
  });

  it('sizes the pool per role', () => {
    expect(loadEnv({ ...valid, ROLE: 'worker' }).DB_POOL_MAX).toBe(5);
    expect(loadEnv({ ...valid, ROLE: 'migrate' }).DB_POOL_MAX).toBe(2);
    expect(loadEnv({ ...valid, DB_POOL_MAX: '25' }).DB_POOL_MAX).toBe(25);
  });

  it('honours port overrides', () => {
    expect(loadEnv({ ...valid, API_PORT: '3100' }).API_PORT).toBe(3100);
  });

  it('splits WORKER_ACTIVE_QUEUES', () => {
    expect(loadEnv({ ...valid, WORKER_ACTIVE_QUEUES: 'a, b' }).WORKER_ACTIVE_QUEUES).toEqual(['a', 'b']);
  });

  it('treats an empty WORKER_ACTIVE_QUEUES as all queues', () => {
    expect(loadEnv({ ...valid, WORKER_ACTIVE_QUEUES: '' }).WORKER_ACTIVE_QUEUES).toEqual([]);
  });

  it('rejects a non-UTC TZ', () => {
    expect(issuePaths(failureOf({ TZ: 'Europe/Paris' }))).toContain('TZ');
  });

  it('accepts only the log levels Vendure knows', () => {
    expect(loadEnv({ ...valid, LOG_LEVEL: 'debug' }).LOG_LEVEL).toBe('debug');
    expect(issuePaths(failureOf({ LOG_LEVEL: 'trace' }))).toContain('LOG_LEVEL');
  });

  it('rejects ROLE=storefront and a missing DATABASE_URL_DIRECT', () => {
    const paths = issuePaths(failureOf({ ROLE: 'storefront', DATABASE_URL_DIRECT: undefined }));

    expect(paths).toEqual(expect.arrayContaining(['ROLE', 'DATABASE_URL_DIRECT']));
  });

  it('applies S3 defaults and rejects a non-Garage key id', () => {
    expect(loadEnv(valid)).toMatchObject({ S3_REGION: 'garage', S3_FORCE_PATH_STYLE: true });
    expect(issuePaths(failureOf({ S3_ACCESS_KEY: 'AKIA123' }))).toContain('S3_ACCESS_KEY');
  });

  it('never echoes secret values', () => {
    const error = failureOf({ COOKIE_SECRET: 'short-secret' });

    expect(issuePaths(error)).toContain('COOKIE_SECRET');
    expect(error.message).not.toContain('short-secret');
  });

  it('rejects a database URL that a reserved character in the password broke (RF5)', () => {
    const error = failureOf({ DATABASE_URL_DIRECT: 'postgresql://cod:p@ss/w:rd@postgres:5432/cod' });

    expect(issuePaths(error)).toContain('DATABASE_URL_DIRECT');
    expect(error.message).not.toContain('p@ss');
  });

  it.each(['staging', 'production'])('rejects placeholder secrets in %s (M4)', (appEnv) => {
    const placeholders = {
      COOKIE_SECRET: `${PLACEHOLDER_SECRET_MARKER}-${'0'.repeat(54)}`,
      SUPERADMIN_PASSWORD: 'change-me-admin',
      S3_SECRET_KEY: '0'.repeat(64),
      S3_ACCESS_KEY: `GK${'0'.repeat(24)}`,
      DATABASE_URL: 'postgresql://cod:change-me-pg@pgbouncer:5432/cod',
      DATABASE_URL_DIRECT: 'postgresql://cod:change-me-pg@postgres:5432/cod',
    };
    const error = failureOf({ APP_ENV: appEnv, ...placeholders });

    expect(issuePaths(error).sort()).toEqual(Object.keys(placeholders).sort());
    expect(error.message).not.toContain('change-me-pg');
  });

  it('accepts the same placeholder secrets in development', () => {
    expect(
      loadEnv({
        ...valid,
        APP_ENV: 'development',
        COOKIE_SECRET: 'change-me-' + '0'.repeat(54),
        S3_SECRET_KEY: '0'.repeat(64),
      }),
    ).toMatchObject({ APP_ENV: 'development' });
  });
});

describe('isPlaceholderSecret', () => {
  it.each(['change-me-pg', '0'.repeat(64), `GK${'0'.repeat(24)}`])('flags %s', (value) => {
    expect(isPlaceholderSecret(value)).toBe(true);
  });

  it.each(['b'.repeat(64), `GK${'a'.repeat(24)}`, 'test-password'])('accepts %s', (value) => {
    expect(isPlaceholderSecret(value)).toBe(false);
  });
});
