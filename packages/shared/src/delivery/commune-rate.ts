import { z } from 'zod';
import { WILAYA_CODES } from '../wilayas/wilayas';
import { MAX_COMMUNE_RATES_PER_WILAYA, ONS_CODE_MAX } from './constants';
import { deliveryIssue as issue, deliveryPriceSchema } from './schema-parts';

/** A commune's ONS code (`codeOns`), the key geo's `TownDirectory` checks against the wilaya (D3125). */
const onsCodeSchema = z.number(issue).int(issue).min(1, issue).max(ONS_CODE_MAX, issue);

/** A commune price the merchant may leave to the base, then the wilaya: `null`, or absent, means "inherit" (D3125). */
const inheritedPriceSchema = deliveryPriceSchema.nullish().transform((price) => price ?? null);

/** A commune switch the merchant may leave to its wilaya: `null`, or absent, means "inherit" (D3125). */
const inheritedSwitchSchema = z
  .boolean(issue)
  .nullish()
  .transform((enabled) => enabled ?? null);

/**
 * One commune as the merchant edits it (D3125): a typed price is an override (compared with the commune base by the
 * API), `null` clears it so the price falls back to the commune base, then the wilaya; a `null` switch inherits the
 * wilaya's.
 */
export const deliveryFeeCommuneRateInputSchema = z.object(
  {
    codeOns: onsCodeSchema,
    homePrice: inheritedPriceSchema,
    deskPrice: inheritedPriceSchema,
    deliveryEnabled: inheritedSwitchSchema,
    deskEnabled: inheritedSwitchSchema,
  },
  issue,
);

/** One commune as sent by the merchant. */
export type DeliveryFeeCommuneRateInput = z.output<typeof deliveryFeeCommuneRateInputSchema>;

const hasDistinctCommunes = (rows: readonly { codeOns: number }[]): boolean =>
  new Set(rows.map(({ codeOns }) => codeOns)).size === rows.length;

/**
 * The communes of one wilaya to merge into a fee group (`setDeliveryFeeCommuneRates`): communes not named are left as
 * they are. The row cap is a bound above the largest wilaya; the API checks each commune belongs to `provinceCode`.
 */
export const deliveryFeeCommuneRatesInputSchema = z.object(
  {
    provinceCode: z.enum(WILAYA_CODES, issue),
    rows: z
      .array(deliveryFeeCommuneRateInputSchema, issue)
      .max(MAX_COMMUNE_RATES_PER_WILAYA, issue)
      .refine(hasDistinctCommunes, issue),
  },
  issue,
);

/** The communes of one wilaya as sent by the merchant. */
export type DeliveryFeeCommuneRatesInput = z.output<typeof deliveryFeeCommuneRatesInputSchema>;

/**
 * One stored commune row of a fee group (D3125): its effective prices (override ?? base, `null` = the wilaya's), the
 * base ones, its switches (`null` = the wilaya's) and whether a merchant override is stored.
 */
export const deliveryFeeCommuneRateSchema = z.object({
  codeOns: onsCodeSchema,
  provinceCode: z.enum(WILAYA_CODES),
  homePrice: deliveryPriceSchema.nullable(),
  deskPrice: deliveryPriceSchema.nullable(),
  baseHomePrice: deliveryPriceSchema.nullable(),
  baseDeskPrice: deliveryPriceSchema.nullable(),
  deliveryEnabled: z.boolean().nullable(),
  deskEnabled: z.boolean().nullable(),
  overridden: z.boolean(),
});

/** One stored commune row of a fee group. */
export type DeliveryFeeCommuneRate = z.output<typeof deliveryFeeCommuneRateSchema>;
