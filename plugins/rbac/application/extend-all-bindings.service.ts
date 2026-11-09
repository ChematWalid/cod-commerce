import type { BusinessId } from '@cod/shared';
import type { BusinessRoleRepositoryPort } from '../domain/ports/business-role-repository.port';
import type { EngineRolesPort } from '../domain/ports/engine-roles.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { RbacLockPort } from '../domain/ports/rbac-lock.port';
import type { RoleBindingRepositoryPort } from '../domain/ports/role-binding-repository.port';

/** What extending reads and writes through. */
export interface ExtendAllBindingsPorts {
  readonly lock: RbacLockPort;
  readonly roles: Pick<BusinessRoleRepositoryPort, 'findBuiltIn'>;
  readonly bindings: Pick<RoleBindingRepositoryPort, 'allStoresBindings'>;
  readonly engine: Pick<EngineRolesPort, 'addChannel'>;
}

/** The store just opened. */
export interface NewStoreChannel {
  readonly businessId: BusinessId;
  readonly channelId: number;
}

/** Puts a new store's channel on the Vendure Role of every `all` binding of its business (D53). */
export class ExtendAllBindingsService {
  constructor(private readonly ports: ExtendAllBindingsPorts) {}

  /** The lock comes first (D70): a binding created concurrently is then either read here or sees the new channel. */
  async extendToStore(ctx: OperationContext, { businessId, channelId }: NewStoreChannel): Promise<void> {
    const { lock, roles, bindings, engine } = this.ports;
    const scope = { businessId };
    await lock.acquire(ctx, businessId);
    const allStores = await bindings.allStoresBindings(ctx, scope);
    const owner = await roles.findBuiltIn(ctx, scope, 'owner');
    for (const binding of allStores) {
      // Tenancy has already put Owner's role on the channel.
      if (binding.businessRoleId !== owner?.id) {
        await engine.addChannel(ctx, binding.vendureRoleId, channelId);
      }
    }
  }
}
