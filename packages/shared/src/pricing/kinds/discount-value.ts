import { z } from 'zod';
import { MONEY_MAX_DZD } from '../../catalog/money';
import { DISCOUNT_VALUE_TYPES } from '../channels';
import { PERCENT_BASE } from '../constants';
import { invalidOfferConfig } from '../error-codes';

const positiveMoney = z
  .number(invalidOfferConfig)
  .int(invalidOfferConfig)
  .min(1, invalidOfferConfig)
  .max(MONEY_MAX_DZD, invalidOfferConfig);

/** The fields of a percent or fixed discount with an optional cap in DZD; shared by product and order discounts. */
export const discountValueFields = {
  valueType: z.enum(DISCOUNT_VALUE_TYPES, invalidOfferConfig),
  value: positiveMoney,
  cap: positiveMoney.nullable().default(null),
};

/** A percent discount is at most 100 %. */
export const isPercentInRange = ({ valueType, value }: { valueType: string; value: number }): boolean =>
  valueType !== 'percent' || value <= PERCENT_BASE;
