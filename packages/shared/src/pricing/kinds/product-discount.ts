import { z } from 'zod';
import { PRODUCT_DISCOUNT_SCOPES } from '../channels';
import { invalidOfferConfig } from '../error-codes';
import { discountValueFields, isPercentInRange } from './discount-value';

/** Configuration of a product discount; percent and fixed apply per unit, the cap per unit too (D2409). */
export const productDiscountConfigSchema = z
  .object(
    {
      ...discountValueFields,
      appliesTo: z.enum(PRODUCT_DISCOUNT_SCOPES, invalidOfferConfig),
      /** Display only: storefronts show a countdown to `endsAt`. */
      showCountdown: z.boolean(invalidOfferConfig).default(false),
    },
    invalidOfferConfig,
  )
  .refine(isPercentInRange, invalidOfferConfig);

export type ProductDiscountConfig = z.output<typeof productDiscountConfigSchema>;
