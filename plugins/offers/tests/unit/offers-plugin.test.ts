import { CatalogPlugin } from '@cod/plugin-catalog';
import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { describe, expect, it } from 'vitest';
import {
  BUYER_HISTORY_REGISTRAR,
  COLLECTION_MEMBERSHIP_REGISTRAR,
  OFFER_USAGE_REGISTRAR,
  OfferAdminService,
  OffersPlugin,
  OfferUsageService,
  ORDER_ADDON_TARGET_REGISTRAR,
  OrderAddonService,
  PricingService,
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

  it('exports the pricing, offer admin and offer usage use cases (D2408, D2431, D2447)', () => {
    // Arrange
    const plugin = OffersPlugin;

    // Act
    const exported = Reflect.getMetadata(EXPORTS_KEY, plugin) as readonly unknown[];

    // Assert
    expect(exported).toEqual(expect.arrayContaining([PricingService, OfferAdminService, OfferUsageService]));
  });

  it('imports the platform outbox and exports the order add-on service and its order source registrar (D2508)', () => {
    // Arrange
    const plugin = OffersPlugin;

    // Act
    const imports = Reflect.getMetadata(IMPORTS_KEY, plugin) as readonly unknown[];
    const exported = Reflect.getMetadata(EXPORTS_KEY, plugin) as readonly unknown[];

    // Assert
    expect(imports).toEqual(expect.arrayContaining([PlatformOutboxPlugin]));
    expect(exported).toEqual(expect.arrayContaining([OrderAddonService, ORDER_ADDON_TARGET_REGISTRAR]));
  });
});
