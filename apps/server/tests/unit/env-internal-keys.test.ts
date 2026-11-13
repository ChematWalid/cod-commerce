import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';
import { DEPLOYED_OVERRIDES, STRONG_SECRETS, TEST_ENV } from '../support/deployed-env.fixture';
import { failureOf as envFailure, issuePaths } from '../support/env-failure';

const valid = TEST_ENV;

const failureOf = (overrides: Record<string, string | undefined>) => envFailure({ ...valid, ...overrides });

describe('loadEnv internal HMAC keys', () => {
  it('requires INTERNAL_HMAC_KEYS for every role', () => {
    for (const role of ['api', 'worker', 'migrate']) {
      expect(issuePaths(failureOf({ ROLE: role, INTERNAL_HMAC_KEYS: undefined }))).toEqual(['INTERNAL_HMAC_KEYS']);
    }
  });

  it('rejects malformed INTERNAL_HMAC_KEYS without printing the secret', () => {
    const error = failureOf({ INTERNAL_HMAC_KEYS: 'k1:tooshort-secret' });

    expect(issuePaths(error)).toEqual(['INTERNAL_HMAC_KEYS']);
    expect(error.message).not.toContain('tooshort-secret');
  });

  it('parses INTERNAL_HMAC_ACTIVE_KID as optional and as one of the kids', () => {
    const keys = `${STRONG_SECRETS.INTERNAL_HMAC_KEYS},k2:${'w'.repeat(40)}`;

    expect(loadEnv({ ...valid, INTERNAL_HMAC_KEYS: keys }).INTERNAL_HMAC_ACTIVE_KID).toBeUndefined();
    expect(
      loadEnv({ ...valid, INTERNAL_HMAC_KEYS: keys, INTERNAL_HMAC_ACTIVE_KID: 'k2' }).INTERNAL_HMAC_ACTIVE_KID,
    ).toBe('k2');
    expect(issuePaths(failureOf({ INTERNAL_HMAC_KEYS: keys, INTERNAL_HMAC_ACTIVE_KID: 'k9' }))).toEqual([
      'INTERNAL_HMAC_ACTIVE_KID',
    ]);
  });

  it.each(['staging', 'production'])('rejects a placeholder INTERNAL_HMAC_KEYS secret in %s', (appEnv) => {
    const deployed = { APP_ENV: appEnv, ...DEPLOYED_OVERRIDES };
    const error = failureOf({
      ...deployed,
      INTERNAL_HMAC_KEYS: 'k1:change-me-internal-hmac-000000000000000000000',
    });

    expect(issuePaths(error)).toEqual(['INTERNAL_HMAC_KEYS']);
    expect(error.message).not.toContain('change-me-internal-hmac');
  });
});
