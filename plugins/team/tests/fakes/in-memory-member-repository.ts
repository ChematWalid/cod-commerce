import type { Snowflake, TenantScope } from '@cod/shared';
import type { MemberRepositoryPort, TeamMemberPatch } from '../../domain/ports/member-repository.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { TeamMember } from '../../domain/team-member';

/** Raised as Postgres would on the partial unique indexes of `team_member`. */
export class UniqueMemberViolation extends Error {
  constructor(index: string) {
    super(`duplicate key value violates unique constraint "${index}"`);
    this.name = 'UniqueMemberViolation';
  }
}

/** Members in memory, with the same unique rules as the table; it passes the repository contract. */
export class InMemoryMemberRepository implements MemberRepositoryPort {
  readonly rows: TeamMember[] = [];

  insert(_ctx: OperationContext, scope: TenantScope, member: TeamMember): Promise<void> {
    const ofBusiness = this.rows.filter((row) => row.businessId === scope.businessId);
    if (
      ofBusiness.some((row) => row.removedAt === null && member.removedAt === null && row.emailKey === member.emailKey)
    ) {
      return Promise.reject(new UniqueMemberViolation('team_member_email_key'));
    }
    if (member.administratorId !== null && ofBusiness.some((row) => row.administratorId === member.administratorId)) {
      return Promise.reject(new UniqueMemberViolation('team_member_administrator'));
    }
    this.rows.push({ ...member, businessId: scope.businessId });
    return Promise.resolve();
  }

  findById(_ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<TeamMember | undefined> {
    return Promise.resolve(this.find(scope, (row) => row.id === id));
  }

  listLive(_ctx: OperationContext, scope: TenantScope): Promise<readonly TeamMember[]> {
    return Promise.resolve(this.rows.filter((row) => row.businessId === scope.businessId && row.removedAt === null));
  }

  findLiveByEmailKey(_ctx: OperationContext, scope: TenantScope, emailKey: string): Promise<TeamMember | undefined> {
    return Promise.resolve(this.find(scope, (row) => row.removedAt === null && row.emailKey === emailKey));
  }

  findByAdministratorId(
    _ctx: OperationContext,
    scope: TenantScope,
    administratorId: number,
  ): Promise<TeamMember | undefined> {
    return Promise.resolve(this.find(scope, (row) => row.administratorId === administratorId));
  }

  update(_ctx: OperationContext, scope: TenantScope, id: Snowflake, patch: TeamMemberPatch): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.businessId === scope.businessId && row.id === id);
    const current = this.rows[index];
    if (current === undefined) return Promise.resolve(false);
    this.rows[index] = { ...current, ...patch };
    return Promise.resolve(true);
  }

  private find(scope: TenantScope, matches: (row: TeamMember) => boolean): TeamMember | undefined {
    return this.rows.find((row) => row.businessId === scope.businessId && matches(row));
  }
}
