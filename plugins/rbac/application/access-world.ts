import type { PermissionKey, Snowflake, StoreId, TenantScope } from '@cod/shared';
import type { BusinessRole, MemberAssignment } from '../domain/business-role';
import { ALL_STORES_SCOPE } from '../domain/constants';
import {
  assertCanChangeTarget,
  assertCanGrantAccess,
  assertOwnerChangeAllowed,
  assertOwnerKept,
} from '../domain/escalation-rules';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { BusinessRoleRepositoryPort } from '../domain/ports/business-role-repository.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import {
  accessChange,
  activeStoreIdsOf,
  type Actor,
  buildActor,
  holdsAllAccess,
  type RequestedStoreAccess,
  type RoleOnStore,
  sameReach,
} from '../domain/store-access';

/** Who is making the change and from where, as the activity row keeps it. */
export interface MemberAccessActor {
  readonly administratorId: number;
  readonly scope: TenantScope;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

/** Replaces a member's roles and store access (D54). */
export interface SetMemberAccessCommand extends RequestedStoreAccess {
  readonly actor: MemberAccessActor;
  readonly administratorId: number;
  readonly roleIds: readonly string[];
}

/** What loading the world and checking the rules read through. */
export interface AccessWorldPorts {
  readonly directory: Pick<BusinessDirectoryPort, 'stores' | 'ownerAdministratorOf'>;
  readonly roles: Pick<BusinessRoleRepositoryPort, 'all'>;
  readonly assignments: Pick<MemberAssignmentRepositoryPort, 'ofAdministrator' | 'ofRoles'>;
}

/** Everything the rules read, loaded under the lock. */
export interface AccessWorld {
  readonly stores: Awaited<ReturnType<BusinessDirectoryPort['stores']>>;
  readonly activeStoreIds: readonly StoreId[];
  readonly roles: ReadonlyMap<string, BusinessRole>;
  readonly owner: BusinessRole;
  readonly businessOwnerId: number | null;
  readonly actor: Actor;
  readonly target: Actor;
  readonly before: readonly MemberAssignment[];
}

/** Reads the stores, roles and both members' rows the D60 rules judge, inside the caller's transaction. */
export async function loadAccessWorld(
  ports: AccessWorldPorts,
  ctx: OperationContext,
  command: SetMemberAccessCommand,
): Promise<AccessWorld> {
  const { directory, roles: roleRows, assignments } = ports;
  const { scope } = command.actor;
  const stores = await directory.stores(ctx, scope.businessId);
  const activeStoreIds = activeStoreIdsOf(stores);
  const all = await roleRows.all(ctx, scope);
  const roles = new Map(all.map((role) => [role.id as string, role]));
  const owner = all.find((role) => role.builtInKey === 'owner');
  if (owner === undefined) throw new Error('The business has no owner role');
  const actorRows = await assignments.ofAdministrator(ctx, scope, command.actor.administratorId);
  const before = await assignments.ofAdministrator(ctx, scope, command.administratorId);
  return {
    stores,
    activeStoreIds,
    roles,
    owner,
    businessOwnerId: await directory.ownerAdministratorOf(ctx, scope.businessId),
    actor: buildActor(command.actor.administratorId, actorRows, roles, activeStoreIds),
    target: buildActor(command.administratorId, before, roles, activeStoreIds),
    before,
  };
}

/** A change as the rules judge it: the command, the world it was loaded in, and the rows it would write. */
export interface AccessChangeUnderReview {
  readonly command: SetMemberAccessCommand;
  readonly world: AccessWorld;
  readonly after: readonly MemberAssignment[];
}

/** Who may touch Owner first, so a non-holder cannot probe who the owner is; then D60.8, .4, .3. */
export async function checkAccessRules(
  ports: AccessWorldPorts,
  ctx: OperationContext,
  { command, world, after }: AccessChangeUnderReview,
): Promise<void> {
  const { actor, target, owner, activeStoreIds, before, roles } = world;
  const ownerBefore = before.find((row) => row.businessRoleId === owner.id);
  const ownerAfter = after.find((row) => row.businessRoleId === owner.id);
  assertOwnerChangeAllowed(actor, !sameReach(ownerBefore, ownerAfter));
  assertOwnerKept({
    isBusinessOwner: command.administratorId === world.businessOwnerId,
    heldOwner: ownerBefore !== undefined,
    keepsOwnerOnAllStores: ownerAfter?.storeAccess === ALL_STORES_SCOPE,
    otherAllAccessHolders: await otherAllAccessOwners(ports, ctx, command, owner.id),
  });
  assertCanChangeTarget(actor, target);
  assertCanGrantAccess(actor, {
    wantsAllStores: command.storeAccess === ALL_STORES_SCOPE,
    grants: accessChange(before, after, activeStoreIds).map((pair) => grantOf(pair, roles)),
  });
}

function grantOf(
  { businessRoleId, storeId }: RoleOnStore,
  roles: ReadonlyMap<string, BusinessRole>,
): { readonly storeId: StoreId; readonly permissions: readonly PermissionKey[] } {
  return { storeId, permissions: roles.get(businessRoleId)?.permissions ?? [] };
}

async function otherAllAccessOwners(
  ports: AccessWorldPorts,
  ctx: OperationContext,
  command: SetMemberAccessCommand,
  ownerRoleId: Snowflake,
): Promise<number> {
  const holders = await ports.assignments.ofRoles(ctx, command.actor.scope, [ownerRoleId]);
  return holders.filter((row) => row.administratorId !== command.administratorId && holdsAllAccess([row])).length;
}
