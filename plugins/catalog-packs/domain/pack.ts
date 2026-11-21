import type { PackDiscountType, PackPricingMode, PackVariantMode, PackWeightMode, Snowflake } from '@cod/shared';
import type { PACK_STATUSES } from './constants';

/** One of the {@link PACK_STATUSES}. */
export type PackStatus = (typeof PACK_STATUSES)[number];

/** One component line: a product of the store, optionally one of its variants, and how many the pack holds. */
export interface PackComponentLine {
  readonly productId: string;
  readonly variantId: string | null;
  readonly quantity: number;
}

/** How a pack is priced (D2202): a fixed price, or the components' sum less a discount. */
export interface PackPricing {
  readonly packPricingMode: PackPricingMode;
  readonly packFixedPrice: number | null;
  readonly packDiscountType: PackDiscountType | null;
  readonly packDiscountValue: number | null;
}

/** How a pack's weight is found (D2202): the components' sum, or grams of its own. */
export interface PackWeighting {
  readonly packWeightMode: PackWeightMode;
  readonly packFixedWeightGrams: number | null;
}

/** Everything a merchant decides about a pack: its modes and its 2 to 10 component lines. */
export interface PackDefinition extends PackPricing, PackWeighting {
  readonly packVariantMode: PackVariantMode;
  readonly packSharedOption: string | null;
  readonly components: readonly PackComponentLine[];
}

/** A stored pack of one pack product. */
export interface PackRecord extends PackDefinition {
  readonly id: Snowflake;
  readonly productId: string;
  readonly status: PackStatus;
}
