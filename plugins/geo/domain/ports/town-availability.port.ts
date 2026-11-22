import type { StoreId, WilayaCode } from '@cod/shared';

/** Which delivery modes are offered in one place (a wilaya or a commune). */
export interface ModeAvailability {
  /** Home delivery is offered. */
  readonly home: boolean;
  /** Stop-desk pickup is offered. */
  readonly desk: boolean;
}

/** Which delivery modes a store offers in one wilaya, and in the communes of it that differ (D3125). */
export interface TownAvailability extends ModeAvailability {
  /**
   * The communes whose modes differ from the wilaya's, keyed by ONS code (`codeOns`). It only holds those communes:
   * a commune absent from the map has the wilaya's `home` and `desk`.
   */
  readonly towns: ReadonlyMap<number, ModeAvailability>;
}

/**
 * Narrows the communes a store's storefront offers to what its delivery fee table delivers (P3.S1 Task 8). Delivery
 * pricing registers it on `TOWN_AVAILABILITY_REGISTRAR`; until then nothing is narrowed.
 */
export interface TownAvailabilitySource {
  /** The store's modes in the wilaya and its differing communes, or `null` when the store does not narrow it. */
  availabilityFor(storeId: StoreId, provinceCode: WilayaCode): Promise<TownAvailability | null>;
}

/** Where delivery pricing registers its {@link TownAvailabilitySource} (injected as `TOWN_AVAILABILITY_REGISTRAR`). */
export interface TownAvailabilityRegistrar {
  /** @throws {Error} when a source is already registered: two sources would silently disagree. */
  register(source: TownAvailabilitySource): void;
}
