/** How a pack is priced: a price of its own, or the sum of its components then a discount (D2202). */
export const PACK_PRICING_MODES = ['fixed', 'components_sum'] as const;
/** How the discount of a `components_sum` pack is read: a percentage or an amount in whole DZD. */
export const PACK_DISCOUNT_TYPES = ['percent', 'amount'] as const;
/** How a pack's variants are made: one default variant, or one per value of an option all components share. */
export const PACK_VARIANT_MODES = ['per_component', 'shared_option'] as const;
/** How a pack's weight is found: the sum of its components, or a weight of its own in grams. */
export const PACK_WEIGHT_MODES = ['components_sum', 'fixed'] as const;

/** Fewest and most component lines of one pack. */
export const PACK_MIN_COMPONENTS = 2;
export const PACK_MAX_COMPONENTS = 10;
/** Highest quantity of one component line. */
export const PACK_MAX_QUANTITY = 99;
/** Longest name of the shared option, as an option name of the catalog. */
export const PACK_SHARED_OPTION_MAX = 50;
/** Highest percentage discount. */
export const PACK_MAX_PERCENT_DISCOUNT = 100;

/** One of the {@link PACK_PRICING_MODES}. */
export type PackPricingMode = (typeof PACK_PRICING_MODES)[number];
/** One of the {@link PACK_DISCOUNT_TYPES}. */
export type PackDiscountType = (typeof PACK_DISCOUNT_TYPES)[number];
/** One of the {@link PACK_VARIANT_MODES}. */
export type PackVariantMode = (typeof PACK_VARIANT_MODES)[number];
/** One of the {@link PACK_WEIGHT_MODES}. */
export type PackWeightMode = (typeof PACK_WEIGHT_MODES)[number];
