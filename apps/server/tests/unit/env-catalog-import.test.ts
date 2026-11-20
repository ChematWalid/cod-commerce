import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';
import { DEPLOYED_OVERRIDES, TEST_ENV } from '../support/deployed-env.fixture';
import { failureOf as envFailure, issuePaths } from '../support/env-failure';

const PRODUCTION = { ...TEST_ENV, APP_ENV: 'production', ...DEPLOYED_OVERRIDES };
const failureOf = (overrides: Record<string, string | undefined>) => envFailure({ ...TEST_ENV, ...overrides });

describe('loadEnv catalog import (D2208, D2214)', () => {
  it('S3_PUBLIC_ENDPOINT blank falls back to S3_ENDPOINT', () => {
    // Act
    const blank = loadEnv({ ...TEST_ENV, S3_PUBLIC_ENDPOINT: '' });
    const unset = loadEnv({ ...TEST_ENV, S3_PUBLIC_ENDPOINT: undefined });
    const set = loadEnv({ ...TEST_ENV, S3_PUBLIC_ENDPOINT: 'http://localhost:3900' });

    // Assert
    expect(blank.S3_PUBLIC_ENDPOINT).toBe(TEST_ENV.S3_ENDPOINT);
    expect(unset.S3_PUBLIC_ENDPOINT).toBe(TEST_ENV.S3_ENDPOINT);
    expect(set.S3_PUBLIC_ENDPOINT).toBe('http://localhost:3900');
  });

  it('S3_PUBLIC_ENDPOINT must be a URL', () => {
    // Act and Assert
    expect(issuePaths(failureOf({ S3_PUBLIC_ENDPOINT: 'files.example.test' }))).toEqual(['S3_PUBLIC_ENDPOINT']);
  });

  it('S3_PUBLIC_ENDPOINT must be https in production', () => {
    // Act
    const error = envFailure({ ...PRODUCTION, S3_PUBLIC_ENDPOINT: 'http://files.example.com' });
    const env = loadEnv({ ...PRODUCTION, S3_PUBLIC_ENDPOINT: 'https://files.example.com' });

    // Assert
    expect(issuePaths(error)).toEqual(['S3_PUBLIC_ENDPOINT']);
    expect(env.S3_PUBLIC_ENDPOINT).toBe('https://files.example.com');
  });

  it('LINK_IMPORT_SCRAPER defaults to http and accepts fixture outside production', () => {
    // Act and Assert
    expect(loadEnv(TEST_ENV).LINK_IMPORT_SCRAPER).toBe('http');
    expect(loadEnv({ ...TEST_ENV, LINK_IMPORT_SCRAPER: 'fixture' }).LINK_IMPORT_SCRAPER).toBe('fixture');
    expect(issuePaths(failureOf({ LINK_IMPORT_SCRAPER: 'curl' }))).toEqual(['LINK_IMPORT_SCRAPER']);
  });

  it('fixture scraper refused in production', () => {
    // Act and Assert
    expect(
      issuePaths(
        envFailure({ ...PRODUCTION, S3_PUBLIC_ENDPOINT: 'https://files.example.com', LINK_IMPORT_SCRAPER: 'fixture' }),
      ),
    ).toEqual(['LINK_IMPORT_SCRAPER']);
  });
});
