import { describe, expect, it } from 'vitest';
import { deliveryEnvIssues, readTrustEdgeIp } from '../../src/config/delivery-env';

/** base64 of the 32-byte placeholder 'change-me-server-actions-key-000', never a real key. */
const PLACEHOLDER_KEY = 'Y2hhbmdlLW1lLXNlcnZlci1hY3Rpb25zLWtleS0wMDA=';

describe('storefront delivery environment', () => {
  it('accepts a deployed environment with a 32-byte base64 server actions key', () => {
    const env = {
      APP_ENV: 'production',
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: PLACEHOLDER_KEY,
      STOREFRONT_TRUST_EDGE_IP: 'true',
    };
    expect(deliveryEnvIssues(env)).toEqual([]);
  });

  it.each(['staging', 'production'])('requires STOREFRONT_TRUST_EDGE_IP=true when APP_ENV is %s', (appEnv) => {
    // Act
    const issues = deliveryEnvIssues({
      APP_ENV: appEnv,
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: PLACEHOLDER_KEY,
      STOREFRONT_TRUST_EDGE_IP: 'false',
    });
    // Assert
    expect(issues).toEqual(['STOREFRONT_TRUST_EDGE_IP must be true when APP_ENV is staging or production']);
  });

  it.each(['staging', 'production', undefined])('requires the server actions key when APP_ENV is %s', (appEnv) => {
    expect(deliveryEnvIssues({ APP_ENV: appEnv, STOREFRONT_TRUST_EDGE_IP: 'true' })).toEqual([
      'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is required unless APP_ENV is development or test',
    ]);
  });

  it.each(['development', 'test'])('lets Next generate the key per build when APP_ENV is %s', (appEnv) => {
    expect(deliveryEnvIssues({ APP_ENV: appEnv })).toEqual([]);
  });

  it.each(['c2hvcnQ=', 'not base64 at all!', `${PLACEHOLDER_KEY}AA`])(
    'refuses the server actions key %j, which is not 32 bytes of base64, without echoing it',
    (value) => {
      // Act
      const env = {
        APP_ENV: 'production',
        NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: value,
        STOREFRONT_TRUST_EDGE_IP: 'true',
      };
      const issues = deliveryEnvIssues(env);
      // Assert
      expect(issues).toEqual(['NEXT_SERVER_ACTIONS_ENCRYPTION_KEY must be 32 bytes encoded in base64']);
      expect(issues.join('')).not.toContain(value);
    },
  );

  it.each([
    ['STOREFRONT_ASSET_BASE', 'ftp://assets', 'STOREFRONT_ASSET_BASE must be an http(s) URL or a path starting with /'],
    [
      'STOREFRONT_ASSET_PREFIX',
      'cdn.example',
      'STOREFRONT_ASSET_PREFIX must be an http(s) URL or a path starting with /',
    ],
    ['STOREFRONT_TRUST_EDGE_IP', 'yes', 'STOREFRONT_TRUST_EDGE_IP must be true or false'],
  ])('refuses %s=%s', (key, value, issue) => {
    expect(deliveryEnvIssues({ APP_ENV: 'development', [key]: value })).toEqual([issue]);
  });

  it('accepts asset URLs and same-origin paths', () => {
    const env = {
      APP_ENV: 'test',
      STOREFRONT_ASSET_BASE: 'https://assets.example.dz/assets',
      STOREFRONT_ASSET_PREFIX: '/static',
    };
    expect(deliveryEnvIssues(env)).toEqual([]);
  });

  it('trusts the edge address only when STOREFRONT_TRUST_EDGE_IP is exactly true', () => {
    expect(readTrustEdgeIp({ STOREFRONT_TRUST_EDGE_IP: 'true' })).toBe(true);
    expect(readTrustEdgeIp({ STOREFRONT_TRUST_EDGE_IP: 'false' })).toBe(false);
    expect(readTrustEdgeIp({})).toBe(false);
  });
});
