import type { OfferKindCalculator } from '../engine/kind-registry';
import { productDiscountCalculator } from './product-discount';
import { quantityCalculator } from './quantity';

/**
 * Every built-in offer kind (D2404, §3a.7). A new kind is one calculator file and one entry here; Task 7 appends
 * the order-discount and free-delivery kinds, P2.S5 the bxgy and add-on kinds.
 */
export const BUILT_IN_OFFER_KINDS: readonly OfferKindCalculator<unknown>[] = [
  quantityCalculator,
  productDiscountCalculator,
];

export { productDiscountCalculator } from './product-discount';
export { quantityCalculator } from './quantity';
