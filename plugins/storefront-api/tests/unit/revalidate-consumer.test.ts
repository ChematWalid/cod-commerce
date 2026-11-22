import type { OutboxConsumer, OutboxConsumerRegistry, OutboxDelivery } from '@cod/plugin-platform-outbox';
import { OutboxParkError } from '@cod/plugin-platform-outbox';
import type { OutboxTopic, TenantScope } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { REVALIDATE_SETTLE_MS } from '../../domain/constants';
import type { RevalidationJob, RevalidationQueuePort } from '../../domain/ports/revalidation-queue.port';
import { StorefrontRevalidateConsumer } from '../../infrastructure/revalidate.consumer';
import { STORE_A, STORE_B } from '../fakes/fake-storefront';

const OUTBOX_ID = '1500000000000000001';

class RecordingQueue implements RevalidationQueuePort {
  readonly jobs: RevalidationJob[] = [];

  enqueue(job: RevalidationJob): Promise<void> {
    this.jobs.push(job);
    return Promise.resolve();
  }
}

let queue: RecordingQueue;
let registered: OutboxConsumer[];
let consumer: StorefrontRevalidateConsumer;

beforeEach(() => {
  queue = new RecordingQueue();
  registered = [];
  const registry = { register: (entry: OutboxConsumer) => registered.push(entry) } as unknown as OutboxConsumerRegistry;
  consumer = new StorefrontRevalidateConsumer(registry, queue);
});

/** A delivery of `topic` whose row names `rowStoreId`, for the business of `scope`. */
function deliveryOf(topic: OutboxTopic, payload: OutboxDelivery['payload'], rowStoreId: string | null): OutboxDelivery {
  return {
    outboxId: OUTBOX_ID,
    createdAt: '2026-11-20T00:00:00.000Z',
    businessId: STORE_A.businessId,
    storeId: rowStoreId,
    topic,
    aggregateId: null,
    payload,
    consumer: 'storefront-revalidate',
    idempotencyKey: `${OUTBOX_ID}:storefront-revalidate`,
    attempt: 1,
  };
}

const scopeA: TenantScope = { businessId: STORE_A.businessId };

describe('StorefrontRevalidateConsumer', () => {
  it('follows the product, collection and store topics', () => {
    // Act
    consumer.onModuleInit();

    // Assert
    expect(registered).toHaveLength(1);
    expect([...(registered[0]?.topics ?? [])].sort()).toEqual([
      'collection.changed',
      'product.changed',
      'store.changed',
    ]);
  });

  it('expires a changed product and its store list pages, after the projection settles', async () => {
    // Arrange
    const delivery = deliveryOf(
      'product.changed',
      { productId: '12', storeId: STORE_A.storeId, change: 'updated' },
      STORE_A.storeId,
    );

    // Act
    await consumer.handle(delivery, scopeA);

    // Assert
    expect(queue.jobs).toEqual([
      {
        key: OUTBOX_ID,
        storeId: STORE_A.storeId,
        tags: ['product:12', `store:${STORE_A.storeId}`],
        delayMs: REVALIDATE_SETTLE_MS,
      },
    ]);
  });

  it('expires a changed collection and its store list pages', async () => {
    // Arrange
    const delivery = deliveryOf(
      'collection.changed',
      { collectionId: '3', storeId: STORE_A.storeId, change: 'membership' },
      STORE_A.storeId,
    );

    // Act
    await consumer.handle(delivery, scopeA);

    // Assert
    expect(queue.jobs.map((job) => job.tags)).toEqual([['collection:3', `store:${STORE_A.storeId}`]]);
  });

  it.each(['settings', 'status', 'domain'])('expires the whole store on a %s change', async (change) => {
    // Arrange
    const payload = { storeId: STORE_A.storeId, businessId: STORE_A.businessId, change };

    // Act
    await consumer.handle(deliveryOf('store.changed', payload, STORE_A.storeId), scopeA);

    // Assert
    expect(queue.jobs.map((job) => job.tags)).toEqual([[`store:${STORE_A.storeId}`]]);
  });

  it.each([
    [
      'a product id that is not an id',
      'product.changed',
      { productId: '../1', storeId: STORE_A.storeId, change: 'updated' },
    ],
    ['a product without a store', 'product.changed', { productId: '12', change: 'updated' }],
    [
      'a collection id of zero',
      'collection.changed',
      { collectionId: '0', storeId: STORE_A.storeId, change: 'updated' },
    ],
    ['a store change of another business', 'store.changed', { ...STORE_B, change: 'settings' }],
    ['a store change of an unknown kind', 'store.changed', { ...STORE_A, change: 'logo' }],
  ] as const)('parks %s', async (_name, topic, payload) => {
    // Arrange
    const delivery = deliveryOf(topic, payload, null);

    // Act
    const run = consumer.handle(delivery, scopeA);

    // Assert
    await expect(run).rejects.toBeInstanceOf(OutboxParkError);
    expect(queue.jobs).toEqual([]);
  });

  it('parks a payload whose store is not the delivery row store', async () => {
    // Arrange
    const payload = { productId: '12', storeId: STORE_B.storeId, change: 'updated' };

    // Act
    const run = consumer.handle(deliveryOf('product.changed', payload, STORE_A.storeId), scopeA);

    // Assert
    await expect(run).rejects.toBeInstanceOf(OutboxParkError);
  });

  it('parks a topic it does not follow', async () => {
    // Act
    const run = consumer.handle(deliveryOf('offer.applied', {}, STORE_A.storeId), scopeA);

    // Assert
    await expect(run).rejects.toBeInstanceOf(OutboxParkError);
  });
});
