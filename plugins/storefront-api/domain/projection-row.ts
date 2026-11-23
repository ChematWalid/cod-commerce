import { normalizeForSearch, type ProductStatus, type SoldOutBehavior } from '@cod/shared';

/** A variant as the projection reads it: only its prices. */
export interface ProjectedVariant {
  readonly price: number;
  readonly oldPrice: number | null;
}

/**
 * A product as the catalog's public read shows it on a landing page, the widest public view (active and hidden,
 * sold out or not): what one projection row is built from. Only visible variants are listed.
 */
export interface ProjectedProduct {
  /** The Vendure product id, a decimal string. */
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly status: ProductStatus;
  /** The product's own price, used when no variant is visible. */
  readonly price: number;
  readonly oldPrice: number | null;
  readonly variants: readonly ProjectedVariant[];
  /** The featured image's storage path, `null` without one. */
  readonly imagePath: string | null;
  readonly createdAt: Date;
}

/** One `storefront_product` row: a product as store lists, collection pages and search read it (D3205). */
export interface ProjectionRow {
  readonly productId: string;
  readonly slug: string;
  readonly name: string;
  /** The name through `normalizeForSearch` (ADR 0014). */
  readonly searchText: string;
  readonly price: number;
  readonly oldPrice: number | null;
  readonly imagePath: string | null;
  /** Shown in lists by its status (active); a hidden product is kept but never listed. */
  readonly visible: boolean;
  readonly soldOut: boolean;
  /** `visible` and not hidden for being sold out: what lists and search filter on. */
  readonly listed: boolean;
  readonly createdAt: Date;
}

/**
 * Whether a product shows in the store's lists: visible, and either the store keeps sold-out products or this one is
 * not sold out. The same rule as the one `UPDATE` a sold-out behaviour change runs (D3205).
 */
export const isListed = (visible: boolean, soldOut: boolean, soldOutBehavior: SoldOutBehavior): boolean =>
  visible && (soldOutBehavior === 'keep' || !soldOut);

/** The cheapest visible variant's prices, or the product's own when no variant is visible. */
function cheapestPrices(product: ProjectedProduct): ProjectedVariant {
  const own = { price: product.price, oldPrice: product.oldPrice };
  return product.variants.reduce<ProjectedVariant>(
    (cheapest, variant) => (variant.price < cheapest.price ? variant : cheapest),
    product.variants[0] ?? own,
  );
}

/** An old price only when it is above the price, as a buyer's card shows a discount. */
const shownOldPrice = ({ price, oldPrice }: ProjectedVariant): number | null =>
  oldPrice !== null && oldPrice > price ? oldPrice : null;

/**
 * The projection row of `product` in a store whose sold-out behaviour is `soldOutBehavior`, or `undefined` for a draft,
 * which no public context ever shows and so is never stored.
 */
export function projectionRowOf(
  product: ProjectedProduct,
  soldOut: boolean,
  soldOutBehavior: SoldOutBehavior,
): ProjectionRow | undefined {
  if (product.status === 'draft') return undefined;
  const visible = product.status === 'active';
  const prices = cheapestPrices(product);
  return {
    productId: product.id,
    slug: product.slug,
    name: product.title,
    searchText: normalizeForSearch(product.title),
    price: prices.price,
    oldPrice: shownOldPrice(prices),
    imagePath: product.imagePath,
    visible,
    soldOut,
    listed: isListed(visible, soldOut, soldOutBehavior),
    createdAt: product.createdAt,
  };
}
