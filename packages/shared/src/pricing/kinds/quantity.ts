import { z } from 'zod';
import { MONEY_MAX_DZD } from '../../catalog/money';
import { QUANTITY_PRICE_MODES } from '../channels';
import { MAX_LINE_QUANTITY, MAX_TIERS, PERCENT_BASE } from '../constants';
import { invalidOfferConfig } from '../error-codes';
import { localizedLabelSchema } from '../offer-model';

/** One tier: from `quantity` pieces, `price` % off (percent mode) or `price` DZD for the tier (total mode). */
const quantityTierSchema = z.object(
  {
    quantity: z
      .number(invalidOfferConfig)
      .int(invalidOfferConfig)
      .min(1, invalidOfferConfig)
      .max(MAX_LINE_QUANTITY, invalidOfferConfig),
    price: z
      .number(invalidOfferConfig)
      .int(invalidOfferConfig)
      .min(0, invalidOfferConfig)
      .max(MONEY_MAX_DZD, invalidOfferConfig),
    /** Exposed to forms only; the engine never raises a quantity (D2410). */
    preselected: z.boolean(invalidOfferConfig).default(false),
    freeDelivery: z.boolean(invalidOfferConfig).default(false),
    label: localizedLabelSchema.optional(),
  },
  invalidOfferConfig,
);

type QuantityTier = z.output<typeof quantityTierSchema>;

const isStrictlyAscending = (tiers: readonly QuantityTier[]): boolean =>
  tiers.every((tier, index) => index === 0 || tier.quantity > (tiers[index - 1]?.quantity ?? 0));

const hasAtMostOnePreselected = (tiers: readonly QuantityTier[]): boolean =>
  tiers.filter((tier) => tier.preselected).length <= 1;

/** Configuration of a quantity offer (D2409, D2410). */
export const quantityConfigSchema = z
  .object(
    {
      priceMode: z.enum(QUANTITY_PRICE_MODES, invalidOfferConfig),
      tiers: z
        .array(quantityTierSchema, invalidOfferConfig)
        .min(1, invalidOfferConfig)
        .max(MAX_TIERS, invalidOfferConfig)
        .refine(isStrictlyAscending, invalidOfferConfig)
        .refine(hasAtMostOnePreselected, invalidOfferConfig),
    },
    invalidOfferConfig,
  )
  .refine(
    ({ priceMode, tiers }) => priceMode !== 'percent' || tiers.every((tier) => tier.price <= PERCENT_BASE),
    invalidOfferConfig,
  );

export type QuantityConfig = z.output<typeof quantityConfigSchema>;
export type { QuantityTier };
