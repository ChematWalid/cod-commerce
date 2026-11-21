import type { ProductService, ProductVariantService } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { newCollectionMembershipRegistry } from '../../application/default-sources';
import type { CollectionMembership } from '../../domain/ports/collection-membership.port';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import type { StoreScope } from '../../domain/store-scope';
import { VendureOfferTargetCatalog } from '../../infrastructure/vendure-target-catalog';
import { scopeA } from '../support/offer-records';

const ctx = asOperationContext({});

/** Vendure reads that fail the test if called: these cases name no variant or product. */
const unread = { findByIds: () => Promise.reject(new Error('not expected')) };

/** A membership source holding collection 5 in store A only, recording the scope and ids it was asked about. */
class FakeMembership implements CollectionMembership {
  readonly asked: { scope: StoreScope; ids: readonly string[] }[] = [];

  collectionsOf(): Promise<ReadonlyMap<string, readonly string[]>> {
    return Promise.resolve(new Map());
  }

  existingCollectionIds(_ctx: unknown, scope: StoreScope, ids: readonly string[]): Promise<readonly string[]> {
    this.asked.push({ scope, ids });
    return Promise.resolve(scope === scopeA ? ids.filter((id) => id === '5') : []);
  }
}

function catalogOver(membership?: CollectionMembership) {
  const registry = newCollectionMembershipRegistry();
  if (membership !== undefined) registry.register(membership);
  return new VendureOfferTargetCatalog(
    unread as unknown as ProductVariantService,
    unread as unknown as ProductService,
    registry,
  );
}

describe('VendureOfferTargetCatalog collections (D2342)', () => {
  it("keeps only the store's collections, as the registered membership source answers", async () => {
    // Arrange
    const membership = new FakeMembership();
    const catalog = catalogOver(membership);

    // Act
    const found = await catalog.existing(ctx, scopeA, { variantIds: [], productIds: [], collectionIds: ['5', '95'] });

    // Assert
    expect(found).toEqual({ variantIds: [], productIds: [], collectionIds: ['5'] });
    expect(membership.asked).toEqual([{ scope: scopeA, ids: ['5', '95'] }]);
  });

  it('asks the membership source nothing when no collection is named', async () => {
    // Arrange
    const membership = new FakeMembership();
    const catalog = catalogOver(membership);

    // Act
    const found = await catalog.existing(ctx, scopeA, { variantIds: [], productIds: [], collectionIds: [] });

    // Assert
    expect(found.collectionIds).toEqual([]);
    expect(membership.asked).toEqual([]);
  });

  it('leaves collection ids unchecked while no membership source is registered', async () => {
    // Arrange
    const catalog = catalogOver();

    // Act
    const found = await catalog.existing(ctx, scopeA, { variantIds: [], productIds: [], collectionIds: ['404'] });

    // Assert
    expect(found.collectionIds).toEqual(['404']);
  });
});
