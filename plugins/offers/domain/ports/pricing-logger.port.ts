/**
 * What the offers report to operators without reaching for a framework logger (`application/` and `domain/` are pure,
 * D2404). Messages carry ids and stored keys only, never buyer data.
 */
export interface PricingLogger {
  /** A stored offer names a kind no calculator handles; it is left out of the snapshot. */
  unknownKind(offerId: string, kind: string): void;

  /** A stored target has a `refType` or `role` the engine does not know; it is left out of its offer (Task 10). */
  unknownTarget(offerId: string, refType: string, role: string): void;

  /** A stored offer's config no longer fits its kind's schema (D2450); it is left out of the snapshot. */
  invalidConfig(offerId: string, kind: string): void;
}
