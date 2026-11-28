import type { DeliveryFeeCommunePricesInput } from '@cod/shared';
import { setCommunePrices } from '../domain/bulk-prices';
import { InvalidDeliveryFeeInputError } from '../domain/errors';
import type { FeeGroupRecord } from '../domain/fee-group';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { FeeGroupPorts } from './fee-group-ports';
import { withLockedGroup } from './locked-group';

/**
 * `setDeliveryFeeProvinceCommunePrices` (D3140): "Set price for all communes" of one wilaya. The communes are the
 * wilaya's in geo's town directory, never a fixed list; overrides only, bases and switches stay.
 */
export class SetCommunePricesService {
  constructor(private readonly ports: FeeGroupPorts) {}

  /**
   * @throws {DeliveryFeeGroupNotFoundError} for an unknown, foreign, other-store or malformed group id, checked first.
   * @throws {InvalidDeliveryFeeInputError} for a wilaya the group holds no row of (its stored rows decide).
   */
  set(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    input: DeliveryFeeCommunePricesInput,
  ): Promise<FeeGroupRecord> {
    const { provinceCode, prices } = input;
    return withLockedGroup({ ports: this.ports, ctx, scope, rawId }, async (tx, group) => {
      if (!group.rates.some((row) => row.provinceCode === provinceCode)) throw new InvalidDeliveryFeeInputError();
      const towns = await this.ports.towns.townsOf(provinceCode);
      const stored = group.communeRates.filter((row) => row.provinceCode === provinceCode);
      const change = setCommunePrices(towns, provinceCode, stored, prices);
      // Like a no-op adjustment (D3143): no write, so updatedAt does not move and no editor reloads.
      if (change.upserts.length === 0 && change.removals.length === 0) return;
      await this.ports.groups.writeCommuneRows(tx, scope, group.id, change);
    });
  }
}
