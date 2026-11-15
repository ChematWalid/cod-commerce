import { CatalogPlugin } from '@cod/plugin-catalog';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import type { QuoteKeyRing } from '@cod/shared/quote-keys';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { QUOTE_KEY_RING } from './application/tokens';
import { OFFERS_ENTITIES } from './infrastructure/offers-entities';
import { OFFERS_PROVIDERS, OFFERS_REGISTRARS } from './infrastructure/offers.providers';

/** How the server configures {@link OffersPlugin}. */
export interface OffersPluginOptions {
  /** The HMAC keys of the signed quotes, built from `QUOTE_HMAC_KEYS` and its active kid (D2422). */
  readonly quoteKeys: QuoteKeyRing;
}

/**
 * The pricing and offer engine of a store (ADR 0004, D2400): offers, discount codes and signed quotes. It imports
 * tenancy, whose guard scopes every call, and the catalog, whose variants it prices. This module only wires the layers.
 */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, CatalogPlugin],
  entities: OFFERS_ENTITIES,
  providers: [
    { provide: QUOTE_KEY_RING, useFactory: (): QuoteKeyRing => OffersPlugin.requireOptions().quoteKeys },
    ...OFFERS_PROVIDERS,
  ],
  exports: [...OFFERS_REGISTRARS],
  compatibility: '^3.8.0',
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- a Vendure plugin is a decorated class
export class OffersPlugin {
  static options: OffersPluginOptions | undefined;

  /** Registers the plugin with its options. */
  static init(options: OffersPluginOptions): typeof OffersPlugin {
    OffersPlugin.options = options;
    return OffersPlugin;
  }

  /** The options `init` set; a missing `init` stops the boot. */
  static requireOptions(): OffersPluginOptions {
    if (OffersPlugin.options === undefined) {
      throw new Error('OffersPlugin needs its options: use OffersPlugin.init(...)');
    }
    return OffersPlugin.options;
  }
}
