/**
 * The configuration a new offer starts with, by app-type id (D2515): a valid draft of its kind, so the preview prices
 * it at once and Save works before the merchant changes anything. An app's own card (P9.S8b) starts with none; its
 * editor sets it. A map, not a branch per kind (§3a.7).
 */
const DEFAULT_CONFIGS: Readonly<Record<string, unknown>> = {
  quantity: {
    priceMode: 'percent',
    tiers: [{ quantity: 2, price: 10, preselected: false, freeDelivery: false }],
  },
  free_delivery: { threshold: { type: 'none' } },
  product_discount: { appliesTo: 'targets', valueType: 'percent', value: 10, cap: null, showCountdown: false },
  discount_codes: { appliesTo: 'all', valueType: 'percent', value: 10, cap: null, showCountdown: false },
  bxgy: {
    appliesTo: 'targets',
    buyQuantity: 2,
    getQuantity: 1,
    getFrom: 'same',
    gift: { mode: 'free' },
    maxTimesPerOrder: null,
  },
  order_discount: { valueType: 'percent', value: 10, cap: null, minimum: { type: 'none' } },
  addon: {
    condition: 'any_order',
    price: { mode: 'percent', value: 20 },
    maxPiecesPerOrder: 1,
    placement: 'order_form',
  },
};

/** The starting configuration of a new offer of `appTypeId`, `undefined` for a card the dashboard does not know. */
export const defaultConfigOf = (appTypeId: string): unknown => DEFAULT_CONFIGS[appTypeId];
