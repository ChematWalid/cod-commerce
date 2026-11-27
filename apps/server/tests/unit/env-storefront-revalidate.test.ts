import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';
import { storefrontTargetOf } from '../../src/config/storefront-revalidate-env';
import { TEST_ENV } from '../support/deployed-env.fixture';
import { failureOf as envFailure, issuePaths } from '../support/env-failure';

const failureOf = (overrides: Record<string, string | undefined>) => envFailure({ ...TEST_ENV, ...overrides });

describe('loadEnv storefront revalidation (D3211, D3222)', () => {
  it('leaves revalidation off when STOREFRONT_INTERNAL_URL is unset or blank', () => {
    // Act
    const unset = loadEnv({ ...TEST_ENV, STOREFRONT_INTERNAL_URL: undefined });
    const blank = loadEnv({ ...TEST_ENV, STOREFRONT_INTERNAL_URL: '' });

    // Assert
    expect(storefrontTargetOf(unset)).toBeUndefined();
    expect(storefrontTargetOf(blank)).toBeUndefined();
  });

  it('signs revalidations with the active internal key when STOREFRONT_INTERNAL_URL is set', () => {
    // Act
    const env = loadEnv({
      ...TEST_ENV,
      STOREFRONT_INTERNAL_URL: 'http://storefront:3001',
      INTERNAL_HMAC_ACTIVE_KID: 'k1',
    });

    // Assert
    expect(storefrontTargetOf(env)).toEqual({
      internalUrl: 'http://storefront:3001',
      signingKey: expect.objectContaining({ kid: 'k1' }) as unknown,
    });
  });

  it.each(['storefront:3001', 'ftp://storefront:3001'])('refuses %s, which is not an http(s) URL', (url) => {
    // Act and Assert
    expect(issuePaths(failureOf({ STOREFRONT_INTERNAL_URL: url, INTERNAL_HMAC_ACTIVE_KID: 'k1' }))).toEqual([
      'STOREFRONT_INTERNAL_URL',
    ]);
  });

  it('needs INTERNAL_HMAC_ACTIVE_KID to sign once a storefront is set', () => {
    // Act and Assert
    expect(
      issuePaths(failureOf({ STOREFRONT_INTERNAL_URL: 'http://storefront:3001', INTERNAL_HMAC_ACTIVE_KID: undefined })),
    ).toEqual(['INTERNAL_HMAC_ACTIVE_KID']);
  });
});
