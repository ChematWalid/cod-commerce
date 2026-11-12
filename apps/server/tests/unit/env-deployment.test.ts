import { AuthPlugin } from '@cod/plugin-auth';
import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv, MAX_TRUSTED_PROXY_HOPS } from '../../src/config/env';
import { buildVendureConfig } from '../../src/config/vendure-config';

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
  SUPERADMIN_USERNAME: 'superadmin',
  SUPERADMIN_PASSWORD: 'test-password',
  S3_ENDPOINT: 'http://garage:3900',
  S3_ACCESS_KEY: 'GK' + 'a'.repeat(24),
  S3_SECRET_KEY: 'fedcba9876543210'.repeat(4),
  S3_BUCKET_PRIVATE: 'cod-private',
};

const turnstile = {
  TURNSTILE_ENABLED: 'true',
  TURNSTILE_SECRET_KEY: 'synthetic-turnstile-secret',
  TURNSTILE_CHALLENGE_URL: 'https://challenge.example.test/',
};

/** What a deployed server needs on top of `valid`; every value is synthetic. */
const deployed = {
  APP_ENV: 'production',
  PLATFORM_DOMAIN: 'example.test',
  CLIENT_IP_HEADER: 'cf-connecting-ip',
  AUTH_DASHBOARD_URL: 'https://app.example.test/dashboard',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_FROM: 'no-reply@example.test',
};

/** The seven endpoint overrides: the server calls each of them with a secret or a user's token. */
const ENDPOINT_OVERRIDES = [
  'TURNSTILE_SITEVERIFY_URL',
  'GOOGLE_OAUTH_AUTHORIZE_URL',
  'GOOGLE_OAUTH_TOKEN_URL',
  'GOOGLE_OAUTH_USERINFO_URL',
  'FACEBOOK_OAUTH_AUTHORIZE_URL',
  'FACEBOOK_OAUTH_TOKEN_URL',
  'FACEBOOK_OAUTH_USERINFO_URL',
] as const;

function issuesOf(overrides: Record<string, string>): EnvValidationError['issues'] {
  try {
    loadEnv({ ...valid, ...overrides });
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return error.issues;
    }
    throw error;
  }
  throw new Error('loadEnv accepted an invalid environment');
}

const issuePathsOf = (overrides: Record<string, string>): string[] => issuesOf(overrides).map((issue) => issue.path);

describe('TRUSTED_PROXY_HOPS', () => {
  it('defaults to one hop', () => {
    expect(loadEnv(valid).TRUSTED_PROXY_HOPS).toBe(1);
    expect(loadEnv({ ...valid, TRUSTED_PROXY_HOPS: '' }).TRUSTED_PROXY_HOPS).toBe(1);
  });

  it.each([
    ['0', 0],
    ['2', 2],
  ])('accepts %s hops', (value, hops) => {
    expect(loadEnv({ ...valid, TRUSTED_PROXY_HOPS: value }).TRUSTED_PROXY_HOPS).toBe(hops);
  });

  it('accepts the most hops a deployment can declare', () => {
    expect(loadEnv({ ...valid, TRUSTED_PROXY_HOPS: String(MAX_TRUSTED_PROXY_HOPS) }).TRUSTED_PROXY_HOPS).toBe(5);
  });

  it('rejects more hops than any real chain of proxies, which would let a client forge its address', () => {
    expect(issuePathsOf({ TRUSTED_PROXY_HOPS: String(MAX_TRUSTED_PROXY_HOPS + 1) })).toEqual(['TRUSTED_PROXY_HOPS']);
    expect(issuePathsOf({ TRUSTED_PROXY_HOPS: '1000' })).toEqual(['TRUSTED_PROXY_HOPS']);
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

describe.each(ENDPOINT_OVERRIDES)('the endpoint override %s', (name) => {
  it.each(['ftp://mock.test/endpoint', 'javascript:alert(1)', 'file:///etc/hostname'])(
    'refuses %s in development and when deployed',
    (value) => {
      expect(issuePathsOf({ [name]: value })).toEqual([name]);
      expect(issuePathsOf({ ...deployed, [name]: value })).toEqual([name]);
    },
  );

  it.each(['development', 'test'])('accepts http:// when APP_ENV is %s, for a local mock', (appEnv) => {
    expect(() => loadEnv({ ...valid, APP_ENV: appEnv, [name]: 'http://mock.test:8080/endpoint' })).not.toThrow();
  });

  it.each(['staging', 'production'])('refuses http:// when APP_ENV is %s', (appEnv) => {
    // Arrange
    const env = { ...deployed, APP_ENV: appEnv, [name]: 'http://mock.example.test/endpoint' };

    // Act
    const issues = issuesOf(env);

    // Assert
    expect(issues).toEqual([{ path: name, message: 'must be an https:// URL in this environment' }]);
  });

  it('accepts https:// everywhere', () => {
    expect(() => loadEnv({ ...valid, [name]: 'https://mock.example.test/endpoint' })).not.toThrow();
    expect(() => loadEnv({ ...deployed, ...valid, ...deployed, [name]: 'https://mock.example.test/e' })).not.toThrow();
  });
});
