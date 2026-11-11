import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv, PLACEHOLDER_SECRET_MARKER } from '../../src/config/env';

const SMTP_USER = 'user@example.test';
const SMTP_PASS = 'not-a-real-password';

const valid = {
  APP_ENV: 'test',
  ROLE: 'api',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://cod:pw@pgbouncer:5432/cod',
  DATABASE_URL_DIRECT: 'postgresql://cod:pw@postgres:5432/cod',
  REDIS_URL: 'redis://valkey:6379',
  COOKIE_SECRET: 'k'.repeat(40),
  AUTH_TOKEN_SECRET: 'y'.repeat(32),
  AUTH_DASHBOARD_URL: 'https://app.example.test/dashboard',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_FROM: 'no-reply@example.test',
  SUPERADMIN_USERNAME: 'superadmin',
  SUPERADMIN_PASSWORD: 'real-admin-pw',
  S3_ENDPOINT: 'http://garage:3900',
  S3_ACCESS_KEY: 'GK' + 'a'.repeat(24),
  S3_SECRET_KEY: 'b'.repeat(64),
  S3_BUCKET_PRIVATE: 'cod-private',
  PLATFORM_DOMAIN: 'example.test',
  CLIENT_IP_HEADER: 'cf-connecting-ip',
};

/** A port with no conventional TLS mode. */
const FREE_PORT = '2525';

const credentials = { SMTP_USERNAME: SMTP_USER, SMTP_PASSWORD: SMTP_PASS };

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

describe('loadEnv, SMTP_TLS', () => {
  it.each(['none', 'starttls', 'implicit'])('accepts %s', (mode) => {
    expect(loadEnv({ ...valid, SMTP_PORT: FREE_PORT, SMTP_TLS: mode })).toMatchObject({ SMTP_TLS: mode });
  });

  it('rejects an unknown mode', () => {
    expect(issuePaths(failureOf({ SMTP_TLS: 'ssl' }))).toEqual(['SMTP_TLS']);
  });

  it.each([
    { appEnv: 'development', port: '1026', expected: 'none' },
    { appEnv: 'test', port: '587', expected: 'none' },
    { appEnv: 'staging', port: '587', expected: 'starttls' },
    { appEnv: 'production', port: '25', expected: 'starttls' },
    { appEnv: 'development', port: '465', expected: 'implicit' },
    { appEnv: 'production', port: '465', expected: 'implicit' },
  ])('defaults to $expected on port $port in $appEnv', ({ appEnv, port, expected }) => {
    const env = loadEnv({ ...valid, APP_ENV: appEnv, SMTP_PORT: port });

    expect(env.SMTP_TLS).toBe(expected);
  });

  it('defaults to none for the local Mailpit a development server falls back to', () => {
    const env = loadEnv({
      ...valid,
      APP_ENV: 'development',
      SMTP_HOST: undefined,
      SMTP_PORT: undefined,
      SMTP_FROM: undefined,
    });

    expect(env).toMatchObject({ SMTP_HOST: 'localhost', SMTP_PORT: 1026, SMTP_TLS: 'none' });
    expect(env.SMTP_USERNAME).toBeUndefined();
    expect(env.SMTP_PASSWORD).toBeUndefined();
  });

  it('keeps an explicit mode over the default of the environment', () => {
    const env = loadEnv({ ...valid, APP_ENV: 'production', SMTP_PORT: FREE_PORT, SMTP_TLS: 'none' });

    expect(env.SMTP_TLS).toBe('none');
  });

  it('defaults to starttls for a Mailpit host left in a deployed environment', () => {
    // Arrange
    const source = { ...valid, APP_ENV: 'production', SMTP_HOST: 'mailpit', SMTP_PORT: '1025', SMTP_TLS: undefined };

    // Act
    const env = loadEnv(source);

    // Assert
    expect(env.SMTP_TLS).toBe('starttls');
  });

  it('takes a blank mode, username and password for unset ones', () => {
    // Arrange
    const source = { ...valid, SMTP_TLS: '', SMTP_USERNAME: '', SMTP_PASSWORD: '' };

    // Act
    const env = loadEnv(source);

    // Assert
    expect(env.SMTP_TLS).toBe('none');
    expect(env.SMTP_USERNAME).toBeUndefined();
    expect(env.SMTP_PASSWORD).toBeUndefined();
  });

  it.each([
    { port: '465', mode: 'starttls', message: 'starttls contradicts SMTP_PORT 465, the implicit TLS port' },
    { port: '587', mode: 'implicit', message: 'implicit contradicts SMTP_PORT 587, the STARTTLS port' },
  ])('refuses SMTP_TLS=$mode on SMTP_PORT=$port, naming both variables', ({ port, mode, message }) => {
    // Arrange
    const overrides = { SMTP_PORT: port, SMTP_TLS: mode };

    // Act
    const failure = failureOf(overrides);

    // Assert
    expect(failure.issues).toEqual([{ path: 'SMTP_TLS', message }]);
    expect(failure.message).toContain('SMTP_TLS');
    expect(failure.message).toContain('SMTP_PORT');
  });

  it.each([
    { port: '25', mode: 'starttls' },
    { port: '2465', mode: 'implicit' },
    { port: '465', mode: 'implicit' },
    { port: '587', mode: 'starttls' },
    { port: '587', mode: 'none' },
  ])('leaves SMTP_TLS=$mode free on SMTP_PORT=$port', ({ port, mode }) => {
    // Arrange
    const source = { ...valid, SMTP_PORT: port, SMTP_TLS: mode };

    // Act
    const env = loadEnv(source);

    // Assert
    expect(env).toMatchObject({ SMTP_PORT: Number(port), SMTP_TLS: mode });
  });
});

describe('loadEnv, SMTP credentials', () => {
  it('accepts a username and a password over required TLS', () => {
    const env = loadEnv({ ...valid, ...credentials, SMTP_TLS: 'starttls' });

    expect(env).toMatchObject({ ...credentials, SMTP_TLS: 'starttls' });
  });

  it('requires SMTP_PASSWORD when SMTP_USERNAME is set', () => {
    const failure = failureOf({ SMTP_TLS: 'starttls', SMTP_USERNAME: SMTP_USER });

    expect(failure.issues).toEqual([{ path: 'SMTP_PASSWORD', message: 'is required when SMTP_USERNAME is set' }]);
  });

  it('requires SMTP_USERNAME when SMTP_PASSWORD is set, without repeating the password', () => {
    const failure = failureOf({ SMTP_TLS: 'starttls', SMTP_PASSWORD: SMTP_PASS });

    expect(failure.issues).toEqual([{ path: 'SMTP_USERNAME', message: 'is required when SMTP_PASSWORD is set' }]);
    expect(failure.message).not.toContain(SMTP_PASS);
  });

  it('refuses to send them without TLS to a host that is not local, without repeating the password', () => {
    const failure = failureOf({ ...credentials, SMTP_HOST: 'smtp.example.test', SMTP_TLS: 'none' });

    expect(issuePaths(failure)).toEqual(['SMTP_TLS']);
    expect(failure.message).not.toContain(SMTP_PASS);
    expect(JSON.stringify(failure.issues)).not.toContain(SMTP_PASS);
  });

  it('refuses them when the mode the environment defaults to is none', () => {
    const failure = failureOf({ ...credentials, APP_ENV: 'development', SMTP_HOST: 'smtp.example.test' });

    expect(issuePaths(failure)).toEqual(['SMTP_TLS']);
  });

  it.each(['localhost', '127.0.0.1', '::1', 'mailpit', 'LOCALHOST', 'mail.localhost'])(
    'allows them without TLS to the local host %s',
    (host) => {
      const env = loadEnv({ ...valid, ...credentials, SMTP_HOST: host, SMTP_TLS: 'none' });

      expect(env).toMatchObject({ ...credentials, SMTP_TLS: 'none' });
    },
  );

  it.each(['localhost.example.test', 'mailpit.example.test', 'notlocalhost'])(
    'does not take %s for a local host',
    (host) => {
      expect(issuePaths(failureOf({ ...credentials, SMTP_HOST: host, SMTP_TLS: 'none' }))).toEqual(['SMTP_TLS']);
    },
  );

  it.each(['localhost.', '[::1]'])('refuses them without TLS to %s, which is not spelled as a local host', (host) => {
    // Arrange
    const overrides = { ...credentials, SMTP_HOST: host, SMTP_TLS: 'none' };

    // Act
    const failure = failureOf(overrides);

    // Assert
    expect(issuePaths(failure)).toEqual(['SMTP_TLS']);
  });

  it('rejects a placeholder SMTP_PASSWORD when deployed', () => {
    const failure = failureOf({
      APP_ENV: 'production',
      SMTP_USERNAME: SMTP_USER,
      SMTP_PASSWORD: `${PLACEHOLDER_SECRET_MARKER}-app-password`,
    });

    expect(issuePaths(failure)).toEqual(['SMTP_PASSWORD']);
  });
});
