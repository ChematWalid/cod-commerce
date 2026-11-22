import {
  type OutboxConsumer,
  OutboxConsumerRegistry,
  type OutboxDelivery,
  OutboxParkError,
} from '@cod/plugin-platform-outbox';
import {
  collectionChangedPayloadSchema,
  type QueueName,
  storeChangedPayloadSchema,
  type TenantScope,
} from '@cod/shared';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { REVALIDATION_QUEUE_PORT } from '../application/tokens';
import { REVALIDATE_CONSUMER_NAME, REVALIDATE_SETTLE_MS } from '../domain/constants';
import { canonicalCoreId } from '../domain/core-id';
import type { RevalidationQueuePort } from '../domain/ports/revalidation-queue.port';
import { type RevalidationTarget, revalidationTagsOf } from '../domain/revalidation-target';
import { isRowStore, productChangedSchema } from './outbox-payloads';

/**
 * The pool the deliveries run on: the projection consumer's, so a product change is usually written to the
 * projection before its list pages are expired (D3222). The delivery only queues the revalidation job.
 */
const REVALIDATE_DELIVERY_QUEUE: QueueName = 'catalog-effects';

const park = (topic: string): never => {
  throw new OutboxParkError(`the ${topic} payload is malformed`);
};

/**
 * Turns `product.changed`, `collection.changed` and `store.changed` into a `storefront-revalidate` job with the cache
 * tags they expire (ADR 0006, Task 11). No database work and no call to the storefront happen in the delivery's
 * transaction. A malformed, cross-store or cross-business payload is parked.
 */
@Injectable()
export class StorefrontRevalidateConsumer implements OnModuleInit {
  constructor(
    private readonly registry: OutboxConsumerRegistry,
    @Inject(REVALIDATION_QUEUE_PORT) private readonly revalidations: RevalidationQueuePort,
  ) {}

  onModuleInit(): void {
    const consumer: OutboxConsumer = {
      name: REVALIDATE_CONSUMER_NAME,
      topics: ['product.changed', 'collection.changed', 'store.changed'],
      queue: REVALIDATE_DELIVERY_QUEUE,
      handle: (delivery, scope) => this.handle(delivery, scope),
    };
    this.registry.register(consumer);
  }

  /** Queues the revalidation of one delivery; `scope` is the delivery's business. */
  async handle(delivery: OutboxDelivery, scope: TenantScope): Promise<void> {
    const target = targetOf(delivery, scope);
    await this.revalidations.enqueue({
      key: delivery.outboxId,
      storeId: target.storeId,
      tags: revalidationTagsOf(target),
      delayMs: REVALIDATE_SETTLE_MS,
    });
  }
}

/** What the delivery changed, or a park for a payload this consumer does not trust. */
function targetOf(delivery: OutboxDelivery, scope: TenantScope): RevalidationTarget {
  if (delivery.topic === 'product.changed') return productTarget(delivery);
  if (delivery.topic === 'collection.changed') return collectionTarget(delivery);
  if (delivery.topic === 'store.changed') return storeTarget(delivery, scope);
  throw new OutboxParkError('the storefront revalidation does not follow this topic');
}

function productTarget(delivery: OutboxDelivery): RevalidationTarget {
  const parsed = productChangedSchema.safeParse(delivery.payload);
  const productId = parsed.success ? canonicalCoreId(parsed.data.productId) : undefined;
  if (!parsed.success || productId === undefined || !isRowStore(delivery, parsed.data.storeId)) {
    return park(delivery.topic);
  }
  return { kind: 'product', storeId: parsed.data.storeId, productId };
}

function collectionTarget(delivery: OutboxDelivery): RevalidationTarget {
  const parsed = collectionChangedPayloadSchema.safeParse(delivery.payload);
  const collectionId = parsed.success ? canonicalCoreId(parsed.data.collectionId) : undefined;
  if (!parsed.success || collectionId === undefined || !isRowStore(delivery, parsed.data.storeId)) {
    return park(delivery.topic);
  }
  return { kind: 'collection', storeId: parsed.data.storeId, collectionId };
}

function storeTarget(delivery: OutboxDelivery, scope: TenantScope): RevalidationTarget {
  const parsed = storeChangedPayloadSchema.safeParse(delivery.payload);
  const foreign = parsed.success && parsed.data.businessId !== scope.businessId;
  if (!parsed.success || foreign || !isRowStore(delivery, parsed.data.storeId)) return park(delivery.topic);
  return { kind: 'store', storeId: parsed.data.storeId };
}
