import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';
import { DEPLOYED_OVERRIDES, syntheticSecret, TEST_ENV } from '../support/deployed-env.fixture';
import { failureOf as envFailure, issuePaths } from '../support/env-failure';

/** The `.env.example` value: the marker `change-me` makes it a placeholder. */
const PLACEHOLDER_KEYS = 'k1:change-me-quote-hmac-00000000000000000000000000';
const QUOTE_KEY_ONE = syntheticSecret('quote-hmac-k1');
const QUOTE_KEY_TWO = syntheticSecret('quote-hmac-k2');

const valid = TEST_ENV;

const failureOf = (overrides: Record<string, string | undefined>) => envFailure({ ...valid, ...overrides });

describe('loadEnv quote HMAC keys', () => {
  it('requires QUOTE_HMAC_KEYS and QUOTE_HMAC_ACTIVE_KID for every role', () => {
    for (const role of ['api', 'worker', 'migrate']) {
      // Act
      const paths = issuePaths(failureOf({ ROLE: role, QUOTE_HMAC_KEYS: undefined, QUOTE_HMAC_ACTIVE_KID: undefined }));

      // Assert
      expect(paths).toEqual(expect.arrayContaining(['QUOTE_HMAC_KEYS', 'QUOTE_HMAC_ACTIVE_KID']));
    }
  });

  it('reads the ring and the active kid', () => {
    // Act
    const env = loadEnv({
      ...valid,
      QUOTE_HMAC_KEYS: `k1:${QUOTE_KEY_ONE},k2:${QUOTE_KEY_TWO}`,
      QUOTE_HMAC_ACTIVE_KID: 'k2',
    });

    // Assert
    expect(env.QUOTE_HMAC_KEYS).toBe(`k1:${QUOTE_KEY_ONE},k2:${QUOTE_KEY_TWO}`);
    expect(env.QUOTE_HMAC_ACTIVE_KID).toBe('k2');
  });

  it('refuses an active kid missing from the ring', () => {
    // Act and Assert
    expect(issuePaths(failureOf({ QUOTE_HMAC_ACTIVE_KID: 'k9' }))).toEqual(['QUOTE_HMAC_ACTIVE_KID']);
  });

  it('refuses a malformed list without printing the secret', () => {
    // Arrange
    const short = QUOTE_KEY_ONE.slice(0, 20);

    // Act
    const error = failureOf({ QUOTE_HMAC_KEYS: `k1:${short}` });

    // Assert
    expect(issuePaths(error)).toContain('QUOTE_HMAC_KEYS');
    expect(error.message).not.toContain(short);
  });

  it.each(['staging', 'production'])('refuses the placeholder when deployed (%s)', (appEnv) => {
    // Act
    const error = failureOf({ APP_ENV: appEnv, ...DEPLOYED_OVERRIDES, QUOTE_HMAC_KEYS: PLACEHOLDER_KEYS });

    // Assert
    expect(issuePaths(error)).toEqual(['QUOTE_HMAC_KEYS']);
    expect(error.message).not.toContain(PLACEHOLDER_KEYS.slice(3));
  });

  it('accepts the placeholder in development', () => {
    // Act and Assert
    expect(() => loadEnv({ ...valid, APP_ENV: 'development', QUOTE_HMAC_KEYS: PLACEHOLDER_KEYS })).not.toThrow();
  });

  it('refuses a weak key when deployed', () => {
    // Arrange
    const uniform = 'q'.repeat(40);

    // Act
    const error = failureOf({ APP_ENV: 'production', ...DEPLOYED_OVERRIDES, QUOTE_HMAC_KEYS: `k1:${uniform}` });

    // Assert
    expect(issuePaths(error)).toEqual(['QUOTE_HMAC_KEYS']);
    expect(error.message).not.toContain(uniform);
  });

  it.each(['INTERNAL_HMAC_KEYS', 'AUTH_TOKEN_SECRET', 'COOKIE_SECRET'])(
    'refuses a quote key that reuses the %s secret when deployed',
    (name) => {
      // Arrange
      const shared = syntheticSecret(`shared-with-${name}`);
      const reused = name === 'INTERNAL_HMAC_KEYS' ? `k7:${shared}` : shared;

      // Act
      const error = failureOf({
        APP_ENV: 'production',
        ...DEPLOYED_OVERRIDES,
        [name]: reused,
        QUOTE_HMAC_KEYS: `k1:${QUOTE_KEY_ONE},k2:${shared}`,
      });

      // Assert
      expect(issuePaths(error)).toEqual(['QUOTE_HMAC_KEYS']);
      expect(error.message).toContain(name);
      expect(error.message).not.toContain(shared);
    },
  );

  it('accepts a quote key shared with another secret in development', () => {
    // Arrange
    const shared = syntheticSecret('shared-in-development');

    // Act and Assert
    expect(() =>
      loadEnv({ ...valid, APP_ENV: 'development', COOKIE_SECRET: shared, QUOTE_HMAC_KEYS: `k1:${shared}` }),
    ).not.toThrow();
  });

  it('accepts real keys when deployed', () => {
    // Act and Assert
    expect(() =>
      loadEnv({
        ...valid,
        APP_ENV: 'production',
        ...DEPLOYED_OVERRIDES,
        QUOTE_HMAC_KEYS: `k1:${QUOTE_KEY_ONE},k2:${QUOTE_KEY_TWO}`,
        QUOTE_HMAC_ACTIVE_KID: 'k2',
      }),
    ).not.toThrow();
  });
});
