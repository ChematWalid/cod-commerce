import type { ActiveStorePort } from '../../domain/ports/active-store.port';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context.port';
import type { StoreScope } from '../../domain/store-scope';

const sameStore = (left: StoreScope | undefined, right: StoreScope): boolean =>
  left?.businessId === right.businessId && left.storeId === right.storeId;

/**
 * The active-store port over contexts it hands out: each is on one store's channel and, unless asked otherwise, the
 * guard resolved that store as the request's tenant (D2408).
 */
export class FakeActiveStores implements ActiveStorePort {
  private readonly channels = new Map<OperationContext, StoreScope>();
  private readonly tenants = new Map<OperationContext, StoreScope>();
  private readonly archived: StoreScope[] = [];

  /** A context on `scope`'s channel; `resolvedTenant: false` models a request the tenant guard did not resolve. */
  contextOf(scope: StoreScope, { resolvedTenant = true } = {}): OperationContext {
    const ctx = asOperationContext({});
    this.channels.set(ctx, scope);
    if (resolvedTenant) this.tenants.set(ctx, scope);
    return ctx;
  }

  activeStoreOf(ctx: OperationContext): Promise<StoreScope | undefined> {
    return Promise.resolve(this.tenants.get(ctx));
  }

  /** Archives `scope`'s store: its own channel is no longer an active store's channel. */
  archive(scope: StoreScope): void {
    this.archived.push(scope);
  }

  isChannelOf(ctx: OperationContext, scope: StoreScope): Promise<boolean> {
    const archived = this.archived.some((store) => sameStore(store, scope));
    return Promise.resolve(!archived && sameStore(this.channels.get(ctx), scope));
  }

  isOwnChannelOf(ctx: OperationContext, scope: StoreScope): Promise<boolean> {
    return Promise.resolve(sameStore(this.channels.get(ctx), scope));
  }
}
