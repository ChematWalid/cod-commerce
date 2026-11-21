/** One option value of a variant, such as `Color: Red`, as the merchant typed it. */
export interface VariantOption {
  readonly name: string;
  readonly value: string;
}

/**
 * What a rule condition reads of a product (D2304). `price`, `onSale` and `variantOptions` come from the product's
 * non-hidden variants only; `brandId` and `tagIds` are the store's own snowflakes.
 */
export interface ProductFacts {
  readonly productId: string;
  readonly title: string;
  readonly brandId: string | null;
  readonly tagIds: readonly string[];
  /** The lowest price among the non-hidden variants, or the product price when none is visible (whole DZD). */
  readonly price: number;
  /** True when some non-hidden variant has an old price above its price. */
  readonly onSale: boolean;
  /** The options of each non-hidden variant. */
  readonly variantOptions: readonly (readonly VariantOption[])[];
}

/** One variant of a {@link ProductSnapshot}, hidden ones included. */
export interface VariantSnapshot {
  readonly hidden: boolean;
  readonly price: number;
  readonly oldPrice: number | null;
  readonly options: readonly VariantOption[];
}

/** A product as stored, every variant included, from which {@link productFactsOf} derives the rule facts. */
export interface ProductSnapshot {
  readonly productId: string;
  readonly title: string;
  readonly brandId: string | null;
  readonly tagIds: readonly string[];
  /** The product's own price, used when no variant is visible. */
  readonly price: number;
  readonly variants: readonly VariantSnapshot[];
}

const isOnSale = (variant: VariantSnapshot): boolean => variant.oldPrice !== null && variant.oldPrice > variant.price;

/**
 * The rule facts of a product (D2304): hidden variants are left out of the price, the on-sale flag and the options,
 * since the storefront never shows them (#246). E.g. visible variants at 800 and 3 000 DZD price the product at 800.
 */
export function productFactsOf(product: ProductSnapshot): ProductFacts {
  const visible = product.variants.filter((variant) => !variant.hidden);
  return {
    productId: product.productId,
    title: product.title,
    brandId: product.brandId,
    tagIds: product.tagIds,
    price: visible.length === 0 ? product.price : Math.min(...visible.map((variant) => variant.price)),
    onSale: visible.some(isOnSale),
    variantOptions: visible.map((variant) => variant.options),
  };
}
