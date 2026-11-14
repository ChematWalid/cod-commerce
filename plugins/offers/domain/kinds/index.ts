import type { OfferKindCalculator } from '../engine/kind-registry';
import { freeDeliveryCalculator } from './free-delivery';
import { orderDiscountCalculator } from './order-discount';
import { productDiscountCalculator } from './product-discount';
import { quantityCalculator } from './quantity';

/**
 * Every built-in offer kind (D2404, §3a.7). A new kind is one calculator file and one entry here; P2.S5 appends the
 * bxgy and add-on kinds.
 */
export const BUILT_IN_OFFER_KINDS: readonly OfferKindCalculator<unknown>[] = [
  quantityCalculator,
  productDiscountCalculator,
  orderDiscountCalculator,
  freeDeliveryCalculator,
];

export { freeDeliveryCalculator } from './free-delivery';
export { orderDiscountCalculator } from './order-discount';
export { productDiscountCalculator } from './product-discount';
export { quantityCalculator } from './quantity';
