import { catchUpTask } from '@cod/plugin-platform-jobs';
import { asOperationContext as asTenancyContext, BusinessStoreDirectory, TenantTransaction } from '@cod/plugin-tenancy';
import { type BusinessId, type Snowflake, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { Logger, RequestContextService, type ScheduledTask } from '@vendure/core';
import { ProjectionService, type ProjectionSkip } from '../application/projection.service';
import {
  PROJECTION_BACKFILL_BUSINESS_PAGE,
  PROJECTION_BACKFILL_SCHEDULE,
  PROJECTION_BACKFILL_TASK_ID,
} from '../domain/constants';
import { asOperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { ProjectionRebuilder } from './projection-rebuild.job';

const LOG_CONTEXT = 'StorefrontProjectionBackfill';

/** What one backfill sweep did. */
export interface BackfillCounts {
  /** Active stores whose projection was empty and was rebuilt. */
  readonly stores: number;
  /** Products read while rebuilding them. */
  readonly products: number;
}

/**
 * Builds the projection of every active store that has none (D3205): stores that existed before the projection, or
 * whose rows were lost. One transaction per store; a store that fails is logged and left to the next sweep, so one
 * broken store never stops the others. A store with rows is only counted, never re-read. {@link rebuild} rewrites
 * one store's rows on the same path, for the rebuild job (D3222).
 */
@Injectable()
export class ProjectionBackfill implements ProjectionRebuilder {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly directory: BusinessStoreDirectory,
    private readonly transactions: TenantTransaction,
    private readonly projection: ProjectionService,
  ) {}

  /** One sweep over the platform's businesses, page by page. */
  async run(): Promise<BackfillCounts> {
    const ctx = await this.contexts.create({ apiType: 'admin' });
    let counts: BackfillCounts = { stores: 0, products: 0 };
    let after: Snowflake | undefined;
    for (;;) {
      const page = await this.directory.allBusinessIds(asTenancyContext(ctx), after, PROJECTION_BACKFILL_BUSINESS_PAGE);
      for (const business of page) counts = add(counts, await this.backfillBusiness(business.id));
      if (page.length < PROJECTION_BACKFILL_BUSINESS_PAGE) return counts;
      const last = page.at(-1);
      after = last === undefined ? undefined : toSnowflake(last.id);
    }
  }

  /** Rewrites every row of one store in one transaction; a failure propagates, so the rebuild job retries. */
  async rebuild(scope: StoreScope): Promise<number | ProjectionSkip> {
    const ctx = await this.contexts.create({ apiType: 'admin' });
    return this.transactions.run(ctx, scope, (txCtx) => this.projection.rebuildStore(asOperationContext(txCtx), scope));
  }

  private async backfillBusiness(businessId: BusinessId): Promise<BackfillCounts> {
    const ctx = await this.contexts.create({ apiType: 'admin' });
    const stores = await this.directory.storesOf(asTenancyContext(ctx), businessId);
    let counts: BackfillCounts = { stores: 0, products: 0 };
    for (const store of stores) {
      if (store.status !== 'active') continue;
      counts = add(counts, await this.backfillStore({ businessId, storeId: store.id }));
    }
    return counts;
  }

  private async backfillStore(scope: StoreScope): Promise<BackfillCounts> {
    try {
      const ctx = await this.contexts.create({ apiType: 'admin' });
      const read = await this.transactions.run(ctx, scope, (txCtx) =>
        this.projection.backfillIfEmpty(asOperationContext(txCtx), scope),
      );
      return typeof read === 'number' && read > 0 ? { stores: 1, products: read } : { stores: 0, products: 0 };
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.name : typeof error;
      Logger.error(`The projection backfill of store ${scope.storeId} failed: ${reason}`, LOG_CONTEXT);
      return { stores: 0, products: 0 };
    }
  }
}

const add = (left: BackfillCounts, right: BackfillCounts): BackfillCounts => ({
  stores: left.stores + right.stores,
  products: left.products + right.products,
});

/** Every 15 minutes, builds the projection of the stores that have none (D3205). Safe to run late and twice. */
export const projectionBackfillTask: ScheduledTask = catchUpTask({
  id: PROJECTION_BACKFILL_TASK_ID,
  schedule: PROJECTION_BACKFILL_SCHEDULE,
  description: 'Build the storefront projection of every active store that has none',
  run: async (injector) => {
    const counts = await injector.get(ProjectionBackfill).run();
    return { ...counts };
  },
});
