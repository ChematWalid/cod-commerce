import type { Snowflake, StoreId } from '@cod/shared';
import { CONVERGE_PAGE_SIZE } from '../domain/constants';
import { type DeliveryDefaultsConvergeFailure, DeliveryDefaultsConvergeFailedError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreLink } from '../domain/ports/store-defaults.port';
import type { StoreScope } from '../domain/store-scope';
import { DefaultTableService } from './default-table.service';
import type { FeeGroupPorts } from './fee-group-ports';

/** What one converge run did: the active stores it read and how many it linked to their default table. */
export interface DeliveryDefaultsConvergeReport {
  readonly stores: number;
  readonly linked: number;
}

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

/**
 * Links each store to its "Platform default prices" table (D3111, D3112): a new store from tenancy's creation hook,
 * existing stores from the migrate converge, which also repairs a default id the store does not own (a dangling id
 * stored before #230).
 */
export class DeliveryDefaultsConvergeService {
  private readonly defaultTable: DefaultTableService;

  constructor(private readonly ports: FeeGroupPorts) {
    this.defaultTable = new DefaultTableService(ports);
  }

  /** Creates the store's default table when it has none and makes it the store's default; answers its id. */
  linkStore(ctx: OperationContext, scope: StoreScope): Promise<Snowflake> {
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      const groupId = await this.defaultTable.ensureFor(tx, scope);
      await this.ports.storeDefaults.linkDefaultGroup(tx, scope, groupId);
      return groupId;
    });
  }

  /**
   * Converges every active store, one transaction each, and is idempotent. A store that fails is collected and the
   * others still converge.
   *
   * @throws {@link DeliveryDefaultsConvergeFailedError} once every store was tried, when any failed.
   */
  async convergeAll(ctx: OperationContext): Promise<DeliveryDefaultsConvergeReport> {
    const failures: DeliveryDefaultsConvergeFailure[] = [];
    let stores = 0;
    let linked = 0;
    let afterStoreId: StoreId | undefined;
    for (;;) {
      const page = await this.ports.storeDefaults.activeStores(ctx, afterStoreId, CONVERGE_PAGE_SIZE);
      stores += page.length;
      linked += await this.convergePage(ctx, page, failures);
      const last = page.at(-1);
      if (last === undefined) break;
      afterStoreId = last.scope.storeId;
    }
    if (failures.length > 0) throw new DeliveryDefaultsConvergeFailedError(stores, failures);
    return { stores, linked };
  }

  private async convergePage(
    ctx: OperationContext,
    page: readonly StoreLink[],
    failures: DeliveryDefaultsConvergeFailure[],
  ): Promise<number> {
    let linked = 0;
    for (const link of page) {
      try {
        if (await this.convergeStore(ctx, link)) linked += 1;
      } catch (error: unknown) {
        failures.push({ businessId: link.scope.businessId, storeId: link.scope.storeId, reason: reasonOf(error) });
      }
    }
    return linked;
  }

  /**
   * Answers whether the store had to be linked: its default was missing or not one of its own groups. The default is
   * re-read under the store row's lock, not taken from the page, so a group the merchant linked meanwhile is kept.
   */
  private convergeStore(ctx: OperationContext, { scope }: StoreLink): Promise<boolean> {
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      const defaultGroupId = await this.ports.storeDefaults.lockedDefaultGroupOf(tx, scope);
      if (defaultGroupId !== null && (await this.ports.groups.share(tx, scope, defaultGroupId))) return false;
      await this.linkStore(tx, scope);
      return true;
    });
  }
}
