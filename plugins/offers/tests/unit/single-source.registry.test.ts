import { describe, expect, it } from 'vitest';
import {
  newBuyerHistoryRegistry,
  newCollectionMembershipRegistry,
  newOfferUsageRegistry,
  newShippingQuoteRegistry,
} from '../../application/default-sources';
import { SingleSourceRegistry } from '../../application/single-source.registry';
import { toCoreId } from '../../domain/core-id';
import { matchingLines } from '../../domain/engine/targets';
import type { CollectionMembership } from '../../domain/ports/collection-membership.port';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { aLine, anOffer } from '../support/builders';
import { scopeA } from '../support/offer-records';
import { UNRESOLVED_SHIPPING } from '../../domain/snapshot';

const ctx = asOperationContext({});
const buyer = { phone: '+213555123456' };

const oneCollection: CollectionMembership = {
  collectionsOf: (_ctx, _scope, productIds) => Promise.resolve(new Map(productIds.map((id) => [id, ['77']]))),
  existingCollectionIds: () => Promise.resolve(['77']),
};

describe('SingleSourceRegistry', () => {
  it('answers with the default until a source registers, then with that source', () => {
    // Arrange
    const registry = new SingleSourceRegistry('test source', 'default');

    // Act
    const before = registry.current();
    registry.register('registered');

    // Assert
    expect(before).toBe('default');
    expect(registry.current()).toBe('registered');
  });

  it('refuses a second collection source', () => {
    // Arrange
    const registry = newCollectionMembershipRegistry();
    registry.register(oneCollection);

    // Act
    const again = () => {
      registry.register(oneCollection);
    };

    // Assert
    expect(again).toThrow(/collection membership source/);
  });

  it('returns no memberships by default so a collection target matches nothing', async () => {
    // Arrange
    const registry = newCollectionMembershipRegistry();
    const offer = anOffer({ targets: [{ role: 'buy', refType: 'collection', refId: '77' }] });

    // Act
    const memberships = await registry.current().collectionsOf(ctx, scopeA, [toCoreId('1')]);
    const line = aLine({ productId: '1', collectionIds: memberships.get('1') ?? [] });

    // Assert
    expect(memberships.size).toBe(0);
    expect(matchingLines(offer, [line])).toEqual([]);
  });

  it('answers every collection id unchanged by default, so collection targets stay unchecked (D2342)', async () => {
    // Arrange
    const registry = newCollectionMembershipRegistry();

    // Act
    const existing = await registry.current().existingCollectionIds(ctx, scopeA, ['77', '404']);

    // Assert
    expect(existing).toEqual(['77', '404']);
  });

  it('asks the registered source which collections exist (D2342)', async () => {
    // Arrange
    const registry = newCollectionMembershipRegistry();
    registry.register(oneCollection);

    // Act
    const existing = await registry.current().existingCollectionIds(ctx, scopeA, ['77', '404']);

    // Assert
    expect(existing).toEqual(['77']);
  });

  it('reports an unresolved delivery by default', async () => {
    // Arrange
    const registry = newShippingQuoteRegistry();

    // Act
    const quote = await registry.current().quote(ctx, scopeA, {
      provinceCode: '16',
      stopdesk: false,
      items: [{ productId: toCoreId('1'), variantId: toCoreId('11'), quantity: 2, weightGrams: 1_200 }],
    });

    // Assert
    expect(quote).toEqual({ resolved: false, baseFee: 0, overweightFee: 0, speed: null });
    expect(quote).toBe(UNRESOLVED_SHIPPING);
  });

  it('counts no orders by default', async () => {
    // Arrange
    const registry = newBuyerHistoryRegistry();

    // Act
    const count = await registry.current().orderCountOf(ctx, scopeA, buyer);

    // Assert
    expect(count).toBe(0);
  });

  it('counts no per-buyer uses by default', async () => {
    // Arrange
    const registry = newOfferUsageRegistry();

    // Act
    const uses = await registry.current().perBuyer(ctx, scopeA, ['7001'], buyer);

    // Assert
    expect(uses.size).toBe(0);
  });

  it.each([
    ['shipping quote source', newShippingQuoteRegistry],
    ['buyer history source', newBuyerHistoryRegistry],
    ['offer usage source', newOfferUsageRegistry],
  ] as const)('refuses a second %s', (name, make) => {
    // Arrange
    const registry = make() as SingleSourceRegistry<unknown>;
    registry.register({});

    // Act
    const again = () => {
      registry.register({});
    };

    // Assert
    expect(again).toThrow(name);
  });
});
