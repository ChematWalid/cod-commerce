import { ClientIpResolver, RateLimitPlugin, type RateLimitPluginOptions } from '@cod/plugin-rate-limit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TenancyPlugin, type TenancyPluginOptions } from '../../tenancy.plugin';

interface FactoryProvider {
  readonly provide: unknown;
  readonly useFactory: () => unknown;
}

const isFactoryOf = (provider: unknown, token: unknown): provider is FactoryProvider =>
  typeof provider === 'object' && provider !== null && 'useFactory' in provider && 'provide' in provider
    ? provider.provide === token
    : false;

/** Builds the rate-limit plugin's client address resolver the way Nest does when the server boots. */
function bootClientIpResolver(): unknown {
  const providers = Reflect.getMetadata('providers', RateLimitPlugin) as readonly unknown[];
  const provider = providers.find((candidate) => isFactoryOf(candidate, ClientIpResolver));
  if (!isFactoryOf(provider, ClientIpResolver)) {
    throw new Error('RateLimitPlugin no longer provides ClientIpResolver through a factory');
  }
  return provider.useFactory();
}

describe('a host that registers the tenancy plugin', () => {
  let rateLimitOptions: RateLimitPluginOptions | undefined;
  let tenancyOptions: TenancyPluginOptions | undefined;

  beforeEach(() => {
    rateLimitOptions = RateLimitPlugin.options;
    tenancyOptions = TenancyPlugin.options;
    RateLimitPlugin.options = undefined;
  });

  afterEach(() => {
    RateLimitPlugin.options = rateLimitOptions;
    TenancyPlugin.options = tenancyOptions;
  });

  it('fails fast at boot when it did not configure the rate-limit plugin itself', () => {
    TenancyPlugin.init({ redisUrl: 'redis://localhost:6380', platformDomain: 'localhost', snowflakeWorkerId: 1 });

    expect(bootClientIpResolver).toThrow(
      'RateLimitPlugin is registered without options: use RateLimitPlugin.init(...)',
    );
  });

  it('boots the rate-limit plugin with the options the host gave it', () => {
    RateLimitPlugin.init({ redisUrl: 'redis://localhost:6380', clientIpHeader: 'x-client-ip' });
    TenancyPlugin.init({ redisUrl: 'redis://localhost:6380', platformDomain: 'localhost', snowflakeWorkerId: 1 });

    expect(bootClientIpResolver()).toBeInstanceOf(ClientIpResolver);
    expect(RateLimitPlugin.options).toEqual({ redisUrl: 'redis://localhost:6380', clientIpHeader: 'x-client-ip' });
  });
});
