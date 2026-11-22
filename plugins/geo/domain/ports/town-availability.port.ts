import type { StoreId, WilayaCode } from '@cod/shared';

/** Which delivery modes a store offers in one wilaya. */
export interface TownAvailability {
  /** Home delivery is offered. */
  readonly home: boolean;
  /** Stop-desk pickup is offered. */
  readonly desk: boolean;
}

/**
 * Narrows the communes a store's storefront offers to what its delivery fee table delivers (P3.S1 Task 8). Delivery
 * pricing registers it on `TOWN_AVAILABILITY_REGISTRAR`; until then nothing is narrowed.
 */
export interface TownAvailabilitySource {
  /** The store's delivery modes in the wilaya, or `null` when the store does not narrow it. */
  availabilityFor(storeId: StoreId, provinceCode: WilayaCode): Promise<TownAvailability | null>;
}

/** Where delivery pricing registers its {@link TownAvailabilitySource} (injected as `TOWN_AVAILABILITY_REGISTRAR`). */
export interface TownAvailabilityRegistrar {
  /** @throws {Error} when a source is already registered: two sources would silently disagree. */
  register(source: TownAvailabilitySource): void;
}
