import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';
import { TEST_ENV } from '../support/deployed-env.fixture';
import { failureOf as envFailure, issuePaths } from '../support/env-failure';

const valid = TEST_ENV;

const failureOf = (overrides: Record<string, string | undefined>) => envFailure({ ...valid, ...overrides });

describe('loadEnv PLATFORM_DEMO_HANDLERS', () => {
  it('is off by default', () => {
    expect(loadEnv(valid).PLATFORM_DEMO_HANDLERS).toBe(false);
  });

  it('treats a blank value as off', () => {
    expect(loadEnv({ ...valid, PLATFORM_DEMO_HANDLERS: '' }).PLATFORM_DEMO_HANDLERS).toBe(false);
  });

  it.each(['development', 'test'])('can be switched on in %s', (appEnv) => {
    expect(loadEnv({ ...valid, APP_ENV: appEnv, PLATFORM_DEMO_HANDLERS: 'true' }).PLATFORM_DEMO_HANDLERS).toBe(true);
  });

  it('is refused in production', () => {
    const error = failureOf({
      APP_ENV: 'production',
      CLIENT_IP_HEADER: 'cf-connecting-ip',
      PLATFORM_DEMO_HANDLERS: 'true',
    });
    expect(issuePaths(error)).toEqual(['PLATFORM_DEMO_HANDLERS']);
  });

  it('may stay off in production', () => {
    const env = loadEnv({
      ...valid,
      APP_ENV: 'production',
      CLIENT_IP_HEADER: 'cf-connecting-ip',
      PLATFORM_DEMO_HANDLERS: 'false',
    });
    expect(env.PLATFORM_DEMO_HANDLERS).toBe(false);
  });
});
