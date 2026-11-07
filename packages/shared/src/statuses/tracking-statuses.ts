/**
 * Carrier-neutral parcel tracking statuses.
 *
 * @remarks Stub — owner: P5.S1, which maps each carrier's statuses onto this list.
 */
export const TRACKING_STATUSES = [
  'created',
  'picked-up',
  'in-transit',
  'out-for-delivery',
  'delivered',
  'delivery-failed',
  'returning',
  'returned',
] as const;

/** One of the {@link TRACKING_STATUSES}. */
export type TrackingStatus = (typeof TRACKING_STATUSES)[number];
