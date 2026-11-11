import { describe, expect, it } from 'vitest';
import {
  loadStorefrontEnv,
  readInternalApiUrl,
  STOREFRONT_ENV_KEYS,
  StorefrontEnvError,
} from '../../src/config/storefront-env';

const valid = {
  APP_ENV: 'production',
  NEXT_DEPLOYMENT_ID: 'abc1234',
  REDIS_URL: 'redis://valkey:6379',
  INTERNAL_API_URL: 'http://api:3000',
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
    });
  });

  it('keeps the development fallbacks of the cache, but never guesses the API', () => {
    // Arrange
    const env = { APP_ENV: 'development', INTERNAL_API_URL: 'http://localhost:3100' };

    // Act
    const loaded = loadStorefrontEnv(env);

    // Assert
    expect(loaded).toMatchObject({ redisUrl: 'redis://localhost:6380', deploymentId: 'dev' });
    expect(issuesOf({ APP_ENV: 'development' })).toEqual(['INTERNAL_API_URL is required']);
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
    const env = { APP_ENV: 'production', INTERNAL_API_URL: 'not-a-url-with-a-secret' };

    // Act
    const issues = issuesOf(env);

    // Assert
    expect(issues).toHaveLength(3);
    expect(issues.join('\n')).toMatch(
      /REDIS_URL is required[\s\S]*NEXT_DEPLOYMENT_ID is required[\s\S]*INTERNAL_API_URL/,
    );
    expect(issues.join('\n')).not.toContain('not-a-url-with-a-secret');
  });

  it('lists the variables it reads, for the .env.example gate', () => {
    expect([...STOREFRONT_ENV_KEYS].sort()).toEqual(['APP_ENV', 'INTERNAL_API_URL', 'NEXT_DEPLOYMENT_ID', 'REDIS_URL']);
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
