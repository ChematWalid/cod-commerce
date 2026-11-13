import type { Snowflake, TenantScope } from '@cod/shared';
import type { MemberAssignment } from '../domain/business-role';
import type { ActorDirectoryPort } from '../domain/ports/actor-directory.port';
import type { MemberAssignmentRepositoryPort } from '../domain/ports/member-assignment-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';

/**
 * The assignment rows as the rules must read them (audit RBAC-3): a soft-deleted administrator keeps its rows, but
 * holds no role, does not keep a role "in use" and is not another Owner holder. Writes and the flush-only
 * `allStoresAdministratorIds` pass straight through, since evicting a departed session is harmless.
 */
export class LiveMemberAssignments implements MemberAssignmentRepositoryPort {
  constructor(
    private readonly rows: MemberAssignmentRepositoryPort,
    private readonly actors: Pick<ActorDirectoryPort, 'liveAdministratorIds'>,
  ) {}

  insert(ctx: OperationContext, scope: TenantScope, assignment: MemberAssignment): Promise<void> {
    return this.rows.insert(ctx, scope, assignment);
  }

  isAssigned(
    ctx: OperationContext,
    scope: TenantScope,
    administratorId: number,
    businessRoleId: Snowflake,
  ): Promise<boolean> {
    return this.rows.isAssigned(ctx, scope, administratorId, businessRoleId);
  }

  async ofAdministrator(
    ctx: OperationContext,
    scope: TenantScope,
    administratorId: number,
  ): Promise<readonly MemberAssignment[]> {
    const live = await this.actors.liveAdministratorIds(ctx, scope, [administratorId]);
    return live.length === 0 ? [] : this.rows.ofAdministrator(ctx, scope, administratorId);
  }

  async ofRoles(
    ctx: OperationContext,
    scope: TenantScope,
    businessRoleIds: readonly Snowflake[],
  ): Promise<readonly MemberAssignment[]> {
    const rows = await this.rows.ofRoles(ctx, scope, businessRoleIds);
    const live = await this.liveAmong(
      ctx,
      scope,
      rows.map((row) => row.administratorId),
    );
    return rows.filter((row) => live.has(row.administratorId));
  }

  replaceFor(
    ctx: OperationContext,
    scope: TenantScope,
    administratorId: number,
    assignments: readonly MemberAssignment[],
  ): Promise<void> {
    return this.rows.replaceFor(ctx, scope, administratorId, assignments);
  }

  async holdersOf(
    ctx: OperationContext,
    scope: TenantScope,
    businessRoleIds: readonly Snowflake[],
  ): Promise<readonly number[]> {
    const holders = await this.rows.holdersOf(ctx, scope, businessRoleIds);
    const live = await this.liveAmong(ctx, scope, holders);
    return holders.filter((id) => live.has(id));
  }

  allStoresAdministratorIds(ctx: OperationContext, scope: TenantScope): Promise<readonly number[]> {
    return this.rows.allStoresAdministratorIds(ctx, scope);
  }

  private async liveAmong(
    ctx: OperationContext,
    scope: TenantScope,
    ids: readonly number[],
  ): Promise<ReadonlySet<number>> {
    return new Set(await this.actors.liveAdministratorIds(ctx, scope, [...new Set(ids)]));
  }
}
