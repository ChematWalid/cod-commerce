/**
 * What a store does with sold-out products: keep showing them flagged, or hide them from lists and product pages.
 * Tenancy stores it per store; catalog reads it for visibility (D2109), so it is a shared contract (§3a.2).
 */
export const SOLD_OUT_BEHAVIORS = ['keep', 'hide'] as const;

/** One of the {@link SOLD_OUT_BEHAVIORS}. */
export type SoldOutBehavior = (typeof SOLD_OUT_BEHAVIORS)[number];
