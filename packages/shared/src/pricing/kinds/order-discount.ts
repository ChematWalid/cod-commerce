import { z } from 'zod';
import { invalidOfferConfig } from '../error-codes';
import { discountValueFields, isPercentInRange } from './discount-value';
import { thresholdSchema } from './threshold';

/** Configuration of an order discount: on the subtotal after line offers, capped, never above it (D2409). */
export const orderDiscountConfigSchema = z
  .object({ ...discountValueFields, minimum: thresholdSchema.prefault({ type: 'none' }) }, invalidOfferConfig)
  .refine(isPercentInRange, invalidOfferConfig);

export type OrderDiscountConfig = z.output<typeof orderDiscountConfigSchema>;
