import type { BusinessId } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { RecomputeMembershipService } from '../../application/recompute-membership.service';
import { RecomputeStoreService } from '../../application/recompute-store.service';
import { ReconcileSweepService } from '../../application/reconcile-sweep.service';
import { SaveRecomputeService } from '../../application/save-recompute.service';
import type { CollectionDefinition } from '../../domain/collection';
import type { BusinessDirectoryPort } from '../../domain/ports/business-directory.port';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { ReconcileReason, StoreReconcileQueuePort } from '../../domain/ports/store-reconcile.port';
import type { StoreScope } from '../../domain/store-scope';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { automaticCollection, manualCollection } from '../support/arrange-collections';
import { scopeA, scopeA2, scopeB } from '../support/builders';
import { facts, PROMO_TAG, ruleOf, tagIs } from './rule-fixtures';

const ctx = asOperationContext({});
const PROMO_RULE = ruleOf('all', tagIs('is_any_of', PROMO_TAG));

/** Records the store reconciles asked for. */
class RecordingReconcile implements StoreReconcileQueuePort {
  readonly asked: { scope: StoreScope; reason: ReconcileReason }[] = [];

  enqueue(scope: StoreScope, reason: ReconcileReason): Promise<void> {
    this.asked.push({ scope, reason });
    return Promise.resolve();
  }
}

/** Businesses A and B, in id order, served in pages of the asked size. */
class TwoBusinesses implements BusinessDirectoryPort {
  readonly pages: (BusinessId | undefined)[] = [];
  private readonly ids = [scopeA.businessId, scopeB.businessId];

  businessIdsAfter(_ctx: unknown, after: BusinessId | undefined, limit: number): Promise<readonly BusinessId[]> {
    this.pages.push(after);
    const start = after === undefined ? 0 : this.ids.indexOf(after) + 1;
    return Promise.resolve(this.ids.slice(start, start + limit));
  }
}

let world: FakeCollectionWorld;
let reconcile: RecordingReconcile;
let recompute: RecomputeMembershipService;

beforeEach(() => {
  world = new FakeCollectionWorld();
  reconcile = new RecordingReconcile();
  recompute = new RecomputeMembershipService(world.ports);
});

/** An automatic promo collection of `scope` holding `memberIds`, stored with `matchVersion`. */
async function promoCollection(
  scope: StoreScope,
  memberIds: readonly string[] = [],
  matchVersion = 1,
): Promise<CollectionDefinition> {
  const collectionId = await automaticCollection(world, scope, memberIds);
  const stored = await world.tables.definitions.findByCollectionId(ctx, scope, collectionId);
  if (stored === undefined) throw new Error('the collection was just made');
  const definition = { ...stored, rule: PROMO_RULE, matchVersion };
  await world.tables.definitions.update(ctx, scope, definition);
  return definition;
}

const memberIds = async (scope: StoreScope, collectionId: string): Promise<string[]> =>
  (await world.tables.members.membersOf(ctx, scope, collectionId)).map((member) => member.productId);

describe('RecomputeStoreService (D2336)', () => {
  it('rebuilds every automatic collection of the store under its lock and leaves the rest alone', async () => {
    // Arrange
    world.facts.put(scopeA, facts({ productId: '7', tagIds: [PROMO_TAG] }));
    world.facts.put(scopeA2, facts({ productId: '7', tagIds: [PROMO_TAG] }));
    const [first, second] = [await promoCollection(scopeA, ['9']), await promoCollection(scopeA)];
    const manual = await manualCollection(world, scopeA);
    await world.tables.members.replaceMembers(ctx, scopeA, manual, [{ productId: '9', position: 0 }]);
    const sibling = await promoCollection(scopeA2);
    world.steps.length = 0;

    // Act
    const rebuilt = await new RecomputeStoreService(world.ports, recompute).run(ctx, scopeA);

    // Assert
    expect(rebuilt).toBe(2);
    expect(world.steps.slice(0, 2)).toEqual(['transaction', `lock ${scopeA.storeId}`]);
    expect(await memberIds(scopeA, first.collectionId)).toEqual(['7']);
    expect(await memberIds(scopeA, second.collectionId)).toEqual(['7']);
    expect(await memberIds(scopeA, manual)).toEqual(['9']);
    expect(await memberIds(scopeA2, sibling.collectionId)).toEqual([]);
  });

  it('repairs a membership changed behind its back', async () => {
    // Arrange
    world.facts.put(scopeA, facts({ productId: '7', tagIds: [PROMO_TAG] }));
    const definition = await promoCollection(scopeA, ['8']);

    // Act
    await new RecomputeStoreService(world.ports, recompute).run(ctx, scopeA);

    // Assert
    expect(await memberIds(scopeA, definition.collectionId)).toEqual(['7']);
  });
});

describe('ReconcileSweepService (D2336)', () => {
  it('bootstrap enqueues stores with an older matchVersion, business by business', async () => {
    // Arrange
    await promoCollection(scopeA, [], 0);
    await promoCollection(scopeA2, [], 1);
    await promoCollection(scopeB, [], 0);
    const directory = new TwoBusinesses();
    const sweep = new ReconcileSweepService(world.ports.definitions, directory, reconcile, 1);

    // Act
    const enqueued = await sweep.enqueueStale(ctx);

    // Assert
    expect(enqueued).toBe(2);
    expect(reconcile.asked).toEqual([
      { scope: scopeA, reason: 'version' },
      { scope: scopeB, reason: 'version' },
    ]);
    expect(directory.pages).toEqual([undefined, scopeA.businessId, scopeB.businessId]);
  });

  it('the nightly sweep enqueues every store with an automatic collection', async () => {
    // Arrange
    await promoCollection(scopeA, [], 1);
    await manualCollection(world, scopeA2);
    await promoCollection(scopeB, [], 1);
    const sweep = new ReconcileSweepService(world.ports.definitions, new TwoBusinesses(), reconcile);

    // Act
    const enqueued = await sweep.enqueueAll(ctx);

    // Assert
    expect(enqueued).toBe(2);
    expect(reconcile.asked).toEqual([
      { scope: scopeA, reason: 'nightly' },
      { scope: scopeB, reason: 'nightly' },
    ]);
  });

  it('a business without stores to reconcile enqueues nothing', async () => {
    // Arrange
    const sweep = new ReconcileSweepService(world.ports.definitions, new TwoBusinesses(), reconcile);

    // Act
    const enqueued = await sweep.enqueueAll(ctx);

    // Assert
    expect(enqueued).toBe(0);
    expect(reconcile.asked).toEqual([]);
  });
});

describe('SaveRecomputeService (D2312)', () => {
  const threeProducts = (): void => {
    for (const productId of ['1', '2', '3']) {
      world.facts.put(scopeA, facts({ productId, tagIds: [PROMO_TAG] }));
    }
  };

  it('a save over the sync cap answers at once and enqueues the store reconcile', async () => {
    // Arrange
    threeProducts();
    const definition = await promoCollection(scopeA);
    const save = new SaveRecomputeService(recompute, world.ports.facts, reconcile, 2);

    // Act
    const answered = await save.forStore(ctx, scopeA, definition);

    // Assert
    expect(answered).toEqual(definition);
    expect(await memberIds(scopeA, definition.collectionId)).toEqual([]);
    expect(reconcile.asked).toEqual([{ scope: scopeA, reason: 'save' }]);
  });

  it('a save at the sync cap recomputes in the request', async () => {
    // Arrange
    threeProducts();
    const definition = await promoCollection(scopeA);
    const save = new SaveRecomputeService(recompute, world.ports.facts, reconcile, 3);

    // Act
    await save.forStore(ctx, scopeA, definition);

    // Assert
    expect(await memberIds(scopeA, definition.collectionId)).toEqual(['3', '2', '1']);
    expect(reconcile.asked).toEqual([]);
  });

  it('a manual collection neither counts the store nor enqueues', async () => {
    // Arrange
    threeProducts();
    const collectionId = await manualCollection(world, scopeA);
    const definition = await world.tables.definitions.findByCollectionId(ctx, scopeA, collectionId);
    if (definition === undefined) throw new Error('the collection was just made');
    world.facts.pageRequests.length = 0;
    const save = new SaveRecomputeService(recompute, world.ports.facts, reconcile, 0);

    // Act
    const answered = await save.forStore(ctx, scopeA, definition);

    // Assert
    expect(answered).toEqual(definition);
    expect(world.facts.pageRequests).toEqual([]);
    expect(reconcile.asked).toEqual([]);
  });
});
