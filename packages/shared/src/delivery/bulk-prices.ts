import { z } from 'zod';
import { WILAYA_CODES } from '../wilayas/wilayas';
import {
  MAX_ADJUST_PROVINCES,
  MAX_DELIVERY_PRICE,
  MAX_PRICE_ADJUST_PERCENT,
  MIN_PRICE_ADJUST_PERCENT,
  PRICE_ADJUSTMENT_KINDS,
} from './constants';
import { feeGroupNameSchema } from './fee-group';
import { deliveryIssue as issue, deliveryPriceSchema } from './schema-parts';

const hasDistinctCodes = (codes: readonly string[]): boolean => new Set(codes).size === codes.length;

/** A value within the bounds of its kind: a DZD amount within ± the price bound, a percent from -100 to the bound. */
function valueFitsKind({ kind, value }: { kind: (typeof PRICE_ADJUSTMENT_KINDS)[number]; value: number }): boolean {
  if (kind === 'amount') return Math.abs(value) <= MAX_DELIVERY_PRICE;
  return value >= MIN_PRICE_ADJUST_PERCENT && value <= MAX_PRICE_ADJUST_PERCENT;
}

/**
 * "Raise/lower by…" (D3140): the selected wilayas' home and/or desk prices move by a whole DZD amount or a whole
 * percent, rounded half up and clamped to 0–`MAX_DELIVERY_PRICE` by the API, which writes overrides only. Commune
 * overrides stay unless `includeCommunes` (default false).
 */
export const deliveryFeePriceAdjustmentInputSchema = z
  .object(
    {
      provinceCodes: z
        .array(z.enum(WILAYA_CODES, issue), issue)
        .min(1, issue)
        .max(MAX_ADJUST_PROVINCES, issue)
        .refine(hasDistinctCodes, issue),
      kind: z.enum(PRICE_ADJUSTMENT_KINDS, issue),
      value: z.number(issue).int(issue),
      home: z.boolean(issue),
      desk: z.boolean(issue),
      includeCommunes: z
        .boolean(issue)
        .nullish()
        .transform((included) => included ?? false),
    },
    issue,
  )
  .refine((input) => input.home || input.desk, issue)
  .refine(valueFitsKind, issue);

/** A price adjustment as sent by the merchant. */
export type DeliveryFeePriceAdjustmentInput = z.output<typeof deliveryFeePriceAdjustmentInputSchema>;

/**
 * "Set price for all communes" of one wilaya (D3140): an absent price is left as each commune stores it, a number
 * becomes every commune's price, `null` clears every commune's override (back to its base, then the wilaya).
 */
export const deliveryFeeCommunePricesInputSchema = z.object(
  {
    provinceCode: z.enum(WILAYA_CODES, issue),
    prices: z
      .object(
        { homePrice: deliveryPriceSchema.nullable().optional(), deskPrice: deliveryPriceSchema.nullable().optional() },
        issue,
      )
      .refine((prices) => prices.homePrice !== undefined || prices.deskPrice !== undefined, issue),
  },
  issue,
);

/** The prices for every commune of a wilaya as sent by the merchant. */
export type DeliveryFeeCommunePricesInput = z.output<typeof deliveryFeeCommunePricesInputSchema>;

/** "Copy" a pricing option (D3140): the copy's name; everything else comes from the source group. */
export const deliveryFeeGroupDuplicateInputSchema = z.object({ name: feeGroupNameSchema }, issue);

/** The name of a copy as sent by the merchant. */
export type DeliveryFeeGroupDuplicateInput = z.output<typeof deliveryFeeGroupDuplicateInputSchema>;
