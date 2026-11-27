import type { DeliveryFeeGroupDuplicateInput, Snowflake } from '@cod/shared';
import { DeliveryFeeGroupNotFoundError } from '../domain/errors';
import { type FeeGroupRecord, settingsOfGroup } from '../domain/fee-group';
import { groupIdOf } from '../domain/group-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { FeeGroupPorts } from './fee-group-ports';

/**
 * `duplicateDeliveryFeeGroup` (D3140): "Copy" a pricing option of the store into a new one of the same store, with
 * its settings, its wilaya rows and its commune rows (bases, overrides and switches). The copy is never the platform
 * default table.
 */
export class DuplicateFeeGroupService {
  constructor(private readonly ports: FeeGroupPorts) {}

  /**
   * Copies the store's group `rawId`, held `FOR SHARE` so no edit lands half-way through the copy.
   * @throws {DeliveryFeeGroupNotFoundError} for an unknown, foreign, other-store or malformed id.
   */
  async duplicate(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    input: DeliveryFeeGroupDuplicateInput,
  ): Promise<FeeGroupRecord> {
    const id = groupIdOf(rawId);
    if (id === undefined) throw new DeliveryFeeGroupNotFoundError();
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      if (!(await this.ports.groups.share(tx, scope, id))) throw new DeliveryFeeGroupNotFoundError();
      const source = await this.reread(tx, scope, id);
      const settings = { ...settingsOfGroup(source), name: input.name };
      const copyId = await this.ports.groups.insert(tx, scope, {
        ...settings,
        isPlatformDefault: false,
        rates: source.rates,
      });
      await this.ports.groups.writeCommuneRows(tx, scope, copyId, { upserts: source.communeRates, removals: [] });
      return this.reread(tx, scope, copyId);
    });
  }

  private async reread(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<FeeGroupRecord> {
    const group = await this.ports.groups.find(ctx, scope, id);
    if (group === undefined) throw new DeliveryFeeGroupNotFoundError();
    return group;
  }
}
