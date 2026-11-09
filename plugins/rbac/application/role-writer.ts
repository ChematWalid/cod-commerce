import { MAX_CUSTOM_ROLES_PER_BUSINESS, type PermissionKey, type StoreId, type TenantContext } from '@cod/shared';
import type { BusinessRole, RoleBinding } from '../domain/business-role';
import { ALL_STORES_SCOPE } from '../domain/constants';
import { RoleLimitError, RoleNameTakenError, RoleNotFoundError } from '../domain/errors';
import type { ActivityEntryInput } from '../domain/activity';
import type { RoleEdit } from '../domain/escalation-rules';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { BusinessRoleRepositoryPort } from '../domain/ports/business-role-repository.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { RbacLockPort } from '../domain/ports/rbac-lock.port';
import type { RoleBindingRepositoryPort } from '../domain/ports/role-binding-repository.port';
import type { SessionFlusherPort } from '../domain/ports/session-flusher.port';
import type { TransactionPort } from '../domain/ports/transaction.port';
import { activeStoreIdsOf, type Actor, buildActor, reachOf } from '../domain/store-access';
import type { ActivityLogService } from './activity-log.service';

/** What role use cases read and write through. */
export interface RoleWriterPorts {
  readonly transaction: TransactionPort;
  readonly lock: RbacLockPort;
  readonly roles: BusinessRoleRepositoryPort;
  readonly bindings: Pick<RoleBindingRepositoryPort, 'allBindings'>;
  readonly assignments: Pick<MemberAssignmentRepositoryPort, 'ofAdministrator' | 'holdersOf' | 'isAssigned'>;
  readonly directory: Pick<BusinessDirectoryPort, 'stores'>;
  readonly activity: Pick<ActivityLogService, 'record'>;
  readonly flusher: SessionFlusherPort;
  readonly ids: IdGeneratorPort;
  readonly clock: ClockPort;
}

/** Who is writing a role and from where. */
export interface RoleActor {
  readonly administratorId: number;
  readonly tenant: TenantContext;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

/** Everything the rules read, loaded under the lock (D60, D70). */
export interface RoleWorld {
  readonly roles: readonly BusinessRole[];
  readonly bindings: readonly RoleBinding[];
  readonly actor: Actor;
  readonly activeStoreIds: readonly StoreId[];
}

/** What a write answers, and whose sessions to evict once it has committed (D55). */
export interface RoleWriteOutcome<T> {
  readonly result: T;
  readonly flush: readonly number[];
}

type ActivityFields = Pick<ActivityEntryInput, 'action' | 'entityId' | 'summary' | 'diff'>;

/** The frame every role write runs in: transaction, lock, rows read under it, then the eviction after commit. */
export class RoleWriter {
  constructor(readonly ports: RoleWriterPorts) {}

  /** Runs `work` under the business's lock; a throw rolls it back and evicts nothing. */
  async write<T>(
    ctx: OperationContext,
    actor: RoleActor,
    work: (transactional: OperationContext, world: RoleWorld) => Promise<RoleWriteOutcome<T>>,
  ): Promise<T> {
    const { transaction, lock, flusher } = this.ports;
    const { result, flush } = await transaction.run(ctx, actor.tenant, async (transactional) => {
      await lock.acquire(transactional, actor.tenant.businessId);
      return work(transactional, await this.load(transactional, actor));
    });
    await flusher.flushAdministrators(flush);
    return result;
  }

  /** @throws {@link RoleNotFoundError} when the id names no role of this business */
  requireRole(world: RoleWorld, id: string): BusinessRole {
    const role = world.roles.find((candidate) => candidate.id === id);
    if (role === undefined) throw new RoleNotFoundError();
    return role;
  }

  /** @throws {@link RoleNameTakenError} when another role has this key */
  assertNameFree(world: RoleWorld, nameKey: string, ownId?: string): void {
    if (world.roles.some((role) => role.nameKey === nameKey && role.id !== ownId)) throw new RoleNameTakenError();
  }

  /** @throws {@link RoleLimitError} when the business cannot hold one more custom role */
  assertRoomForRole(world: RoleWorld): void {
    const custom = world.roles.filter((role) => role.builtInKey === null).length;
    if (custom >= MAX_CUSTOM_ROLES_PER_BUSINESS) throw new RoleLimitError();
  }

  bindingsOf(world: RoleWorld, roleId: string): readonly RoleBinding[] {
    return world.bindings.filter((binding) => binding.businessRoleId === roleId);
  }

  /** What D60.2 judges about an edit of `role` to `next`. */
  editOf(world: RoleWorld, actor: RoleActor, role: BusinessRole, next: readonly PermissionKey[]): RoleEdit {
    const scopes = this.bindingsOf(world, role.id).map((binding) => binding.scope);
    return {
      reach: reachOf(scopes, world.activeStoreIds),
      allStoresBound: scopes.includes(ALL_STORES_SCOPE),
      activeStoreId: actor.tenant.activeStoreId,
      current: role.permissions,
      next,
    };
  }

  /** Records the change in the transaction `ctx` carries, so a failed append undoes it. */
  record(ctx: OperationContext, actor: RoleActor, fields: ActivityFields): Promise<void> {
    return this.ports.activity.record(ctx, {
      ...fields,
      scope: actor.tenant,
      actorAdministratorId: actor.administratorId,
      entityType: 'role',
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }

  private async load(ctx: OperationContext, actor: RoleActor): Promise<RoleWorld> {
    const { roles, bindings, assignments, directory } = this.ports;
    const scope = actor.tenant;
    const activeStoreIds = activeStoreIdsOf(await directory.stores(ctx, scope.businessId));
    const allRoles = await roles.all(ctx, scope);
    const actorRows = await assignments.ofAdministrator(ctx, scope, actor.administratorId);
    return {
      roles: allRoles,
      bindings: await bindings.allBindings(ctx, scope),
      activeStoreIds,
      actor: buildActor(
        actor.administratorId,
        actorRows,
        new Map(allRoles.map((role) => [role.id as string, role])),
        activeStoreIds,
      ),
    };
  }
}
