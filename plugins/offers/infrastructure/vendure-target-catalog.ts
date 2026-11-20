import { Injectable } from '@nestjs/common';
import { ProductService, type ProductVariant, ProductVariantService } from '@vendure/core';
import type { OfferTargetRefs } from '../domain/ports/offer-repository.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { OfferTargetCatalog } from '../domain/ports/target-catalog.port';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-scope';

/** A soft-deleted variant stays readable by id; it is no row an offer may name. */
const isLive = (variant: ProductVariant): boolean => variant.deletedAt === null;

/**
 * The store's variants and products over Vendure's channel-scoped reads (D2537): `ProductVariantService.findByIds` and
 * `ProductService.findByIds` only see rows of `ctx`'s channel, which the caller proved is the store's own (D2448), so
 * another store's or business's row is never found. Deleted variants are dropped here (the product read drops deleted
 * products itself); disabled and hidden rows count, unlike the quote's variant gate (D2423). `scope` is not read: the
 * channel is the scope.
 */
@Injectable()
export class VendureOfferTargetCatalog implements OfferTargetCatalog {
  constructor(
    private readonly variants: ProductVariantService,
    private readonly products: ProductService,
  ) {}

  async existing(ctx: OperationContext, _scope: StoreScope, refs: OfferTargetRefs): Promise<OfferTargetRefs> {
    // One read after the other: both may run on the request's single transaction connection.
    const variantIds = await this.existingVariantIds(ctx, refs.variantIds);
    const productIds = await this.existingProductIds(ctx, refs.productIds);
    return { variantIds, productIds };
  }

  private async existingVariantIds(ctx: OperationContext, ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const found = await this.variants.findByIds(toRequestContext(ctx), [...ids]);
    return found.filter(isLive).map((variant) => String(variant.id));
  }

  private async existingProductIds(ctx: OperationContext, ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const found = await this.products.findByIds(toRequestContext(ctx), [...ids]);
    return found.map((product) => String(product.id));
  }
}
