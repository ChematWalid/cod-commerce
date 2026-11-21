import { z } from 'zod';
import {
  catalogObject,
  catalogRefIdKey,
  catalogRefIdSchema,
  catalogTextSchema,
  intColumnSchema,
} from '../catalog/fields';
import { moneySchema } from '../catalog/money';
import {
  PACK_DISCOUNT_TYPES,
  PACK_MAX_COMPONENTS,
  PACK_MAX_PERCENT_DISCOUNT,
  PACK_MAX_QUANTITY,
  PACK_MIN_COMPONENTS,
  PACK_PRICING_MODES,
  PACK_SHARED_OPTION_MAX,
  PACK_VARIANT_MODES,
  PACK_WEIGHT_MODES,
} from './constants';
import { CATALOG_PACKS_ERROR_CODES } from './error-codes';

const invalidPackInput = { message: CATALOG_PACKS_ERROR_CODES.INVALID_INPUT };

/** One component line: a product of the store, optionally one of its variants, and how many the pack holds. */
const packComponentSchema = catalogObject({
  productId: catalogRefIdSchema,
  variantId: catalogRefIdSchema.nullish(),
  quantity: z
    .number(invalidPackInput)
    .int(invalidPackInput)
    .min(1, invalidPackInput)
    .max(PACK_MAX_QUANTITY, invalidPackInput),
});

/** Product and variant of a line as the boundary will parse them, so `"07"` and `"7"` are the same product. */
const componentKey = ({ productId, variantId }: z.output<typeof packComponentSchema>): string =>
  `${catalogRefIdKey(productId)}:${variantId == null ? '' : catalogRefIdKey(variantId)}`;

const packFieldsSchema = catalogObject({
  packPricingMode: z.enum(PACK_PRICING_MODES, invalidPackInput),
  packFixedPrice: moneySchema.nullish(),
  packDiscountType: z.enum(PACK_DISCOUNT_TYPES, invalidPackInput).nullish(),
  packDiscountValue: moneySchema.nullish(),
  packVariantMode: z.enum(PACK_VARIANT_MODES, invalidPackInput),
  packSharedOption: catalogTextSchema(PACK_SHARED_OPTION_MAX).nullish(),
  packWeightMode: z.enum(PACK_WEIGHT_MODES, invalidPackInput),
  packFixedWeightGrams: intColumnSchema.nullish(),
  components: z
    .array(packComponentSchema, invalidPackInput)
    .min(PACK_MIN_COMPONENTS, invalidPackInput)
    .max(PACK_MAX_COMPONENTS, invalidPackInput)
    .refine((lines) => new Set(lines.map(componentKey)).size === lines.length, invalidPackInput),
});

type PackFields = z.output<typeof packFieldsSchema>;

const isSet = (value: unknown): boolean => value !== null && value !== undefined;

/** A fixed price only with fixed pricing; a discount (type and value together) only with summed pricing. */
function hasValidPricing(pack: PackFields): boolean {
  const hasDiscount = isSet(pack.packDiscountType);
  if (hasDiscount !== isSet(pack.packDiscountValue)) return false;
  if (pack.packPricingMode === 'fixed') return isSet(pack.packFixedPrice) && !hasDiscount;
  if (isSet(pack.packFixedPrice)) return false;
  return pack.packDiscountType !== 'percent' || (pack.packDiscountValue ?? 0) <= PACK_MAX_PERCENT_DISCOUNT;
}

/** The shared option is named only in shared mode, where the shared value, not a pinned variant, picks each one. */
function hasValidVariantMode(pack: PackFields): boolean {
  if (pack.packVariantMode === 'per_component') return !isSet(pack.packSharedOption);
  return isSet(pack.packSharedOption) && pack.components.every(({ variantId }) => !isSet(variantId));
}

/** A fixed weight is given exactly when the weight is fixed. */
const hasValidWeight = (pack: PackFields): boolean =>
  (pack.packWeightMode === 'fixed') === isSet(pack.packFixedWeightGrams);

/**
 * "Save a pack" (D2202): its pricing, discount, variant and weight modes and its 2 to 10 component lines. A field
 * that belongs to another mode must be absent or null, so a stored pack never carries a value nobody reads.
 * Store-bound checks (components of the store, not packs themselves, the shared option present) are the service's.
 */
export const packInputSchema = packFieldsSchema
  .refine(hasValidPricing, invalidPackInput)
  .refine(hasValidVariantMode, invalidPackInput)
  .refine(hasValidWeight, invalidPackInput);

export type PackInput = z.input<typeof packInputSchema>;
export type PackCommand = z.output<typeof packInputSchema>;
export type PackComponentInput = z.input<typeof packComponentSchema>;
export type PackComponentCommand = z.output<typeof packComponentSchema>;
