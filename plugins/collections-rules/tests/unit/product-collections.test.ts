import { COLLECTION_MAX_MANUAL_PRODUCTS, COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProductCollectionsService } from '../../application/product-collections.service';
import { ProductLinksService } from '../../application/product-links.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { automaticCollection, manualCollection } from '../support/arrange-collections';
import { scopeA, scopeA2, scopeB } from '../support/builders';

const ctx = asOperationContext({});
const C = COLLECTIONS_ERROR_CODES;

let world: FakeCollectionWorld;
let service: ProductCollectionsService;

beforeEach(() => {
  world = new FakeCollectionWorld();
  world.facts.add(scopeA, '1', '2');
  world.facts.add(scopeA2, '9');
  service = new ProductCollectionsService(world.ports, new ProductLinksService(world.ports));
});

const idsOf = (refs: readonly { id: string }[]): string[] => refs.map((ref) => ref.id);

describe('ProductCollectionsService.of', () => {
  it('lists the manual and the automatic collections of a product with their titles', async () => {
    // Arrange
    const manual = await manualCollection(world, scopeA, 'Picked');
    const automatic = await automaticCollection(world, scopeA, ['1']);
    await service.set(ctx, scopeA, { productId: '1', collectionIds: [manual] });

    // Act
    const view = await service.of(ctx, scopeA, '1');

    // Assert
    expect(view.manual).toEqual([{ id: manual, title: 'Picked' }]);
    expect(idsOf(view.automatic)).toEqual([automatic]);
  });

  it.each([
    ["another store's product", '9'],
    ['a malformed id', '1.5'],
  ])('answers product-not-found for %s', async (_case, productId) => {
    await expect(service.of(ctx, scopeA, productId)).rejects.toMatchObject({ code: C.PRODUCT_NOT_FOUND });
  });
});

describe('ProductCollectionsService.set', () => {
  it('appends the product last to each new manual collection and leaves the ones not named', async () => {
    // Arrange
    const [first, second] = [await manualCollection(world, scopeA), await manualCollection(world, scopeA)];
    await service.set(ctx, scopeA, { productId: '2', collectionIds: [first] });
    await service.set(ctx, scopeA, { productId: '1', collectionIds: [first, second] });

    // Act
    const view = await service.set(ctx, scopeA, { productId: '1', collectionIds: [second] });
    const inFirst = await world.tables.members.membersOf(ctx, scopeA, first);

    // Assert
    expect(idsOf(view.manual)).toEqual([second]);
    expect(inFirst.map((member) => member.productId)).toEqual(['2']);
  });

  it('places a product after the last member of the collection', async () => {
    // Arrange
    const collectionId = await manualCollection(world, scopeA);
    await service.set(ctx, scopeA, { productId: '2', collectionIds: [collectionId] });

    // Act
    await service.set(ctx, scopeA, { productId: '1', collectionIds: [collectionId] });
    const members = await world.tables.members.membersOf(ctx, scopeA, collectionId);

    // Assert
    expect(members).toEqual([
      { productId: '2', position: 0 },
      { productId: '1', position: 1 },
    ]);
  });

  it('keeps the automatic memberships of the product', async () => {
    // Arrange
    const automatic = await automaticCollection(world, scopeA, ['1']);

    // Act
    const view = await service.set(ctx, scopeA, { productId: '1', collectionIds: [] });

    // Assert
    expect(idsOf(view.automatic)).toEqual([automatic]);
  });

  it('refuses an automatic collection with not-manual and writes nothing', async () => {
    // Arrange
    const manual = await manualCollection(world, scopeA);
    const automatic = await automaticCollection(world, scopeA);

    // Act
    const set = service.set(ctx, scopeA, { productId: '1', collectionIds: [manual, automatic] });

    // Assert
    await expect(set).rejects.toMatchObject({ code: C.NOT_MANUAL });
    expect(await world.tables.members.membersOf(ctx, scopeA, manual)).toEqual([]);
  });

  it.each([
    ["the other store's collection", 'other'],
    ["another business's collection", 'foreign'],
    ['a malformed id', 'abc'],
  ])('refuses %s with not-found and writes nothing', async (_case, which) => {
    // Arrange
    const own = await manualCollection(world, scopeA);
    const collectionId =
      which === 'other'
        ? await manualCollection(world, scopeA2)
        : which === 'foreign'
          ? await manualCollection(world, scopeB)
          : which;
    world.events.published.length = 0;

    // Act
    const set = service.set(ctx, scopeA, { productId: '1', collectionIds: [own, collectionId] });

    // Assert
    await expect(set).rejects.toMatchObject({ code: C.NOT_FOUND });
    expect(await world.tables.members.membersOf(ctx, scopeA, own)).toEqual([]);
    expect(world.events.published).toEqual([]);
  });

  it('refuses a collection whose Vendure collection left the store with not-found', async () => {
    // Arrange
    const stale = await manualCollection(world, scopeA);
    world.vendure.rows.delete(stale);

    // Act
    const set = service.set(ctx, scopeA, { productId: '1', collectionIds: [stale] });

    // Assert
    await expect(set).rejects.toMatchObject({ code: C.NOT_FOUND });
    expect(await world.tables.members.membersOf(ctx, scopeA, stale)).toEqual([]);
  });

  it('joins a collection named twice once and publishes one change', async () => {
    // Arrange
    const collectionId = await manualCollection(world, scopeA);
    world.events.published.length = 0;

    // Act
    const view = await service.set(ctx, scopeA, { productId: '1', collectionIds: [collectionId, `0${collectionId}`] });

    // Assert
    expect(idsOf(view.manual)).toEqual([collectionId]);
    expect(world.events.published.map((event) => event.collectionId)).toEqual([collectionId]);
  });

  it("refuses another store's product with product-not-found", async () => {
    // Arrange
    const collectionId = await manualCollection(world, scopeA);

    // Act
    const set = service.set(ctx, scopeA, { productId: '9', collectionIds: [collectionId] });

    // Assert
    await expect(set).rejects.toMatchObject({ code: C.PRODUCT_NOT_FOUND });
  });

  it('refuses to append to a full manual collection (too-many-products)', async () => {
    // Arrange
    const collectionId = await manualCollection(world, scopeA);
    const full = Array.from({ length: COLLECTION_MAX_MANUAL_PRODUCTS }, (_, index) => ({
      productId: String(index + 100),
      position: index,
    }));
    await world.tables.members.replaceMembers(ctx, scopeA, collectionId, full);

    // Act
    const set = service.set(ctx, scopeA, { productId: '1', collectionIds: [collectionId] });

    // Assert
    await expect(set).rejects.toMatchObject({ code: C.TOO_MANY_PRODUCTS });
  });

  it('publishes a membership change for each collection it joins or leaves', async () => {
    // Arrange
    const [first, second] = [await manualCollection(world, scopeA), await manualCollection(world, scopeA)];
    await service.set(ctx, scopeA, { productId: '1', collectionIds: [first] });
    world.events.published.length = 0;

    // Act
    await service.set(ctx, scopeA, { productId: '1', collectionIds: [second] });

    // Assert
    expect(world.events.published.map((event) => [event.collectionId, event.change])).toEqual([
      [second, 'membership'],
      [first, 'membership'],
    ]);
  });
});
