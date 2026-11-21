import type { OfferAppType } from '@cod/shared';

/**
 * The cards of the create dialog (D2515), in catalogue order: a kind with the method it starts with and the goal it
 * is grouped under. "Discount codes" is a product discount activated by codes (D2403), not a kind of its own. Labels
 * and descriptions are frontend i18n by `id`.
 */
export const OFFER_APP_TYPES: readonly Readonly<OfferAppType>[] = [
  { id: 'quantity', kind: 'quantity', method: 'automatic', goal: 'sell_more', recommended: true },
  { id: 'free_delivery', kind: 'free_delivery', method: 'automatic', goal: 'delivery', recommended: false },
  { id: 'product_discount', kind: 'product_discount', method: 'automatic', goal: 'stock', recommended: false },
  { id: 'discount_codes', kind: 'product_discount', method: 'codes', goal: 'influencers', recommended: false },
  { id: 'bxgy', kind: 'bxgy', method: 'automatic', goal: null, recommended: false },
  { id: 'order_discount', kind: 'order_discount', method: 'automatic', goal: null, recommended: false },
  { id: 'addon', kind: 'addon', method: 'automatic', goal: null, recommended: false },
];
