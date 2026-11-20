import { COLLECTIONS_ERROR_CODES, type CreateStoreCollectionCommand } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateCollectionService } from '../../application/create-collection.service';
import { DeleteCollectionService } from '../../application/delete-collection.service';
import { GetCollectionService } from '../../application/get-collection.service';
import { ListCollectionsService } from '../../application/list-collections.service';
import { UpdateCollectionService } from '../../application/update-collection.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { newCoreId, priceRule, scopeA, scopeA2 } from '../support/builders';

const ctx = asOperationContext({});
const MALFORMED_IDS = ['abc', '-1', '1.5', '99999999999999999999', ''];

let world: FakeCollectionWorld;

beforeEach(() => {
  world = new FakeCollectionWorld();
});

const create = (overrides: Partial<CreateStoreCollectionCommand> = {}) =>
  new CreateCollectionService(world.ports).create(ctx, scopeA, {
    title: 'Summer',
    slug: 'summer',
    visible: true,
    position: 0,
    mode: 'manual',
    rule: undefined,
    ...overrides,
  });

describe('UpdateCollectionService.update', () => {
  it('changes texts, visibility and position, keeps the rest and publishes updated', async () => {
    // Arrange
    const created = await create({ description: 'Old' });

    // Act
    const view = await new UpdateCollectionService(world.ports).update(ctx, scopeA, created.id, {
      title: 'Summer 2026',
      visible: false,
      position: 7,
    });

    // Assert
    expect(view).toMatchObject({
      title: 'Summer 2026',
      slug: 'summer',
      description: 'Old',
      visible: false,
      position: 7,
    });
    expect(world.vendure.rows.get(created.id)?.isPrivate).toBe(true);
    expect(world.events.published.map((event) => event.change)).toEqual(['created', 'updated']);
  });

  it('keeps its own slug and refuses one another collection of the store uses', async () => {
    // Arrange
    const summer = await create();
    const winter = await create({ title: 'Winter', slug: 'winter' });
    const update = new UpdateCollectionService(world.ports);

    // Act
    const own = await update.update(ctx, scopeA, summer.id, { slug: 'summer' });
    const taken = update.update(ctx, scopeA, winter.id, { slug: 'summer' });

    // Assert
    expect(own.slug).toBe('summer');
    await expect(taken).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.SLUG_TAKEN });
  });

  it("answers not-found for the business's other store, an unknown or a malformed id", async () => {
    // Arrange
    const created = await create();
    const update = new UpdateCollectionService(world.ports);
    const otherStore = update.update(ctx, scopeA2, created.id, { title: 'Taken over' });

    // Act
    const answers = [otherStore, ...[newCoreId(), ...MALFORMED_IDS].map((id) => update.update(ctx, scopeA, id, {}))];

    // Assert
    for (const answer of answers)
      await expect(answer).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.NOT_FOUND });
  });

  it('leaves the Vendure collection alone when the edit names none of its fields', async () => {
    // Arrange
    const created = await create();

    // Act
    const view = await new UpdateCollectionService(world.ports).update(ctx, scopeA, created.id, {
      position: 3,
      mode: 'manual',
    });

    // Assert
    expect(view.position).toBe(3);
    expect(world.vendure.updated).toEqual([]);
    expect(world.events.published.map((event) => event.change)).toEqual(['created', 'updated']);
  });

  it('refuses a switch to automatic with rule-invalid until rule saves land (Task 7)', async () => {
    // Arrange
    const created = await create();

    // Act
    const update = new UpdateCollectionService(world.ports).update(ctx, scopeA, created.id, {
      mode: 'automatic',
      rule: priceRule(1, 2),
    });

    // Assert
    await expect(update).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.RULE_INVALID });
  });
});

describe('DeleteCollectionService.delete', () => {
  it('under the store lock removes the Vendure collection, the definition and its members, and publishes deleted', async () => {
    // Arrange
    const created = await create();
    await world.tables.members.replaceMembers(ctx, scopeA, created.id, [{ productId: '5', position: 0 }]);
    world.steps.length = 0;

    // Act
    await new DeleteCollectionService(world.ports).delete(ctx, scopeA, created.id);

    // Assert
    expect(world.steps.slice(0, 2)).toEqual(['transaction', `lock ${scopeA.storeId}`]);
    expect(world.vendure.rows.has(created.id)).toBe(false);
    expect(await world.tables.definitions.findByCollectionId(ctx, scopeA, created.id)).toBeUndefined();
    expect(world.tables.memberRows).toEqual([]);
    expect(world.events.published.at(-1)).toEqual({ scope: scopeA, collectionId: created.id, change: 'deleted' });
  });

  it("answers not-found for the business's other store and leaves the collection", async () => {
    // Arrange
    const created = await create();

    // Act
    const deleted = new DeleteCollectionService(world.ports).delete(ctx, scopeA2, created.id);

    // Assert
    await expect(deleted).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.NOT_FOUND });
    expect(world.vendure.rows.has(created.id)).toBe(true);
  });

  it('removes a definition whose Vendure collection already left the store and frees its place', async () => {
    // Arrange
    const created = await create();
    world.vendure.rows.delete(created.id);

    // Act
    await new DeleteCollectionService(world.ports).delete(ctx, scopeA, created.id);

    // Assert
    expect(await world.tables.definitions.findByCollectionId(ctx, scopeA, created.id)).toBeUndefined();
    expect(await world.tables.definitions.countInStore(ctx, scopeA)).toBe(0);
    expect(world.events.published.at(-1)).toEqual({ scope: scopeA, collectionId: created.id, change: 'deleted' });
  });
});

describe('reading collections', () => {
  it('lists by position with product counts, and searches titles whatever their Arabic written form', async () => {
    // Arrange
    const shoes = await create({ title: 'أحذية رياضية', slug: 'shoes', position: 2 });
    const bags = await create({ title: 'Bags', slug: 'bags', position: 1 });
    await world.tables.members.replaceMembers(ctx, scopeA, shoes.id, [{ productId: '5', position: 0 }]);
    const list = new ListCollectionsService(world.ports);

    // Act
    const all = await list.list(ctx, scopeA, { skip: 0, take: 20 });
    const found = await list.list(ctx, scopeA, { skip: 0, take: 20, search: 'احذيه' });

    // Assert
    expect(all.items.map((item) => [item.id, item.productCount])).toEqual([
      [bags.id, 0],
      [shoes.id, 1],
    ]);
    expect(all.totalItems).toBe(2);
    expect(found).toEqual({ items: [expect.objectContaining({ id: shoes.id })], totalItems: 1 });
  });

  it('a search with no letter left after normalising matches nothing', async () => {
    // Arrange
    await create();
    const list = new ListCollectionsService(world.ports);

    // Act
    const pages = await Promise.all(
      ['\u0640\u0640\u0640', '\u064e'].map((search) => list.list(ctx, scopeA, { skip: 0, take: 20, search })),
    );

    // Assert
    expect(pages).toEqual([
      { items: [], totalItems: 0 },
      { items: [], totalItems: 0 },
    ]);
  });

  it('counts only the collections a page can show when a Vendure collection is missing', async () => {
    // Arrange
    const kept = await create({ title: 'Kept', slug: 'kept', position: 1 });
    const orphan = await create({ title: 'Orphan', slug: 'orphan', position: 2 });
    world.vendure.rows.delete(orphan.id);

    // Act
    const page = await new ListCollectionsService(world.ports).list(ctx, scopeA, { skip: 0, take: 20 });

    // Assert
    expect(page.items.map((item) => item.id)).toEqual([kept.id]);
    expect(page.totalItems).toBe(page.items.length);
  });

  it('reports the same total on every page when the missing Vendure collection sits on another page', async () => {
    // Arrange
    const kept = await create({ title: 'Kept', slug: 'kept', position: 1 });
    const orphan = await create({ title: 'Orphan', slug: 'orphan', position: 2 });
    const last = await create({ title: 'Last', slug: 'last', position: 3 });
    world.vendure.rows.delete(orphan.id);
    const list = new ListCollectionsService(world.ports);

    // Act
    const pages = await Promise.all([0, 1, 2].map((skip) => list.list(ctx, scopeA, { skip, take: 1 })));

    // Assert
    expect(pages.map((page) => page.items.map((item) => item.id))).toEqual([[kept.id], [last.id], []]);
    expect(pages.map((page) => page.totalItems)).toEqual([2, 2, 2]);
  });

  it("finds a collection of the store and nothing for the other store's or a malformed id", async () => {
    // Arrange
    const created = await create();
    const get = new GetCollectionService(world.ports);

    // Act
    const [own, otherStore, malformed] = await Promise.all([
      get.find(ctx, scopeA, created.id),
      get.find(ctx, scopeA2, created.id),
      get.find(ctx, scopeA, 'abc'),
    ]);

    // Assert
    expect(own?.title).toBe('Summer');
    expect([otherStore, malformed]).toEqual([undefined, undefined]);
  });
});
