import {
  Collection,
  CollectionAsset,
  Product,
  ProductAsset,
  ProductVariant,
  ProductVariantAsset,
  type RequestContext,
  type TransactionalConnection,
} from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { toCoreId } from '../../domain/core-id';
import { VendureAssetReads } from '../../infrastructure/vendure-asset-reads';

const ctx = {} as RequestContext;
const ASSET = toCoreId('55');

/** A connection whose repositories count one use of the asset for the entity `usedBy`, and none elsewhere. */
function readsWithOneUseIn(usedBy: unknown): VendureAssetReads {
  const connection = {
    getRepository: (_ctx: unknown, entity: unknown) => ({
      count: () => Promise.resolve(entity === usedBy ? 1 : 0),
    }),
  } as unknown as TransactionalConnection;
  return new VendureAssetReads(connection);
}

describe('VendureAssetReads.isInUse', () => {
  it.each([
    ['a product featured image', Product],
    ['a product gallery image', ProductAsset],
    ['a variant featured image', ProductVariant],
    ['a variant gallery image', ProductVariantAsset],
    ['a collection featured image', Collection],
    ['a collection gallery image', CollectionAsset],
  ])('counts %s as a use', async (_use, entity) => {
    // Act
    const inUse = await readsWithOneUseIn(entity).isInUse(ctx, ASSET);

    // Assert
    expect(inUse).toBe(true);
  });

  it('answers false when nothing uses the image', async () => {
    // Act
    const inUse = await readsWithOneUseIn(undefined).isInUse(ctx, ASSET);

    // Assert
    expect(inUse).toBe(false);
  });
});
