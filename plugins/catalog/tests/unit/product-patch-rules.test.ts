import { productInputSchema, type ProductInput, type ProductPatchInput, productPatchSchema } from '@cod/shared';
import type { StoreId } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductService } from '../../application/create-product.service';
import { UpdateProductService } from '../../application/update-product.service';
import { CollectionNotFoundError, MediaNotFoundError } from '../../domain/errors';
import type { OrderManagerCheck } from '../../domain/ports/order-manager-check.port';
import { ProductWorld } from '../fakes/product-world';
import { mediaOf, scopeA, scopeA2, scopeB } from '../support/builders';

const MATRIX: ProductInput = {
  title: 'Shirt',
  status: 'active',
  price: 2500,
  sku: 'TS',
  optionGroups: [
    { name: 'Color', values: ['Red', 'Blue'] },
    { name: 'Size', values: ['S', 'M'] },
  ],
};

/** Team's check as a caller whose store reach the test changes between calls (D2132). */
function switchableReach(): { check: OrderManagerCheck; reach: { stores: ReadonlySet<StoreId> | 'all' } } {
  const reach: { stores: ReadonlySet<StoreId> | 'all' } = { stores: 'all' };
  const check: OrderManagerCheck = {
    unknownIds: (_ctx, _business, _store, ids) => Promise.resolve(ids),
    accessibleStoreIds: () => Promise.resolve(reach.stores),
  };
  return { check, reach };
}

describe('product patch rules', () => {
  let world: ProductWorld;

  beforeEach(() => {
    world = new ProductWorld();
  });

  const create = (input: Partial<ProductInput> = {}, scope = scopeA) =>
    new CreateProductService(world.ports).create(
      world.ctxOf(scope),
      scope,
      productInputSchema.parse({ ...MATRIX, ...input }),
    );
  const update = (id: string, patch: ProductPatchInput, scope = scopeA) =>
    new UpdateProductService(world.ports).update(world.ctxOf(scope), scope, id, productPatchSchema.parse(patch));

  it('keeps the meta description when only the meta title is patched, and clears a field sent as null', async () => {
    // Arrange
    const { product } = await create({ seo: { metaTitle: 'Title', metaDescription: 'Description' } });

    // Act
    const { product: retitled } = await update(product.id, { seo: { metaTitle: 'New title' } });
    const { product: cleared } = await update(product.id, { seo: { metaDescription: null } });

    // Assert
    expect(retitled).toMatchObject({ metaTitle: 'New title', metaDescription: 'Description' });
    expect(cleared).toMatchObject({ metaTitle: 'New title', metaDescription: null });
  });

  it('ignores the edit of a variant whose value the same save removes, and applies the others', async () => {
    // Arrange
    const { product } = await create();
    const [redSmall, redMedium] = product.variants;

    // Act
    const { product: saved } = await update(product.id, {
      optionGroups: [
        { name: 'Color', values: ['Red', 'Blue'] },
        { name: 'Size', values: ['S'] },
      ],
      variants: [
        { id: redMedium?.id ?? '', price: 1 },
        { id: redSmall?.id ?? '', price: 3000 },
      ],
    });

    // Assert
    expect(saved.variants.map((variant) => [variant.name, variant.price])).toEqual([
      ['Shirt - Red / S', 3000],
      ['Shirt - Blue / S', 2500],
    ]);
  });

  it("answers collection not found for a collection of another store's channel or a malformed id", async () => {
    // Arrange
    const foreign = world.products.addCollection(scopeB.storeId);

    // Act / Assert
    await expect(create({ collectionIds: [foreign] })).rejects.toBeInstanceOf(CollectionNotFoundError);
    await expect(create({ collectionIds: ['abc'] })).rejects.toBeInstanceOf(CollectionNotFoundError);
    const { product } = await create();
    await expect(update(product.id, { collectionIds: [foreign] })).rejects.toBeInstanceOf(CollectionNotFoundError);
  });

  it("lets a store-restricted member re-send an image the owner attached from the business's other store", async () => {
    // Arrange
    const { check, reach } = switchableReach();
    world.orderManagerChecks.register(check);
    const otherStore = mediaOf(scopeA2);
    await world.media.insert(world.ctxOf(scopeA2), scopeA2, otherStore);
    const { product } = await create({ featuredAssetId: otherStore.assetId, assetIds: [otherStore.assetId] });
    reach.stores = new Set([scopeA.storeId]);

    // Act
    const { product: saved } = await update(product.id, {
      title: 'Shirt 2',
      featuredAssetId: otherStore.assetId,
      assetIds: [otherStore.assetId],
    });

    // Assert
    expect(saved).toMatchObject({ title: 'Shirt 2', featuredAssetId: otherStore.assetId });
  });

  it('still refuses a store-restricted member adding a new image of a store it does not reach (D2132)', async () => {
    // Arrange
    const { check, reach } = switchableReach();
    world.orderManagerChecks.register(check);
    const held = mediaOf(scopeA2);
    const added = mediaOf(scopeA2);
    await world.media.insert(world.ctxOf(scopeA2), scopeA2, held);
    await world.media.insert(world.ctxOf(scopeA2), scopeA2, added);
    const { product } = await create({ assetIds: [held.assetId] });
    reach.stores = new Set([scopeA.storeId]);

    // Act
    const updating = update(product.id, { assetIds: [held.assetId, added.assetId] });

    // Assert
    await expect(updating).rejects.toBeInstanceOf(MediaNotFoundError);
  });
});
