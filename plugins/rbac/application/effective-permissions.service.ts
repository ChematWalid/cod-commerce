import type { PermissionKey, StoreId, TenantContext } from '@cod/shared';
import type { MemberStoreAccess } from '../domain/constants';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { BusinessRoleRepositoryPort } from '../domain/ports/business-role-repository.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { activeStoreIdsOf, buildActor, holdsAllAccess } from '../domain/store-access';

/** What a member can do on the active store, which frontends hide controls from and never enforce (ADR 0017). */
export interface EffectivePermissionsView {
  readonly storeId: StoreId;
  readonly permissions: readonly PermissionKey[];
  readonly storeAccess: MemberStoreAccess;
}

/** Answers what the caller holds on the active store, from our rows (D60). */
export class EffectivePermissionsService {
  constructor(
    private readonly roles: Pick<BusinessRoleRepositoryPort, 'all'>,
    private readonly assignments: Pick<MemberAssignmentRepositoryPort, 'ofAdministrator'>,
    private readonly directory: Pick<BusinessDirectoryPort, 'stores'>,
  ) {}

  /** A member with no assignment holds nothing. */
  async of(ctx: OperationContext, tenant: TenantContext, administratorId: number): Promise<EffectivePermissionsView> {
    const rows = await this.assignments.ofAdministrator(ctx, tenant, administratorId);
    const roles = new Map((await this.roles.all(ctx, tenant)).map((role) => [role.id as string, role]));
    const activeStoreIds = activeStoreIdsOf(await this.directory.stores(ctx, tenant.businessId));
    const held = buildActor(administratorId, rows, roles, activeStoreIds).permissionsByStore.get(tenant.activeStoreId);
    return {
      storeId: tenant.activeStoreId,
      permissions: [...(held ?? [])].sort(),
      storeAccess: holdsAllAccess(rows) ? 'all' : 'selected',
    };
  }
}
