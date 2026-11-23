import { PROJECTION_REBUILD_PAGE_SIZE } from '../domain/constants';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProjectionRepositoryPort } from '../domain/ports/projection-repository.port';
import type { ProjectionSourcePort } from '../domain/ports/projection-source.port';
import type { StorefrontStore, StorefrontStorePort } from '../domain/ports/storefront-store.port';
import { projectionRowOf } from '../domain/projection-row';
import type { StoreScope } from '../domain/store-scope';

/** What the projection is kept with. */
export interface ProjectionPorts {
  readonly stores: StorefrontStorePort;
  readonly source: ProjectionSourcePort;
  readonly projection: ProjectionRepositoryPort;
}

/** Why a projection change did nothing: the store is gone, inactive, or not the business's. */
export type ProjectionSkip = 'store-unavailable';

const sameStore = (expected: StoreScope, actual: StoreScope): boolean =>
  expected.businessId === actual.businessId && expected.storeId === actual.storeId;

/**
 * Keeps the `storefront_product` projection of a store (D3205): reads go through a storefront context of the store
 * (catalog visibility, D3201), writes through `writeCtx`, the outbox delivery's transaction. Each method answers
 * `'store-unavailable'` when the store is unknown, archived, of a suspended business or of another business than
 * `scope` says, and then writes nothing.
 */
export class ProjectionService {
  constructor(private readonly ports: ProjectionPorts) {}

  /** Rewrites the row of one product, or drops it when the product is gone or a draft. */
  async refreshProduct(
    writeCtx: OperationContext,
    scope: StoreScope,
    productId: string,
  ): Promise<ProjectionSkip | undefined> {
    const store = await this.storeFor(scope);
    if (store === undefined) return 'store-unavailable';
    await this.writeProduct(writeCtx, store, productId);
    return undefined;
  }

  /** Drops the row of a deleted product; needs no read. */
  async removeProduct(writeCtx: OperationContext, scope: StoreScope, productId: string): Promise<void> {
    await this.ports.projection.remove(writeCtx, scope, productId);
  }

  /**
   * Applies the store's current sold-out behaviour to every row, in one statement and with no product read: a store
   * settings change may have flipped it (D3205).
   */
  async relistStore(writeCtx: OperationContext, scope: StoreScope): Promise<ProjectionSkip | undefined> {
    const store = await this.storeFor(scope);
    if (store === undefined) return 'store-unavailable';
    await this.ports.projection.relist(writeCtx, scope, store.soldOutBehavior);
    return undefined;
  }

  /** Builds the rows of a store that has none yet; answers how many products were read, or why it did nothing. */
  async backfillIfEmpty(writeCtx: OperationContext, scope: StoreScope): Promise<number | ProjectionSkip> {
    if ((await this.ports.projection.count(writeCtx, scope)) > 0) return 0;
    return this.rebuildStore(writeCtx, scope);
  }

  /**
   * Rewrites the row of every live product of the store, page by page, then drops the rows of products the walk did
   * not meet, in the same transaction: a missed `deleted` delivery must not leave a ghost listed product. Answers how
   * many products were read.
   */
  async rebuildStore(writeCtx: OperationContext, scope: StoreScope): Promise<number | ProjectionSkip> {
    const store = await this.storeFor(scope);
    if (store === undefined) return 'store-unavailable';
    const walked: string[] = [];
    let after: string | null = null;
    do {
      const page = await this.ports.source.productIds(store.ctx, scope, after, PROJECTION_REBUILD_PAGE_SIZE);
      for (const productId of page.ids) await this.writeProduct(writeCtx, store, productId);
      walked.push(...page.ids);
      after = page.next;
    } while (after !== null);
    await this.ports.projection.removeAllExcept(writeCtx, store.scope, walked);
    return walked.length;
  }

  private async writeProduct(writeCtx: OperationContext, store: ReadableStore, productId: string): Promise<void> {
    const source = await this.ports.source.productOf(store.ctx, productId);
    const row =
      source === undefined ? undefined : projectionRowOf(source.product, source.soldOut, store.soldOutBehavior);
    if (row === undefined) {
      await this.ports.projection.remove(writeCtx, store.scope, productId);
      return;
    }
    await this.ports.projection.save(writeCtx, store.scope, row);
  }

  /** The storefront context of the scope's store, when it is available and the scope's business owns it. */
  private async storeFor(scope: StoreScope): Promise<ReadableStore | undefined> {
    const ctx = await this.ports.stores.contextFor(scope.storeId);
    if (ctx === undefined) return undefined;
    const store = this.ports.stores.storeOf(ctx);
    return sameStore(scope, store.scope) ? { ...store, ctx } : undefined;
  }
}

/** A store and the storefront context its catalog is read with. */
interface ReadableStore extends StorefrontStore {
  readonly ctx: OperationContext;
}
