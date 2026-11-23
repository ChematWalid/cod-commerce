import type { SoldOutBehavior } from '@cod/shared';
import type { OperationContext } from '../../domain/ports/operation-context';
import type {
  ProjectionListing,
  ProjectionPage,
  ProjectionRepositoryPort,
} from '../../domain/ports/projection-repository.port';
import { isListed, type ProjectionRow } from '../../domain/projection-row';
import type { StoreScope } from '../../domain/store-scope';

const keyOf = (scope: StoreScope): string => `${scope.businessId}/${scope.storeId}`;

const COMPARE: Record<ProjectionListing['sort'], (a: ProjectionRow, b: ProjectionRow) => number> = {
  newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || Number(b.productId) - Number(a.productId),
  'price-asc': (a, b) => a.price - b.price || Number(a.productId) - Number(b.productId),
  'price-desc': (a, b) => b.price - a.price || Number(b.productId) - Number(a.productId),
};

/** {@link ProjectionRepositoryPort} in memory, one map per store, for the use-case tests. */
export class InMemoryProjectionRepository implements ProjectionRepositoryPort {
  private readonly stores = new Map<string, Map<string, ProjectionRow>>();
  /** Every relist asked, in order. */
  readonly relists: { scope: StoreScope; soldOutBehavior: SoldOutBehavior }[] = [];

  rowsOf(scope: StoreScope): Map<string, ProjectionRow> {
    const key = keyOf(scope);
    const rows = this.stores.get(key) ?? new Map<string, ProjectionRow>();
    this.stores.set(key, rows);
    return rows;
  }

  save(_ctx: OperationContext, scope: StoreScope, row: ProjectionRow): Promise<void> {
    const rows = this.rowsOf(scope);
    for (const [id, other] of rows) if (other.slug === row.slug && id !== row.productId) rows.delete(id);
    rows.set(row.productId, row);
    return Promise.resolve();
  }

  remove(_ctx: OperationContext, scope: StoreScope, productId: string): Promise<void> {
    this.rowsOf(scope).delete(productId);
    return Promise.resolve();
  }

  removeAllExcept(_ctx: OperationContext, scope: StoreScope, keptProductIds: readonly string[]): Promise<number> {
    const kept = new Set(keptProductIds);
    const rows = this.rowsOf(scope);
    const stale = [...rows.keys()].filter((id) => !kept.has(id));
    for (const id of stale) rows.delete(id);
    return Promise.resolve(stale.length);
  }

  relist(_ctx: OperationContext, scope: StoreScope, soldOutBehavior: SoldOutBehavior): Promise<number> {
    this.relists.push({ scope, soldOutBehavior });
    const rows = this.rowsOf(scope);
    for (const [id, row] of rows) rows.set(id, { ...row, listed: isListed(row.visible, row.soldOut, soldOutBehavior) });
    return Promise.resolve(rows.size);
  }

  count(_ctx: OperationContext, scope: StoreScope): Promise<number> {
    return Promise.resolve(this.rowsOf(scope).size);
  }

  listed(_ctx: OperationContext, scope: StoreScope, listing: ProjectionListing): Promise<ProjectionPage> {
    const among = listing.productIds === undefined ? undefined : new Set(listing.productIds);
    const matching = [...this.rowsOf(scope).values()]
      .filter((row) => row.listed && (among === undefined || among.has(row.productId)))
      .sort(COMPARE[listing.sort]);
    const items = matching.slice(listing.skip, listing.skip + listing.take);
    return Promise.resolve({ items, totalItems: matching.length });
  }
}
