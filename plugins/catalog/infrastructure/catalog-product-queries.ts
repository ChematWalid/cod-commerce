import { tenantOf } from '@cod/plugin-tenancy';
import type { ProductListQuery } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { GetProductService } from '../application/get-product.service';
import { ListProductsService, type ProductViewPage } from '../application/list-products.service';
import type { ProductView } from '../application/product-view';
import { asOperationContext } from '../domain/ports/operation-context';

/**
 * The read-only product facade later sessions use (P2.S2-S5, P3; D2104): the products of the request's active store,
 * the store taken from the tenant the guard resolved, never from an argument (D2142). Admin reads: every status.
 *
 * @throws {TenantContextMissingError} on a context that did not pass `@TenantScoped()`.
 */
@Injectable()
export class CatalogProductQueries {
  constructor(
    private readonly reading: GetProductService,
    private readonly listing: ListProductsService,
  ) {}

  /** The product `productId` of the active store, or `undefined`. */
  byId(ctx: RequestContext, productId: string): Promise<ProductView | undefined> {
    const { businessId, activeStoreId } = tenantOf(ctx);
    return this.reading.byId(asOperationContext(ctx), { businessId, storeId: activeStoreId }, productId);
  }

  /** One page of the active store's products. */
  list(ctx: RequestContext, query: ProductListQuery): Promise<ProductViewPage> {
    const { businessId, activeStoreId } = tenantOf(ctx);
    return this.listing.list(asOperationContext(ctx), { businessId, storeId: activeStoreId }, query);
  }
}
