import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CollectionsReadService } from '../../application/collections-read.service';
import { CollectionsNoActiveStoreError } from '../../domain/no-active-store.error';
import type { ActiveStorePort } from '../../domain/ports/active-store.port';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { type FakeProductPage, FakeVisibleProducts } from '../fakes/fake-visible-products';
import { automaticCollection, manualCollection } from '../support/arrange-collections';
import { scopeA, scopeB } from '../support/builders';

const ctx = asOperationContext({});
const PAGE = { skip: 0, take: 10 };

let world: FakeCollectionWorld;
let products: FakeVisibleProducts;
let active: StoreScope | undefined;

const stores: ActiveStorePort = {
  activeStoreOf: () =>
    active === undefined ? Promise.reject(new CollectionsNoActiveStoreError()) : Promise.resolve(active),
};
const reads = () => new CollectionsReadService<string, FakeProductPage>(world.ports, stores, products);

/** Saves a changed visibility or position of a collection straight in the definitions table. */
async function patchDefinition(collectionId: string, patch: { visible?: boolean; position?: number }): Promise<void> {
  const definition = await world.tables.definitions.findByCollectionId(ctx, scopeA, collectionId);
  if (definition === undefined) throw new Error('the collection was just made');
  await world.tables.definitions.update(ctx, scopeA, { ...definition, ...patch });
}

/** A manual collection of A's store holding `productIds` in that order. */
async function manualWith(...productIds: string[]): Promise<string> {
  const collectionId = await manualCollection(world, scopeA);
  const rows = productIds.map((productId, position) => ({ productId, position }));
  await world.tables.members.replaceMembers(ctx, scopeA, collectionId, rows);
  return collectionId;
}

beforeEach(() => {
  world = new FakeCollectionWorld();
  products = new FakeVisibleProducts();
  active = scopeA;
});

describe('CollectionsReadService.listVisible (D2316)', () => {
  it('a hidden collection is not listed and its products read undefined', async () => {
    // Arrange
    const shown = await manualWith('1');
    const hidden = await manualWith('2');
    await patchDefinition(hidden, { visible: false });

    // Act
    const page = await reads().listVisible(ctx, PAGE);
    const hiddenProducts = await reads().productsOf(ctx, hidden, 'listing', PAGE);

    // Assert
    expect(page.items.map((item) => item.id)).toEqual([shown]);
    expect(page.totalItems).toBe(1);
    expect(hiddenProducts).toBeUndefined();
  });

  it('position orders the list and each item carries only what a buyer may see', async () => {
    // Arrange
    const [late, early] = [await manualWith(), await manualWith()];
    await patchDefinition(late, { position: 9 });
    await patchDefinition(early, { position: 1 });

    // Act
    const page = await reads().listVisible(ctx, PAGE);

    // Assert
    expect(page.items.map((item) => item.id)).toEqual([early, late]);
    expect(Object.keys(page.items[0] ?? {}).sort()).toEqual(
      ['description', 'featuredAsset', 'id', 'position', 'slug', 'title'].sort(),
    );
    expect(page.items[0]).toMatchObject({ id: early, position: 1, featuredAsset: null });
  });

  it('refuses a page outside the bounds', async () => {
    // Act
    const refusals = await Promise.all(
      [
        { skip: -1, take: 10 },
        { skip: 0, take: 0 },
        { skip: 0, take: 101 },
        { skip: 0.5, take: 10 },
      ].map((page) =>
        reads()
          .listVisible(ctx, page)
          .catch((error: unknown) => error),
      ),
    );

    // Assert
    for (const refusal of refusals) {
      expect(refusal).toMatchObject({ code: COLLECTIONS_ERROR_CODES.INVALID_INPUT });
    }
  });

  it('a context without an active store is refused', async () => {
    // Arrange
    const collectionId = await manualWith('1');
    active = undefined;

    // Act
    const listed = reads().listVisible(ctx, PAGE);
    const read = reads().productsOf(ctx, collectionId, 'listing', PAGE);

    // Assert
    await expect(listed).rejects.toBeInstanceOf(CollectionsNoActiveStoreError);
    await expect(read).rejects.toBeInstanceOf(CollectionsNoActiveStoreError);
  });
});

describe('CollectionsReadService.productsOf (D2316, D2310)', () => {
  it('manual products keep their order through the catalog read among ids', async () => {
    // Arrange
    const collectionId = await manualWith('3', '1', '2');
    products.hidden.add('1');

    // Act
    const page = await reads().productsOf(ctx, collectionId, 'listing', { skip: 0, take: 1 });

    // Assert
    expect(page).toEqual({ ids: ['3'], totalItems: 2, read: 'among', context: 'listing' });
    expect(products.given).toEqual([['3', '1', '2']]);
  });

  it('automatic products read newest first, at most the catalog cap of ids', async () => {
    // Arrange
    const collectionId = await automaticCollection(world, scopeA, ['4', '10', '7', '2', '9']);

    // Act
    const page = await reads().productsOf(ctx, collectionId, 'search', PAGE);

    // Assert
    expect(page).toEqual({ ids: ['10', '9', '7'], totalItems: 3, read: 'newest', context: 'search' });
    expect(products.given[0]?.length).toBeLessThanOrEqual(products.maxNewestIds + 1);
  });

  it("B's, unknown and malformed collection ids read undefined for A", async () => {
    // Arrange
    active = scopeB;
    const foreign = await manualCollection(world, scopeB);
    active = scopeA;

    // Act
    const answers = await Promise.all(
      [foreign, '999999', 'abc', '-1', '1.5', '99999999999999999999', ''].map((id) =>
        reads().productsOf(ctx, id, 'listing', PAGE),
      ),
    );

    // Assert
    expect(answers.every((answer) => answer === undefined)).toBe(true);
    expect(products.given).toEqual([]);
  });

  it('a collection whose Vendure collection left the store reads undefined', async () => {
    // Arrange
    const collectionId = await manualWith('1');
    world.vendure.rows.delete(collectionId);

    // Act
    const page = await reads().productsOf(ctx, collectionId, 'listing', PAGE);
    const listed = await reads().listVisible(ctx, PAGE);

    // Assert
    expect(page).toBeUndefined();
    expect(listed.items).toEqual([]);
    expect(listed.totalItems).toBe(0);
  });

  it('listVisible drops a definition whose Vendure collection left the store from the page and its total', async () => {
    // Arrange
    const [kept, gone] = [await manualWith('1'), await manualWith('2')];
    world.vendure.rows.delete(gone);

    // Act
    const listed = await reads().listVisible(ctx, PAGE);

    // Assert
    expect(listed.items.map((item) => item.id)).toEqual([kept]);
    expect(listed.totalItems).toBe(1);
  });
});
