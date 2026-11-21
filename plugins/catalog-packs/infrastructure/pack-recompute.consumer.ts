import { type OutboxConsumer, type OutboxDelivery, OutboxParkError } from '@cod/plugin-platform-outbox';
import { requestContextOf } from '@cod/plugin-tenancy';
import {
  CATALOG_ERROR_CODES,
  DOMAIN_EVENT_NAMES,
  DomainError,
  isSnowflake,
  type StoreId,
  type TenantScope,
  toBusinessId,
  toStoreId,
} from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import { RecomputePacksService } from '../application/recompute-packs.service';
import { PACK_RECOMPUTE_CONSUMER, PACK_RECOMPUTE_QUEUE } from '../domain/constants';
import { asOperationContext } from '../domain/ports/operation-context';
import { parseProductId } from '../domain/product-id';
import type { StoreScope } from '../domain/store-scope';

/**
 * What the consumer needs of catalog's facade: the store-channel context of a scope (D2201), joining the transaction
 * of `within` when given (D2282).
 */
export interface StoreContexts {
  storeContext(scope: StoreScope, within?: RequestContext): Promise<RequestContext>;
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
   * Everything runs in the delivery's own transaction (`outer`), on the one connection it already holds: the pack
   * lookup first, then, only when some pack holds the product, the store-channel context catalog builds inside that
   * transaction and each pack's savepoint. Asking the pool for a second connection while the delivery's is held
   * starved the worker pool under an import's fan-out (#260, D2282). A product no pack holds ends there, with no
   * store context, transaction or lock. A rerun recomputes the same values (idempotent).
   *
   * @throws {OutboxParkError} for a payload that names no product or store, or (when a pack holds the product) a store
   * catalog refuses (archived, suspended business): retrying would not help.
   */
  async handle(delivery: OutboxDelivery, outer: TenantScope): Promise<void> {
    const change = changeOf(delivery);
    if (change === undefined) throw new OutboxParkError('the product.changed payload names no product or store');
    const scope: StoreScope = { businessId: toBusinessId(delivery.businessId), storeId: change.storeId };
    const within = requestContextOf(outer);
    const lookup = within === undefined ? await this.storeContext(scope) : within;
    const packs = await this.recomputing.affectedPacks(asOperationContext(lookup), scope, change.productId);
    if (packs.length === 0) return;
    const ctx = within === undefined ? lookup : await this.storeContext(scope, within);
    await this.recomputing.recomputePacks(asOperationContext(ctx), scope, packs);
  }

  private async storeContext(scope: StoreScope, within?: RequestContext): Promise<RequestContext> {
    try {
      return await this.contexts.storeContext(scope, within);
    } catch (error: unknown) {
      const refused = error instanceof DomainError && error.code === CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND;
      if (refused) throw new OutboxParkError('the store is not live: its packs are not recomputed');
      throw error;
    }
  }
}
