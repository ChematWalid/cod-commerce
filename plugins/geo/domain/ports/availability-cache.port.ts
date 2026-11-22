import type { TownAvailability } from './town-availability.port';

/** The process cache of a store's narrowed wilaya, keyed by store and wilaya; `null` caches "not narrowed". */
export interface AvailabilityCache {
  /** The cached answer, or `undefined` on a miss or once it expired. */
  get(key: string): TownAvailability | null | undefined;
  set(key: string, value: TownAvailability | null): void;
}
