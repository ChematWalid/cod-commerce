import { AuthPlugin } from '@cod/plugin-auth';
import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../../src/config/env';
import { buildVendureConfig } from '../../src/config/vendure-config';

const valid = {
  APP_ENV: 'test',
  ROLE: 'api',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://cod:pw@pgbouncer:5432/cod',
  DATABASE_URL_DIRECT: 'postgresql://cod:pw@postgres:5432/cod',
  REDIS_URL: 'redis://valkey:6379',
  COOKIE_SECRET: 'x'.repeat(32),
  AUTH_TOKEN_SECRET: 'y'.repeat(32),
  SUPERADMIN_USERNAME: 'superadmin',
  SUPERADMIN_PASSWORD: 'test-password',
  S3_ENDPOINT: 'http://garage:3900',
  S3_ACCESS_KEY: 'GK' + 'a'.repeat(24),
  S3_SECRET_KEY: 'b'.repeat(64),
  S3_BUCKET_PRIVATE: 'cod-private',
};

const turnstile = {
  TURNSTILE_ENABLED: 'true',
  TURNSTILE_SECRET_KEY: 'synthetic-turnstile-secret',
  TURNSTILE_CHALLENGE_URL: 'https://challenge.example.test/',
};

function issuePathsOf(overrides: Record<string, string>): string[] {
  try {
    loadEnv({ ...valid, ...overrides });
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return error.issues.map((issue) => issue.path);
    }
    throw error;
  }
  throw new Error('loadEnv accepted an invalid environment');
}

describe('TRUSTED_PROXY_HOPS', () => {
  it('defaults to the one reverse proxy of the compose stack', () => {
    expect(loadEnv(valid).TRUSTED_PROXY_HOPS).toBe(1);
    expect(loadEnv({ ...valid, TRUSTED_PROXY_HOPS: '' }).TRUSTED_PROXY_HOPS).toBe(1);
  });

  it.each([
    ['0', 0],
    ['2', 2],
  ])('accepts %s hops', (value, hops) => {
    expect(loadEnv({ ...valid, TRUSTED_PROXY_HOPS: value }).TRUSTED_PROXY_HOPS).toBe(hops);
  });

  it.each(['-1', '1.5', 'true', 'loopback'])('rejects %s', (value) => {
    expect(issuePathsOf({ TRUSTED_PROXY_HOPS: value })).toEqual(['TRUSTED_PROXY_HOPS']);
  });

  it('is the number of X-Forwarded-For hops the api trusts', () => {
    // Arrange
    const env = loadEnv({ ...valid, TRUSTED_PROXY_HOPS: '2' });

    // Act
    const config = buildVendureConfig(env, 'api');

    // Assert
    expect(config.apiOptions.trustProxy).toBe(2);
  });
});

describe('TURNSTILE_SITEVERIFY_URL', () => {
  it('is unset by default, so the adapter keeps the provider address', () => {
    // Arrange and Act
    buildVendureConfig(loadEnv({ ...valid, ...turnstile }), 'api');

    // Assert
    expect(AuthPlugin.options?.challenge).toEqual({
      secretKey: turnstile.TURNSTILE_SECRET_KEY,
      challengeUrl: turnstile.TURNSTILE_CHALLENGE_URL,
      siteverifyUrl: undefined,
    });
  });

  it('reaches the auth plugin when set', () => {
    // Arrange
    const siteverifyUrl = 'http://turnstile-mock.test:8080/siteverify';

    // Act
    buildVendureConfig(loadEnv({ ...valid, ...turnstile, TURNSTILE_SITEVERIFY_URL: siteverifyUrl }), 'api');

    // Assert
    expect(AuthPlugin.options?.challenge?.siteverifyUrl).toBe(siteverifyUrl);
  });

  it('rejects a value that is not a URL', () => {
    expect(issuePathsOf({ TURNSTILE_SITEVERIFY_URL: 'siteverify' })).toEqual(['TURNSTILE_SITEVERIFY_URL']);
  });
});
