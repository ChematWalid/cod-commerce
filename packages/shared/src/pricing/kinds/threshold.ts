import { z } from 'zod';
import { MONEY_MAX_DZD } from '../../catalog/money';
import { MAX_LINE_QUANTITY, MAX_QUOTE_LINES } from '../constants';
import { invalidOfferConfig } from '../error-codes';

/** Most pieces a cart can hold, the bound of a pieces threshold. */
const MAX_CART_PIECES = MAX_LINE_QUANTITY * MAX_QUOTE_LINES;

const piecesSchema = z
  .number(invalidOfferConfig)
  .int(invalidOfferConfig)
  .min(1, invalidOfferConfig)
  .max(MAX_CART_PIECES, invalidOfferConfig);

const amountSchema = z
  .number(invalidOfferConfig)
  .int(invalidOfferConfig)
  .min(0, invalidOfferConfig)
  .max(MONEY_MAX_DZD, invalidOfferConfig);

/**
 * When an offer starts to apply: always, from a number of pieces, or from an amount of the subtotal after line
 * offers (D2412). Shared by the free-delivery threshold and the order-discount minimum.
 */
export const thresholdSchema = z.discriminatedUnion(
  'type',
  [
    z.object({ type: z.literal('none') }, invalidOfferConfig),
    z.object({ type: z.literal('pieces'), min: piecesSchema }, invalidOfferConfig),
    z.object({ type: z.literal('amount'), min: amountSchema }, invalidOfferConfig),
  ],
  invalidOfferConfig,
);

export type Threshold = z.output<typeof thresholdSchema>;
