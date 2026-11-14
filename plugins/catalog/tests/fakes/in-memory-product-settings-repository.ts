import type { CoreId } from '../../domain/core-id';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { ProductSettingsRepositoryPort } from '../../domain/ports/product-settings-repository.port';
import type { ProductSettings } from '../../domain/product-settings';
import type { StoreScope } from '../../domain/store-scope';
import { inStore } from './store-rows';

/** Product settings in memory, one row per product of a store; it passes the settings contract. */
export class InMemoryProductSettingsRepository implements ProductSettingsRepositoryPort {
  readonly rows: ProductSettings[] = [];

  private indexOf(scope: StoreScope, productId: CoreId): number {
    return this.rows.findIndex((row) => inStore(scope, row) && row.productId === productId);
  }

  findByProduct(_ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<ProductSettings | undefined> {
    return Promise.resolve(this.rows[this.indexOf(scope, productId)]);
  }

  upsert(_ctx: OperationContext, scope: StoreScope, settings: ProductSettings): Promise<void> {
    const index = this.indexOf(scope, settings.productId);
    const owned = { ...settings, businessId: scope.businessId, storeId: scope.storeId };
    if (index < 0) {
      this.rows.push(owned);
      return Promise.resolve();
    }
    const stored = this.rows[index] as ProductSettings;
    this.rows.splice(index, 1, { ...owned, id: stored.id, createdAt: stored.createdAt });
    return Promise.resolve();
  }

  soldOutProductIds(
    _ctx: OperationContext,
    scope: StoreScope,
    productIds?: readonly CoreId[],
  ): Promise<readonly CoreId[]> {
    const among = productIds === undefined ? undefined : new Set<string>(productIds);
    const ids = this.rows
      .filter((row) => inStore(scope, row) && row.soldOut && (among === undefined || among.has(row.productId)))
      .map((row) => row.productId)
      .sort((left, right) => Number(BigInt(left) - BigInt(right)));
    return Promise.resolve(ids);
  }

  delete(_ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<boolean> {
    const index = this.indexOf(scope, productId);
    if (index < 0) return Promise.resolve(false);
    this.rows.splice(index, 1);
    return Promise.resolve(true);
  }
}
