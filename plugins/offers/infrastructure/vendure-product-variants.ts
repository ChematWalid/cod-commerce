import { MAX_VARIANTS } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { ProductVariantService } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { ProductVariantsPort } from '../domain/ports/product-variants.port';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-scope';

/**
 * The variants of a product over Vendure's channel-scoped read (D2513): `getVariantsByProductId` joins the variants to
 * `ctx`'s channel, which the caller proved is the store's own (D2448), so a product of another store yields none.
 * `scope` is not read: the channel is the scope.
 */
@Injectable()
export class VendureProductVariants implements ProductVariantsPort {
  constructor(private readonly variants: ProductVariantService) {}

  async variantIdsOf(ctx: OperationContext, _scope: StoreScope, productId: string): Promise<readonly string[]> {
    const page = await this.variants.getVariantsByProductId(
      toRequestContext(ctx),
      productId,
      { take: MAX_VARIANTS },
      [],
    );
    return page.items.map((variant) => String(variant.id));
  }
}
