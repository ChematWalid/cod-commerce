import {
  type OutboxConsumer,
  OutboxConsumerRegistry,
  type OutboxDelivery,
  OutboxParkError,
} from '@cod/plugin-platform-outbox';
import { requestContextOf } from '@cod/plugin-tenancy';
import { type QueueName, storeChangedPayloadSchema, type TenantScope, toStoreId } from '@cod/shared';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { Logger, type RequestContext } from '@vendure/core';
import { ProjectionService, type ProjectionSkip } from '../application/projection.service';
import { PROJECTION_REBUILD_QUEUE_PORT } from '../application/tokens';
import { PROJECTION_CONSUMER_NAME } from '../domain/constants';
import { asOperationContext } from '../domain/ports/operation-context';
import type { ProjectionRebuildQueuePort } from '../domain/ports/projection-rebuild-queue.port';
import type { StoreScope } from '../domain/store-scope';
import { isRowStore, productChangedSchema } from './outbox-payloads';

/** The pool the projection's deliveries run on, beside the collections membership (catalog effects, D2312). */
const PROJECTION_QUEUE: QueueName = 'catalog-effects';
const LOG_CONTEXT = 'StorefrontProjectionConsumer';

/** The outbox handed a delivery without the request context its scope should carry: a wiring fault, retried. */
export class MissingProjectionContextError extends Error {
  constructor() {
    super('The outbox delivery carries no request context');
    this.name = 'MissingProjectionContextError';
  }
}

/**
 * Keeps the storefront projection up to date (D3205): a `product.changed` rewrites (or drops) that one product's
 * row; a `store.changed` of the settings re-applies the store's sold-out behaviour in one `UPDATE` and queues a
 * rebuild of the store's rows, whose names are read in the store language, which the change may have switched. Rows
 * are written in the delivery's transaction; the catalog is read as the store (D3201). A malformed or cross-tenant
 * payload is parked; a missing or inactive store is acknowledged and logged.
 */
@Injectable()
export class StorefrontProjectionConsumer implements OnModuleInit {
  constructor(
    private readonly registry: OutboxConsumerRegistry,
    private readonly projection: ProjectionService,
    @Inject(PROJECTION_REBUILD_QUEUE_PORT) private readonly rebuilds: ProjectionRebuildQueuePort,
  ) {}

  onModuleInit(): void {
    const consumer: OutboxConsumer = {
      name: PROJECTION_CONSUMER_NAME,
      topics: ['product.changed', 'store.changed'],
      queue: PROJECTION_QUEUE,
      handle: (delivery, scope) => this.handle(delivery, scope),
    };
    this.registry.register(consumer);
  }

  /** Handles one delivery in its transaction; `scope` is the delivery's business. */
  async handle(delivery: OutboxDelivery, scope: TenantScope): Promise<void> {
    const ctx = requestContextOf(scope);
    if (ctx === undefined) throw new MissingProjectionContextError();
    if (delivery.topic === 'product.changed') return this.onProduct(ctx, delivery, scope);
    if (delivery.topic === 'store.changed') return this.onStore(ctx, delivery, scope);
    throw new OutboxParkError('the storefront projection does not follow this topic');
  }

  private async onProduct(ctx: RequestContext, delivery: OutboxDelivery, scope: TenantScope): Promise<void> {
    const parsed = productChangedSchema.safeParse(delivery.payload);
    if (!parsed.success || !isRowStore(delivery, parsed.data.storeId)) {
      throw new OutboxParkError('the product.changed payload is malformed');
    }
    const store: StoreScope = { businessId: scope.businessId, storeId: toStoreId(parsed.data.storeId) };
    const { productId, change } = parsed.data;
    const writeCtx = asOperationContext(ctx);
    if (change === 'deleted') return this.projection.removeProduct(writeCtx, store, productId);
    this.logSkip(delivery, store, await this.projection.refreshProduct(writeCtx, store, productId));
  }

  private async onStore(ctx: RequestContext, delivery: OutboxDelivery, scope: TenantScope): Promise<void> {
    const parsed = storeChangedPayloadSchema.safeParse(delivery.payload);
    const foreign = parsed.success && parsed.data.businessId !== scope.businessId;
    if (!parsed.success || foreign || !isRowStore(delivery, parsed.data.storeId)) {
      throw new OutboxParkError('the store.changed payload is malformed');
    }
    // Only a settings change can flip the sold-out behaviour or the language; status and domain changes leave the rows.
    if (parsed.data.change !== 'settings') return;
    const store: StoreScope = { businessId: scope.businessId, storeId: toStoreId(parsed.data.storeId) };
    const skip = await this.projection.relistStore(asOperationContext(ctx), store);
    this.logSkip(delivery, store, skip);
    // The settings carry no "what changed", so every settings change rebuilds; merchants rarely save them (D3222).
    if (skip === undefined) await this.rebuilds.enqueue(store, delivery.outboxId);
  }

  private logSkip(delivery: OutboxDelivery, store: StoreScope, skip: ProjectionSkip | undefined): void {
    if (skip === undefined) return;
    Logger.info(
      `Delivery ${delivery.outboxId} skipped: store ${store.storeId} of business ${store.businessId} is ${skip}`,
      LOG_CONTEXT,
    );
  }
}
