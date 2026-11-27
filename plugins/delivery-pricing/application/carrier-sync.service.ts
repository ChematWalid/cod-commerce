import type { Snowflake } from '@cod/shared';
import { type CarrierRate, carrierRatesProblem, mergeCarrierPrices } from '../domain/carrier-prices';
import { DeliveryFeeGroupNotFoundError, InvalidCarrierRatesError } from '../domain/errors';
import type { FeeGroupHeader, FeeGroupSettings } from '../domain/fee-group';
import type { CarrierPriceSyncPort } from '../domain/ports/carrier-price-sync.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { FeeGroupPorts } from './fee-group-ports';

/** `synced` when the carrier's bases were written; `skipped` when it had none or the group's carrier changed meanwhile. */
export type CarrierSyncResult = 'synced' | 'skipped';

const settingsOf = (group: FeeGroupHeader): FeeGroupSettings => ({
  name: group.name,
  carrierId: group.carrierId,
  chargeOverweight: group.chargeOverweight,
  overweightAllowanceKg: group.overweightAllowanceKg,
  overweightRate: group.overweightRate,
});

/**
 * Carrier price sync (D3107, D3136): writes a carrier's prices into a fee group's `base*` at wilaya and commune level,
 * keeping every merchant override and switch. No endpoint calls it yet (P5.S4–S7).
 */
export class CarrierSyncService {
  constructor(
    private readonly ports: FeeGroupPorts,
    private readonly carrier: CarrierPriceSyncPort,
  ) {}

  /**
   * Merges the carrier's current prices into the store's group `groupId`. The carrier is asked outside the
   * transaction (a carrier call must not hold the group lock); the write then runs under the group's `FOR UPDATE`.
   * @throws {DeliveryFeeGroupNotFoundError} for a group of another business or store, before the carrier is asked.
   * @throws {InvalidCarrierRatesError} when the carrier's rates cannot be merged; nothing is written.
   */
  async syncDefaults(ctx: OperationContext, scope: StoreScope, groupId: Snowflake): Promise<CarrierSyncResult> {
    const group = await this.ports.groups.find(ctx, scope, groupId);
    if (group === undefined) throw new DeliveryFeeGroupNotFoundError();
    const rates = await this.carrier.ratesFor(ctx, scope, group.carrierId);
    if (rates === null) return 'skipped';
    await this.assertMergeable(rates);
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      const locked = await this.ports.groups.lock(tx, scope, groupId);
      if (locked === undefined) throw new DeliveryFeeGroupNotFoundError();
      if (locked.carrierId !== group.carrierId) return 'skipped';
      const stored = await this.ports.groups.find(tx, scope, groupId);
      if (stored === undefined) throw new DeliveryFeeGroupNotFoundError();
      const merged = mergeCarrierPrices(stored.rates, stored.communeRates, rates);
      await this.ports.groups.update(tx, scope, groupId, { settings: settingsOf(locked), rates: merged.rates });
      await this.ports.groups.writeCommuneRows(tx, scope, groupId, { upserts: merged.communeUpserts, removals: [] });
      return 'synced';
    });
  }

  /** Refuses rates with a bad value or a commune that is not one of its wilaya's (geo's town directory). */
  private async assertMergeable(rates: readonly CarrierRate[]): Promise<void> {
    const problem = carrierRatesProblem(rates);
    if (problem !== null) throw new InvalidCarrierRatesError(problem);
    const provinces = [...new Set(rates.filter((rate) => rate.codeOns !== null).map((rate) => rate.provinceCode))];
    for (const provinceCode of provinces) {
      const towns = new Set(await this.ports.towns.townsOf(provinceCode));
      const outside = rates.some(
        (rate) => rate.provinceCode === provinceCode && rate.codeOns !== null && !towns.has(rate.codeOns),
      );
      if (outside) throw new InvalidCarrierRatesError('commune outside its wilaya');
    }
  }
}
