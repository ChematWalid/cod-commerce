/**
 * Plan-gated features.
 *
 * @remarks Stub — owner: P9.S1, which defines the plans and their limits.
 */
export const FEATURE_KEYS = {
  Finance: 'finance',
  TrackedItems: 'tracked-items',
  TeamSeats: 'team-seats',
  LandingPagesPerProduct: 'landing-pages-per-product',
  ActiveOffers: 'active-offers',
} as const;

/** One of the {@link FEATURE_KEYS} values. */
export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];
