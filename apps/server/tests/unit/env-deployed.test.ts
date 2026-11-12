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

describe('loadEnv in a deployed environment', () => {
  it.each(['staging', 'production'])('requires CLIENT_IP_HEADER in %s (RL-4)', (appEnv) => {
    const deployed = {
      APP_ENV: appEnv,
      COOKIE_SECRET: 'Qm7vXk2LpR9tWc4Zb8NdHf3JsGy6AeUo',
      SUPERADMIN_PASSWORD: 'real-admin-pw',
    };

    expect(issuePaths(failureOf({ ...deployed, CLIENT_IP_HEADER: undefined }))).toEqual(['CLIENT_IP_HEADER']);
    expect(loadEnv({ ...valid, ...deployed, CLIENT_IP_HEADER: 'cf-connecting-ip' }).CLIENT_IP_HEADER).toBe(
      'cf-connecting-ip',
    );
  });

  it.each(['development', 'test'])('leaves CLIENT_IP_HEADER optional in %s', (appEnv) => {
    expect(loadEnv({ ...valid, APP_ENV: appEnv }).CLIENT_IP_HEADER).toBe('');
  });

  describe('secret strength (SRV-8)', () => {
    const HEX = '0123456789abcdef'.repeat(4);
    const strong = {
      APP_ENV: 'production',
      CLIENT_IP_HEADER: 'cf-connecting-ip',
      COOKIE_SECRET: 'Qm7vXk2LpR9tWc4Zb8NdHf3JsGy6AeUo',
      AUTH_TOKEN_SECRET: 'Vb5nTr8KcXw2MzQj7LhPd4GfSy9EaUo3',
      SUPERADMIN_PASSWORD: 'Rg7-vault-pass',
      S3_SECRET_KEY: HEX,
      INTERNAL_HMAC_KEYS: 'k1:Hn4wBz9TqXc6MvKe2LrJd7GsPy3FaUo8',
      TENANT_SECRET_KEKS: `k1:${HEX}`,
    };

    it.each(['staging', 'production'])('accepts strong secrets in %s', (appEnv) => {
      expect(() => loadEnv({ ...valid, ...strong, APP_ENV: appEnv })).not.toThrow();
    });

    it.each([
      ['COOKIE_SECRET', 'k'.repeat(40)],
      ['COOKIE_SECRET', 'abc'.repeat(14)],
      ['AUTH_TOKEN_SECRET', 'q'.repeat(40)],
      ['SUPERADMIN_PASSWORD', 'a'.repeat(20)],
      ['S3_SECRET_KEY', 'a'.repeat(64)],
      ['S3_SECRET_KEY', 'ab12'.repeat(16)],
      ['INTERNAL_HMAC_KEYS', `k1:${'q'.repeat(40)}`],
      ['TENANT_SECRET_KEKS', `k1:${'1'.repeat(64)}`],
    ])('refuses a weak %s (%#) in production, without echoing it', (name, value) => {
      const error = failureOf({ ...strong, [name]: value });

      expect(issuePaths(error)).toEqual([name]);
      expect(error.message).not.toContain(value.split(':').pop());
    });

    it('refuses a SUPERADMIN_PASSWORD shorter than 12 characters when deployed only', () => {
      expect(issuePaths(failureOf({ ...strong, SUPERADMIN_PASSWORD: 'Rg7-vault1' }))).toEqual(['SUPERADMIN_PASSWORD']);
      expect(() =>
        loadEnv({ ...valid, ...strong, APP_ENV: 'development', SUPERADMIN_PASSWORD: 'Rg7-vault1' }),
      ).not.toThrow();
    });

    it('refuses a short COOKIE_SECRET without the placeholder marker in production', () => {
      expect(issuePaths(failureOf({ ...strong, COOKIE_SECRET: 'Qm7vXk2LpR9tWc4' }))).toEqual(['COOKIE_SECRET']);
    });

    it.each(['development', 'test'])('leaves weak secrets alone in %s', (appEnv) => {
      const weak = { COOKIE_SECRET: 'k'.repeat(40), SUPERADMIN_PASSWORD: 'a'.repeat(8), S3_SECRET_KEY: 'a'.repeat(64) };

      expect(() => loadEnv({ ...valid, ...weak, APP_ENV: appEnv })).not.toThrow();
    });
  });
});
