import type { StoreId, WilayaCode } from '@cod/shared';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ServedStoresPort } from '../domain/ports/served-stores.port';
import { NOTHING_OFFERED, type StoreModes, storeModesOf } from '../domain/store-modes';
import type { FeeGroupPorts } from './fee-group-ports';

/**
 * The delivery modes a store offers in one wilaya and its communes (D3125), which geo's signed
 * `/store/provinces/code/:code` ANDs with the reference flags. It serves a public path, so it reads only what that
 * answer needs: the served store, its default group, the one wilaya row and that wilaya's commune rows, each confined
 * to the store's `(businessId, storeId)`. A store not served, without a default group or whose default is not its own
 * offers nothing, as its quote answers unresolved.
 */
export class TownAvailabilityService {
  constructor(
    private readonly ports: FeeGroupPorts,
    private readonly stores: ServedStoresPort,
  ) {}

  /** The store's modes in `provinceCode`, read in the context `ctx` (a platform context, no session). */
  async modesIn(ctx: OperationContext, storeId: StoreId, provinceCode: WilayaCode): Promise<StoreModes> {
    const scope = await this.stores.scopeOf(storeId);
    if (scope === null) return NOTHING_OFFERED;
    const groupId = await this.ports.storeDefaults.defaultGroupOf(ctx, scope);
    if (groupId === null) return NOTHING_OFFERED;
    const rows = await this.ports.groups.quoteRows(ctx, scope, { groupId, provinceCode, codeOns: null });
    if (rows?.rate == null) return NOTHING_OFFERED;
    const communes = await this.ports.groups.communeRows(ctx, scope, groupId, provinceCode);
    return storeModesOf(rows.rate, communes);
  }
}
