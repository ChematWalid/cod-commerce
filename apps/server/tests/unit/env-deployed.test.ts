import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';
import {
  DEPLOYED_OVERRIDES,
  DEPLOYED_PASSWORD,
  STRONG_SECRETS,
  TEST_ENV,
  syntheticPassword,
  syntheticSecret,
} from '../support/deployed-env.fixture';
import { failureOf as envFailure, issuePaths } from '../support/env-failure';

/** A valid environment that is not deployed; each test sets APP_ENV itself. */
const valid = { ...TEST_ENV };
const { CLIENT_IP_HEADER } = DEPLOYED_OVERRIDES;

const failureOf = (overrides: Record<string, string | undefined>) => envFailure({ ...valid, ...overrides });

describe('loadEnv in a deployed environment', () => {
  it.each(['staging', 'production'])('requires CLIENT_IP_HEADER in %s (RL-4)', (appEnv) => {
    const deployed = { APP_ENV: appEnv, SUPERADMIN_PASSWORD: DEPLOYED_PASSWORD };

    expect(issuePaths(failureOf({ ...deployed, CLIENT_IP_HEADER: undefined }))).toEqual(['CLIENT_IP_HEADER']);
    expect(loadEnv({ ...valid, ...deployed, CLIENT_IP_HEADER }).CLIENT_IP_HEADER).toBe(CLIENT_IP_HEADER);
  });

  it.each(['development', 'test'])('leaves CLIENT_IP_HEADER optional in %s', (appEnv) => {
    expect(loadEnv({ ...valid, APP_ENV: appEnv }).CLIENT_IP_HEADER).toBe('');
  });

  describe('secret strength (SRV-8)', () => {
    const strong = {
      APP_ENV: 'production',
      CLIENT_IP_HEADER,
      ...STRONG_SECRETS,
      SUPERADMIN_PASSWORD: DEPLOYED_PASSWORD,
    };

    it.each(['staging', 'production'])('accepts strong secrets in %s', (appEnv) => {
      expect(() => loadEnv({ ...valid, ...strong, APP_ENV: appEnv })).not.toThrow();
    });

    const weakSecrets: [string, string][] = [
      ['COOKIE_SECRET', 'k'.repeat(40)],
      ['COOKIE_SECRET', 'abc'.repeat(14)],
      ['AUTH_TOKEN_SECRET', 'q'.repeat(40)],
      ['SUPERADMIN_PASSWORD', 'a'.repeat(20)],
      ['S3_SECRET_KEY', 'a'.repeat(64)],
      ['S3_SECRET_KEY', 'ab12'.repeat(16)],
      ['INTERNAL_HMAC_KEYS', `k1:${'q'.repeat(40)}`],
      ['TENANT_SECRET_KEKS', `k1:${'1'.repeat(64)}`],
    ];

    describe.each(['staging', 'production'])('in %s', (appEnv) => {
      it.each(weakSecrets)('refuses a weak %s (%#), without echoing it', (name, value) => {
        const error = failureOf({ ...strong, APP_ENV: appEnv, [name]: value });

        expect(issuePaths(error)).toEqual([name]);
        expect(error.message).not.toContain(value.split(':').pop());
      });
    });

    it('refuses a secret of exactly 9 distinct characters and accepts one of exactly 10', () => {
      const nine = 'abcdefghi'.repeat(5);
      const ten = 'abcdefghij'.repeat(4);

      expect(issuePaths(failureOf({ ...strong, COOKIE_SECRET: nine }))).toEqual(['COOKIE_SECRET']);
      expect(() => loadEnv({ ...valid, ...strong, COOKIE_SECRET: ten })).not.toThrow();
    });

    it('refuses a SUPERADMIN_PASSWORD shorter than 12 characters when deployed only', () => {
      const tenCharacters = syntheticPassword(10);

      expect(issuePaths(failureOf({ ...strong, SUPERADMIN_PASSWORD: tenCharacters }))).toEqual(['SUPERADMIN_PASSWORD']);
      expect(() =>
        loadEnv({ ...valid, ...strong, APP_ENV: 'development', SUPERADMIN_PASSWORD: tenCharacters }),
      ).not.toThrow();
    });

    it('accepts a deployed SUPERADMIN_PASSWORD of exactly 12 characters and refuses 11', () => {
      expect(issuePaths(failureOf({ ...strong, SUPERADMIN_PASSWORD: syntheticPassword(11) }))).toEqual([
        'SUPERADMIN_PASSWORD',
      ]);
      expect(() => loadEnv({ ...valid, ...strong, SUPERADMIN_PASSWORD: syntheticPassword(12) })).not.toThrow();
    });

    it('refuses a short COOKIE_SECRET without the placeholder marker in production', () => {
      const shortSecret = syntheticSecret('short-cookie-secret', 15);

      expect(issuePaths(failureOf({ ...strong, COOKIE_SECRET: shortSecret }))).toEqual(['COOKIE_SECRET']);
    });

    it.each(['development', 'test'])('leaves weak secrets alone in %s', (appEnv) => {
      const weak = { COOKIE_SECRET: 'k'.repeat(40), SUPERADMIN_PASSWORD: 'a'.repeat(8), S3_SECRET_KEY: 'a'.repeat(64) };

      expect(() => loadEnv({ ...valid, ...weak, APP_ENV: appEnv })).not.toThrow();
    });
  });

  describe('PLATFORM_DOMAIN (SRV-9)', () => {
    const deployed = { CLIENT_IP_HEADER };

    it.each(['staging', 'production'])('refuses platform.invalid in %s', (appEnv) => {
      expect(issuePaths(failureOf({ ...deployed, APP_ENV: appEnv, PLATFORM_DOMAIN: 'platform.invalid' }))).toEqual([
        'PLATFORM_DOMAIN',
      ]);
    });

    it.each(['invalid', 'test', 'example', 'localhost', 'local', 'shop.example.test', 'a.b.local', 'app.localhost'])(
      'refuses %s in production',
      (domain) => {
        expect(issuePaths(failureOf({ ...deployed, APP_ENV: 'production', PLATFORM_DOMAIN: domain }))).toEqual([
          'PLATFORM_DOMAIN',
        ]);
      },
    );

    it.each(['souk.example.dz', 'example.com', 'souk.test.dz', 'localhost.dz'])(
      'accepts %s in production',
      (domain) => {
        expect(() => loadEnv({ ...valid, ...deployed, APP_ENV: 'production', PLATFORM_DOMAIN: domain })).not.toThrow();
      },
    );

    it.each(['development', 'test'])('keeps platform.invalid and localhost valid in %s', (appEnv) => {
      expect(loadEnv({ ...valid, APP_ENV: appEnv, PLATFORM_DOMAIN: 'platform.invalid' }).PLATFORM_DOMAIN).toBe(
        'platform.invalid',
      );
      expect(loadEnv({ ...valid, APP_ENV: appEnv, PLATFORM_DOMAIN: 'localhost' }).PLATFORM_DOMAIN).toBe('localhost');
    });
  });
});
