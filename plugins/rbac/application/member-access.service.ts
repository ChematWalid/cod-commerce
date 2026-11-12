import { ACTIVITY_ACTIONS, type TenantScope } from '@cod/shared';
import type { BusinessRole, MemberAssignment } from '../domain/business-role';
import type { MemberStoreAccess } from '../domain/constants';
import { MemberNotFoundError, MemberSuspendedError } from '../domain/errors';
import { assertNotSelf } from '../domain/escalation-rules';
import type { ActorDirectoryPort } from '../domain/ports/actor-directory.port';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { BusinessRoleRepositoryPort } from '../domain/ports/business-role-repository.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { EngineRolesPort } from '../domain/ports/engine-roles.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { MemberSuspensionCheck } from '../domain/ports/member-suspension.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { RbacLockPort } from '../domain/ports/rbac-lock.port';
import type { SessionFlusherPort } from '../domain/ports/session-flusher.port';
import type { TransactionPort } from '../domain/ports/transaction.port';
import { type ResolvedStoreAccess, resolveStoreAccess, sameReach, storeRowId } from '../domain/store-access';
import {
  type AccessWorld,
  checkAccessRules,
  loadAccessWorld,
  rolesInOrder,
  type SetMemberAccessCommand,
} from './access-world';
import type { ActivityLogService } from './activity-log.service';
import type { BindingProjector } from './binding-projector.service';

export type { MemberAccessActor, SetMemberAccessCommand } from './access-world';

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
  readonly suspension: MemberSuspensionCheck;
  readonly ids: IdGeneratorPort;
  readonly clock: ClockPort;
}

/** A member's roles and store access as clients read them. */
export interface MemberAccessView {
  readonly administratorId: string;
  readonly roles: readonly { readonly id: string; readonly name: string }[];
  readonly storeAccess: MemberStoreAccess;
  readonly storeIds: readonly string[];
}

/** Sets who can do what on which stores (D53-D55, D60). P1.S4 calls {@link setAccess} from its invitation flow. */
export class MemberAccessService {
  constructor(private readonly ports: MemberAccessPorts) {}

  /**
   * Replaces the member's access in one transaction, then evicts their sessions (D55). When `ctx` already carries a
   * transaction this one joins it, and the eviction then runs before that outer commit, so the caller must call
   * {@link flushSessionsOf} once it commits. Withdrawing every role of a suspended member is allowed; granting is not.
   *
   * @throws a {@link RbacError} for a member or role not found, an invalid store access, a refusal under D60, or
   *   {@link MemberSuspendedError} for roles granted to a member a registered check reports suspended (D204)
   */
  async setAccess(ctx: OperationContext, command: SetMemberAccessCommand): Promise<MemberAccessView> {
    const view = await this.ports.transaction.run(ctx, command.actor.scope, (transactional) =>
      this.setInTransaction(transactional, command),
    );
    await this.ports.flusher.flushAdministrators([command.administratorId]);
    return view;
  }

  /**
   * Evicts the cached sessions of these administrators (D55). A caller that ran {@link setAccess} inside its own
   * transaction calls it after that transaction commits.
   */
  async flushSessionsOf(administratorIds: readonly number[]): Promise<void> {
    await this.ports.flusher.flushAdministrators(administratorIds);
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

  /**
   * Every live administrator of the business holding at least one role, once each, in ascending order. Team adopts
   * them as members (D215); a soft-deleted holder is not listed (audit RBAC-3).
   */
  async memberAdministratorIds(ctx: OperationContext, scope: TenantScope): Promise<readonly number[]> {
    const roleIds = (await this.ports.roles.all(ctx, scope)).map((role) => role.id);
    if (roleIds.length === 0) return [];
    const rows = await this.ports.assignments.ofRoles(ctx, scope, roleIds);
    return [...new Set(rows.map((row) => row.administratorId))].sort((left, right) => left - right);
  }

  /** The name of every role of the business, by role id. Team names the roles of invitations and snapshots (D204). */
  async roleNames(ctx: OperationContext, scope: TenantScope): Promise<ReadonlyMap<string, string>> {
    return new Map((await this.ports.roles.all(ctx, scope)).map((role) => [role.id as string, role.name]));
  }

  /**
   * The access of every live role holder of the business, by administrator id, read in two queries whatever the
   * team size: Team's members list shows and filters by it (D211). An administrator holding no role is absent.
   */
  async accessOfHolders(ctx: OperationContext, scope: TenantScope): Promise<ReadonlyMap<number, MemberAccessView>> {
    const all = await this.ports.roles.all(ctx, scope);
    if (all.length === 0) return new Map();
    const rows = await this.ports.assignments.ofRoles(
      ctx,
      scope,
      all.map((role) => role.id),
    );
    const byHolder = new Map<number, MemberAssignment[]>();
    for (const row of rows) byHolder.set(row.administratorId, [...(byHolder.get(row.administratorId) ?? []), row]);
    const roles = new Map<string, BusinessRole>(all.map((role) => [role.id, role]));
    return new Map(
      [...byHolder].map(([administratorId, held]) => [administratorId, this.viewOf(administratorId, held, roles)]),
    );
  }

  private async setInTransaction(ctx: OperationContext, command: SetMemberAccessCommand): Promise<MemberAccessView> {
    const { scope } = command.actor;
    await this.ports.lock.acquire(ctx, scope.businessId);
    if (!(await this.ports.members.isMember(ctx, scope, command.administratorId))) throw new MemberNotFoundError();
    assertNotSelf(command.actor.administratorId, command.administratorId);
    const world = await loadAccessWorld(this.ports, ctx, command);
    const roles = rolesInOrder(command.roleIds, world.roles);
    const access = resolveStoreAccess(command, world.stores);
    const after = this.nextRows(command, roles, access);
    await checkAccessRules(this.ports, ctx, { command, world, after });
    // After the D60 rules, so only an actor allowed to make the change learns the member is suspended (D211).
    if (command.roleIds.length > 0 && (await this.ports.suspension.isSuspended(ctx, scope, command.administratorId))) {
      throw new MemberSuspendedError();
    }
    if (this.isUnchanged(world.before, after)) return this.viewOf(command.administratorId, after, world.roles);
    await this.write(ctx, command, world, after);
    return this.viewOf(command.administratorId, after, world.roles);
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
