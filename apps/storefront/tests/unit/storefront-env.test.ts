import { describe, expect, it } from 'vitest';
import {
  loadStorefrontEnv,
  readInternalApiUrl,
  readInternalSigningKey,
  STOREFRONT_ENV_KEYS,
  StorefrontEnvError,
} from '../../src/config/storefront-env';

const valid = {
  APP_ENV: 'production',
  NEXT_DEPLOYMENT_ID: 'abc1234',
  REDIS_URL: 'redis://valkey:6379',
  INTERNAL_API_URL: 'http://api:3000',
  INTERNAL_HMAC_KEYS:
    'k1:change-me-internal-hmac-000000000000000000000,k2:change-me-internal-hmac-111111111111111111111',
  INTERNAL_HMAC_ACTIVE_KID: 'k2',
};

function issuesOf(env: NodeJS.Dict<string>): readonly string[] {
  try {
    loadStorefrontEnv(env);
  } catch (error) {
    if (error instanceof StorefrontEnvError) return error.issues;
    throw error;
  }
  throw new Error('loadStorefrontEnv accepted an invalid environment');
}

describe('loadStorefrontEnv', () => {
  it('returns the typed environment of a complete configuration', () => {
    expect(loadStorefrontEnv(valid)).toEqual({
      redisUrl: 'redis://valkey:6379',
      deploymentId: 'abc1234',
      internalApiUrl: 'http://api:3000',
      internalSigningKey: { kid: 'k2', secret: 'change-me-internal-hmac-111111111111111111111' },
    });
  });

  it('keeps the development fallbacks of the cache, but never guesses the API', () => {
    // Arrange
    const env = { ...valid, APP_ENV: 'development', REDIS_URL: undefined, NEXT_DEPLOYMENT_ID: undefined };

    // Act
    const loaded = loadStorefrontEnv(env);

    // Assert
    expect(loaded).toMatchObject({ redisUrl: 'redis://localhost:6380', deploymentId: 'dev' });
    expect(issuesOf({ ...valid, APP_ENV: 'development', INTERNAL_API_URL: undefined })).toEqual([
      'INTERNAL_API_URL is required',
    ]);
  });

  it.each([
    ['missing', undefined],
    ['blank', '  '],
  ])('refuses a %s INTERNAL_API_URL', (_name, value) => {
    expect(issuesOf({ ...valid, INTERNAL_API_URL: value })).toEqual(['INTERNAL_API_URL is required']);
  });

  it.each(['api:3000', 'api', 'ftp://api:3000', 'http://', '//api:3000'])(
    'refuses the malformed INTERNAL_API_URL %s',
    (value) => {
      expect(issuesOf({ ...valid, INTERNAL_API_URL: value })).toEqual([
        'INTERNAL_API_URL must be an http:// or https:// URL',
      ]);
    },
  );

  it.each(['valkey:6379', 'http://valkey:6379'])('refuses the malformed REDIS_URL %s', (value) => {
    expect(issuesOf({ ...valid, REDIS_URL: value })).toEqual(['REDIS_URL must be a redis:// or rediss:// URL']);
  });

  it('refuses an APP_ENV the platform does not have', () => {
    expect(issuesOf({ ...valid, APP_ENV: 'prod' })).toEqual([
      'APP_ENV must be one of development, test, staging, production',
    ]);
  });

  it('reports every invalid variable at once, by name and never by value', () => {
    // Arrange
    const env = {
      APP_ENV: 'production',
      INTERNAL_API_URL: 'not-a-url-with-a-secret',
      INTERNAL_HMAC_KEYS: 'k1:short-secret-value',
    };

    // Act
    const issues = issuesOf(env);

    // Assert
    expect(issues).toHaveLength(5);
    expect(issues.join('\n')).toMatch(
      /REDIS_URL is required[\s\S]*NEXT_DEPLOYMENT_ID is required[\s\S]*INTERNAL_API_URL[\s\S]*INTERNAL_HMAC_KEYS/,
    );
    expect(issues.join('\n')).not.toContain('not-a-url-with-a-secret');
    expect(issues.join('\n')).not.toContain('short-secret-value');
  });

  it('lists the variables it reads, for the .env.example gate', () => {
    expect([...STOREFRONT_ENV_KEYS].sort()).toEqual([
      'APP_ENV',
      'INTERNAL_API_URL',
      'INTERNAL_HMAC_ACTIVE_KID',
      'INTERNAL_HMAC_KEYS',
      'NEXT_DEPLOYMENT_ID',
      'REDIS_URL',
    ]);
  });
});

describe('internal HMAC keys', () => {
  it.each([
    ['missing keys', { INTERNAL_HMAC_KEYS: undefined }, 'INTERNAL_HMAC_KEYS is required'],
    ['a short secret', { INTERNAL_HMAC_KEYS: 'k1:short' }, 'INTERNAL_HMAC_KEYS'],
    ['a missing active kid', { INTERNAL_HMAC_ACTIVE_KID: undefined }, 'INTERNAL_HMAC_ACTIVE_KID is required'],
    ['an unknown active kid', { INTERNAL_HMAC_ACTIVE_KID: 'zz' }, 'INTERNAL_HMAC_ACTIVE_KID must be one of the kids'],
  ])('refuses %s', (_name, change, expected) => {
    expect(issuesOf({ ...valid, ...change }).join('\n')).toContain(expected);
  });

  it('reads the signing key per call, never at load', () => {
    expect(readInternalSigningKey(valid)).toEqual({
      kid: 'k2',
      secret: 'change-me-internal-hmac-111111111111111111111',
    });
    expect(() => readInternalSigningKey({})).toThrow(StorefrontEnvError);
  });
});

describe('readInternalApiUrl', () => {
  it('returns the validated URL', () => {
    expect(readInternalApiUrl({ INTERNAL_API_URL: ' https://api.internal.example.test ' })).toBe(
      'https://api.internal.example.test',
    );
  });

  it('throws the typed error on its own, without the cache variables', () => {
    expect(() => readInternalApiUrl({})).toThrow(StorefrontEnvError);
    expect(() => readInternalApiUrl({ INTERNAL_API_URL: 'api' })).toThrow('INTERNAL_API_URL must be');
  });
});
