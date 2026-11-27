import type { CarrierRate } from '../domain/carrier-prices';
import type { CarrierPriceSyncPort } from '../domain/ports/carrier-price-sync.port';

/** The carrier prices until a carrier integration exists (P5.S4–S7): none, so a sync changes nothing (D3136). */
export class NoopCarrierPriceSync implements CarrierPriceSyncPort {
  ratesFor(): Promise<readonly CarrierRate[] | null> {
    return Promise.resolve(null);
  }
}
