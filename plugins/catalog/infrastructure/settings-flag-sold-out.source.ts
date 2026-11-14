import type { StoreId, TenantScope } from '@cod/shared';
import type { CoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductSettingsRepositoryPort } from '../domain/ports/product-settings-repository.port';
import type { SoldOutSource } from '../domain/ports/sold-out-source.port';

/**
 * The default {@link SoldOutSource} (D2107): a product is sold out while the merchant's "Mark as sold out" flag is on
 * in its `catalog_product_settings` row. P6.S1 replaces it with stock levels on the `SOLD_OUT_SOURCE` token.
 */
export class SettingsFlagSoldOutSource implements SoldOutSource {
  constructor(private readonly settings: ProductSettingsRepositoryPort) {}

  async soldOutIds(
    ctx: OperationContext,
    scope: TenantScope,
    storeId: StoreId,
    productIds: readonly CoreId[],
  ): Promise<ReadonlySet<string>> {
    if (productIds.length === 0) return new Set();
    return new Set(await this.settings.soldOutProductIds(ctx, { businessId: scope.businessId, storeId }, productIds));
  }

  allSoldOutIds(ctx: OperationContext, scope: TenantScope, storeId: StoreId): Promise<readonly CoreId[]> {
    return this.settings.soldOutProductIds(ctx, { businessId: scope.businessId, storeId });
  }
}
