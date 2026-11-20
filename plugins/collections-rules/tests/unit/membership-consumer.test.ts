import type { OutboxConsumer, OutboxConsumerRegistry, OutboxDelivery } from '@cod/plugin-platform-outbox';
import { OutboxParkError } from '@cod/plugin-platform-outbox';
import { RequestTenantScope } from '@cod/plugin-tenancy';
import { QUEUES } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { RecomputeMembershipService } from '../../application/recompute-membership.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { ReconcileReason, StoreReconcileQueuePort } from '../../domain/ports/store-reconcile.port';
import type { StoreScope } from '../../domain/store-scope';
import { CollectionsMembershipConsumer } from '../../infrastructure/membership.consumer';
import type { StoreChannelContexts } from '../../infrastructure/store-channel-context';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { automaticCollection, manualCollection } from '../support/arrange-collections';
import { scopeA, scopeA2 } from '../support/builders';
import { facts, PROMO_TAG, ruleOf, tagIs } from './rule-fixtures';

const ctx = asOperationContext({});
const LAST_ATTEMPT = QUEUES['catalog-effects'].attempts;

/** Records the store reconciles asked for. */
class RecordingReconcile implements StoreReconcileQueuePort {
  readonly asked: { scope: StoreScope; reason: ReconcileReason }[] = [];

  enqueue(scope: StoreScope, reason: ReconcileReason): Promise<void> {
    this.asked.push({ scope, reason });
    return Promise.resolve();
  }
}

let world: FakeCollectionWorld;
let reconcile: RecordingReconcile;
let archived: Set<string>;
let registered: OutboxConsumer[];
let consumer: CollectionsMembershipConsumer;

beforeEach(() => {
  world = new FakeCollectionWorld();
  reconcile = new RecordingReconcile();
  archived = new Set();
  registered = [];
  const contexts = {
    forStore: (from: RequestContext, _businessId: string, storeId: string) =>
      Promise.resolve(archived.has(storeId) ? undefined : from),
  } as unknown as StoreChannelContexts;
  const registry = { register: (entry: OutboxConsumer) => registered.push(entry) } as unknown as OutboxConsumerRegistry;
  consumer = new CollectionsMembershipConsumer(
    registry,
    contexts,
    new RecomputeMembershipService(world.ports),
    reconcile,
  );
});

/** A `product.changed` delivery of `scope`'s store, at `attempt`. */
function deliveryOf(
  scope: StoreScope,
  payload: OutboxDelivery['payload'],
  attempt = 1,
): { delivery: OutboxDelivery; tenant: RequestTenantScope } {
  const delivery: OutboxDelivery = {
    outboxId: '1500000000000000001',
    createdAt: '2026-11-20T00:00:00.000Z',
    businessId: scope.businessId,
    storeId: scope.storeId,
    topic: 'product.changed',
    aggregateId: String(payload['productId']),
    payload,
    consumer: 'collections-membership',
    idempotencyKey: '1500000000000000001:collections-membership',
    attempt,
  };
  return { delivery, tenant: new RequestTenantScope({} as RequestContext, scope.businessId) };
}

const changed = (scope: StoreScope, productId: string, change = 'updated', attempt = 1) =>
  deliveryOf(scope, { productId, storeId: scope.storeId, change }, attempt);

/** An automatic "Tag is any of [promo]" collection of `scope`, holding `memberIds`. */
async function promoCollection(scope: StoreScope, memberIds: readonly string[] = []): Promise<string> {
  const collectionId = await automaticCollection(world, scope, memberIds);
  const definition = await world.tables.definitions.findByCollectionId(ctx, scope, collectionId);
  if (definition === undefined) throw new Error('the collection was just made');
  await world.tables.definitions.update(ctx, scope, {
    ...definition,
    rule: ruleOf('all', tagIs('is_any_of', PROMO_TAG)),
  });
  return collectionId;
}

const memberIds = async (scope: StoreScope, collectionId: string): Promise<string[]> =>
  (await world.tables.members.membersOf(ctx, scope, collectionId)).map((member) => member.productId);

describe('CollectionsMembershipConsumer (D2312, D2313)', () => {
  it('listens to product.changed on the catalog-effects queue', () => {
    // Act
    consumer.onModuleInit();

    // Assert
    expect(registered.map(({ name, topics, queue }) => ({ name, topics, queue }))).toEqual([
      { name: 'collections-membership', topics: ['product.changed'], queue: 'catalog-effects' },
    ]);
  });

  it('parks a malformed payload', async () => {
    // Arrange
    const malformed = [
      { productId: 'abc', storeId: scopeA.storeId, change: 'updated' },
      { productId: '7', storeId: 'store', change: 'updated' },
      { productId: '7', storeId: scopeA.storeId, change: 'renamed' },
      { productId: '7', storeId: scopeA2.storeId, change: 'updated' },
    ];

    // Act
    const outcomes = await Promise.all(
      malformed.map((payload) => {
        const { delivery, tenant } = deliveryOf(scopeA, payload);
        return consumer.handle(delivery, tenant).catch((error: unknown) => error);
      }),
    );

    // Assert
    for (const outcome of outcomes) expect(outcome).toBeInstanceOf(OutboxParkError);
    expect(world.steps).toEqual([]);
  });

  it('acknowledges an archived store without writing', async () => {
    // Arrange
    const collectionId = await promoCollection(scopeA, ['7']);
    world.steps.length = 0;
    archived.add(scopeA.storeId);
    const { delivery, tenant } = changed(scopeA, '7', 'deleted');

    // Act
    await consumer.handle(delivery, tenant);

    // Assert
    expect(world.steps).toEqual([]);
    expect(await memberIds(scopeA, collectionId)).toEqual(['7']);
  });

  it('adds a product its tag now matches and drops one it no longer matches', async () => {
    // Arrange
    const collectionId = await promoCollection(scopeA, ['8']);
    world.facts.put(scopeA, facts({ productId: '7', tagIds: [PROMO_TAG] }));
    world.facts.put(scopeA, facts({ productId: '8' }));

    // Act
    for (const productId of ['7', '8']) {
      const { delivery, tenant } = changed(scopeA, productId);
      await consumer.handle(delivery, tenant);
    }

    // Assert
    expect(await memberIds(scopeA, collectionId)).toEqual(['7']);
  });

  it('deleted removes the product from every collection, manual ones too', async () => {
    // Arrange
    const automatic = await promoCollection(scopeA, ['7']);
    const manual = await manualCollection(world, scopeA);
    await world.tables.members.replaceMembers(ctx, scopeA, manual, [{ productId: '7', position: 0 }]);
    const { delivery, tenant } = changed(scopeA, '7', 'deleted');

    // Act
    await consumer.handle(delivery, tenant);

    // Assert
    expect(await memberIds(scopeA, automatic)).toEqual([]);
    expect(await memberIds(scopeA, manual)).toEqual([]);
  });

  it("recomputes only the event's store", async () => {
    // Arrange
    const own = await promoCollection(scopeA);
    const sibling = await promoCollection(scopeA2);
    world.facts.put(scopeA, facts({ productId: '7', tagIds: [PROMO_TAG] }));
    world.facts.put(scopeA2, facts({ productId: '7', tagIds: [PROMO_TAG] }));
    world.steps.length = 0;
    const { delivery, tenant } = changed(scopeA, '7');

    // Act
    await consumer.handle(delivery, tenant);

    // Assert
    expect(await memberIds(scopeA, own)).toEqual(['7']);
    expect(await memberIds(scopeA2, sibling)).toEqual([]);
    expect(world.steps.filter((step) => step.startsWith('lock'))).toEqual([`lock ${scopeA.storeId}`]);
  });

  it('enqueues a store reconcile on the last attempt, then fails the delivery', async () => {
    // Arrange
    await promoCollection(scopeA);
    const failure = new Error('facts unavailable');
    world.facts.factsOf = () => Promise.reject(failure);
    const early = changed(scopeA, '7', 'updated', LAST_ATTEMPT - 1);
    const last = changed(scopeA, '7', 'updated', LAST_ATTEMPT);

    // Act
    const earlyOutcome = await consumer.handle(early.delivery, early.tenant).catch((error: unknown) => error);
    const asked = reconcile.asked.length;
    const lastOutcome = await consumer.handle(last.delivery, last.tenant).catch((error: unknown) => error);

    // Assert
    expect([earlyOutcome, lastOutcome]).toEqual([failure, failure]);
    expect(asked).toBe(0);
    expect(reconcile.asked).toEqual([{ scope: scopeA, reason: 'delivery' }]);
  });
});
