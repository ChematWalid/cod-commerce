import {
  asCatalogOperationContext,
  type CollectionMembershipSource,
  type CollectionMembershipSourceRegistrar,
  toCoreId,
} from '@cod/plugin-catalog';
import { CATALOG_ERROR_CODES, COLLECTION_MAX_MANUAL_PRODUCTS, COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProductLinksService } from '../../application/product-links.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { CollectionsMembershipSource } from '../../infrastructure/collections-membership.source';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { automaticCollection, manualCollection } from '../support/arrange-collections';
import { scopeA, scopeA2, scopeB } from '../support/builders';

const ctx = asOperationContext({});
const catalogCtx = asCatalogOperationContext({});
const ids = (...values: string[]) => values.map(toCoreId);

let world: FakeCollectionWorld;
let registered: CollectionMembershipSource[];
let source: CollectionsMembershipSource;

beforeEach(() => {
  world = new FakeCollectionWorld();
  world.facts.add(scopeA, '1', '2');
  registered = [];
  const registrar: CollectionMembershipSourceRegistrar = { register: (one) => registered.push(one) };
  source = new CollectionsMembershipSource(new ProductLinksService(world.ports), registrar);
});

const membersOf = async (collectionId: string): Promise<string[]> =>
  (await world.tables.members.membersOf(ctx, scopeA, collectionId)).map((member) => member.productId);

describe('CollectionsMembershipSource', () => {
  it('registers itself with the catalog once on bootstrap', () => {
    // Act
    source.onApplicationBootstrap();

    // Assert
    expect(registered).toEqual([source]);
  });

  it("keeps only the store's manual collections, in the given order", async () => {
    // Arrange
    const [first, second] = [await manualCollection(world, scopeA), await manualCollection(world, scopeA)];
    const automatic = await automaticCollection(world, scopeA);
    const otherStore = await manualCollection(world, scopeA2);

    // Act
    const manual = await source.manualCollectionIdsAmong(catalogCtx, scopeA, ids(second, automatic, otherStore, first));

    // Assert
    expect(manual).toEqual([second, first]);
  });

  it('replaces the manual links under the store lock, appending last and keeping automatic memberships', async () => {
    // Arrange
    const manual = await manualCollection(world, scopeA);
    const automatic = await automaticCollection(world, scopeA, ['1']);
    await world.tables.members.replaceMembers(ctx, scopeA, manual, [{ productId: '2', position: 0 }]);
    world.steps.length = 0;

    // Act
    await source.replaceProductCollections(catalogCtx, scopeA, toCoreId('1'), ids(manual));

    // Assert
    expect(world.steps.slice(0, 2)).toEqual(['transaction', `lock ${scopeA.storeId}`]);
    expect(await membersOf(manual)).toEqual(['2', '1']);
    expect(await membersOf(automatic)).toEqual(['1']);
    expect(await source.collectionIdsOf(catalogCtx, scopeA, toCoreId('1'))).toEqual([manual]);
  });

  it('refuses a collection that is no longer manual with the catalog code and writes nothing', async () => {
    // Arrange
    const manual = await manualCollection(world, scopeA);
    const automatic = await automaticCollection(world, scopeA);

    // Act
    const write = source.replaceProductCollections(catalogCtx, scopeA, toCoreId('1'), ids(manual, automatic));

    // Assert
    await expect(write).rejects.toMatchObject({ code: CATALOG_ERROR_CODES.COLLECTION_NOT_FOUND });
    expect(await membersOf(manual)).toEqual([]);
    expect(await membersOf(automatic)).toEqual([]);
  });

  it.each([
    ["the other store's collection", 'other'],
    ["another business's collection", 'foreign'],
    ['a collection whose Vendure collection left the store', 'stale'],
  ])('refuses %s with the catalog code and writes nothing', async (_case, which) => {
    // Arrange
    const own = await manualCollection(world, scopeA);
    const target =
      which === 'other'
        ? await manualCollection(world, scopeA2)
        : which === 'foreign'
          ? await manualCollection(world, scopeB)
          : await manualCollection(world, scopeA);
    if (which === 'stale') world.vendure.rows.delete(target);

    // Act
    const write = source.replaceProductCollections(catalogCtx, scopeA, toCoreId('1'), ids(own, target));

    // Assert
    await expect(write).rejects.toMatchObject({ code: CATALOG_ERROR_CODES.COLLECTION_NOT_FOUND });
    expect([await membersOf(own), await membersOf(target)]).toEqual([[], []]);
    expect(await source.manualCollectionIdsAmong(catalogCtx, scopeA, ids(own, target))).toEqual([own]);
  });

  it('refuses a malformed collection id instead of reading it as no collection', async () => {
    // Arrange
    const manual = await manualCollection(world, scopeA);
    const links = new ProductLinksService(world.ports);
    await links.replaceManual(ctx, scopeA, '1', [manual]);

    // Act
    const write = links.replaceManual(ctx, scopeA, '1', ['abc']);

    // Assert
    await expect(write).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.NOT_FOUND });
    expect(await membersOf(manual)).toEqual(['1']);
  });

  it('leaves the dropped collections of a product named with a zero-padded id', async () => {
    // Arrange
    const [first, second] = [await manualCollection(world, scopeA), await manualCollection(world, scopeA)];
    const links = new ProductLinksService(world.ports);
    await links.replaceManual(ctx, scopeA, '1', [first]);

    // Act
    await links.replaceManual(ctx, scopeA, '01', [second]);

    // Assert
    expect([await membersOf(first), await membersOf(second)]).toEqual([[], ['1']]);
  });

  it('refuses an append past the manual cap with a code the catalog answers', async () => {
    // Arrange
    const manual = await manualCollection(world, scopeA);
    const full = Array.from({ length: COLLECTION_MAX_MANUAL_PRODUCTS }, (_, index) => ({
      productId: String(index + 100),
      position: index,
    }));
    await world.tables.members.replaceMembers(ctx, scopeA, manual, full);

    // Act
    const write = source.replaceProductCollections(catalogCtx, scopeA, toCoreId('1'), ids(manual));

    // Assert
    await expect(write).rejects.toMatchObject({ code: CATALOG_ERROR_CODES.INVALID_INPUT });
  });

  it('answers every member of a collection, manual or matched, and none for a malformed id', async () => {
    // Arrange
    const automatic = await automaticCollection(world, scopeA, ['2', '1']);

    // Act
    const members = await source.productIdsInCollection(catalogCtx, scopeA, toCoreId(automatic));
    const none = await source.productIdsInCollection(catalogCtx, scopeA, 'abc' as never);

    // Assert
    expect([...members].sort()).toEqual(['1', '2']);
    expect(none).toEqual([]);
  });

  it('removes a deleted product from every collection of the store under the lock', async () => {
    // Arrange
    const manual = await manualCollection(world, scopeA);
    const automatic = await automaticCollection(world, scopeA, ['1']);
    await source.replaceProductCollections(catalogCtx, scopeA, toCoreId('1'), ids(manual));
    world.steps.length = 0;

    // Act
    await source.deleteProductLinks(catalogCtx, scopeA, toCoreId('1'));

    // Assert
    expect(world.steps).toContain(`lock ${scopeA.storeId}`);
    expect([await membersOf(manual), await membersOf(automatic)]).toEqual([[], []]);
  });

  it("offers the store's collections by position with their titles, never another store's", async () => {
    // Arrange
    const first = await manualCollection(world, scopeA, 'Summer');
    const second = await automaticCollection(world, scopeA);
    await manualCollection(world, scopeA2, 'Other store');

    // Act
    const options = await source.collectionOptionsOf(catalogCtx, scopeA);

    // Assert
    expect(options.map((option) => option.id)).toEqual([first, second]);
    expect(options[0]).toEqual({ id: first, title: 'Summer' });
  });
});
