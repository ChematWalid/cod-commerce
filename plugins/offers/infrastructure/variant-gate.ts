import { Injectable } from '@nestjs/common';
import {
  ConfigService,
  ProductService,
  ProductVariantService,
  type ProductVariant,
  type RequestContext,
} from '@vendure/core';
import { type CoreId, toCoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { GatedVariant, VariantGate } from '../domain/ports/variant-gate.port';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-scope';

/** The catalog's merchant-only `isHidden` variant field (D2149); read here, not through a catalog table. */
const HIDDEN_FIELD = 'isHidden';

// A hidden variant is dropped from every buyer read (D2165); pricing it on a crafted id would sell it anyway.
const isHidden = (variant: ProductVariant): boolean => {
  const fields: unknown = variant.customFields;
  return typeof fields === 'object' && fields !== null && (fields as Record<string, unknown>)[HIDDEN_FIELD] === true;
};

const isSellable = (variant: ProductVariant): boolean =>
  variant.enabled && variant.deletedAt === null && !isHidden(variant);

/**
 * The store-channel variant gate (D2423) over Vendure's channel-scoped reads: `ProductVariantService.findByIds` and
 * `ProductService.findByIds` only see rows of `ctx`'s channel, which the caller proved is the store's own (D2408), so
 * a variant of another business or store is never found. On top it drops disabled, deleted and hidden (catalog `isHidden`, D2149/D2165) variants, and those
 * whose product is deleted or not `enabled` (a catalog draft, D2109), and those with no price in the channel:
 * Vendure reports such a variant at price 0, which would make it a free line. `scope` is not read: the channel is the
 * scope.
 */
@Injectable()
export class VendureVariantGate implements VariantGate {
  constructor(
    private readonly variants: ProductVariantService,
    private readonly products: ProductService,
    private readonly config: ConfigService,
  ) {}

  async accept(
    ctx: OperationContext,
    _scope: StoreScope,
    variantIds: readonly CoreId[],
  ): Promise<ReadonlyMap<string, GatedVariant>> {
    const ids = [...new Set(variantIds)];
    if (ids.length === 0) return new Map();
    const request = toRequestContext(ctx);
    const found = (await this.variants.findByIds(request, ids)).filter(isSellable);
    const variants = await this.pricedInChannel(request, found);
    const liveProductIds = await this.enabledProductIds(ctx, variants);
    const accepted = variants.filter((variant) => liveProductIds.has(String(variant.productId)));
    return new Map(accepted.map((variant) => [String(variant.id), gatedOf(variant)]));
  }

  /** The variants Vendure's price selection finds a price for in `request`'s channel and currency. */
  private async pricedInChannel(
    request: RequestContext,
    variants: readonly ProductVariant[],
  ): Promise<ProductVariant[]> {
    const strategy = this.config.catalogOptions.productVariantPriceSelectionStrategy;
    const priced = await Promise.all(
      variants.map(
        async (variant) => (await strategy.selectPrice(request, variant.productVariantPrices)) !== undefined,
      ),
    );
    return variants.filter((_variant, index) => priced[index]);
  }

  /** The ids of the variants' products that are live and enabled in the channel. */
  private async enabledProductIds(ctx: OperationContext, variants: readonly ProductVariant[]): Promise<Set<string>> {
    const productIds = [...new Set(variants.map((variant) => String(variant.productId)))];
    if (productIds.length === 0) return new Set();
    const products = await this.products.findByIds(toRequestContext(ctx), productIds);
    return new Set(products.filter((product) => product.enabled).map((product) => String(product.id)));
  }
}

function gatedOf(variant: ProductVariant): GatedVariant {
  return {
    variantId: toCoreId(String(variant.id)),
    productId: toCoreId(String(variant.productId)),
    listPrice: variant.price,
  };
}
