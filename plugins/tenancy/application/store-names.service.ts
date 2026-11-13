import type { BusinessId, StoreId } from '@cod/shared';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TenantStoresPort } from '../domain/ports/tenant-stores.port';

/** Reads the names of a business's stores for other plugins: Team shows them beside each member (P1.S4). */
export class StoreNamesService {
  constructor(private readonly ports: { readonly stores: Pick<TenantStoresPort, 'list'> }) {}

  /** The name of every store of the business, archived ones too, by store id. */
  async namesOf(ctx: OperationContext, businessId: BusinessId): Promise<ReadonlyMap<StoreId, string>> {
    const stores = await this.ports.stores.list(ctx, businessId);
    return new Map(stores.map((store) => [store.id, store.name]));
  }
}
