import { CollectionsRulesPlugin } from '@cod/plugin-collections-rules';
import { DeliveryPricingPlugin } from '@cod/plugin-delivery-pricing';
import { GeoPlugin } from '@cod/plugin-geo';
import { OffersPlugin } from '@cod/plugin-offers';
import { StorefrontApiPlugin } from '@cod/plugin-storefront-api';
import { describe, expect, it } from 'vitest';
import { loadEnv, SERVER_ROLES, type ServerRole } from '../../src/config/env';
import { buildPlugins } from '../../src/config/plugins.config';
import { CORE_ENV } from '../support/deployed-env.fixture';

const valid = CORE_ENV;

/** The P3 plugins' places in `buildPlugins` (P3.S1 and P3.S2), next to `plugins-registered.test.ts`. */
describe('buildPlugins order of the P3 plugins', () => {
  // Every role: migrate creates the geo (D3116) and fee tables; delivery pricing follows geo and the offers (P3.S1).
  it.each(SERVER_ROLES)('registers GeoPlugin, the offers, then DeliveryPricingPlugin for the %s role', (role) => {
    // Arrange
    const env = loadEnv({ ...valid, ROLE: role });

    // Act
    const plugins = buildPlugins(env, role);

    // Assert
    expect(plugins).toEqual(expect.arrayContaining([GeoPlugin, OffersPlugin, DeliveryPricingPlugin]));
    expect(plugins.indexOf(OffersPlugin)).toBeGreaterThan(plugins.indexOf(GeoPlugin));
    expect(plugins.indexOf(DeliveryPricingPlugin)).toBeGreaterThan(plugins.indexOf(OffersPlugin));
  });

  // On every role: `migrate` creates its table and the worker feeds it; it reads the collections, so it comes after.
  it.each(SERVER_ROLES)('registers StorefrontApiPlugin after the collections for the %s role', (role: ServerRole) => {
    // Arrange
    const env = loadEnv({ ...valid, ROLE: role });

    // Act
    const plugins = buildPlugins(env, role);

    // Assert
    expect(plugins.indexOf(StorefrontApiPlugin)).toBeGreaterThan(Math.max(plugins.indexOf(CollectionsRulesPlugin), 0));
  });
});
