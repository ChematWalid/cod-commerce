import { type BusinessId, NORMAL_FORM_VERSION } from '@cod/shared';
import { RECONCILE_BUSINESS_PAGE_SIZE } from '../domain/constants';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { CollectionDefinitionRepositoryPort } from '../domain/ports/collection-definition-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ReconcileReason, StoreReconcileQueuePort } from '../domain/ports/store-reconcile.port';

/**
 * The sweeps that queue store reconciles across the platform (D2336), one business at a time (tenant repositories
 * name one business per call, so there is no cross-business scan): at bootstrap the stores whose automatic
 * collections were built with an older normal form, every night every store holding an automatic collection.
 */
export class ReconcileSweepService {
  constructor(
    private readonly definitions: CollectionDefinitionRepositoryPort,
    private readonly directory: BusinessDirectoryPort,
    private readonly queue: StoreReconcileQueuePort,
    private readonly pageSize = RECONCILE_BUSINESS_PAGE_SIZE,
  ) {}

  /** Queues the stores built below {@link NORMAL_FORM_VERSION}; answers how many. */
  enqueueStale(ctx: OperationContext): Promise<number> {
    return this.sweep(ctx, 'version', NORMAL_FORM_VERSION);
  }

  /** Queues every store with an automatic collection; answers how many. */
  enqueueAll(ctx: OperationContext): Promise<number> {
    return this.sweep(ctx, 'nightly');
  }

  private async sweep(ctx: OperationContext, reason: ReconcileReason, belowVersion?: number): Promise<number> {
    let enqueued = 0;
    let after: BusinessId | undefined;
    for (;;) {
      const businessIds = await this.directory.businessIdsAfter(ctx, after, this.pageSize);
      for (const businessId of businessIds) enqueued += await this.sweepBusiness(ctx, businessId, reason, belowVersion);
      if (businessIds.length < this.pageSize) return enqueued;
      after = businessIds.at(-1);
    }
  }

  private async sweepBusiness(
    ctx: OperationContext,
    businessId: BusinessId,
    reason: ReconcileReason,
    belowVersion: number | undefined,
  ): Promise<number> {
    const storeIds = await this.definitions.automaticStores(ctx, { businessId }, belowVersion);
    for (const storeId of storeIds) await this.queue.enqueue({ businessId, storeId }, reason);
    return storeIds.length;
  }
}
