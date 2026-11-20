import {
  type OutboxConsumer,
  OutboxConsumerRegistry,
  type OutboxDelivery,
  OutboxParkError,
} from '@cod/plugin-platform-outbox';
import { requestContextOf } from '@cod/plugin-tenancy';
import { isSnowflake, PRODUCT_CHANGE_KINDS, QUEUES, type TenantScope, toStoreId } from '@cod/shared';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { z } from 'zod';
import { RecomputeMembershipService } from '../application/recompute-membership.service';
import { STORE_RECONCILE_QUEUE } from '../application/tokens';
import { canonicalCoreId } from '../domain/core-id';
import { asOperationContext } from '../domain/ports/operation-context';
import type { StoreReconcileQueuePort } from '../domain/ports/store-reconcile.port';
import type { StoreScope } from '../domain/store-scope';
import { StoreChannelContexts } from './store-channel-context';

/** The consumer's name: part of every delivery's job id. */
export const MEMBERSHIP_CONSUMER_NAME = 'collections-membership';
const MEMBERSHIP_QUEUE = 'catalog-effects';
const LOG_CONTEXT = 'CollectionsMembershipConsumer';

/** The `product.changed` payload (D2127) as this consumer trusts it: ids only, each well formed. */
const productChangedSchema = z.object({
  productId: z.string().refine((id) => canonicalCoreId(id) !== undefined),
  storeId: z.string().refine(isSnowflake),
  change: z.enum(PRODUCT_CHANGE_KINDS),
});

/** True when this run is the delivery's last: the queue gives up after it (D2336 (3)). */
const isLastDelivery = (delivery: OutboxDelivery): boolean => delivery.attempt >= QUEUES[MEMBERSHIP_QUEUE].attempts;

/**
 * Keeps automatic collections up to date with product edits (D2312, D2313): each `product.changed` re-matches that one
 * product against its store's automatic collections, on the store's own channel. A malformed payload is parked; a
 * missing or archived store is acknowledged. A delivery that fails for good asks for a store reconcile first, so the
 * store heals without waiting for the nightly sweep.
 */
@Injectable()
export class CollectionsMembershipConsumer implements OnModuleInit {
  constructor(
    private readonly registry: OutboxConsumerRegistry,
    private readonly contexts: StoreChannelContexts,
    private readonly recompute: RecomputeMembershipService,
    @Inject(STORE_RECONCILE_QUEUE) private readonly reconcile: StoreReconcileQueuePort,
  ) {}

  onModuleInit(): void {
    const consumer: OutboxConsumer = {
      name: MEMBERSHIP_CONSUMER_NAME,
      topics: ['product.changed'],
      queue: MEMBERSHIP_QUEUE,
      handle: (delivery, scope) => this.handle(delivery, scope),
    };
    this.registry.register(consumer);
  }

  /** Handles one delivery in its transaction; `scope` is the delivery's business. */
  async handle(delivery: OutboxDelivery, scope: TenantScope): Promise<void> {
    const parsed = productChangedSchema.safeParse(delivery.payload);
    if (!parsed.success || (delivery.storeId !== null && delivery.storeId !== parsed.data.storeId)) {
      throw new OutboxParkError('the product.changed payload is malformed');
    }
    const store: StoreScope = { businessId: scope.businessId, storeId: toStoreId(parsed.data.storeId) };
    try {
      await this.recomputeProduct(delivery, scope, store, parsed.data.productId);
    } catch (error) {
      if (isLastDelivery(delivery)) await this.askForReconcile(store);
      throw error;
    }
  }

  private async recomputeProduct(
    delivery: OutboxDelivery,
    scope: TenantScope,
    store: StoreScope,
    productId: string,
  ): Promise<void> {
    const ctx = requestContextOf(scope);
    if (ctx === undefined) throw new Error('The outbox delivery carries no request context');
    const onStore = await this.contexts.forStore(ctx, store.businessId, store.storeId);
    if (onStore === undefined) {
      Logger.info(
        `Delivery ${delivery.outboxId} skipped: store ${store.storeId} of business ${store.businessId} is missing or archived`,
        LOG_CONTEXT,
      );
      return;
    }
    await this.recompute.forProduct(asOperationContext(onStore), store, productId);
  }

  /** A reconcile that cannot be queued is logged: the delivery still fails and the nightly sweep heals the store. */
  private async askForReconcile(store: StoreScope): Promise<void> {
    try {
      await this.reconcile.enqueue(store, 'delivery');
    } catch (error) {
      const reason = error instanceof Error ? error.name : typeof error;
      Logger.error(
        `Could not queue the reconcile of store ${store.storeId} of business ${store.businessId}: ${reason}`,
        LOG_CONTEXT,
      );
    }
  }
}
