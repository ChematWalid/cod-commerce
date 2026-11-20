/**
 * A line a pricing pipeline asks a unit price for. The offers' `UnitPriceResolver` port (D2441) is implemented in
 * `infrastructure/` only (rule `offers-entry-infra-only`), so the inner layers keep these framework-free shapes (D2276).
 */
export interface PriceLine {
  readonly productId: string;
  readonly variantId: string;
}

/** The unit price of one pack variant, computed live (D2204). */
export interface PackUnitPrice {
  readonly unitPrice: number;
  /** The components' sum before the pack discount. */
  readonly originalPrice: number;
  readonly source: 'pack';
  readonly weightGrams: number;
}
