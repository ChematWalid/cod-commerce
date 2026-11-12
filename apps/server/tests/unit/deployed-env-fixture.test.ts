import { describe, expect, it } from 'vitest';
import { isDeployed, isPlaceholderSecret, MIN_DISTINCT_SECRET_CHARACTERS } from '../../src/config/deployed-env';
import { loadEnv } from '../../src/config/env';
import {
  CORE_ENV,
  DEPLOYED_OVERRIDES,
  DEPLOYED_PASSWORD,
  KEK_ONE,
  KEK_TWO,
  STRONG_SECRETS,
  syntheticHex,
  syntheticPassword,
  syntheticSecret,
  TEST_ENV,
} from '../support/deployed-env.fixture';
import { failureOf, issuePaths } from '../support/env-failure';

const distinct = (value: string): number => new Set(value).size;

describe('the synthetic secret fixture', () => {
  it('builds the same value for the same label, and a different one for another label', () => {
    // Arrange, Act and Assert
    expect(syntheticSecret('a')).toBe(syntheticSecret('a'));
    expect(syntheticSecret('a')).not.toBe(syntheticSecret('b'));
    expect(syntheticHex('a')).toBe(syntheticHex('a'));
    expect(KEK_ONE).not.toBe(KEK_TWO);
  });

  it('gives a secret only distinct mixed-case letters and digits, as many as its length', () => {
    // Act
    const secret = syntheticSecret('shape', 40);

    // Assert
    expect(secret).toMatch(/^[a-zA-Z0-9]{40}$/);
    expect(distinct(secret)).toBe(40);
    expect(distinct(syntheticPassword(MIN_DISTINCT_SECRET_CHARACTERS))).toBe(MIN_DISTINCT_SECRET_CHARACTERS);
  });

  it('gives a hex key every digit in each 16-character block', () => {
    // Act
    const hex = syntheticHex('shape', 64);

    // Assert
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    for (let start = 0; start < hex.length; start += 16) {
      expect(distinct(hex.slice(start, start + 16))).toBe(16);
    }
  });

  it('refuses a secret longer than its alphabet, which could not stay all distinct', () => {
    expect(() => syntheticSecret('too-long', 63)).toThrow(RangeError);
  });

  it('makes every strong secret pass the deployed strength rule (SRV-8) and none look like a placeholder', () => {
    // Arrange
    const values = [...Object.values(STRONG_SECRETS).map((value) => value.split(':').pop() ?? ''), DEPLOYED_PASSWORD];

    // Assert
    for (const value of values) {
      expect(distinct(value)).toBeGreaterThanOrEqual(MIN_DISTINCT_SECRET_CHARACTERS);
      expect(isPlaceholderSecret(value)).toBe(false);
    }
  });

  it.each(['development', 'test', 'staging', 'production'])('loads as a valid environment in %s', (appEnv) => {
    // Act
    const env = loadEnv({ ...TEST_ENV, ...DEPLOYED_OVERRIDES, APP_ENV: appEnv });

    // Assert
    expect(isDeployed(env)).toBe(appEnv === 'staging' || appEnv === 'production');
    expect(env.COOKIE_SECRET).toBe(STRONG_SECRETS.COOKIE_SECRET);
  });

  it('keeps the core environment free of the settings a deployment adds', () => {
    // Assert
    expect(Object.keys(CORE_ENV)).not.toContain('SMTP_HOST');
    expect(Object.keys(CORE_ENV)).not.toContain('PLATFORM_DOMAIN');
    expect(issuePaths(failureOf({ ...CORE_ENV, APP_ENV: 'production', ...DEPLOYED_OVERRIDES }))).toContain('SMTP_HOST');
  });

  it('reports a failure that loadEnv accepted as an error of the test, not a validation error', () => {
    expect(() => failureOf(TEST_ENV)).toThrow('loadEnv accepted an invalid environment');
  });
});
