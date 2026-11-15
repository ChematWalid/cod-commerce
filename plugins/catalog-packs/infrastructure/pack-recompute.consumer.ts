import { type OutboxConsumer, type OutboxDelivery, OutboxParkError } from '@cod/plugin-platform-outbox';
import {
  CATALOG_ERROR_CODES,
  DOMAIN_EVENT_NAMES,
  DomainError,
  isSnowflake,
  type StoreId,
  toBusinessId,
  toStoreId,
} from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import { RecomputePacksService } from '../application/recompute-packs.service';
import { PACK_RECOMPUTE_CONSUMER, PACK_RECOMPUTE_QUEUE } from '../domain/constants';
import { asOperationContext } from '../domain/ports/operation-context';
import { parseProductId } from '../domain/product-id';
import type { StoreScope } from '../domain/store-scope';

/** What the consumer needs of catalog's facade: the store-channel context of a scope (D2201). */
export interface StoreContexts {
  storeContext(scope: StoreScope): Promise<RequestContext>;
}

/**
 * The product and store a `product.changed` payload names (D2127), or `undefined` when it names none; a malformed
 * product id names none too, so it never reaches the database (D2136, D2238).
 */
function changeOf(delivery: OutboxDelivery): { productId: string; storeId: StoreId } | undefined {
  const { productId, storeId } = delivery.payload as Record<string, unknown>;
  if (typeof productId !== 'string' || typeof storeId !== 'string' || !isSnowflake(storeId)) return undefined;
  const parsed = parseProductId(productId);
  return parsed === undefined ? undefined : { productId: parsed, storeId: toStoreId(storeId) };
}

/**
 * The outbox consumer `catalog-packs-recompute` (D2203): on `product.changed` it recomputes the packs of the event's
 * business and store that hold the product, in the store-channel context catalog builds for that scope, so a worker
 * writes through the same facade checks as a request. The business is the delivery's, never the payload's.
 */
export class PackRecomputeConsumer implements OutboxConsumer {
  readonly name = PACK_RECOMPUTE_CONSUMER;
  readonly topics = [DOMAIN_EVENT_NAMES.ProductChanged] as const;
  readonly queue = PACK_RECOMPUTE_QUEUE;

  constructor(
    private readonly contexts: StoreContexts,
    private readonly recomputing: RecomputePacksService,
  ) {}

  /**
   * @throws {OutboxParkError} for a payload that names no product or store, or a store catalog refuses (archived,
   * suspended business): retrying would not help. The delivery's own scope and transaction are not used: catalog's
   * writes run in the store-channel context, and a rerun recomputes the same values (idempotent).
   */
  async handle(delivery: OutboxDelivery): Promise<void> {
    const change = changeOf(delivery);
    if (change === undefined) throw new OutboxParkError('the product.changed payload names no product or store');
    const scope: StoreScope = { businessId: toBusinessId(delivery.businessId), storeId: change.storeId };
    const ctx = await this.storeContext(scope);
    await this.recomputing.recompute(asOperationContext(ctx), scope, change.productId);
  }

  private async storeContext(scope: StoreScope): Promise<RequestContext> {
    try {
      return await this.contexts.storeContext(scope);
    } catch (error: unknown) {
      const refused = error instanceof DomainError && error.code === CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND;
      if (refused) throw new OutboxParkError('the store is not live: its packs are not recomputed');
      throw error;
    }
  }
}
