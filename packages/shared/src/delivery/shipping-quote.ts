import { z } from 'zod';
import { moneySchema } from '../catalog/money';
import { DELIVERY_SPEEDS } from './constants';

/**
 * A delivery quote (data-model.md, `POST /store/shipping-quote`), in whole DZD. Unresolved (no fee group, wilaya or
 * method off) it carries zero fees, `speed: null` and no offered speeds (D3113). Waived, `totalFee` is 0 and
 * `waivedFee` holds what the buyer would have paid.
 */
export const shippingQuoteSchema = z.object({
  baseFee: moneySchema,
  overweightFee: moneySchema,
  totalFee: moneySchema,
  resolved: z.boolean(),
  speed: z.enum(DELIVERY_SPEEDS).nullable(),
  offeredSpeeds: z.array(z.enum(DELIVERY_SPEEDS)),
  freeShipping: z.boolean(),
  waivedFee: moneySchema,
});

/** A delivery quote. */
export type ShippingQuote = z.output<typeof shippingQuoteSchema>;
