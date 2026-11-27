import { z } from 'zod';
import { CATALOG_ID_MAX_LENGTH } from '../catalog/constants';
import { WILAYA_CODES, WILAYA_COUNT } from '../wilayas/wilayas';
import { deliveryFeeCommuneRateSchema } from './commune-rate';
import { FEE_GROUP_NAME_MAX, MAX_OVERWEIGHT_ALLOWANCE_KG, MAX_OVERWEIGHT_RATE } from './constants';
import { boundedIntSchema, deliveryIssue as issue, deliveryPriceSchema, isCleanLine } from './schema-parts';

/** The prices and switches of one wilaya in a fee group (D3120: desk is offered only when delivery is on too). */
export const deliveryFeeRateInputSchema = z.object(
  {
    provinceCode: z.enum(WILAYA_CODES, issue),
    homePrice: deliveryPriceSchema,
    deskPrice: deliveryPriceSchema,
    deliveryEnabled: z.boolean(issue),
    deskEnabled: z.boolean(issue),
  },
  issue,
);

/** One wilaya's prices as sent by the merchant. */
export type DeliveryFeeRateInput = z.output<typeof deliveryFeeRateInputSchema>;

const hasDistinctProvinces = (rates: readonly { provinceCode: string }[]): boolean =>
  new Set(rates.map(({ provinceCode }) => provinceCode)).size === rates.length;

/**
 * A carrier id as sent: kept as a bounded string so the API answers an unknown or foreign one "not found" (D3109,
 * until P5.S1 every non-null id is). A missing one is no carrier.
 */
const carrierIdSchema = z
  .string(issue)
  .max(CATALOG_ID_MAX_LENGTH, issue)
  .nullish()
  .transform((id) => id ?? null);

const feeGroupFields = {
  name: z.string(issue).trim().min(1, issue).max(FEE_GROUP_NAME_MAX, issue).refine(isCleanLine, issue),
  carrierId: carrierIdSchema,
  chargeOverweight: z.boolean(issue),
  overweightAllowanceKg: boundedIntSchema(MAX_OVERWEIGHT_ALLOWANCE_KG),
  /** Whole DZD per started kg above the allowance (D3121). */
  overweightRate: boundedIntSchema(MAX_OVERWEIGHT_RATE),
};

/** A whole fee group as the merchant creates or saves it: exactly one rate for each wilaya (`WILAYA_COUNT`). */
export const deliveryFeeGroupInputSchema = z.object(
  {
    ...feeGroupFields,
    rates: z.array(deliveryFeeRateInputSchema, issue).length(WILAYA_COUNT, issue).refine(hasDistinctProvinces, issue),
  },
  issue,
);

/** A fee group as sent by the merchant. */
export type DeliveryFeeGroupInput = z.output<typeof deliveryFeeGroupInputSchema>;

/**
 * One wilaya of a stored fee group: the effective prices (override ?? base) plus the base ones (platform default or
 * carrier sync). `overridden` says a merchant override is stored (D3107, D3125), never "price ≠ base", so a carrier
 * price equal to the override still shows it.
 */
export const deliveryFeeRateSchema = deliveryFeeRateInputSchema.extend({
  baseHomePrice: deliveryPriceSchema,
  baseDeskPrice: deliveryPriceSchema,
  overridden: z.boolean(),
});

/** One wilaya of a stored fee group. */
export type DeliveryFeeRate = z.output<typeof deliveryFeeRateSchema>;

/**
 * A stored fee group ("pricing option") of a store, with one rate per wilaya and its sparse commune rows (D3125);
 * dates are ISO 8601 strings.
 */
export const deliveryFeeGroupSchema = z.object({
  ...feeGroupFields,
  id: z.string(),
  isPlatformDefault: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  rates: z.array(deliveryFeeRateSchema).length(WILAYA_COUNT).refine(hasDistinctProvinces),
  communeRates: z.array(deliveryFeeCommuneRateSchema),
});

/** A stored fee group of a store. */
export type DeliveryFeeGroup = z.output<typeof deliveryFeeGroupSchema>;
