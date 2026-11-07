/** The eight COD order states of ADR 0009, in lifecycle order. */
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'scheduled',
  'canceled',
  'abandoned',
  'dispatched',
  'delivered',
  'returned',
] as const;

/** One of the {@link ORDER_STATUSES}. */
export type OrderStatus = (typeof ORDER_STATUSES)[number];
