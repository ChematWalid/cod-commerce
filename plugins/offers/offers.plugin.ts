import { CatalogPlugin } from '@cod/plugin-catalog';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

/**
 * How the server configures {@link OffersPlugin}. Empty until the quote key ring arrives (P2.S4 Task 4).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the options grow with the key ring (Task 4).
export interface OffersPluginOptions {}

/**
 * The pricing and offer engine of a store (ADR 0004, D2400): offers, discount codes and signed quotes. It imports
 * tenancy, whose guard scopes every call, and the catalog, whose variants it prices. This module only wires the layers.
 */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, CatalogPlugin],
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
