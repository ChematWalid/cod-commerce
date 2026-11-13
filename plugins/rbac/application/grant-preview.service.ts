import { type StoreId, type TenantScope, toSnowflake } from '@cod/shared';
import type { BusinessRole } from '../domain/business-role';
import { ALL_STORES_SCOPE } from '../domain/constants';
import { assertCanChangeTarget, assertCanGrantAccess, assertOwnerChangeAllowed } from '../domain/escalation-rules';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { BusinessRoleRepositoryPort } from '../domain/ports/business-role-repository.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import {
  type Actor,
  accessChange,
  buildActor,
  type RequestedStoreAccess,
  reachStoreIdsOf,
  resolveStoreAccess,
  storeRowId,
} from '../domain/store-access';
import { type MemberAccessActor, rolesInOrder } from './access-world';

/** A grant to judge before anyone holds it: the roles and stores an invitation would give (D208). */
export interface PreviewGrantCommand extends RequestedStoreAccess {
  readonly actor: MemberAccessActor;
  readonly roleIds: readonly string[];
}

/** The stores an actor reaches through its roles (D211); `allStores` also covers stores opened later. */
export interface ActorReach {
  readonly allStores: boolean;
  readonly storeIds: readonly string[];
}

/** What the preview reads through. */
export interface GrantPreviewPorts {
  readonly directory: Pick<BusinessDirectoryPort, 'stores'>;
  readonly roles: Pick<BusinessRoleRepositoryPort, 'all'>;
  readonly assignments: Pick<MemberAssignmentRepositoryPort, 'ofAdministrator'>;
}

/** Judges a grant for a member who does not exist yet, and tells which stores an actor reaches. Writes nothing. */
export class GrantPreviewService {
  constructor(private readonly ports: GrantPreviewPorts) {}

  /**
   * Refuses a grant the actor could not make with `setAccess`, with the same errors (D60.3, D60.7), so an invitation
   * is refused when it is made rather than when it is accepted.
   *
   * @throws a {@link RbacError}: role not found, invalid or inaccessible store, Owner restricted, privilege exceeded
   */
  async previewGrant(ctx: OperationContext, command: PreviewGrantCommand): Promise<void> {
    const { scope } = command.actor;
    const stores = await this.ports.directory.stores(ctx, scope.businessId);
    const roles = new Map((await this.ports.roles.all(ctx, scope)).map((role) => [role.id as string, role]));
    const granted = rolesInOrder(command.roleIds, roles);
    const access = resolveStoreAccess(command, stores);
    const reachStoreIds = reachStoreIdsOf(stores);
    const actor = await this.actorOf(ctx, command.actor, roles, reachStoreIds);
    assertOwnerChangeAllowed(
      actor,
      granted.some((role) => role.builtInKey === 'owner'),
    );
    const storeIds = access.storeIds.map(storeRowId);
    const after = granted.map((role) => ({ businessRoleId: role.id, storeAccess: access.storeAccess, storeIds }));
    assertCanGrantAccess(actor, {
      wantsAllStores: access.storeAccess === ALL_STORES_SCOPE,
      grants: accessChange([], after, reachStoreIds).map(({ businessRoleId, storeId }) => ({
        storeId,
        permissions: roles.get(businessRoleId)?.permissions ?? [],
      })),
    });
  }

  /**
   * Refuses to act on a member holding `command`'s grant when the actor could not change that holder with `setAccess`
   * (D60.4, D60.7). Unlike {@link previewGrant}, the grant is judged by what remains of it: a role deleted since grants
   * nothing and an archived store still counts (D210), so a grant gone in part never waves an actor through.
   *
   * @throws a {@link RbacError}: Owner restricted, privilege exceeded
   */
  async assertMayChangeHolder(ctx: OperationContext, command: PreviewGrantCommand): Promise<void> {
    const stores = await this.ports.directory.stores(ctx, command.actor.scope.businessId);
    const roles = new Map(
      (await this.ports.roles.all(ctx, command.actor.scope)).map((role) => [role.id as string, role]),
    );
    const reachStoreIds = reachStoreIdsOf(stores);
    const actor = await this.actorOf(ctx, command.actor, roles, reachStoreIds);
    const rows = command.roleIds
      .filter((roleId) => roles.has(roleId))
      .map((roleId) => ({
        businessRoleId: toSnowflake(roleId),
        storeAccess: command.storeAccess,
        storeIds: command.storeIds.map(toSnowflake),
      }));
    const target = buildActor(actor.administratorId, rows, roles, reachStoreIds);
    assertOwnerChangeAllowed(actor, target.isOwnerHolder);
    assertCanChangeTarget(actor, target);
  }

  /** The stores the actor's roles reach, archived ones included (D210); no role reaches no store. */
  async reachOf(
    ctx: OperationContext,
    actor: Pick<MemberAccessActor, 'administratorId' | 'scope'>,
  ): Promise<ActorReach> {
    const stores = await this.ports.directory.stores(ctx, actor.scope.businessId);
    const roles = new Map((await this.ports.roles.all(ctx, actor.scope)).map((role) => [role.id as string, role]));
    const built = await this.actorOf(ctx, actor, roles, reachStoreIdsOf(stores));
    return { allStores: built.hasAllAccess, storeIds: [...built.permissionsByStore.keys()] };
  }

  private async actorOf(
    ctx: OperationContext,
    { administratorId, scope }: { readonly administratorId: number; readonly scope: TenantScope },
    roles: ReadonlyMap<string, BusinessRole>,
    storeIds: readonly StoreId[],
  ): Promise<Actor> {
    const rows = await this.ports.assignments.ofAdministrator(ctx, scope, administratorId);
    return buildActor(administratorId, rows, roles, storeIds);
  }
}
