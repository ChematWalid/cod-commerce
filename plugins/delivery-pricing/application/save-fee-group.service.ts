import type { DeliveryFeeGroupInput, Snowflake } from '@cod/shared';
import { DEFAULT_PRICES } from '../domain/default-prices';
import { DeliveryCarrierNotFoundError, DeliveryFeeGroupNotFoundError } from '../domain/errors';
import type { FeeGroupRecord, FeeGroupSettings, WilayaRateRow } from '../domain/fee-group';
import { groupIdOf } from '../domain/group-id';
import { wilayaRowsOf } from '../domain/override-rules';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { FeeGroupPorts } from './fee-group-ports';

/**
 * The group's settings from a parsed input. Until P5.S1 no carrier exists, so any carrier id is refused as not found
 * (D3109).
 */
function settingsOf(input: DeliveryFeeGroupInput): FeeGroupSettings {
  if (input.carrierId !== null) throw new DeliveryCarrierNotFoundError();
  return {
    name: input.name,
    carrierId: null,
    chargeOverweight: input.chargeOverweight,
    overweightAllowanceKg: input.overweightAllowanceKg,
    overweightRate: input.overweightRate,
  };
}

/** The base prices of a stored group, by wilaya. */
const basesOf = (rates: readonly WilayaRateRow[]) =>
  new Map(rates.map((row) => [row.provinceCode, { home: row.baseHome, desk: row.baseDesk }]));

/**
 * Creates and edits the active store's fee groups (one rate per wilaya, checked by the input schema). A merchant price
 * is stored as an override of its wilaya base only where it differs (D3107): a new group's bases are the platform
 * defaults (D3124), an edited group keeps its own. The commune rows are never touched here.
 */
export class SaveFeeGroupService {
  constructor(private readonly ports: FeeGroupPorts) {}

  /** Creates a group in the store; it is never the platform default. */
  async create(ctx: OperationContext, scope: StoreScope, input: DeliveryFeeGroupInput): Promise<FeeGroupRecord> {
    const settings = settingsOf(input);
    const rates = wilayaRowsOf(input.rates, (code) => DEFAULT_PRICES[code]);
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      const id = await this.ports.groups.insert(tx, scope, { ...settings, isPlatformDefault: false, rates });
      return this.reread(tx, scope, id);
    });
  }

  /**
   * Replaces the settings and wilaya rows of the store's group `rawId`, locked for the edit.
   * @throws {DeliveryFeeGroupNotFoundError} for an unknown, foreign, other-store or malformed id, checked first.
   */
  async update(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    input: DeliveryFeeGroupInput,
  ): Promise<FeeGroupRecord> {
    const id = groupIdOf(rawId);
    if (id === undefined) throw new DeliveryFeeGroupNotFoundError();
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      if ((await this.ports.groups.lock(tx, scope, id)) === undefined) throw new DeliveryFeeGroupNotFoundError();
      const settings = settingsOf(input);
      const stored = await this.reread(tx, scope, id);
      const bases = basesOf(stored.rates);
      const rates = wilayaRowsOf(input.rates, (code) => bases.get(code) ?? DEFAULT_PRICES[code]);
      await this.ports.groups.update(tx, scope, id, { settings, rates });
      return this.reread(tx, scope, id);
    });
  }

  private async reread(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<FeeGroupRecord> {
    const group = await this.ports.groups.find(ctx, scope, id);
    if (group === undefined) throw new DeliveryFeeGroupNotFoundError();
    return group;
  }
}
