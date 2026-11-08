import type { StoreId } from '@cod/shared';
import type { OperationContext } from '../domain/ports/operation-context';
import type { Store, StoreActor } from '../domain/store';
import { canReach } from './store-access';
import type { StoreAdminPorts } from './store-admin-ports';

/** Reads the stores an actor can reach, archived ones included. */
export class GetStoresService {
  constructor(private readonly ports: StoreAdminPorts) {}

  /** Every reachable store, oldest first. */
  async list(ctx: OperationContext, actor: StoreActor): Promise<readonly Store[]> {
    const stores = await this.ports.stores.list(ctx, actor.businessId);
    return stores.filter((store) => canReach(actor, store));
  }

  /** The store, or `undefined` when it does not exist or `actor` cannot reach it. */
  async get(ctx: OperationContext, actor: StoreActor, id: StoreId): Promise<Store | undefined> {
    const store = await this.ports.stores.find(ctx, actor.businessId, id);
    return store !== undefined && canReach(actor, store) ? store : undefined;
  }
}
