import { NORMAL_FORM_VERSION } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { RecomputeMembershipService } from '../../application/recompute-membership.service';
import type { CollectionDefinition } from '../../domain/collection';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { manualCollection } from '../support/arrange-collections';
import { definitionOf, scopeA, scopeB } from '../support/builders';
import { facts, PROMO_TAG, priceBetween, ruleOf, tagIs } from './rule-fixtures';

const ctx = asOperationContext({});
const PAGE_SIZE = 100;
const PROMO_RULE = ruleOf('all', tagIs('is_any_of', PROMO_TAG));

let world: FakeCollectionWorld;
let service: RecomputeMembershipService;

beforeEach(() => {
  world = new FakeCollectionWorld();
  service = new RecomputeMembershipService(world.ports);
});

/** Stores an automatic definition of `scope` with `rule` (and its Vendure collection), as a rule save leaves it. */
async function automatic(
  scope: StoreScope,
  overrides: Partial<CollectionDefinition> = {},
): Promise<CollectionDefinition> {
  const collectionId = await manualCollection(world, scope);
  const stored = await world.tables.definitions.findByCollectionId(ctx, scope, collectionId);
  if (stored === undefined) throw new Error('the collection was just made');
  const definition = { ...stored, mode: 'automatic' as const, rule: PROMO_RULE, ...overrides };
  await world.tables.definitions.update(ctx, scope, definition);
  return definition;
}

const memberIds = async (scope: StoreScope, collectionId: string): Promise<string[]> =>
  (await world.tables.members.membersOf(ctx, scope, collectionId)).map((member) => member.productId);

describe('RecomputeMembershipService.forStore', () => {
  it('walks every keyset page of the store and keeps the matches newest first at position 0 (D2312, D2318)', async () => {
    // Arrange
    for (let id = 1; id <= 250; id += 1) {
      world.facts.put(scopeA, facts({ productId: String(id), tagIds: id % 50 === 0 ? [PROMO_TAG] : [] }));
    }
    const definition = await automatic(scopeA);

    // Act
    await service.forStore(ctx, scopeA, definition);

    // Assert
    expect(await memberIds(scopeA, definition.collectionId)).toEqual(['250', '200', '150', '100', '50']);
    expect(world.facts.pageRequests.map((page) => [page.after, page.take])).toEqual([
      [null, PAGE_SIZE],
      ['151', PAGE_SIZE],
      ['51', PAGE_SIZE],
    ]);
  });

  it('drops members that no longer match and publishes membership under the store lock', async () => {
    // Arrange
    world.facts.put(scopeA, facts({ productId: '1', tagIds: [PROMO_TAG] }));
    world.facts.put(scopeA, facts({ productId: '2' }));
    const definition = await automatic(scopeA);
    await world.tables.members.replaceMembers(ctx, scopeA, definition.collectionId, [{ productId: '2', position: 0 }]);
    world.steps.length = 0;

    // Act
    await service.forStore(ctx, scopeA, definition);

    // Assert
    expect(await memberIds(scopeA, definition.collectionId)).toEqual(['1']);
    expect(world.steps.slice(0, 2)).toEqual(['transaction', `lock ${scopeA.storeId}`]);
    expect(world.events.published.at(-1)).toEqual({
      scope: scopeA,
      collectionId: definition.collectionId,
      change: 'membership',
    });
  });

  it("never matches another store's products", async () => {
    // Arrange
    world.facts.put(scopeB, facts({ productId: '7', tagIds: [PROMO_TAG] }));
    const definition = await automatic(scopeA);

    // Act
    await service.forStore(ctx, scopeA, definition);

    // Assert
    expect(await memberIds(scopeA, definition.collectionId)).toEqual([]);
  });

  it('records the current normal form version on a definition built with an older one (D2336)', async () => {
    // Arrange
    const definition = await automatic(scopeA, { matchVersion: NORMAL_FORM_VERSION - 1 });

    // Act
    const recomputed = await service.forStore(ctx, scopeA, definition);
    const stored = await world.tables.definitions.findByCollectionId(ctx, scopeA, definition.collectionId);

    // Assert
    expect(recomputed.matchVersion).toBe(NORMAL_FORM_VERSION);
    expect(stored?.matchVersion).toBe(NORMAL_FORM_VERSION);
  });

  it('leaves a manual collection as it is', async () => {
    // Arrange
    const definition = definitionOf(scopeA);

    // Act
    const recomputed = await service.forStore(ctx, scopeA, definition);

    // Assert
    expect(recomputed).toBe(definition);
    expect(world.facts.pageRequests).toEqual([]);
  });
});

describe('RecomputeMembershipService.forProduct', () => {
  it('joins the automatic collections it matches, leaves the others and keeps its manual ones', async () => {
    // Arrange
    world.facts.put(scopeA, facts({ productId: '5', tagIds: [PROMO_TAG], price: 9_000 }));
    const promo = await automatic(scopeA);
    const cheap = await automatic(scopeA, { rule: ruleOf('all', priceBetween(0, 1_000)) });
    const manual = await manualCollection(world, scopeA);
    await world.tables.members.replaceMembers(ctx, scopeA, cheap.collectionId, [{ productId: '5', position: 0 }]);
    await world.tables.members.replaceMembers(ctx, scopeA, manual, [{ productId: '5', position: 0 }]);
    world.events.published.length = 0;

    // Act
    await service.forProduct(ctx, scopeA, '5');

    // Assert
    expect(await memberIds(scopeA, promo.collectionId)).toEqual(['5']);
    expect(await memberIds(scopeA, cheap.collectionId)).toEqual([]);
    expect(await memberIds(scopeA, manual)).toEqual(['5']);
    expect(world.events.published.map((event) => event.collectionId).sort()).toEqual(
      [promo.collectionId, cheap.collectionId].sort(),
    );
  });

  it('publishes nothing when the product stays where it was', async () => {
    // Arrange
    world.facts.put(scopeA, facts({ productId: '5', tagIds: [PROMO_TAG] }));
    const promo = await automatic(scopeA);
    await world.tables.members.replaceMembers(ctx, scopeA, promo.collectionId, [{ productId: '5', position: 0 }]);
    world.events.published.length = 0;

    // Act
    await service.forProduct(ctx, scopeA, '5');

    // Assert
    expect(world.events.published).toEqual([]);
  });

  it('takes a product gone from the store out of every collection (D2306)', async () => {
    // Arrange
    const promo = await automatic(scopeA);
    const manual = await manualCollection(world, scopeA);
    await world.tables.members.replaceMembers(ctx, scopeA, promo.collectionId, [{ productId: '5', position: 0 }]);
    await world.tables.members.replaceMembers(ctx, scopeA, manual, [{ productId: '5', position: 0 }]);

    // Act
    await service.forProduct(ctx, scopeA, '5');

    // Assert
    expect(await memberIds(scopeA, promo.collectionId)).toEqual([]);
    expect(await memberIds(scopeA, manual)).toEqual([]);
  });

  it('reads the rules and the facts only once it holds the store lock (D2334)', async () => {
    // Arrange
    world.facts.put(scopeA, facts({ productId: '5', tagIds: [PROMO_TAG] }));
    const promo = await automatic(scopeA);
    const holder = asOperationContext({ holder: true });
    world.locks.begin(holder);
    await world.locks.acquire(holder, scopeA.storeId);

    // Act
    const pending = service.forProduct(ctx, scopeA, '5');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const readWhileHeld = world.facts.factsRequests.length;
    world.locks.end(holder);
    await pending;

    // Assert
    expect(readWhileHeld).toBe(0);
    expect(await memberIds(scopeA, promo.collectionId)).toEqual(['5']);
  });
});
