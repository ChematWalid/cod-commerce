import { classifySubdomain, type StoreId } from '@cod/shared';
import { SubdomainInvalidError, SubdomainTakenError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { Store, StoreActor } from '../domain/store';
import { requireActiveStore } from './store-access';
import type { StoreAdminPorts } from './store-admin-ports';

/** What a subdomain change did. */
interface SubdomainChange {
  readonly store: Store;
  readonly previous: string;
}

/** Moves a store to another subdomain (D11). */
export class ChangeSubdomainService {
  constructor(private readonly ports: StoreAdminPorts) {}

  /**
   * Changes the subdomain, then forgets both hosts once the change has committed.
   *
   * @throws {@link SubdomainInvalidError}, {@link SubdomainTakenError}, {@link StoreNotFoundError} or
   * {@link StoreArchivedError}.
   */
  async change(ctx: OperationContext, actor: StoreActor, id: StoreId, raw: string): Promise<Store> {
    const { status, subdomain, reason } = classifySubdomain(raw);
    if (status !== 'available') {
      throw new SubdomainInvalidError(reason ?? status);
    }
    const { store, previous } = await this.ports.transaction.run(ctx, (transactional) =>
      this.move(transactional, actor, id, subdomain),
    );
    if (previous !== store.subdomain) {
      await this.ports.hosts.invalidate({ storeId: store.id, subdomains: [previous, store.subdomain] });
    }
    return store;
  }

  private async move(
    ctx: OperationContext,
    actor: StoreActor,
    id: StoreId,
    subdomain: string,
  ): Promise<SubdomainChange> {
    const store = await requireActiveStore(this.ports.stores, ctx, actor, id);
    if (store.subdomain === subdomain) return { store, previous: subdomain };
    if (await this.ports.platform.isSubdomainTaken(ctx, subdomain)) {
      throw new SubdomainTakenError();
    }
    const write = { subdomain, updatedAt: this.ports.clock() };
    await this.ports.stores.update(ctx, actor.businessId, id, write);
    return { store: { ...store, ...write }, previous: store.subdomain };
  }
}
