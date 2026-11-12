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

describe('loadEnv', () => {
  it('requires APP_ENV, with no default (SRV-3)', () => {
    expect(issuePaths(failureOf({ APP_ENV: undefined }))).toEqual(['APP_ENV']);
  });

  it('applies port and pool defaults for the api role', () => {
    expect(loadEnv(valid)).toMatchObject({
      API_PORT: 3000,
      WORKER_HEALTH_PORT: 3020,
      DB_POOL_MAX: 10,
      WORKER_POOL: 'all',
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

  it('reads WORKER_POOL and refuses an unknown pool', () => {
    expect(loadEnv({ ...valid, WORKER_POOL: 'bulk' }).WORKER_POOL).toBe('bulk');
    expect(issuePaths(failureOf({ WORKER_POOL: 'llm' }))).toContain('WORKER_POOL');
  });

  it('refuses a non-empty WORKER_ACTIVE_QUEUES, which WORKER_POOL replaced', () => {
    const error = failureOf({ WORKER_ACTIVE_QUEUES: 'q1' });

    expect(error.issues).toContainEqual({ path: 'WORKER_ACTIVE_QUEUES', message: 'replaced by WORKER_POOL' });
  });

  it('accepts an empty WORKER_ACTIVE_QUEUES, so an old .env still boots', () => {
    expect(loadEnv({ ...valid, WORKER_ACTIVE_QUEUES: '' }).WORKER_POOL).toBe('all');
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

  it.each(['redis://:s3cret@valkey:6379/abc', 'redis://:s3cret@valkey:6379/-1', 'redis://:s3cret@valkey:6379/0/1'])(
    'rejects a REDIS_URL whose path is not a database index (%s)',
    (url) => {
      const error = failureOf({ REDIS_URL: url });

      expect(issuePaths(error)).toContain('REDIS_URL');
      expect(error.message).not.toContain('s3cret');
    },
  );

  it('accepts a REDIS_URL with a database index', () => {
    expect(loadEnv({ ...valid, REDIS_URL: 'redis://valkey:6379/2' }).REDIS_URL).toBe('redis://valkey:6379/2');
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
    const error = failureOf({ APP_ENV: appEnv, CLIENT_IP_HEADER: 'cf-connecting-ip', ...placeholders });

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

  it.each(['staging', 'production'])('requires PLATFORM_DOMAIN in %s', (appEnv) => {
    expect(
      issuePaths(failureOf({ APP_ENV: appEnv, PLATFORM_DOMAIN: undefined, CLIENT_IP_HEADER: 'cf-connecting-ip' })),
    ).toEqual(['PLATFORM_DOMAIN']);
  });

  it.each([
    'localhost',
    'app.localhost',
    'platform.invalid',
    'example.test',
    'souk-1.example.dz',
    `${'a'.repeat(63)}.example.test`,
  ])('accepts %s as PLATFORM_DOMAIN', (domain) => {
    expect(loadEnv({ ...valid, PLATFORM_DOMAIN: domain }).PLATFORM_DOMAIN).toBe(domain);
  });

  it.each([
    ['uppercase', 'Example.test'],
    ['port', 'example.test:3000'],
    ['trailing dot', 'example.test.'],
    ['leading dot', '.example.test'],
    ['empty label', 'example..test'],
    ['label starting with a hyphen', '-a.example.test'],
    ['label ending with a hyphen', 'a-.example.test'],
    ['label over 63 characters', `${'a'.repeat(64)}.example.test`],
    ['name over 253 characters', Array.from({ length: 64 }, () => 'abc').join('.') + '.example.test'],
    ['scheme', 'https://example.test'],
    ['wildcard', '*.localhost'],
    ['underscore', 'a_b.example.test'],
  ])('rejects PLATFORM_DOMAIN with %s', (_label, domain) => {
    expect(issuePaths(failureOf({ PLATFORM_DOMAIN: domain }))).toEqual(['PLATFORM_DOMAIN']);
  });

  it('reads the client address header, empty by default', () => {
    expect(loadEnv(valid).CLIENT_IP_HEADER).toBe('');
    expect(loadEnv({ ...valid, CLIENT_IP_HEADER: 'cf-connecting-ip' }).CLIENT_IP_HEADER).toBe('cf-connecting-ip');
    expect(loadEnv({ ...valid, CLIENT_IP_HEADER: '' }).CLIENT_IP_HEADER).toBe('');
  });

  it.each(['cf connecting ip', 'x-real-ip: 1.2.3.4', 'a\nb'])('rejects %j as CLIENT_IP_HEADER', (header) => {
    expect(issuePaths(failureOf({ CLIENT_IP_HEADER: header }))).toEqual(['CLIENT_IP_HEADER']);
  });

  it('requires an AUTH_TOKEN_SECRET of at least 32 characters', () => {
    expect(issuePaths(failureOf({ AUTH_TOKEN_SECRET: undefined }))).toEqual(['AUTH_TOKEN_SECRET']);
    expect(issuePaths(failureOf({ AUTH_TOKEN_SECRET: 'too-short' }))).toEqual(['AUTH_TOKEN_SECRET']);
  });

  it('rejects a placeholder AUTH_TOKEN_SECRET in staging', () => {
    const staging = {
      APP_ENV: 'staging',
      CLIENT_IP_HEADER: 'cf-connecting-ip',
      COOKIE_SECRET: 'k'.repeat(40),
      SUPERADMIN_PASSWORD: 'real-admin-pw',
    };

    expect(issuePaths(failureOf({ ...staging, AUTH_TOKEN_SECRET: `change-me-${'0'.repeat(40)}` }))).toEqual([
      'AUTH_TOKEN_SECRET',
    ]);
  });

  it.each(['AUTH_DASHBOARD_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'])('requires %s when deployed', (name) => {
    const staging = {
      APP_ENV: 'staging',
      CLIENT_IP_HEADER: 'cf-connecting-ip',
      COOKIE_SECRET: 'k'.repeat(40),
      SUPERADMIN_PASSWORD: 'real-admin-pw',
    };

    expect(issuePaths(failureOf({ ...staging, [name]: undefined }))).toEqual([name]);
  });

  it('falls back to the local mail and dashboard addresses in development', () => {
    const env = loadEnv({
      ...valid,
      APP_ENV: 'development',
      AUTH_DASHBOARD_URL: undefined,
      SMTP_HOST: undefined,
      SMTP_PORT: undefined,
      SMTP_FROM: undefined,
    });

    expect(env).toMatchObject({
      AUTH_DASHBOARD_URL: 'http://localhost:3100/dashboard',
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1026,
      SMTP_FROM: 'no-reply@localhost',
    });
  });

  it('keeps oauth and the challenge off by default', () => {
    expect(loadEnv(valid)).toMatchObject({ AUTH_OAUTH_ENABLED: false, TURNSTILE_ENABLED: false });
  });

  it('requires the provider credentials when oauth is on', () => {
    expect(issuePaths(failureOf({ AUTH_OAUTH_ENABLED: 'true' })).sort()).toEqual([
      'FACEBOOK_OAUTH_CLIENT_ID',
      'FACEBOOK_OAUTH_CLIENT_SECRET',
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
    ]);
  });

  it('requires the secret and the page when the challenge is on', () => {
    expect(issuePaths(failureOf({ TURNSTILE_ENABLED: 'true' })).sort()).toEqual([
      'TURNSTILE_CHALLENGE_URL',
      'TURNSTILE_SECRET_KEY',
    ]);
  });

  it('defaults PLATFORM_DOMAIN to localhost in development', () => {
    expect(loadEnv({ ...valid, APP_ENV: 'development', PLATFORM_DOMAIN: undefined }).PLATFORM_DOMAIN).toBe('localhost');
  });

  it('accepts a reserved SNOWFLAKE_WORKER_ID when APP_ENV is test', () => {
    expect(loadEnv({ ...valid, APP_ENV: 'test', SNOWFLAKE_WORKER_ID: '1000' }).SNOWFLAKE_WORKER_ID).toBe(1000);
  });

  it('rejects SNOWFLAKE_WORKER_ID outside tests', () => {
    const error = failureOf({ APP_ENV: 'development', SNOWFLAKE_WORKER_ID: '1000' });

    expect(issuePaths(error)).toEqual(['SNOWFLAKE_WORKER_ID']);
  });

  it('rejects a SNOWFLAKE_WORKER_ID outside the reserved range', () => {
    expect(issuePaths(failureOf({ APP_ENV: 'test', SNOWFLAKE_WORKER_ID: '999' }))).toEqual(['SNOWFLAKE_WORKER_ID']);
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
