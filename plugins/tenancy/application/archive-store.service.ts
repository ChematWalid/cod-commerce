import { type StoreId, toSnowflake } from '@cod/shared';
import { LastStoreError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { Store, StoreActor } from '../domain/store';
import { requireStore } from './store-access';
import type { StoreAdminPorts } from './store-admin-ports';

/** Soft-deletes a store: the row, channel and subdomain all stay (D4). */
export class ArchiveStoreService {
  constructor(private readonly ports: StoreAdminPorts) {}

  /**
   * Archives the store; archiving an archived store changes nothing.
   *
   * @throws {@link StoreNotFoundError} or {@link LastStoreError}.
   */
  async archive(ctx: OperationContext, actor: StoreActor, id: StoreId): Promise<Store> {
    const archived = await this.ports.transaction.run(ctx, (transactional) => this.archiveIn(transactional, actor, id));
    await this.ports.hosts.invalidate({ storeId: archived.id, subdomains: [archived.subdomain] });
    return archived;
  }

  private async archiveIn(ctx: OperationContext, actor: StoreActor, id: StoreId): Promise<Store> {
    // Two archives at once would each count the other's store as still active.
    await this.ports.platform.lockBusiness(ctx, toSnowflake(actor.businessId));
    const store = await requireStore(this.ports.stores, ctx, actor, id);
    if (store.status === 'archived') return store;
    if ((await this.ports.stores.countActive(ctx, actor.businessId)) <= 1) {
      throw new LastStoreError();
    }
    const now = this.ports.clock();
    const write = { status: 'archived', archivedAt: now, updatedAt: now } as const;
    await this.ports.stores.update(ctx, actor.businessId, id, write);
    return { ...store, ...write };
  }
}
