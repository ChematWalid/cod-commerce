import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../../src/config/env';

const KEK_ONE = '0123456789abcdef'.repeat(4);

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

describe('loadEnv PLATFORM_DEMO_HANDLERS', () => {
  it('is off by default', () => {
    expect(loadEnv(valid).PLATFORM_DEMO_HANDLERS).toBe(false);
  });

  it('treats a blank value as off', () => {
    expect(loadEnv({ ...valid, PLATFORM_DEMO_HANDLERS: '' }).PLATFORM_DEMO_HANDLERS).toBe(false);
  });

  it.each(['development', 'test'])('can be switched on in %s', (appEnv) => {
    expect(loadEnv({ ...valid, APP_ENV: appEnv, PLATFORM_DEMO_HANDLERS: 'true' }).PLATFORM_DEMO_HANDLERS).toBe(true);
  });

  it('is refused in production', () => {
    const error = failureOf({
      APP_ENV: 'production',
      CLIENT_IP_HEADER: 'cf-connecting-ip',
      PLATFORM_DEMO_HANDLERS: 'true',
    });
    expect(issuePaths(error)).toEqual(['PLATFORM_DEMO_HANDLERS']);
  });

  it('may stay off in production', () => {
    const env = loadEnv({
      ...valid,
      APP_ENV: 'production',
      CLIENT_IP_HEADER: 'cf-connecting-ip',
      PLATFORM_DEMO_HANDLERS: 'false',
    });
    expect(env.PLATFORM_DEMO_HANDLERS).toBe(false);
  });
});
