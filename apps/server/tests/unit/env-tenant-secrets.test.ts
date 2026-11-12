import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';
import { DEPLOYED_OVERRIDES, KEK_ONE, KEK_TWO, TEST_ENV } from '../support/deployed-env.fixture';
import { failureOf as envFailure, issuePaths } from '../support/env-failure';

const ZEROS = '0'.repeat(64);

const valid = TEST_ENV;

const failureOf = (overrides: Record<string, string | undefined>) => envFailure({ ...valid, ...overrides });

describe('loadEnv tenant secret keys', () => {
  it('requires TENANT_SECRET_KEKS for every role', () => {
    for (const role of ['api', 'worker', 'migrate']) {
      expect(issuePaths(failureOf({ ROLE: role, TENANT_SECRET_KEKS: undefined }))).toContain('TENANT_SECRET_KEKS');
    }
  });

  it('requires TENANT_SECRET_ACTIVE_KID', () => {
    // Act and Assert
    expect(issuePaths(failureOf({ TENANT_SECRET_ACTIVE_KID: undefined }))).toEqual(['TENANT_SECRET_ACTIVE_KID']);
  });

  it('reads the ring and the active kid', () => {
    // Act
    const env = loadEnv({
      ...valid,
      TENANT_SECRET_KEKS: `k1:${KEK_ONE},k2:${KEK_TWO}`,
      TENANT_SECRET_ACTIVE_KID: 'k2',
    });

    // Assert
    expect(env.TENANT_SECRET_ACTIVE_KID).toBe('k2');
  });

  it('rejects an active kid that is not in the ring', () => {
    // Act and Assert
    expect(issuePaths(failureOf({ TENANT_SECRET_ACTIVE_KID: 'k9' }))).toEqual(['TENANT_SECRET_ACTIVE_KID']);
  });

  it.each([
    ['a 63-hex key', `k1:${KEK_ONE.slice(1)}`],
    ['a key that is not hex', `k1:${'zz'.repeat(32)}`],
    ['no kid', KEK_ONE],
  ])('rejects %s without printing it', (_name, keks) => {
    // Act
    const error = failureOf({ TENANT_SECRET_KEKS: keks });

    // Assert
    expect(issuePaths(error)).toContain('TENANT_SECRET_KEKS');
    expect(error.message).not.toContain(KEK_ONE.slice(1));
    expect(error.message).not.toContain('zzzz');
  });

  it('refuses a kid that reads as a job continuation, naming it, and accepts k2', () => {
    // Act
    const error = failureOf({ TENANT_SECRET_KEKS: `r2:${KEK_ONE}`, TENANT_SECRET_ACTIVE_KID: 'r2' });
    const env = loadEnv({ ...valid, TENANT_SECRET_KEKS: `k2:${KEK_ONE}`, TENANT_SECRET_ACTIVE_KID: 'k2' });

    // Assert
    expect(issuePaths(error)).toContain('TENANT_SECRET_KEKS');
    expect(error.message).toContain('r2');
    expect(env.TENANT_SECRET_ACTIVE_KID).toBe('k2');
  });

  it.each(['staging', 'production'])('rejects an all-zero placeholder KEK in %s', (appEnv) => {
    // Arrange
    const deployed = { APP_ENV: appEnv, ...DEPLOYED_OVERRIDES };

    // Act
    const error = failureOf({ ...deployed, TENANT_SECRET_KEKS: `k1:${ZEROS}` });

    // Assert
    expect(issuePaths(error)).toEqual(['TENANT_SECRET_KEKS']);
    expect(error.message).not.toContain(ZEROS);
  });

  it('flags a placeholder among several keys in production, and accepts real keys', () => {
    // Arrange
    const deployed = { APP_ENV: 'production', ...DEPLOYED_OVERRIDES };

    // Act and Assert
    expect(issuePaths(failureOf({ ...deployed, TENANT_SECRET_KEKS: `k1:${KEK_ONE},k2:${ZEROS}` }))).toEqual([
      'TENANT_SECRET_KEKS',
    ]);
    expect(() =>
      loadEnv({
        ...valid,
        ...deployed,
        TENANT_SECRET_KEKS: `k1:${KEK_ONE},k2:${KEK_TWO}`,
        TENANT_SECRET_ACTIVE_KID: 'k2',
      }),
    ).not.toThrow();
  });

  it('accepts the placeholder outside staging and production', () => {
    // Act and Assert
    expect(() => loadEnv({ ...valid, APP_ENV: 'development', TENANT_SECRET_KEKS: `k1:${ZEROS}` })).not.toThrow();
  });
});
