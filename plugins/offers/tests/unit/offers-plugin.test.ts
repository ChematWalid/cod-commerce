import { CatalogPlugin } from '@cod/plugin-catalog';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { describe, expect, it } from 'vitest';
import {
  BUYER_HISTORY_REGISTRAR,
  COLLECTION_MEMBERSHIP_REGISTRAR,
  OFFER_USAGE_REGISTRAR,
  OffersPlugin,
  SHIPPING_QUOTE_REGISTRAR,
  UNIT_PRICE_RESOLVER_REGISTRAR,
} from '../../index';

/** Nest's module metadata key for `imports`, and Vendure's key for the compatibility range. */
const IMPORTS_KEY = 'imports';
const COMPATIBILITY_KEY = 'compatibility';
const EXPORTS_KEY = 'exports';

describe('OffersPlugin', () => {
  it('declares compatibility ^3.8.0 and imports tenancy and catalog', () => {
    // Arrange
    const plugin = OffersPlugin;

    // Act
    const imports = Reflect.getMetadata(IMPORTS_KEY, plugin) as readonly unknown[];
    const compatibility: unknown = Reflect.getMetadata(COMPATIBILITY_KEY, plugin);

    // Assert
    expect(imports).toEqual(expect.arrayContaining([TenancyPlugin, CatalogPlugin]));
    expect(compatibility).toBe('^3.8.0');
  });

  it('exports the five seam registrars other plugins register on (D2423)', () => {
    // Arrange
    const plugin = OffersPlugin;

    // Act
    const exported = Reflect.getMetadata(EXPORTS_KEY, plugin) as readonly unknown[];

    // Assert
    expect(exported).toEqual(
      expect.arrayContaining([
        UNIT_PRICE_RESOLVER_REGISTRAR,
        COLLECTION_MEMBERSHIP_REGISTRAR,
        SHIPPING_QUOTE_REGISTRAR,
        BUYER_HISTORY_REGISTRAR,
        OFFER_USAGE_REGISTRAR,
      ]),
    );
  });
});
