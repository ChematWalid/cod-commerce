import {
  type OutboxConsumer,
  OutboxConsumerRegistry,
  type OutboxDelivery,
  OutboxParkError,
} from '@cod/plugin-platform-outbox';
import { requestContextOf } from '@cod/plugin-tenancy';
import {
  isSnowflake,
  PRODUCT_CHANGE_KINDS,
  type QueueName,
  storeChangedPayloadSchema,
  type TenantScope,
  toStoreId,
} from '@cod/shared';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Logger, type RequestContext } from '@vendure/core';
import { z } from 'zod';
import { ProjectionService, type ProjectionSkip } from '../application/projection.service';
import { PROJECTION_CONSUMER_NAME } from '../domain/constants';
import { canonicalCoreId } from '../domain/core-id';
import { asOperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';

/** The pool the projection's deliveries run on, beside the collections membership (catalog effects, D2312). */
const PROJECTION_QUEUE: QueueName = 'catalog-effects';
const LOG_CONTEXT = 'StorefrontProjectionConsumer';

/** The `product.changed` payload (D2127) as this consumer trusts it: ids only, each well formed. */
const productChangedSchema = z.object({
  productId: z.string().refine((id) => canonicalCoreId(id) !== undefined),
  storeId: z.string().refine(isSnowflake),
  change: z.enum(PRODUCT_CHANGE_KINDS),
});

/** The outbox handed a delivery without the request context its scope should carry: a wiring fault, retried. */
export class MissingProjectionContextError extends Error {
  constructor() {
    super('The outbox delivery carries no request context');
    this.name = 'MissingProjectionContextError';
  }
}

/** The payload's store must be the delivery row's, when the row names one: anything else is a forged delivery. */
const isRowStore = (delivery: OutboxDelivery, storeId: string): boolean =>
  delivery.storeId === null || delivery.storeId === storeId;

/**
 * Keeps the storefront projection up to date (D3205): a `product.changed` rewrites (or drops) that one product's
 * row; a `store.changed` of the settings re-applies the store's sold-out behaviour in one `UPDATE`, nothing else. Rows
 * are written in the delivery's transaction; the catalog is read as the store (D3201). A malformed or cross-tenant
 * payload is parked; a missing or inactive store is acknowledged and logged.
 */
@Injectable()
export class StorefrontProjectionConsumer implements OnModuleInit {
  constructor(
    private readonly registry: OutboxConsumerRegistry,
    private readonly projection: ProjectionService,
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
    // Only a settings change can flip the sold-out behaviour; status and domain changes leave the rows as they are.
    if (parsed.data.change !== 'settings') return;
    const store: StoreScope = { businessId: scope.businessId, storeId: toStoreId(parsed.data.storeId) };
    this.logSkip(delivery, store, await this.projection.relistStore(asOperationContext(ctx), store));
  }

  private logSkip(delivery: OutboxDelivery, store: StoreScope, skip: ProjectionSkip | undefined): void {
    if (skip === undefined) return;
    Logger.info(
      `Delivery ${delivery.outboxId} skipped: store ${store.storeId} of business ${store.businessId} is ${skip}`,
      LOG_CONTEXT,
    );
  }
}
