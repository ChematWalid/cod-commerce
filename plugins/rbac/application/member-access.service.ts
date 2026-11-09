import { ACTIVITY_ACTIONS, type PermissionKey, type Snowflake, type StoreId, type TenantScope } from '@cod/shared';
import type { BusinessRole, MemberAssignment } from '../domain/business-role';
import { ALL_STORES_SCOPE, type MemberStoreAccess } from '../domain/constants';
import { MemberNotFoundError, RoleNotFoundError } from '../domain/errors';
import {
  assertCanChangeTarget,
  assertCanGrantAccess,
  assertNotSelf,
  assertOwnerChangeAllowed,
  assertOwnerKept,
} from '../domain/escalation-rules';
import type { ActorDirectoryPort } from '../domain/ports/actor-directory.port';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { BusinessRoleRepositoryPort } from '../domain/ports/business-role-repository.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { EngineRolesPort } from '../domain/ports/engine-roles.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { RbacLockPort } from '../domain/ports/rbac-lock.port';
import type { SessionFlusherPort } from '../domain/ports/session-flusher.port';
import type { TransactionPort } from '../domain/ports/transaction.port';
import {
  accessChange,
  activeStoreIdsOf,
  type Actor,
  buildActor,
  holdsAllAccess,
  type RequestedStoreAccess,
  type ResolvedStoreAccess,
  type RoleOnStore,
  resolveStoreAccess,
  sameReach,
  storeRowId,
} from '../domain/store-access';
import type { ActivityLogService } from './activity-log.service';
import type { BindingProjector } from './binding-projector.service';

/** What the service reads and writes through. */
export interface MemberAccessPorts {
  readonly transaction: TransactionPort;
  readonly lock: RbacLockPort;
  readonly members: ActorDirectoryPort;
  readonly directory: Pick<BusinessDirectoryPort, 'stores' | 'ownerAdministratorOf'>;
  readonly roles: Pick<BusinessRoleRepositoryPort, 'all'>;
  readonly assignments: Pick<MemberAssignmentRepositoryPort, 'ofAdministrator' | 'ofRoles' | 'replaceFor'>;
  readonly engine: Pick<EngineRolesPort, 'setAdministratorRoles'>;
  readonly projector: Pick<BindingProjector, 'bindingsFor' | 'releaseUnheld'>;
  readonly activity: Pick<ActivityLogService, 'record'>;
  readonly flusher: SessionFlusherPort;
  readonly ids: IdGeneratorPort;
  readonly clock: ClockPort;
}

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

/** A member's roles and store access as clients read them. */
export interface MemberAccessView {
  readonly administratorId: string;
  readonly roles: readonly { readonly id: string; readonly name: string }[];
  readonly storeAccess: MemberStoreAccess;
  readonly storeIds: readonly string[];
}

/** Everything the rules read, loaded under the lock. */
interface AccessWorld {
  readonly stores: Awaited<ReturnType<BusinessDirectoryPort['stores']>>;
  readonly activeStoreIds: readonly StoreId[];
  readonly roles: ReadonlyMap<string, BusinessRole>;
  readonly owner: BusinessRole;
  readonly businessOwnerId: number | null;
  readonly actor: Actor;
  readonly target: Actor;
  readonly before: readonly MemberAssignment[];
}

const rolesInOrder = (ids: readonly string[], roles: ReadonlyMap<string, BusinessRole>): readonly BusinessRole[] =>
  [...new Set(ids)].map((id) => {
    const role = roles.get(id);
    if (role === undefined) throw new RoleNotFoundError();
    return role;
  });

/** Sets who can do what on which stores (D53-D55, D60). P1.S4 calls {@link setAccess} from its invitation flow. */
export class MemberAccessService {
  constructor(private readonly ports: MemberAccessPorts) {}

  /**
   * Replaces the member's access in one transaction, then evicts their sessions (D55). When `ctx` already carries a
   * transaction this one joins it, and the eviction then runs before that outer commit, so the caller must flush too.
   *
   * @throws a {@link RbacError} for a member or role not found, an invalid store access, or a refusal under D60
   */
  async setAccess(ctx: OperationContext, command: SetMemberAccessCommand): Promise<MemberAccessView> {
    const view = await this.ports.transaction.run(ctx, command.actor.scope, (transactional) =>
      this.setInTransaction(transactional, command),
    );
    await this.ports.flusher.flushAdministrators([command.administratorId]);
    return view;
  }

  /** The member's access, or `undefined` when the id names nobody in this business. */
  async getAccess(
    ctx: OperationContext,
    scope: TenantScope,
    administratorId: number,
  ): Promise<MemberAccessView | undefined> {
    const { members, assignments, roles } = this.ports;
    if (!(await members.isMember(ctx, scope, administratorId))) return undefined;
    const held = await assignments.ofAdministrator(ctx, scope, administratorId);
    return this.viewOf(administratorId, held, new Map((await roles.all(ctx, scope)).map((role) => [role.id, role])));
  }

  private async setInTransaction(ctx: OperationContext, command: SetMemberAccessCommand): Promise<MemberAccessView> {
    const { scope } = command.actor;
    await this.ports.lock.acquire(ctx, scope.businessId);
    if (!(await this.ports.members.isMember(ctx, scope, command.administratorId))) throw new MemberNotFoundError();
    assertNotSelf(command.actor.administratorId, command.administratorId);
    const world = await this.loadWorld(ctx, command);
    const roles = rolesInOrder(command.roleIds, world.roles);
    const access = resolveStoreAccess(command, world.stores);
    const after = this.nextRows(command, roles, access);
    await this.checkRules(ctx, command, world, after);
    if (this.isUnchanged(world.before, after)) return this.viewOf(command.administratorId, after, world.roles);
    await this.write(ctx, command, world, after);
    return this.viewOf(command.administratorId, after, world.roles);
  }

  private async loadWorld(ctx: OperationContext, command: SetMemberAccessCommand): Promise<AccessWorld> {
    const { directory, roles: roleRows, assignments } = this.ports;
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

  private nextRows(
    command: SetMemberAccessCommand,
    roles: readonly BusinessRole[],
    access: ResolvedStoreAccess,
  ): readonly MemberAssignment[] {
    const { ids, clock } = this.ports;
    const now = clock.now();
    return roles.map((role) => ({
      id: ids.next(),
      administratorId: command.administratorId,
      businessRoleId: role.id,
      storeAccess: access.storeAccess,
      storeIds: access.storeIds.map(storeRowId),
      createdAt: now,
    }));
  }

  /** Invariant first, then who may touch Owner, then what the actor holds (D60.8, .7, .4, .3). */
  private async checkRules(
    ctx: OperationContext,
    command: SetMemberAccessCommand,
    world: AccessWorld,
    after: readonly MemberAssignment[],
  ): Promise<void> {
    const { actor, target, owner, activeStoreIds, before, roles } = world;
    const ownerBefore = before.find((row) => row.businessRoleId === owner.id);
    const ownerAfter = after.find((row) => row.businessRoleId === owner.id);
    assertOwnerKept({
      isBusinessOwner: command.administratorId === world.businessOwnerId,
      heldOwner: ownerBefore !== undefined,
      keepsOwnerOnAllStores: ownerAfter?.storeAccess === ALL_STORES_SCOPE,
      otherAllAccessHolders: await this.otherAllAccessOwners(ctx, command, owner.id),
    });
    assertOwnerChangeAllowed(actor, !sameReach(ownerBefore, ownerAfter));
    assertCanChangeTarget(actor, target);
    assertCanGrantAccess(actor, {
      wantsAllStores: command.storeAccess === ALL_STORES_SCOPE,
      grants: accessChange(before, after, activeStoreIds).map((pair) => this.grantOf(pair, roles)),
    });
  }

  private grantOf(
    { businessRoleId, storeId }: RoleOnStore,
    roles: ReadonlyMap<string, BusinessRole>,
  ): { readonly storeId: StoreId; readonly permissions: readonly PermissionKey[] } {
    return { storeId, permissions: roles.get(businessRoleId)?.permissions ?? [] };
  }

  private async otherAllAccessOwners(
    ctx: OperationContext,
    command: SetMemberAccessCommand,
    ownerRoleId: Snowflake,
  ): Promise<number> {
    const holders = await this.ports.assignments.ofRoles(ctx, command.actor.scope, [ownerRoleId]);
    return holders.filter((row) => row.administratorId !== command.administratorId && holdsAllAccess([row])).length;
  }

  private isUnchanged(before: readonly MemberAssignment[], after: readonly MemberAssignment[]): boolean {
    return (
      before.length === after.length &&
      after.every((row) =>
        sameReach(
          row,
          before.find(({ businessRoleId }) => businessRoleId === row.businessRoleId),
        ),
      )
    );
  }

  private async write(
    ctx: OperationContext,
    command: SetMemberAccessCommand,
    world: AccessWorld,
    after: readonly MemberAssignment[],
  ): Promise<void> {
    const { projector, engine, assignments } = this.ports;
    const { scope } = command.actor;
    const projected = after.map((row) => ({
      role: world.roles.get(row.businessRoleId) as BusinessRole,
      storeAccess: row.storeAccess,
      storeIds: row.storeIds,
    }));
    const vendureRoleIds = await projector.bindingsFor(ctx, scope, projected);
    await engine.setAdministratorRoles(ctx, command.administratorId, vendureRoleIds);
    await assignments.replaceFor(ctx, scope, command.administratorId, after);
    await projector.releaseUnheld(ctx, scope, world.before);
    await this.record(ctx, command, world.before, after);
  }

  private async record(
    ctx: OperationContext,
    { actor, administratorId }: SetMemberAccessCommand,
    before: readonly MemberAssignment[],
    after: readonly MemberAssignment[],
  ): Promise<void> {
    await this.ports.activity.record(ctx, {
      scope: actor.scope,
      actorAdministratorId: actor.administratorId,
      action: ACTIVITY_ACTIONS.MEMBER_ACCESS_CHANGED,
      entityType: 'member',
      entityId: String(administratorId),
      summary: 'Member access changed',
      diff: { before: this.diffSide(before), after: this.diffSide(after) },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  private diffSide(rows: readonly MemberAssignment[]): Readonly<Record<string, unknown>> {
    return {
      roleIds: rows.map((row) => row.businessRoleId),
      storeAccess: rows[0]?.storeAccess ?? null,
      storeIds: rows[0]?.storeIds ?? [],
    };
  }

  private viewOf(
    administratorId: number,
    rows: readonly MemberAssignment[],
    roles: ReadonlyMap<string, BusinessRole>,
  ): MemberAccessView {
    return {
      administratorId: String(administratorId),
      roles: rows.flatMap((row) => {
        const role = roles.get(row.businessRoleId);
        return role === undefined ? [] : [{ id: role.id, name: role.name }];
      }),
      storeAccess: rows[0]?.storeAccess ?? 'selected',
      storeIds: rows[0]?.storeIds ?? [],
    };
  }
}
