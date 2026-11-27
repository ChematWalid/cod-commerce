import type { Snowflake } from '@cod/shared';
import type { CarrierRate } from '../carrier-prices';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/**
 * The prices a carrier bills a store (D3107, D3136): the carrier integrations (P5.S4–S7) answer them; until then the
 * no-op adapter answers `null`, so a sync changes nothing. `carrierId` is the fee group's carrier, `null` for a group
 * without one (the platform default table).
 */
export interface CarrierPriceSyncPort {
  ratesFor(
    ctx: OperationContext,
    scope: StoreScope,
    carrierId: Snowflake | null,
  ): Promise<readonly CarrierRate[] | null>;
}
