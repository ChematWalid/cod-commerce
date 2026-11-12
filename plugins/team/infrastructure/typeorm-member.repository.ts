import { type TenantRepository, TenantRepositoryFactory, tenantQuery } from '@cod/plugin-tenancy';
import { type Snowflake, type TenantScope, toBusinessId, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type { MemberGrant } from '../domain/member-grant';
import type { MemberRepositoryPort, TeamMemberPatch } from '../domain/ports/member-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamMember } from '../domain/team-member';
import { requestScope } from './request-scope';
import { TeamMemberEntity } from './team-member.entity';

const grantOf = (stored: MemberGrant | null): MemberGrant | null =>
  stored === null
    ? null
    : {
        roleIds: stored.roleIds.map(toSnowflake),
        storeAccess: stored.storeAccess,
        storeIds: stored.storeIds.map(toSnowflake),
      };

function toMember(row: TeamMemberEntity): TeamMember {
  return {
    id: toSnowflake(row.id),
    businessId: toBusinessId(row.businessId),
    administratorId: row.administratorId,
    email: row.email,
    emailKey: row.emailKey,
    firstName: row.firstName,
    lastName: row.lastName,
    status: row.status,
    suspendedAccess: grantOf(row.suspendedAccess),
    commissionConfigIds: row.commissionConfigIds.map(toSnowflake),
    baseSalary: row.baseSalary,
    maxOpenOrders: row.maxOpenOrders,
    receivingOrders: row.receivingOrders,
    invitedByAdministratorId: row.invitedByAdministratorId,
    invitedAt: row.invitedAt,
    joinedAt: row.joinedAt,
    removedAt: row.removedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const grantRow = (grant: MemberGrant | null): MemberGrant | null =>
  grant === null
    ? null
    : { roleIds: [...grant.roleIds], storeAccess: grant.storeAccess, storeIds: [...grant.storeIds] };

/** A domain patch as a row patch: TypeORM wants mutable arrays and a plain JSON value. */
function toRowPatch(patch: TeamMemberPatch): QueryDeepPartialEntity<TeamMemberEntity> {
  const { commissionConfigIds, suspendedAccess, ...fields } = patch;
  return {
    ...fields,
    ...(commissionConfigIds === undefined ? {} : { commissionConfigIds: [...commissionConfigIds] }),
    ...(suspendedAccess === undefined ? {} : { suspendedAccess: grantRow(suspendedAccess) }),
  };
}

/** The Postgres adapter of {@link MemberRepositoryPort}, on `TenantRepository` (ADR 0002). */
@Injectable()
export class TypeOrmMemberRepository implements MemberRepositoryPort {
  private readonly rows: TenantRepository<TeamMemberEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.rows = repositories.for(TeamMemberEntity);
  }

  async insert(ctx: OperationContext, scope: TenantScope, member: TeamMember): Promise<void> {
    await this.rows.insert(requestScope(ctx, scope), {
      ...member,
      suspendedAccess: grantRow(member.suspendedAccess),
      commissionConfigIds: [...member.commissionConfigIds],
    });
  }

  async findById(ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<TeamMember | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { id });
    return row === null ? undefined : toMember(row);
  }

  async findForUpdate(ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<TeamMember | undefined> {
    const row = await tenantQuery(requestScope(ctx, scope), this.rows, 'member')
      .andWhere('member.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    return row === null ? undefined : toMember(row);
  }

  async listLive(ctx: OperationContext, scope: TenantScope): Promise<readonly TeamMember[]> {
    const rows = await this.rows.find(requestScope(ctx, scope), { where: { removedAt: IsNull() } });
    return rows.map(toMember);
  }

  async findLiveByEmailKey(
    ctx: OperationContext,
    scope: TenantScope,
    emailKey: string,
  ): Promise<TeamMember | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { emailKey, removedAt: IsNull() });
    return row === null ? undefined : toMember(row);
  }

  async findByAdministratorId(
    ctx: OperationContext,
    scope: TenantScope,
    administratorId: number,
  ): Promise<TeamMember | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { administratorId });
    return row === null ? undefined : toMember(row);
  }

  async update(ctx: OperationContext, scope: TenantScope, id: Snowflake, patch: TeamMemberPatch): Promise<boolean> {
    const changed = await this.rows.update(requestScope(ctx, scope), { id }, toRowPatch(patch));
    return changed > 0;
  }
}
