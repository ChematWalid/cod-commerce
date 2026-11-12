import type { InternalSigningKey } from '@cod/shared/internal-auth';
import { Logger, VendurePlugin } from '@vendure/core';
import { internalOnlyMiddleware } from './api/internal-only.middleware';
import { INTERNAL_BODY_LIMIT_BYTES, INTERNAL_GUARD_LOG_CONTEXT } from './domain/constants';
import { internalOnlyPrefixes } from './domain/internal-prefixes';

/** How the server configures {@link PlatformWebhooksPlugin}. */
export interface PlatformWebhooksOptions {
  readonly internalKeys: readonly InternalSigningKey[];
}

/**
 * Puts the internal-only guard (D112) in front of the Shop API, `/store` and `/_internal` on every host: a
 * `beforeListen` middleware per prefix, so it runs before Nest's own parsers and guards.
 */
@VendurePlugin({
  configuration: (config) => {
    const { options } = PlatformWebhooksPlugin;
    if (options === undefined || options.internalKeys.length === 0) {
      throw new Error('PlatformWebhooksPlugin needs at least one internal key: use PlatformWebhooksPlugin.init(...)');
    }
    const handler = internalOnlyMiddleware({
      keys: options.internalKeys,
      maxBodyBytes: INTERNAL_BODY_LIMIT_BYTES,
      log: (message) => {
        Logger.warn(message, INTERNAL_GUARD_LOG_CONTEXT);
      },
    });
    for (const route of internalOnlyPrefixes(config.apiOptions.shopApiPath)) {
      config.apiOptions.middleware.push({ route, handler, beforeListen: true });
    }
    return config;
  },
  compatibility: '^3.8.0',
})
// A Vendure plugin is a decorated class; its body stays empty when its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PlatformWebhooksPlugin {
  static options: PlatformWebhooksOptions | undefined;

  /** Registers the plugin with the keys that verify internal requests. */
  static init(options: PlatformWebhooksOptions): typeof PlatformWebhooksPlugin {
    PlatformWebhooksPlugin.options = options;
    return PlatformWebhooksPlugin;
  }
}
