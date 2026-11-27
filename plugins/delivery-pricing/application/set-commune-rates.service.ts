import type { DeliveryFeeCommuneRatesInput, WilayaCode } from '@cod/shared';
import { DeliveryFeeGroupNotFoundError, InvalidDeliveryFeeInputError } from '../domain/errors';
import type { CommuneRateRow, FeeGroupRecord } from '../domain/fee-group';
import { groupIdOf } from '../domain/group-id';
import { mergeCommuneRow } from '../domain/override-rules';
import type { CommuneRowsChange } from '../domain/ports/fee-group-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { FeeGroupPorts } from './fee-group-ports';

/** The rows a merge writes: each named commune merged with its stored row, or removed when nothing is left. */
function changeOf(
  stored: readonly CommuneRateRow[],
  provinceCode: WilayaCode,
  input: DeliveryFeeCommuneRatesInput,
): CommuneRowsChange {
  const byCommune = new Map(stored.map((row) => [row.codeOns, row]));
  const upserts: CommuneRateRow[] = [];
  const removals: number[] = [];
  for (const edit of input.rows) {
    const merged = mergeCommuneRow(byCommune.get(edit.codeOns), provinceCode, edit);
    if (merged !== null) upserts.push(merged);
    else if (byCommune.has(edit.codeOns)) removals.push(edit.codeOns);
  }
  return { upserts, removals };
}

/**
 * `setDeliveryFeeCommuneRates` (D3125): merges the named communes of one wilaya into a fee group, writing only their
 * overrides and switches; communes not named stay as they are and bases are never written.
 */
export class SetCommuneRatesService {
  constructor(private readonly ports: FeeGroupPorts) {}

  /**
   * @throws {DeliveryFeeGroupNotFoundError} for an unknown, foreign, other-store or malformed group id, checked first.
   * @throws {InvalidDeliveryFeeInputError} for a commune that is not one of the wilaya's (geo's town directory).
   */
  async set(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    input: DeliveryFeeCommuneRatesInput,
  ): Promise<FeeGroupRecord> {
    const id = groupIdOf(rawId);
    if (id === undefined) throw new DeliveryFeeGroupNotFoundError();
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      if ((await this.ports.groups.lock(tx, scope, id)) === undefined) throw new DeliveryFeeGroupNotFoundError();
      await this.assertCommunesOf(input);
      const stored = await this.ports.groups.communeRows(tx, scope, id, input.provinceCode);
      await this.ports.groups.writeCommuneRows(tx, scope, id, changeOf(stored, input.provinceCode, input));
      const group = await this.ports.groups.find(tx, scope, id);
      if (group === undefined) throw new DeliveryFeeGroupNotFoundError();
      return group;
    });
  }

  private async assertCommunesOf(input: DeliveryFeeCommuneRatesInput): Promise<void> {
    const towns = new Set(await this.ports.towns.townsOf(input.provinceCode));
    if (input.rows.some((row) => !towns.has(row.codeOns))) throw new InvalidDeliveryFeeInputError();
  }
}
