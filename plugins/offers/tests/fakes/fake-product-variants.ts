import type { ProductVariantsPort } from '../../domain/ports/product-variants.port';
import type { OperationContext } from '../../domain/ports/operation-context.port';
import type { StoreScope } from '../../domain/store-scope';

/** The variants of each store's products in memory; a product of another store has none, as the channel read gives. */
export class FakeProductVariants implements ProductVariantsPort {
  private readonly byStore = new Map<string, ReadonlyMap<string, readonly string[]>>();

  /** Makes `variantIds` the variants of `productId` in `scope`'s store. */
  set(scope: StoreScope, productId: string, variantIds: readonly string[]): void {
    const key = `${scope.businessId}/${scope.storeId}`;
    this.byStore.set(key, new Map([...(this.byStore.get(key) ?? []), [productId, variantIds]]));
  }

  variantIdsOf(_ctx: OperationContext, scope: StoreScope, productId: string): Promise<readonly string[]> {
    return Promise.resolve(this.byStore.get(`${scope.businessId}/${scope.storeId}`)?.get(productId) ?? []);
  }
}
