import type { DeliveryFeePriceAdjustmentInput, WilayaCode } from '@cod/shared';
import { adjustCommunePrices, adjustPrices } from '../domain/bulk-prices';
import { InvalidDeliveryFeeInputError } from '../domain/errors';
import { type FeeGroupRecord, settingsOfGroup } from '../domain/fee-group';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { FeeGroupPorts } from './fee-group-ports';
import { withLockedGroup } from './locked-group';

/**
 * `adjustDeliveryFeeGroupPrices` (D3140): "Raise/lower by…" on the selected wilayas of a fee group, writing overrides
 * only. Commune overrides stay as they are unless `includeCommunes`; communes without a price of their own follow
 * their wilaya anyway. Only the rows the change moves are written; a change that moves none writes nothing.
 */
export class AdjustPricesService {
  constructor(private readonly ports: FeeGroupPorts) {}

  /**
   * @throws {DeliveryFeeGroupNotFoundError} for an unknown, foreign, other-store or malformed group id, checked first.
   * @throws {InvalidDeliveryFeeInputError} for a selected wilaya the group holds no row of (its stored rows decide).
   */
  adjust(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    input: DeliveryFeePriceAdjustmentInput,
  ): Promise<FeeGroupRecord> {
    const selection = new Set<WilayaCode>(input.provinceCodes);
    return withLockedGroup({ ports: this.ports, ctx, scope, rawId }, async (tx, group) => {
      const held = new Set(group.rates.map((row) => row.provinceCode));
      if (input.provinceCodes.some((code) => !held.has(code))) throw new InvalidDeliveryFeeInputError();
      // A write moves `updatedAt` (D3141), so a change that leaves every price as it is writes nothing.
      const rates = adjustPrices(group.rates, selection, input);
      if (rates.length > 0) {
        await this.ports.groups.update(tx, scope, group.id, { settings: settingsOfGroup(group), rates });
      }
      if (!input.includeCommunes) return;
      const upserts = adjustCommunePrices(group.communeRates, selection, input);
      if (upserts.length === 0) return;
      await this.ports.groups.writeCommuneRows(tx, scope, group.id, { upserts, removals: [] });
    });
  }
}
