import { z } from 'zod';
import { MONEY_MAX_DZD } from '../../catalog/money';
import { ADDON_CONDITIONS, ADDON_PLACEMENTS } from '../channels';
import { MAX_ADDON_PIECES, PERCENT_BASE } from '../constants';
import { invalidOfferConfig } from '../error-codes';

const wholeNumber = z.number(invalidOfferConfig).int(invalidOfferConfig);

/**
 * The unit price of an add-on (D2505): a fixed price (0 for a free add-on, capped at the list price by the engine), or
 * a percent or an amount off the list price, clamped at 0.
 */
export const addonPriceSchema = z.discriminatedUnion(
  'mode',
  [
    z.object(
      {
        mode: z.literal('fixed'),
        value: wholeNumber.min(0, invalidOfferConfig).max(MONEY_MAX_DZD, invalidOfferConfig),
      },
      invalidOfferConfig,
    ),
    z.object(
      {
        mode: z.literal('percent'),
        value: wholeNumber.min(1, invalidOfferConfig).max(PERCENT_BASE, invalidOfferConfig),
      },
      invalidOfferConfig,
    ),
    z.object(
      {
        mode: z.literal('amount_off'),
        value: wholeNumber.min(1, invalidOfferConfig).max(MONEY_MAX_DZD, invalidOfferConfig),
      },
      invalidOfferConfig,
    ),
  ],
  invalidOfferConfig,
);

/**
 * Configuration of an add-on offer (D2505): the add-on products are the offer's `addon` targets, offered on any order
 * or with a `buy` target in the cart, on the order form or on the thank-you page.
 */
export const addonConfigSchema = z.object(
  {
    condition: z.enum(ADDON_CONDITIONS, invalidOfferConfig),
    price: addonPriceSchema,
    maxPiecesPerOrder: wholeNumber.min(1, invalidOfferConfig).max(MAX_ADDON_PIECES, invalidOfferConfig),
    placement: z.enum(ADDON_PLACEMENTS, invalidOfferConfig),
  },
  invalidOfferConfig,
);

export type AddonPrice = z.output<typeof addonPriceSchema>;
export type AddonConfig = z.output<typeof addonConfigSchema>;
