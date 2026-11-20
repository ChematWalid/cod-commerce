import { COLLECTION_SYNC_MAX_PRODUCTS } from '@cod/shared';
import type { CollectionDefinition } from '../domain/collection';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductFactsPort } from '../domain/ports/product-facts.port';
import type { StoreReconcileQueuePort } from '../domain/ports/store-reconcile.port';
import type { StoreScope } from '../domain/store-scope';
import type { RecomputeMembershipService } from './recompute-membership.service';
import { storeHoldsMoreThan } from './store-walk';

/** What a collection save calls to bring an automatic collection's members up to its rule (D2312). */
export interface SaveTimeRecompute {
  forStore(ctx: OperationContext, scope: StoreScope, definition: CollectionDefinition): Promise<CollectionDefinition>;
}

/**
 * The recompute of a rule save (D2312): in the request when the store holds at most `syncMax` products, else the
 * save answers at once and the store reconcile job fills the members (D2336). The job waits for the save's store
 * lock, so it reads the saved rule.
 */
export class SaveRecomputeService implements SaveTimeRecompute {
  constructor(
    private readonly recompute: RecomputeMembershipService,
    private readonly facts: ProductFactsPort,
    private readonly queue: StoreReconcileQueuePort,
    private readonly syncMax = COLLECTION_SYNC_MAX_PRODUCTS,
  ) {}

  async forStore(
    ctx: OperationContext,
    scope: StoreScope,
    definition: CollectionDefinition,
  ): Promise<CollectionDefinition> {
    if (definition.mode !== 'automatic' || definition.rule === null) return definition;
    if (!(await storeHoldsMoreThan(this.facts, ctx, scope, this.syncMax))) {
      return this.recompute.forStore(ctx, scope, definition);
    }
    await this.queue.enqueue(scope, 'save');
    return definition;
  }
}
