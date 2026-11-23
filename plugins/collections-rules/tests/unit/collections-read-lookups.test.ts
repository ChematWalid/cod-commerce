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

let world: FakeCollectionWorld;
let products: FakeVisibleProducts;
let active: StoreScope | undefined;

const stores: ActiveStorePort = {
  activeStoreOf: () =>
    active === undefined ? Promise.reject(new CollectionsNoActiveStoreError()) : Promise.resolve(active),
};
const reads = () => new CollectionsReadService<string, FakeProductPage>(world.ports, stores, products);

async function hide(collectionId: string): Promise<void> {
  const definition = await world.tables.definitions.findByCollectionId(ctx, scopeA, collectionId);
  if (definition === undefined) throw new Error('the collection was just made');
  await world.tables.definitions.update(ctx, scopeA, { ...definition, visible: false });
}

async function manualWith(scope: StoreScope, ...productIds: string[]): Promise<string> {
  const collectionId = await manualCollection(world, scope);
  const rows = productIds.map((productId, position) => ({ productId, position }));
  await world.tables.members.replaceMembers(ctx, scope, collectionId, rows);
  return collectionId;
}

const slugOf = (collectionId: string): string => world.vendure.rows.get(collectionId)?.meta.slug ?? '';

/** B's collection, made while B's store is the active one. */
async function foreignCollection(): Promise<string> {
  active = scopeB;
  const collectionId = await manualWith(scopeB, '8');
  active = scopeA;
  return collectionId;
}

beforeEach(() => {
  world = new FakeCollectionWorld();
  products = new FakeVisibleProducts();
  active = scopeA;
});

describe('CollectionsReadService.visibleMemberIds (P3.S2, D3206)', () => {
  it('answers every member of a visible manual collection in hand order, whatever the catalog shows', async () => {
    // Arrange
    const collectionId = await manualWith(scopeA, '3', '1', '2');
    products.hidden.add('1');

    // Act
    const ids = await reads().visibleMemberIds(ctx, collectionId);

    // Assert
    expect(ids).toEqual(['3', '1', '2']);
    expect(products.given).toEqual([]);
  });

  it('answers every member of an automatic collection, past the newest-read cap', async () => {
    // Arrange
    const memberIds = ['4', '10', '7', '2', '9', '11'];
    const collectionId = await automaticCollection(world, scopeA, memberIds);

    // Act
    const ids = await reads().visibleMemberIds(ctx, collectionId);

    // Assert
    expect([...(ids ?? [])].sort()).toEqual([...memberIds].sort());
    expect(ids?.length).toBeGreaterThan(products.maxNewestIds);
  });

  it("a hidden collection, B's, an unknown or a malformed id answers undefined", async () => {
    // Arrange
    const hidden = await manualWith(scopeA, '1');
    await hide(hidden);
    const foreign = await foreignCollection();

    // Act
    const answers = await Promise.all(
      [hidden, foreign, '999999', 'abc', '-1', '1.5', '99999999999999999999', ''].map((id) =>
        reads().visibleMemberIds(ctx, id),
      ),
    );

    // Assert
    expect(answers.every((answer) => answer === undefined)).toBe(true);
  });

  it('a collection whose Vendure collection left the store answers undefined', async () => {
    // Arrange
    const collectionId = await manualWith(scopeA, '1');
    world.vendure.rows.delete(collectionId);

    // Act / Assert
    expect(await reads().visibleMemberIds(ctx, collectionId)).toBeUndefined();
  });

  it('a context without an active store is refused', async () => {
    // Arrange
    const collectionId = await manualWith(scopeA, '1');
    active = undefined;

    // Act / Assert
    await expect(reads().visibleMemberIds(ctx, collectionId)).rejects.toBeInstanceOf(CollectionsNoActiveStoreError);
  });
});

describe('CollectionsReadService.findVisibleBySlug (P3.S2 /category/[slug])', () => {
  it('finds a visible collection of the active store by its slug, with only what a buyer may see', async () => {
    // Arrange
    const collectionId = await manualWith(scopeA, '1');

    // Act
    const found = await reads().findVisibleBySlug(ctx, slugOf(collectionId));

    // Assert
    expect(found).toMatchObject({ id: collectionId, slug: slugOf(collectionId), featuredAsset: null });
    expect(Object.keys(found ?? {}).sort()).toEqual(
      ['description', 'featuredAsset', 'id', 'position', 'slug', 'title'].sort(),
    );
  });

  it("a hidden collection's, B's, an unknown or an empty slug answers undefined", async () => {
    // Arrange
    const hidden = await manualWith(scopeA, '1');
    await hide(hidden);
    const foreign = await foreignCollection();

    // Act
    const answers = await Promise.all(
      [slugOf(hidden), slugOf(foreign), 'no-such-collection', '', '   '].map((slug) =>
        reads().findVisibleBySlug(ctx, slug),
      ),
    );

    // Assert
    expect(answers.every((answer) => answer === undefined)).toBe(true);
  });

  it('a context without an active store is refused', async () => {
    // Arrange
    const collectionId = await manualWith(scopeA, '1');
    active = undefined;

    // Act / Assert
    await expect(reads().findVisibleBySlug(ctx, slugOf(collectionId))).rejects.toBeInstanceOf(
      CollectionsNoActiveStoreError,
    );
  });
});
