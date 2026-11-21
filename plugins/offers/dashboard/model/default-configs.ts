import type {
  AddonConfig,
  BxgyConfig,
  FreeDeliveryConfig,
  OrderDiscountConfig,
  ProductDiscountConfig,
  QuantityConfig,
} from '@cod/shared';

/** The starting configuration of each kind: a valid draft, and what an editor reads a missing field as. */
export const DEFAULT_QUANTITY_CONFIG: QuantityConfig = {
  priceMode: 'percent',
  tiers: [{ quantity: 2, price: 10, preselected: false, freeDelivery: false }],
};
export const DEFAULT_FREE_DELIVERY_CONFIG: FreeDeliveryConfig = { threshold: { type: 'none' } };
export const DEFAULT_PRODUCT_DISCOUNT_CONFIG: ProductDiscountConfig = {
  appliesTo: 'targets',
  valueType: 'percent',
  value: 10,
  cap: null,
  showCountdown: false,
};
export const DEFAULT_DISCOUNT_CODES_CONFIG: ProductDiscountConfig = {
  ...DEFAULT_PRODUCT_DISCOUNT_CONFIG,
  appliesTo: 'all',
};
export const DEFAULT_BXGY_CONFIG: BxgyConfig = {
  appliesTo: 'targets',
  buyQuantity: 2,
  getQuantity: 1,
  getFrom: 'same',
  gift: { mode: 'free' },
  maxTimesPerOrder: null,
};
export const DEFAULT_ORDER_DISCOUNT_CONFIG: OrderDiscountConfig = {
  valueType: 'percent',
  value: 10,
  cap: null,
  minimum: { type: 'none' },
};
export const DEFAULT_ADDON_CONFIG: AddonConfig = {
  condition: 'any_order',
  price: { mode: 'percent', value: 20 },
  maxPiecesPerOrder: 1,
  placement: 'order_form',
};

/**
 * The configuration a new offer starts with, by app-type id (D2515): a valid draft of its kind, so the preview prices
 * it at once and Save works before the merchant changes anything. An app's own card (P9.S8b) starts with none; its
 * editor sets it. A map, not a branch per kind (§3a.7).
 */
const DEFAULT_CONFIGS: Readonly<Record<string, unknown>> = {
  quantity: DEFAULT_QUANTITY_CONFIG,
  free_delivery: DEFAULT_FREE_DELIVERY_CONFIG,
  product_discount: DEFAULT_PRODUCT_DISCOUNT_CONFIG,
  discount_codes: DEFAULT_DISCOUNT_CODES_CONFIG,
  bxgy: DEFAULT_BXGY_CONFIG,
  order_discount: DEFAULT_ORDER_DISCOUNT_CONFIG,
  addon: DEFAULT_ADDON_CONFIG,
};

/** The starting configuration of a new offer of `appTypeId`, `undefined` for a card the dashboard does not know. */
export const defaultConfigOf = (appTypeId: string): unknown => DEFAULT_CONFIGS[appTypeId];
