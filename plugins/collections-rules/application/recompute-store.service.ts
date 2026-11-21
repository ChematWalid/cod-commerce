import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';
import { RecomputeMembershipService } from './recompute-membership.service';

/**
 * The store reconcile (D2336): rebuilds every automatic collection of one store from its rule, in one transaction
 * under the store lock (D2334), so membership heals from a lost delivery, a writer that published no
 * `product.changed`, or a normal form change. Manual collections are left as they are.
 */
export class RecomputeStoreService {
  constructor(
    private readonly ports: CollectionPorts,
    private readonly recompute = new RecomputeMembershipService(ports),
  ) {}

  /** Answers how many automatic collections were rebuilt. */
  run(ctx: OperationContext, scope: StoreScope): Promise<number> {
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      await this.ports.lock.lockStore(tx, scope.storeId);
      const automatic = await this.ports.definitions.listAutomatic(tx, scope);
      for (const definition of automatic) await this.recompute.forStore(tx, scope, definition);
      return automatic.length;
    });
  }
}
