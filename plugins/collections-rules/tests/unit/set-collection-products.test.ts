import { COLLECTION_MAX_MANUAL_PRODUCTS, COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CollectionProductsService } from '../../application/collection-products.service';
import { ProductCollectionsService } from '../../application/product-collections.service';
import { ProductLinksService } from '../../application/product-links.service';
import { SetCollectionProductsService } from '../../application/set-collection-products.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { automaticCollection, manualCollection } from '../support/arrange-collections';
import { scopeA, scopeA2 } from '../support/builders';

const ctx = asOperationContext({});
const C = COLLECTIONS_ERROR_CODES;
const ALL = { skip: 0, take: COLLECTION_MAX_MANUAL_PRODUCTS };

let world: FakeCollectionWorld;

beforeEach(() => {
  world = new FakeCollectionWorld();
  world.facts.add(scopeA, '1', '2', '3');
  world.facts.add(scopeA2, '9');
});

const setProducts = (collectionId: string, productIds: string[]) =>
  new SetCollectionProductsService(world.ports).set(ctx, scopeA, collectionId, { productIds });
const productsOf = async (collectionId: string): Promise<string[]> => {
  const page = await new CollectionProductsService(world.ports).list(ctx, scopeA, collectionId, ALL);
  return page.items.map((item) => item.productId);
};

describe('SetCollectionProductsService.set', () => {
  it('keeps the hand-given order and a later reorder replaces it', async () => {
    // Arrange
    const collectionId = await manualCollection(world, scopeA);

    // Act
    const first = await setProducts(collectionId, ['3', '1', '2']);
    const afterFirst = await productsOf(collectionId);
    await setProducts(collectionId, ['1', '3']);

    // Assert
    expect(first.productCount).toBe(3);
    expect(afterFirst).toEqual(['3', '1', '2']);
    expect(await productsOf(collectionId)).toEqual(['1', '3']);
  });

  it('takes the store lock in a transaction and publishes a membership change', async () => {
    // Arrange
    const collectionId = await manualCollection(world, scopeA);
    world.steps.length = 0;
    world.events.published.length = 0;

    // Act
    await setProducts(collectionId, ['1']);

    // Assert
    expect(world.steps.slice(0, 2)).toEqual(['transaction', `lock ${scopeA.storeId}`]);
    expect(world.events.published).toEqual([{ scope: scopeA, collectionId, change: 'membership' }]);
  });

  it('refuses an automatic collection with not-manual', async () => {
    // Arrange
    const collectionId = await automaticCollection(world, scopeA);

    // Act
    const set = setProducts(collectionId, ['1']);

    // Assert
    await expect(set).rejects.toMatchObject({ code: C.NOT_MANUAL });
  });

  it.each([
    ["another store's product", '9'],
    ['a product that does not exist', '404'],
    ['a malformed id', 'abc'],
  ])('refuses %s with product-not-found and writes nothing', async (_case, productId) => {
    // Arrange
    const collectionId = await manualCollection(world, scopeA);
    await setProducts(collectionId, ['2']);

    // Act
    const set = setProducts(collectionId, ['1', productId]);

    // Assert
    await expect(set).rejects.toMatchObject({ code: C.PRODUCT_NOT_FOUND });
    expect(await productsOf(collectionId)).toEqual(['2']);
  });

  it('refuses more products than the manual cap', async () => {
    // Arrange
    const collectionId = await manualCollection(world, scopeA);
    const ids = Array.from({ length: COLLECTION_MAX_MANUAL_PRODUCTS + 1 }, (_, index) => String(index + 1));

    // Act
    const set = setProducts(collectionId, ids);

    // Assert
    await expect(set).rejects.toMatchObject({ code: C.TOO_MANY_PRODUCTS });
  });

  it("refuses a collection of the business's other store with not-found", async () => {
    // Arrange
    const otherStore = await manualCollection(world, scopeA2);

    // Act
    const set = setProducts(otherStore, ['1']);

    // Assert
    await expect(set).rejects.toMatchObject({ code: C.NOT_FOUND });
  });
});

describe('CollectionProductsService.list', () => {
  it('pages the members with their title, status and price', async () => {
    // Arrange
    const collectionId = await manualCollection(world, scopeA);
    await setProducts(collectionId, ['3', '1', '2']);

    // Act
    const page = await new CollectionProductsService(world.ports).list(ctx, scopeA, collectionId, {
      skip: 1,
      take: 1,
    });

    // Assert
    expect(page).toEqual({
      items: [{ productId: '1', title: 'Product 1', status: 'active', price: 1_000 }],
      totalItems: 3,
    });
  });

  it('counts every member row and leaves a product deleted since out of its page', async () => {
    // Arrange
    const collectionId = await manualCollection(world, scopeA);
    await setProducts(collectionId, ['3', '1', '2']);
    world.facts.remove(scopeA, '1');

    // Act
    const page = await new CollectionProductsService(world.ports).list(ctx, scopeA, collectionId, {
      skip: 0,
      take: 2,
    });

    // Assert
    expect(page.items.map((item) => item.productId)).toEqual(['3']);
    expect(page.totalItems).toBe(3);
  });

  it('reads only the requested page of members', async () => {
    // Arrange
    const collectionId = await manualCollection(world, scopeA);
    await setProducts(collectionId, ['3', '1', '2']);
    world.tables.members.membersOf = () => Promise.reject(new Error('read every member'));

    // Act
    const page = await new CollectionProductsService(world.ports).list(ctx, scopeA, collectionId, {
      skip: 2,
      take: 5,
    });

    // Assert
    expect(page).toMatchObject({ items: [{ productId: '2' }], totalItems: 3 });
  });

  it('answers not-found for a collection the store does not have', async () => {
    // Act
    const list = new CollectionProductsService(world.ports).list(ctx, scopeA, '424242', ALL);

    // Assert
    await expect(list).rejects.toMatchObject({ code: C.NOT_FOUND });
  });
});

describe('product-side appends under the store lock (D2334)', () => {
  it('parallel appends get distinct positions', async () => {
    // Arrange
    const collectionId = await manualCollection(world, scopeA);
    const service = new ProductCollectionsService(world.ports, new ProductLinksService(world.ports));

    // Act
    await Promise.all(
      ['1', '2', '3'].map((productId) => service.set(ctx, scopeA, { productId, collectionIds: [collectionId] })),
    );
    const members = await world.tables.members.membersOf(ctx, scopeA, collectionId);

    // Assert
    expect(new Set(members.map((member) => member.position)).size).toBe(3);
  });
});
