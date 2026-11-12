import { getConfigurationFunction, type RuntimeVendureConfig } from '@vendure/core';
import { HardenPlugin } from '@vendure/harden-plugin';
import { describe, expect, it } from 'vitest';
import { buildAuthConfig } from '../../src/config/auth.config';
import { isDeployed } from '../../src/config/deployed-env';
import { loadEnv } from '../../src/config/env';
import { buildPlugins } from '../../src/config/plugins.config';
import { DEPLOYED_OVERRIDES, TEST_ENV } from '../support/deployed-env.fixture';

/** A valid environment for any APP_ENV: strong secrets, a client IP header and a resolvable domain. */
const valid = { ...TEST_ENV, ...DEPLOYED_OVERRIDES };

const envOf = (appEnv: string) => loadEnv({ ...valid, APP_ENV: appEnv });

/** Runs the hardening plugin's own configuration step over an empty api config. */
async function configuredBy(appEnv: string): Promise<RuntimeVendureConfig> {
  const plugins = buildPlugins(envOf(appEnv), 'api');
  expect(plugins).toContain(HardenPlugin);
  const configure = getConfigurationFunction(HardenPlugin);
  expect(configure).toBeDefined();
  const config = { apiOptions: { apolloServerPlugins: [], introspection: true } } as unknown as RuntimeVendureConfig;
  return (await configure?.(config)) ?? config;
}

describe('isDeployed', () => {
  it.each([
    ['staging', true],
    ['production', true],
    ['development', false],
    ['test', false],
  ])('%s is deployed: %s', (appEnv, expected) => {
    expect(isDeployed({ APP_ENV: appEnv })).toBe(expected);
  });
});

describe('API hardening by environment (SRV-10)', () => {
  it.each(['staging', 'production'])('refuses introspection in %s', async (appEnv) => {
    const config = await configuredBy(appEnv);

    expect(HardenPlugin.options.apiMode).toBe('prod');
    expect(config.apiOptions.introspection).toBe(false);
  });

  it.each(['development', 'test'])('keeps introspection in %s', async (appEnv) => {
    const config = await configuredBy(appEnv);

    expect(HardenPlugin.options.apiMode).toBe('dev');
    expect(config.apiOptions.introspection).toBe(true);
  });
});

describe('session cookie flags (SRV-11)', () => {
  it.each(['staging', 'production'])('sets Secure, HttpOnly and SameSite=Lax in %s', (appEnv) => {
    const { cookieOptions } = buildAuthConfig(envOf(appEnv));

    expect(cookieOptions).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax' });
  });

  it.each(['development', 'test'])('stays usable over http in %s', (appEnv) => {
    const { cookieOptions } = buildAuthConfig(envOf(appEnv));

    expect(cookieOptions).toMatchObject({ secure: false, httpOnly: true, sameSite: 'lax' });
  });

  it('keeps the signing secret', () => {
    expect(buildAuthConfig(envOf('production')).cookieOptions?.secret).toBe(valid.COOKIE_SECRET);
  });
});
