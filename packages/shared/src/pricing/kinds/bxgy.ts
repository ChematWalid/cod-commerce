import { z } from 'zod';
import { MONEY_MAX_DZD } from '../../catalog/money';
import { BXGY_GET_SOURCES, PRODUCT_DISCOUNT_SCOPES } from '../channels';
import { MAX_BXGY_QUANTITY, MAX_BXGY_TIMES, PERCENT_BASE } from '../constants';
import { invalidOfferConfig } from '../error-codes';

const wholeNumber = z.number(invalidOfferConfig).int(invalidOfferConfig);
const bxgyQuantitySchema = wholeNumber.min(1, invalidOfferConfig).max(MAX_BXGY_QUANTITY, invalidOfferConfig);

/**
 * The price of a gifted unit: free, a percent off, or a fixed amount off per unit, taken from the running unit price
 * and clamped at 0 (D2503, D2504).
 */
export const bxgyGiftSchema = z.discriminatedUnion(
  'mode',
  [
    z.object({ mode: z.literal('free') }, invalidOfferConfig),
    z.object(
      {
        mode: z.literal('percent'),
        value: wholeNumber.min(1, invalidOfferConfig).max(PERCENT_BASE, invalidOfferConfig),
      },
      invalidOfferConfig,
    ),
    z.object(
      {
        mode: z.literal('fixed'),
        value: wholeNumber.min(1, invalidOfferConfig).max(MONEY_MAX_DZD, invalidOfferConfig),
      },
      invalidOfferConfig,
    ),
  ],
  invalidOfferConfig,
);

/**
 * Configuration of a buy-x-get-y offer (D2503): buy `buyQuantity` pieces, get `getQuantity` gifted, from the same
 * matched items or from the `get` targets, at most `maxTimesPerOrder` times (no cap when null).
 */
export const bxgyConfigSchema = z.object(
  {
    appliesTo: z.enum(PRODUCT_DISCOUNT_SCOPES, invalidOfferConfig),
    buyQuantity: bxgyQuantitySchema,
    getQuantity: bxgyQuantitySchema,
    getFrom: z.enum(BXGY_GET_SOURCES, invalidOfferConfig),
    gift: bxgyGiftSchema,
    maxTimesPerOrder: wholeNumber
      .min(1, invalidOfferConfig)
      .max(MAX_BXGY_TIMES, invalidOfferConfig)
      .nullable()
      .default(null),
  },
  invalidOfferConfig,
);

export type BxgyGift = z.output<typeof bxgyGiftSchema>;
export type BxgyConfig = z.output<typeof bxgyConfigSchema>;
