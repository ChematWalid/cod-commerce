import { toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  newBuyerHistoryRegistry,
  newCollectionMembershipRegistry,
  newOfferUsageRegistry,
  newShippingQuoteRegistry,
} from '../../application/default-sources';
import { PricingSnapshotLoader } from '../../application/pricing-snapshot.loader';
import { UnitPriceRegistry } from '../../application/unit-price.registry';
import { OfferKindRegistry } from '../../domain/engine/kind-registry';
import { BUILT_IN_OFFER_KINDS } from '../../domain/kinds';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import type { GatedLine, ResolverPrice, UnitPriceResolver } from '../../domain/ports/unit-price-resolver.port';
import { T0 } from '../support/builders';
import { scopeA } from '../support/offer-records';
import { SELLABLE } from '../support/pricing-service';
import { FixedVariantGate } from '../fakes/fixed-variant-gate';
import { InMemoryOfferTables } from '../fakes/in-memory-offer-repository';
import { RecordingPricingLogger } from '../fakes/recording-pricing-logger';

const ctx = asOperationContext({});
const ADDON_OFFER_ID = toSnowflake('7006');
/** The price a pack resolver (P2.S2) answers for variant 12, not its list price of 3,000. */
const PACK_PRICE: ResolverPrice = { unitPrice: 2_500, originalPrice: 3_400, source: 'pack' };

/** A pack-like resolver that re-prices variant 12 and records the lines it was asked for. */
function aPackResolver() {
  const seen: (readonly GatedLine[])[] = [];
  const resolver: UnitPriceResolver = {
    key: 'pack',
    resolve: (_ctx, _scope, lines) => {
      seen.push(lines);
      const owned = lines.filter((line) => line.variantId === '12');
      return Promise.resolve(new Map(owned.map((line) => [line.variantId, PACK_PRICE])));
    },
  };
  return { resolver, seen };
}

/** A loader whose unit prices go through the registry with the pack-like resolver registered. */
function setUpLoaderWithPackResolver() {
  const tables = new InMemoryOfferTables();
  const unitPrices = new UnitPriceRegistry(new FixedVariantGate(SELLABLE));
  const pack = aPackResolver();
  unitPrices.register(pack.resolver);
  const loader = new PricingSnapshotLoader({
    offers: tables.offers,
    codes: tables.codes,
    unitPrices,
    collections: newCollectionMembershipRegistry(),
    shipping: newShippingQuoteRegistry(),
    buyers: newBuyerHistoryRegistry(),
    usage: newOfferUsageRegistry(),
    kinds: new OfferKindRegistry(BUILT_IN_OFFER_KINDS),
    logger: new RecordingPricingLogger(),
    clock: { now: () => T0 },
  });
  return { loader, seen: pack.seen };
}

describe('PricingSnapshotLoader: add-ons through the unit price resolvers (D2506, D2423)', () => {
  it("prices an add-on whose variant is a pack at the resolver's price, like a cart line", async () => {
    // Arrange
    const { loader } = setUpLoaderWithPackResolver();
    const addons = [{ offerId: ADDON_OFFER_ID, variantId: '12', quantity: 1 }];

    // Act
    const loaded = await loader.load(ctx, scopeA, {
      lines: [{ variantId: '11', quantity: 1 }],
      destination: null,
      buyer: null,
      codes: [],
      addons,
    });

    // Assert
    expect(loaded.addons).toEqual([
      {
        offerId: '7006',
        variantId: '12',
        quantity: 1,
        priced: { productId: '2', originalPrice: PACK_PRICE.unitPrice, collectionIds: [] },
      },
    ]);
  });

  it('asks the resolver once for the cart lines and the add-ons together', async () => {
    // Arrange
    const { loader, seen } = setUpLoaderWithPackResolver();
    const addons = [{ offerId: ADDON_OFFER_ID, variantId: '12', quantity: 1 }];

    // Act
    await loader.load(ctx, scopeA, {
      lines: [{ variantId: '11', quantity: 1 }],
      destination: null,
      buyer: null,
      codes: [],
      addons,
    });

    // Assert
    expect(seen.map((lines) => lines.map((line) => line.variantId).sort())).toEqual([['11', '12']]);
  });
});
