import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { ClientIpResolver } from './api/client-ip.resolver';
import { RateLimitGuard } from './api/rate-limit.guard';
import { RateLimiter } from './domain/rate-limiter';
import { createLimiterRedis, ValkeyRateLimiter } from './infrastructure/valkey-rate-limiter';

/** How {@link RateLimitPlugin} is configured. */
export interface RateLimitPluginOptions {
  readonly redisUrl: string;
  /** The request header that carries the client address (production: `cf-connecting-ip`); empty means `req.ip`. */
  readonly clientIpHeader: string;
}

const LOG_CONTEXT = 'RateLimitPlugin';

function requireOptions(): RateLimitPluginOptions {
  const { options } = RateLimitPlugin;
  if (options === undefined) {
    throw new Error('RateLimitPlugin is registered without options: use RateLimitPlugin.init(...)');
  }
  return options;
}

function createRateLimiter(): RateLimiter {
  return new ValkeyRateLimiter(createLimiterRedis(requireOptions().redisUrl), {
    logger: {
      error: (message) => {
        Logger.error(message, LOG_CONTEXT);
      },
    },
  });
}

/** Valkey token buckets that other plugins use through `RateLimiter` and `@RateLimit` (D28 to D31). */
@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    { provide: RateLimiter, useFactory: createRateLimiter },
    { provide: ClientIpResolver, useFactory: () => new ClientIpResolver(requireOptions().clientIpHeader) },
    RateLimitGuard,
  ],
  exports: [RateLimiter, ClientIpResolver, RateLimitGuard],
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class RateLimitPlugin {
  static options: RateLimitPluginOptions | undefined;

  /** Registers the plugin with its options. */
  static init(options: RateLimitPluginOptions): typeof RateLimitPlugin {
    RateLimitPlugin.options = options;
    return RateLimitPlugin;
  }
}
